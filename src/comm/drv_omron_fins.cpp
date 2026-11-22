#define COMM_DRIVER_EXPORTS
#include "comm_common.hpp"

#include <mutex>
#include <vector>

namespace {

struct FinsConn {
    std::mutex mtx;
    bool connected = false;
    std::string host = "192.168.1.10";
    int port = 9600;
    int timeoutMs = 1500;
    uint8_t clientNode = 0;
    uint8_t serverNode = 0;
    uint8_t sid = 1;
    SOCKET sock = INVALID_SOCKET;
};

bool parseFinsAddr(const char* rawAddr, uint8_t& areaCode, uint16_t& wordAddr, uint8_t& bitAddr, bool& isBit) {
    std::string s = comm_util::toUpperTrim(rawAddr);
    if (s.size() < 2) return false;
    isBit = false;
    bitAddr = 0;

    std::string numStr;
    if (s.rfind("DM", 0) == 0) { areaCode = 0x82; numStr = s.substr(2); }
    else if (s[0] == 'D') { areaCode = 0x82; numStr = s.substr(1); }
    else if (s.rfind("CIO", 0) == 0) { areaCode = 0xB0; numStr = s.substr(3); }
    else if (s.rfind("WR", 0) == 0) { areaCode = 0xB1; numStr = s.substr(2); }
    else if (s[0] == 'W') { areaCode = 0xB1; numStr = s.substr(1); }
    else if (s.rfind("HR", 0) == 0) { areaCode = 0xB2; numStr = s.substr(2); }
    else if (s[0] == 'H') { areaCode = 0xB2; numStr = s.substr(1); }
    else return false;

    auto dot = numStr.find('.');
    if (dot != std::string::npos) {
        isBit = true;
        wordAddr = static_cast<uint16_t>(std::atoi(numStr.substr(0, dot).c_str()));
        bitAddr = static_cast<uint8_t>(std::atoi(numStr.substr(dot + 1).c_str()));
        areaCode = static_cast<uint8_t>(areaCode - 0x80); // Bit area code (0x02, 0x30, 0x31, 0x32)
    } else {
        wordAddr = static_cast<uint16_t>(std::atoi(numStr.c_str()));
    }
    return true;
}

bool finsHandshake(FinsConn* c, char* errBuf, int32_t errBufLen) {
    uint8_t req[20] = {
        'F','I','N','S',
        0x00,0x00,0x00,0x0C,
        0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00 // auto node
    };
    if (!comm_util::sendAll(c->sock, req, 20)) {
        comm_util::setErr(errBuf, errBufLen, "FINS/TCP handshake send failed");
        return false;
    }
    uint8_t resp[24]{};
    if (!comm_util::recvExact(c->sock, resp, 24) || std::memcmp(resp, "FINS", 4) != 0) {
        comm_util::setErr(errBuf, errBufLen, "FINS/TCP handshake response invalid");
        return false;
    }
    c->clientNode = resp[19];
    c->serverNode = resp[23];
    return true;
}

bool exchangeFins(FinsConn* c, const std::vector<uint8_t>& finsCmd, std::vector<uint8_t>& outData, char* errBuf, int32_t errBufLen) {
    // FINS/TCP frame header (16 bytes) + FINS header (10 bytes) + command
    uint32_t tcpLen = static_cast<uint32_t>(8 + 10 + finsCmd.size());
    std::vector<uint8_t> pkt(16 + 10 + finsCmd.size(), 0);
    pkt[0]='F'; pkt[1]='I'; pkt[2]='N'; pkt[3]='S';
    pkt[4]=static_cast<uint8_t>((tcpLen>>24)&0xFF);
    pkt[5]=static_cast<uint8_t>((tcpLen>>16)&0xFF);
    pkt[6]=static_cast<uint8_t>((tcpLen>>8)&0xFF);
    pkt[7]=static_cast<uint8_t>(tcpLen&0xFF);
    pkt[11]=0x02; // FINS frame send command
    pkt[16]=0x80; pkt[17]=0x00; pkt[18]=0x02; // ICF, RSV, GCT
    pkt[20]=c->serverNode;
    pkt[23]=c->clientNode;
    pkt[25]=c->sid++;
    std::memcpy(pkt.data() + 26, finsCmd.data(), finsCmd.size());

    if (!comm_util::sendAll(c->sock, pkt.data(), static_cast<int>(pkt.size()))) {
        comm_util::setErr(errBuf, errBufLen, "FINS send failed");
        return false;
    }

    uint8_t tcpHdr[16]{};
    if (!comm_util::recvExact(c->sock, tcpHdr, 16) || std::memcmp(tcpHdr, "FINS", 4) != 0) {
        comm_util::setErr(errBuf, errBufLen, "FINS response header timeout");
        return false;
    }
    uint32_t payloadLen = (static_cast<uint32_t>(tcpHdr[4])<<24)|(static_cast<uint32_t>(tcpHdr[5])<<16)|(static_cast<uint32_t>(tcpHdr[6])<<8)|tcpHdr[7];
    if (payloadLen < 22 || payloadLen > 4096) {
        comm_util::setErr(errBuf, errBufLen, "FINS invalid payload length");
        return false;
    }
    int rem = static_cast<int>(payloadLen) - 8;
    std::vector<uint8_t> body(rem);
    if (!comm_util::recvExact(c->sock, body.data(), rem)) {
        comm_util::setErr(errBuf, errBufLen, "FINS truncated payload");
        return false;
    }
    if (body.size() < 14 || body[12] != 0 || body[13] != 0) {
        comm_util::setErr(errBuf, errBufLen, "FINS PLC returned error code");
        return false;
    }
    outData.assign(body.begin() + 14, body.end());
    return true;
}

} // namespace

COMM_API int32_t Comm_GetDriverInfo(CommDriverInfo* outInfo) {
    if (!outInfo) return -1;
    std::memset(outInfo, 0, sizeof(*outInfo));
    outInfo->apiVersion = COMM_API_VERSION;
    std::snprintf(outInfo->id, sizeof(outInfo->id), "omron_fins");
    std::snprintf(outInfo->name, sizeof(outInfo->name), "Omron FINS (TCP)");
    std::snprintf(outInfo->version, sizeof(outInfo->version), "1.0.0");
    outInfo->transportMask = COMM_TRANSPORT_TCP;
    outInfo->defaultPort = 9600;
    return 0;
}

COMM_API int32_t Comm_Connect(const char* configJson, void** outHandle, char* errBuf, int32_t errBufLen) {
    if (!outHandle) return -1;
    *outHandle = nullptr;
    std::string cfg = (configJson && *configJson) ? configJson : "{}";
    auto* c = new FinsConn();
    c->host = comm_util::cfgStr(cfg, "address", comm_util::cfgStr(cfg, "host", "192.168.1.10"));
    c->port = comm_util::cfgInt(cfg, "port", 9600);
    c->timeoutMs = comm_util::cfgInt(cfg, "timeoutMs", 1500);
    c->sock = comm_util::connectTcp(c->host, c->port, c->timeoutMs, errBuf, errBufLen);
    if (c->sock == INVALID_SOCKET || !finsHandshake(c, errBuf, errBufLen)) {
        if (c->sock != INVALID_SOCKET) closesocket(c->sock);
        delete c;
        return -1;
    }
    c->connected = true;
    *outHandle = c;
    return 0;
}

COMM_API int32_t Comm_Disconnect(void* handle) {
    auto* c = static_cast<FinsConn*>(handle);
    if (!c) return 0;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (c->sock != INVALID_SOCKET) {
            closesocket(c->sock);
            c->sock = INVALID_SOCKET;
        }
        c->connected = false;
    }
    delete c;
    return 0;
}

COMM_API int32_t Comm_GetStatus(void* handle, int32_t* outConnected, char* statusBuf, int32_t statusBufLen) {
    auto* c = static_cast<FinsConn*>(handle);
    if (!c) {
        if (outConnected) *outConnected = 0;
        comm_util::setErr(statusBuf, statusBufLen, "Disconnected");
        return 0;
    }
    std::lock_guard<std::mutex> lock(c->mtx);
    if (outConnected) *outConnected = c->connected ? 1 : 0;
    comm_util::setErr(statusBuf, statusBufLen, c->connected ? ("FINS " + c->host + ":" + std::to_string(c->port)) : "Disconnected");
    return 0;
}

COMM_API int32_t Comm_ReadTag(void* handle, const char* address, CommTagValue* outValue, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<FinsConn*>(handle);
    if (!c || !outValue) return -1;
    std::memset(outValue, 0, sizeof(*outValue));

    uint8_t area = 0, bit = 0;
    uint16_t word = 0;
    bool isBit = false;
    if (!parseFinsAddr(address, area, word, bit, isBit)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid FINS address (use D100, DM100, CIO0, W0.0, H0)");
        return -1;
    }

    std::vector<uint8_t> cmd = {
        0x01, 0x01, // Memory Area Read
        area,
        static_cast<uint8_t>(word >> 8), static_cast<uint8_t>(word & 0xFF),
        bit,
        0x00, 0x01 // 1 item
    };
    std::vector<uint8_t> resp;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (!exchangeFins(c, cmd, resp, errBuf, errBufLen)) return -1;
    }
    if (isBit) {
        if (resp.empty()) return -1;
        outValue->dataType = COMM_TYPE_BOOL;
        outValue->quality = 1;
        outValue->num.boolVal = resp[0] ? 1 : 0;
    } else {
        if (resp.size() < 2) return -1;
        outValue->dataType = COMM_TYPE_UINT16;
        outValue->quality = 1;
        outValue->num.u32Val = static_cast<uint16_t>((resp[0] << 8) | resp[1]);
    }
    return 0;
}

COMM_API int32_t Comm_WriteTag(void* handle, const char* address, const CommTagValue* value, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<FinsConn*>(handle);
    if (!c || !value) return -1;

    uint8_t area = 0, bit = 0;
    uint16_t word = 0;
    bool isBit = false;
    if (!parseFinsAddr(address, area, word, bit, isBit)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid FINS address");
        return -1;
    }

    std::vector<uint8_t> cmd = {
        0x01, 0x02, // Memory Area Write
        area,
        static_cast<uint8_t>(word >> 8), static_cast<uint8_t>(word & 0xFF),
        bit,
        0x00, 0x01
    };
    if (isBit) {
        cmd.push_back(value->num.boolVal ? 0x01 : 0x00);
    } else {
        cmd.push_back(static_cast<uint8_t>((value->num.u32Val >> 8) & 0xFF));
        cmd.push_back(static_cast<uint8_t>(value->num.u32Val & 0xFF));
    }

    std::vector<uint8_t> resp;
    std::lock_guard<std::mutex> lock(c->mtx);
    return exchangeFins(c, cmd, resp, errBuf, errBufLen) ? 0 : -1;
}
