#define COMM_DRIVER_EXPORTS
#include "comm_common.hpp"

#include <mutex>
#include <vector>

namespace {

struct McConn {
    std::mutex mtx;
    bool connected = false;
    std::string host = "192.168.1.10";
    int port = 5000;
    int timeoutMs = 1500;
    uint8_t networkNo = 0x00;
    uint8_t pcNo = 0xFF;
    uint16_t ioNo = 0x03FF;
    uint8_t stationNo = 0x00;
    SOCKET sock = INVALID_SOCKET;
};

struct McDevice {
    uint8_t code;
    uint32_t address;
    bool isBit;
};

bool parseMcAddress(const char* rawAddr, McDevice& outDev) {
    std::string s = comm_util::toUpperTrim(rawAddr);
    if (s.size() < 2) return false;

    if (s.rfind("ZR", 0) == 0) {
        outDev = { 0xB0, static_cast<uint32_t>(std::strtoul(s.substr(2).c_str(), nullptr, 10)), false };
        return true;
    }

    char prefix = s[0];
    std::string numPart = s.substr(1);
    switch (prefix) {
        case 'X': outDev = { 0x9C, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 16)), true }; return true;
        case 'Y': outDev = { 0x9D, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 16)), true }; return true;
        case 'M': outDev = { 0x90, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 10)), true }; return true;
        case 'L': outDev = { 0x92, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 10)), true }; return true;
        case 'B': outDev = { 0xA0, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 16)), true }; return true;
        case 'D': outDev = { 0xA8, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 10)), false }; return true;
        case 'W': outDev = { 0xB4, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 16)), false }; return true;
        case 'R': outDev = { 0xAF, static_cast<uint32_t>(std::strtoul(numPart.c_str(), nullptr, 10)), false }; return true;
        default: return false;
    }
}

bool exchange3E(McConn* c, const std::vector<uint8_t>& body, std::vector<uint8_t>& respData, char* errBuf, int32_t errBufLen) {
    if (c->sock == INVALID_SOCKET) {
        comm_util::setErr(errBuf, errBufLen, "MC Protocol socket not connected");
        return false;
    }

    uint16_t dataLen = static_cast<uint16_t>(2 + body.size()); // monitoring timer(2) + body
    std::vector<uint8_t> req(11 + body.size());
    req[0] = 0x50; req[1] = 0x00; // 3E Binary Request Subheader
    req[2] = c->networkNo;
    req[3] = c->pcNo;
    req[4] = static_cast<uint8_t>(c->ioNo & 0xFF);
    req[5] = static_cast<uint8_t>((c->ioNo >> 8) & 0xFF);
    req[6] = c->stationNo;
    req[7] = static_cast<uint8_t>(dataLen & 0xFF);
    req[8] = static_cast<uint8_t>((dataLen >> 8) & 0xFF);
    req[9] = 0x10; req[10] = 0x00; // Monitoring timer (4s)
    std::memcpy(req.data() + 11, body.data(), body.size());

    if (!comm_util::sendAll(c->sock, req.data(), static_cast<int>(req.size()))) {
        comm_util::setErr(errBuf, errBufLen, "MC Protocol send failed");
        return false;
    }

    uint8_t hdr[11]{};
    if (!comm_util::recvExact(c->sock, hdr, 11)) {
        comm_util::setErr(errBuf, errBufLen, "MC Protocol response timeout");
        return false;
    }
    if (hdr[0] != 0xD0 || hdr[1] != 0x00) {
        comm_util::setErr(errBuf, errBufLen, "Invalid MC 3E response subheader");
        return false;
    }

    uint16_t respLen = static_cast<uint16_t>(hdr[7] | (hdr[8] << 8));
    uint16_t endCode = static_cast<uint16_t>(hdr[9] | (hdr[10] << 8));
    int payloadBytes = static_cast<int>(respLen) - 2;
    if (payloadBytes > 0) {
        respData.resize(payloadBytes);
        if (!comm_util::recvExact(c->sock, respData.data(), payloadBytes)) {
            comm_util::setErr(errBuf, errBufLen, "MC Protocol truncated response");
            return false;
        }
    }
    if (endCode != 0) {
        char hexBuf[32];
        std::snprintf(hexBuf, sizeof(hexBuf), "0x%04X", endCode);
        comm_util::setErr(errBuf, errBufLen, std::string("MC Protocol end code ") + hexBuf);
        return false;
    }
    return true;
}

} // namespace

COMM_API int32_t Comm_GetDriverInfo(CommDriverInfo* outInfo) {
    if (!outInfo) return -1;
    std::memset(outInfo, 0, sizeof(*outInfo));
    outInfo->apiVersion = COMM_API_VERSION;
    std::snprintf(outInfo->id, sizeof(outInfo->id), "melsec_mc");
    std::snprintf(outInfo->name, sizeof(outInfo->name), "Mitsubishi MELSEC MC Protocol (3E)");
    std::snprintf(outInfo->version, sizeof(outInfo->version), "1.0.0");
    outInfo->transportMask = COMM_TRANSPORT_TCP;
    outInfo->defaultPort = 5000;
    return 0;
}

COMM_API int32_t Comm_Connect(const char* configJson, void** outHandle, char* errBuf, int32_t errBufLen) {
    if (!outHandle) return -1;
    *outHandle = nullptr;

    std::string cfg = (configJson && *configJson) ? configJson : "{}";

    auto* c = new McConn();
    c->host = comm_util::cfgStr(cfg, "address", comm_util::cfgStr(cfg, "host", "192.168.1.10"));
    c->port = comm_util::cfgInt(cfg, "port", 5000);
    c->timeoutMs = comm_util::cfgInt(cfg, "timeoutMs", 1500);
    c->sock = comm_util::connectTcp(c->host, c->port, c->timeoutMs, errBuf, errBufLen);
    if (c->sock == INVALID_SOCKET) {
        delete c;
        return -1;
    }
    c->connected = true;
    *outHandle = c;
    return 0;
}

COMM_API int32_t Comm_Disconnect(void* handle) {
    auto* c = static_cast<McConn*>(handle);
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
    auto* c = static_cast<McConn*>(handle);
    if (!c) {
        if (outConnected) *outConnected = 0;
        comm_util::setErr(statusBuf, statusBufLen, "Disconnected");
        return 0;
    }
    std::lock_guard<std::mutex> lock(c->mtx);
    if (outConnected) *outConnected = c->connected ? 1 : 0;
    comm_util::setErr(statusBuf, statusBufLen, c->connected ? ("MC 3E " + c->host + ":" + std::to_string(c->port)) : "Disconnected");
    return 0;
}

COMM_API int32_t Comm_ReadTag(void* handle, const char* address, CommTagValue* outValue, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<McConn*>(handle);
    if (!c || !outValue) return -1;
    std::memset(outValue, 0, sizeof(*outValue));

    McDevice dev{};
    if (!parseMcAddress(address, dev)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid MELSEC address (use X, Y, M, L, B, D, W, R, ZR)");
        return -1;
    }

    uint16_t subCmd = dev.isBit ? 0x0001 : 0x0000;
    std::vector<uint8_t> body = {
        0x01, 0x04, // Batch Read (0x0401)
        static_cast<uint8_t>(subCmd & 0xFF),
        static_cast<uint8_t>((subCmd >> 8) & 0xFF),
        static_cast<uint8_t>(dev.address & 0xFF),
        static_cast<uint8_t>((dev.address >> 8) & 0xFF),
        static_cast<uint8_t>((dev.address >> 16) & 0xFF),
        dev.code,
        0x01, 0x00 // 1 point
    };

    std::vector<uint8_t> resp;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (!exchange3E(c, body, resp, errBuf, errBufLen)) return -1;
    }

    if (dev.isBit) {
        if (resp.empty()) return -1;
        outValue->dataType = COMM_TYPE_BOOL;
        outValue->quality = 1;
        outValue->num.boolVal = ((resp[0] >> 4) & 0x01) ? 1 : 0;
    } else {
        if (resp.size() < 2) return -1;
        uint16_t val = static_cast<uint16_t>(resp[0] | (resp[1] << 8));
        outValue->dataType = COMM_TYPE_UINT16;
        outValue->quality = 1;
        outValue->num.u32Val = val;
    }
    return 0;
}

COMM_API int32_t Comm_WriteTag(void* handle, const char* address, const CommTagValue* value, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<McConn*>(handle);
    if (!c || !value) return -1;

    McDevice dev{};
    if (!parseMcAddress(address, dev)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid MELSEC address");
        return -1;
    }

    uint16_t subCmd = dev.isBit ? 0x0001 : 0x0000;
    std::vector<uint8_t> body = {
        0x01, 0x14, // Batch Write (0x1401)
        static_cast<uint8_t>(subCmd & 0xFF),
        static_cast<uint8_t>((subCmd >> 8) & 0xFF),
        static_cast<uint8_t>(dev.address & 0xFF),
        static_cast<uint8_t>((dev.address >> 8) & 0xFF),
        static_cast<uint8_t>((dev.address >> 16) & 0xFF),
        dev.code,
        0x01, 0x00 // 1 point
    };

    if (dev.isBit) {
        bool b = (value->dataType == COMM_TYPE_BOOL) ? (value->num.boolVal != 0) : (value->num.u32Val != 0);
        body.push_back(b ? 0x10 : 0x00);
    } else {
        uint16_t w = static_cast<uint16_t>(value->num.u32Val);
        body.push_back(static_cast<uint8_t>(w & 0xFF));
        body.push_back(static_cast<uint8_t>((w >> 8) & 0xFF));
    }

    std::vector<uint8_t> resp;
    std::lock_guard<std::mutex> lock(c->mtx);
    return exchange3E(c, body, resp, errBuf, errBufLen) ? 0 : -1;
}
