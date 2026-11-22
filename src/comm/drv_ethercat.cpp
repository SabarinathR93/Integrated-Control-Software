#define COMM_DRIVER_EXPORTS
#include "comm_common.hpp"
#include <iphlpapi.h>

#include <mutex>
#include <vector>

namespace {

// Minimal Npcap (wpcap.dll) dynamic function pointers so drv_ethercat.dll builds
// cleanly without requiring Npcap SDK headers at compile time.
typedef void* (*PFN_pcap_open_live)(const char* device, int snaplen, int promisc, int to_ms, char* errbuf);
typedef void (*PFN_pcap_close)(void* p);
typedef int (*PFN_pcap_sendpacket)(void* p, const unsigned char* buf, int size);
typedef int (*PFN_pcap_next_ex)(void* p, void** pkt_header, const unsigned char** pkt_data);

struct PcapPktHdr {
    long tv_sec;
    long tv_usec;
    unsigned int caplen;
    unsigned int len;
};

struct EthercatConn {
    std::mutex mtx;
    bool connected = false;
    std::string adapterName;
    uint8_t srcMac[6]{ 0x02, 0x00, 0x00, 0x00, 0x00, 0x01 };
    HMODULE hWpcap = nullptr;
    void* pcapHandle = nullptr;
    PFN_pcap_close pClose = nullptr;
    PFN_pcap_sendpacket pSend = nullptr;
    PFN_pcap_next_ex pNextEx = nullptr;
    uint8_t idx = 1;
    std::vector<uint8_t> pdoImage = std::vector<uint8_t>(64, 0);
};

std::string findFirstEthernetAdapter(uint8_t outMac[6]) {
    ULONG bufLen = 15000;
    std::vector<uint8_t> buf(bufLen);
    auto* addrs = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buf.data());
    if (GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_INCLUDE_PREFIX, nullptr, addrs, &bufLen) == ERROR_BUFFER_OVERFLOW) {
        buf.resize(bufLen);
        addrs = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buf.data());
    }
    if (GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_INCLUDE_PREFIX, nullptr, addrs, &bufLen) != NO_ERROR) {
        return "";
    }
    for (auto* a = addrs; a != nullptr; a = a->Next) {
        if (a->IfType == IF_TYPE_ETHERNET_CSMACD && a->OperStatus == IfOperStatusUp && a->PhysicalAddressLength == 6) {
            std::memcpy(outMac, a->PhysicalAddress, 6);
            return std::string("\\Device\\NPF_") + a->AdapterName;
        }
    }
    return "";
}

// Build Layer-2 EtherCAT frame (EtherType 0x88A4) for LRD/LWR/APRD
std::vector<uint8_t> buildEcatFrame(const uint8_t srcMac[6], uint8_t cmd, uint8_t idx, uint16_t adp, uint16_t ado, const uint8_t* data, uint16_t dataLen) {
    uint16_t dgramLen = static_cast<uint16_t>(10 + dataLen + 2);
    uint16_t ecatHdr = static_cast<uint16_t>((dgramLen & 0x07FF) | (0x1 << 12)); // Type 1 = EtherCAT
    std::vector<uint8_t> frame(14 + 2 + dgramLen, 0);
    // Broadcast dest MAC
    std::memset(frame.data(), 0xFF, 6);
    std::memcpy(frame.data() + 6, srcMac, 6);
    frame[12] = 0x88; frame[13] = 0xA4; // EtherCAT EtherType
    frame[14] = static_cast<uint8_t>(ecatHdr & 0xFF);
    frame[15] = static_cast<uint8_t>((ecatHdr >> 8) & 0xFF);

    uint8_t* dg = frame.data() + 16;
    dg[0] = cmd;
    dg[1] = idx;
    dg[2] = static_cast<uint8_t>(adp & 0xFF);
    dg[3] = static_cast<uint8_t>((adp >> 8) & 0xFF);
    dg[4] = static_cast<uint8_t>(ado & 0xFF);
    dg[5] = static_cast<uint8_t>((ado >> 8) & 0xFF);
    dg[6] = static_cast<uint8_t>(dataLen & 0xFF);
    dg[7] = static_cast<uint8_t>((dataLen >> 8) & 0x7F);
    dg[8] = 0; dg[9] = 0; // IRQ
    if (data && dataLen > 0) {
        std::memcpy(dg + 10, data, dataLen);
    }
    if (frame.size() < 60) frame.resize(60, 0); // Minimum Ethernet frame
    return frame;
}

} // namespace

COMM_API int32_t Comm_GetDriverInfo(CommDriverInfo* outInfo) {
    if (!outInfo) return -1;
    std::memset(outInfo, 0, sizeof(*outInfo));
    outInfo->apiVersion = COMM_API_VERSION;
    std::snprintf(outInfo->id, sizeof(outInfo->id), "ethercat");
    std::snprintf(outInfo->name, sizeof(outInfo->name), "EtherCAT Master (Layer-2 / Npcap)");
    std::snprintf(outInfo->version, sizeof(outInfo->version), "1.0.0");
    outInfo->transportMask = COMM_TRANSPORT_ETHERNET_RAW;
    outInfo->defaultPort = 0;
    return 0;
}

COMM_API int32_t Comm_Connect(const char* configJson, void** outHandle, char* errBuf, int32_t errBufLen) {
    if (!outHandle) return -1;
    *outHandle = nullptr;

    std::string cfg = (configJson && *configJson) ? configJson : "{}";

    auto* c = new EthercatConn();
    c->adapterName = comm_util::cfgStr(cfg, "adapter", "");
    if (c->adapterName.empty()) {
        c->adapterName = findFirstEthernetAdapter(c->srcMac);
    }

    // Load Npcap wpcap.dll dynamically at runtime
    SetDllDirectoryA("C:\\Windows\\System32\\Npcap");
    c->hWpcap = LoadLibraryA("wpcap.dll");
    SetDllDirectoryA(nullptr);
    if (!c->hWpcap) {
        comm_util::setErr(errBuf, errBufLen, "Npcap (wpcap.dll) is not installed on this PC. Install Npcap for raw EtherCAT.");
        delete c;
        return -1;
    }

    auto pOpen = reinterpret_cast<PFN_pcap_open_live>(GetProcAddress(c->hWpcap, "pcap_open_live"));
    c->pClose = reinterpret_cast<PFN_pcap_close>(GetProcAddress(c->hWpcap, "pcap_close"));
    c->pSend = reinterpret_cast<PFN_pcap_sendpacket>(GetProcAddress(c->hWpcap, "pcap_sendpacket"));
    c->pNextEx = reinterpret_cast<PFN_pcap_next_ex>(GetProcAddress(c->hWpcap, "pcap_next_ex"));
    if (!pOpen || !c->pClose || !c->pSend || !c->pNextEx || c->adapterName.empty()) {
        comm_util::setErr(errBuf, errBufLen, "Failed to resolve Npcap symbols or no active Ethernet NIC found");
        FreeLibrary(c->hWpcap);
        delete c;
        return -1;
    }

    char pcapErr[256]{};
    c->pcapHandle = pOpen(c->adapterName.c_str(), 1518, 1, 5, pcapErr);
    if (!c->pcapHandle) {
        comm_util::setErr(errBuf, errBufLen, std::string("pcap_open_live failed: ") + pcapErr);
        FreeLibrary(c->hWpcap);
        delete c;
        return -1;
    }

    c->connected = true;
    *outHandle = c;
    return 0;
}

COMM_API int32_t Comm_Disconnect(void* handle) {
    auto* c = static_cast<EthercatConn*>(handle);
    if (!c) return 0;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (c->pcapHandle && c->pClose) {
            c->pClose(c->pcapHandle);
            c->pcapHandle = nullptr;
        }
        if (c->hWpcap) {
            FreeLibrary(c->hWpcap);
            c->hWpcap = nullptr;
        }
        c->connected = false;
    }
    delete c;
    return 0;
}

COMM_API int32_t Comm_GetStatus(void* handle, int32_t* outConnected, char* statusBuf, int32_t statusBufLen) {
    auto* c = static_cast<EthercatConn*>(handle);
    if (!c) {
        if (outConnected) *outConnected = 0;
        comm_util::setErr(statusBuf, statusBufLen, "Disconnected");
        return 0;
    }
    std::lock_guard<std::mutex> lock(c->mtx);
    if (outConnected) *outConnected = c->connected ? 1 : 0;
    comm_util::setErr(statusBuf, statusBufLen, c->connected ? ("EtherCAT NIC " + c->adapterName) : "Disconnected");
    return 0;
}

COMM_API int32_t Comm_ReadTag(void* handle, const char* address, CommTagValue* outValue, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<EthercatConn*>(handle);
    if (!c || !outValue) return -1;
    std::memset(outValue, 0, sizeof(*outValue));

    // Address format: "PDO:0" (byte offset) or "SDO:1:6040:00"
    std::string s = comm_util::toUpperTrim(address);
    uint32_t offset = 0;
    if (s.rfind("PDO:", 0) == 0) {
        offset = static_cast<uint32_t>(std::strtoul(s.substr(4).c_str(), nullptr, 10));
    } else if (s.size() > 1 && (s[0] == 'I' || s[0] == 'Q')) {
        offset = static_cast<uint32_t>(std::strtoul(s.substr(1).c_str(), nullptr, 10));
    } else {
        comm_util::setErr(errBuf, errBufLen, "Use PDO:<byteOffset>, I<offset>, or Q<offset>");
        return -1;
    }

    std::lock_guard<std::mutex> lock(c->mtx);
    // Send LRD (cmd 0x0A) cyclic process data frame
    auto frame = buildEcatFrame(c->srcMac, 0x0A, c->idx++, 0x0000, static_cast<uint16_t>(offset), nullptr, 2);
    if (c->pSend(c->pcapHandle, frame.data(), static_cast<int>(frame.size())) != 0) {
        comm_util::setErr(errBuf, errBufLen, "EtherCAT pcap_sendpacket failed");
        return -1;
    }

    void* hdr = nullptr;
    const unsigned char* pkt = nullptr;
    for (int tries = 0; tries < 8; ++tries) {
        int rc = c->pNextEx(c->pcapHandle, &hdr, &pkt);
        if (rc == 1 && pkt && static_cast<PcapPktHdr*>(hdr)->caplen >= 28 && pkt[12] == 0x88 && pkt[13] == 0xA4) {
            uint16_t val = static_cast<uint16_t>(pkt[26] | (pkt[27] << 8));
            outValue->dataType = COMM_TYPE_UINT16;
            outValue->quality = 1;
            outValue->num.u32Val = val;
            return 0;
        }
    }
    comm_util::setErr(errBuf, errBufLen, "EtherCAT LRD response timeout");
    return -1;
}

COMM_API int32_t Comm_WriteTag(void* handle, const char* address, const CommTagValue* value, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<EthercatConn*>(handle);
    if (!c || !value) return -1;

    std::string s = comm_util::toUpperTrim(address);
    uint32_t offset = 0;
    if (s.rfind("PDO:", 0) == 0) {
        offset = static_cast<uint32_t>(std::strtoul(s.substr(4).c_str(), nullptr, 10));
    } else if (s.size() > 1 && s[0] == 'Q') {
        offset = static_cast<uint32_t>(std::strtoul(s.substr(1).c_str(), nullptr, 10));
    } else {
        comm_util::setErr(errBuf, errBufLen, "Use PDO:<byteOffset> or Q<offset> for EtherCAT write");
        return -1;
    }

    uint8_t data[2] = {
        static_cast<uint8_t>(value->num.u32Val & 0xFF),
        static_cast<uint8_t>((value->num.u32Val >> 8) & 0xFF)
    };
    std::lock_guard<std::mutex> lock(c->mtx);
    auto frame = buildEcatFrame(c->srcMac, 0x0B, c->idx++, 0x0000, static_cast<uint16_t>(offset), data, 2); // LWR
    if (c->pSend(c->pcapHandle, frame.data(), static_cast<int>(frame.size())) != 0) {
        comm_util::setErr(errBuf, errBufLen, "EtherCAT LWR send failed");
        return -1;
    }
    return 0;
}
