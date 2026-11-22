#define COMM_DRIVER_EXPORTS
#include "comm_common.hpp"

#include <mutex>
#include <vector>

namespace {

struct EipConn {
    std::mutex mtx;
    bool connected = false;
    std::string host = "192.168.1.10";
    int port = 44818;
    int timeoutMs = 1500;
    uint32_t sessionHandle = 0;
    SOCKET sock = INVALID_SOCKET;
};

void pushU16(std::vector<uint8_t>& v, uint16_t x) {
    v.push_back(static_cast<uint8_t>(x & 0xFF));
    v.push_back(static_cast<uint8_t>((x >> 8) & 0xFF));
}
void pushU32(std::vector<uint8_t>& v, uint32_t x) {
    v.push_back(static_cast<uint8_t>(x & 0xFF));
    v.push_back(static_cast<uint8_t>((x >> 8) & 0xFF));
    v.push_back(static_cast<uint8_t>((x >> 16) & 0xFF));
    v.push_back(static_cast<uint8_t>((x >> 24) & 0xFF));
}

bool exchangeEip(EipConn* c, uint16_t cmd, const std::vector<uint8_t>& data, std::vector<uint8_t>& outResp, char* errBuf, int32_t errBufLen) {
    std::vector<uint8_t> pkt;
    pkt.reserve(24 + data.size());
    pushU16(pkt, cmd);
    pushU16(pkt, static_cast<uint16_t>(data.size()));
    pushU32(pkt, c->sessionHandle);
    pushU32(pkt, 0); // status
    for (int i = 0; i < 8; ++i) pkt.push_back(0); // sender context
    pushU32(pkt, 0); // options
    pkt.insert(pkt.end(), data.begin(), data.end());

    if (!comm_util::sendAll(c->sock, pkt.data(), static_cast<int>(pkt.size()))) {
        comm_util::setErr(errBuf, errBufLen, "EtherNet/IP send failed");
        return false;
    }

    uint8_t hdr[24]{};
    if (!comm_util::recvExact(c->sock, hdr, 24)) {
        comm_util::setErr(errBuf, errBufLen, "EtherNet/IP header timeout");
        return false;
    }
    uint16_t respLen = static_cast<uint16_t>(hdr[2] | (hdr[3] << 8));
    c->sessionHandle = static_cast<uint32_t>(hdr[4] | (hdr[5] << 8) | (hdr[6] << 16) | (hdr[7] << 24));
    uint32_t status = static_cast<uint32_t>(hdr[8] | (hdr[9] << 8) | (hdr[10] << 16) | (hdr[11] << 24));
    if (respLen > 0) {
        outResp.resize(respLen);
        if (!comm_util::recvExact(c->sock, outResp.data(), respLen)) {
            comm_util::setErr(errBuf, errBufLen, "EtherNet/IP truncated response");
            return false;
        }
    } else {
        outResp.clear();
    }
    if (status != 0) {
        comm_util::setErr(errBuf, errBufLen, "EtherNet/IP error status " + std::to_string(status));
        return false;
    }
    return true;
}

std::vector<uint8_t> buildCipSymbolicPath(const std::string& tagName) {
    std::vector<uint8_t> path;
    path.push_back(0x91); // ANSI Extended Symbol Segment
    path.push_back(static_cast<uint8_t>(tagName.size()));
    for (char ch : tagName) path.push_back(static_cast<uint8_t>(ch));
    if (tagName.size() & 1) path.push_back(0x00); // pad to even
    return path;
}

} // namespace

COMM_API int32_t Comm_GetDriverInfo(CommDriverInfo* outInfo) {
    if (!outInfo) return -1;
    std::memset(outInfo, 0, sizeof(*outInfo));
    outInfo->apiVersion = COMM_API_VERSION;
    std::snprintf(outInfo->id, sizeof(outInfo->id), "eip_cip");
    std::snprintf(outInfo->name, sizeof(outInfo->name), "Allen-Bradley EtherNet/IP (CIP)");
    std::snprintf(outInfo->version, sizeof(outInfo->version), "1.0.0");
    outInfo->transportMask = COMM_TRANSPORT_TCP;
    outInfo->defaultPort = 44818;
    return 0;
}

COMM_API int32_t Comm_Connect(const char* configJson, void** outHandle, char* errBuf, int32_t errBufLen) {
    if (!outHandle) return -1;
    *outHandle = nullptr;
    std::string cfg = (configJson && *configJson) ? configJson : "{}";
    auto* c = new EipConn();
    c->host = comm_util::cfgStr(cfg, "address", comm_util::cfgStr(cfg, "host", "192.168.1.10"));
    c->port = comm_util::cfgInt(cfg, "port", 44818);
    c->timeoutMs = comm_util::cfgInt(cfg, "timeoutMs", 1500);
    c->sock = comm_util::connectTcp(c->host, c->port, c->timeoutMs, errBuf, errBufLen);
    if (c->sock == INVALID_SOCKET) {
        delete c;
        return -1;
    }

    // RegisterSession (0x0065)
    std::vector<uint8_t> reg = { 0x01, 0x00, 0x00, 0x00 };
    std::vector<uint8_t> resp;
    if (!exchangeEip(c, 0x0065, reg, resp, errBuf, errBufLen) || c->sessionHandle == 0) {
        closesocket(c->sock);
        delete c;
        return -1;
    }
    c->connected = true;
    *outHandle = c;
    return 0;
}

COMM_API int32_t Comm_Disconnect(void* handle) {
    auto* c = static_cast<EipConn*>(handle);
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
    auto* c = static_cast<EipConn*>(handle);
    if (!c) {
        if (outConnected) *outConnected = 0;
        comm_util::setErr(statusBuf, statusBufLen, "Disconnected");
        return 0;
    }
    std::lock_guard<std::mutex> lock(c->mtx);
    if (outConnected) *outConnected = c->connected ? 1 : 0;
    comm_util::setErr(statusBuf, statusBufLen, c->connected ? ("EIP/CIP " + c->host + ":" + std::to_string(c->port)) : "Disconnected");
    return 0;
}

COMM_API int32_t Comm_ReadTag(void* handle, const char* address, CommTagValue* outValue, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<EipConn*>(handle);
    if (!c || !outValue || !address || !*address) return -1;
    std::memset(outValue, 0, sizeof(*outValue));

    auto path = buildCipSymbolicPath(address);
    std::vector<uint8_t> cip;
    cip.push_back(0x4C); // CIP Read Tag Service
    cip.push_back(static_cast<uint8_t>(path.size() / 2));
    cip.insert(cip.end(), path.begin(), path.end());
    pushU16(cip, 1); // 1 element

    // SendRRData (0x006F) wrapper with Unconnected Data Item (0x00B2)
    std::vector<uint8_t> rr;
    pushU32(rr, 0); // interface handle
    pushU16(rr, 5); // timeout
    pushU16(rr, 2); // item count
    pushU16(rr, 0x0000); pushU16(rr, 0); // Null Address Item
    pushU16(rr, 0x00B2); pushU16(rr, static_cast<uint16_t>(cip.size()));
    rr.insert(rr.end(), cip.begin(), cip.end());

    std::vector<uint8_t> resp;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (!exchangeEip(c, 0x006F, rr, resp, errBuf, errBufLen)) return -1;
    }

    if (resp.size() < 22) {
        comm_util::setErr(errBuf, errBufLen, "CIP ReadTag response too short");
        return -1;
    }
    // Locate CIP reply status after 16-byte CPF header
    uint8_t cipStatus = resp[18];
    if (cipStatus != 0) {
        comm_util::setErr(errBuf, errBufLen, "CIP ReadTag error status " + std::to_string(cipStatus));
        return -1;
    }
    uint16_t cipType = static_cast<uint16_t>(resp[20] | (resp[21] << 8));
    if (cipType == 0x00C1 && resp.size() >= 23) { // BOOL
        outValue->dataType = COMM_TYPE_BOOL;
        outValue->quality = 1;
        outValue->num.boolVal = resp[22] ? 1 : 0;
    } else if ((cipType == 0x00C3 || cipType == 0x00C7) && resp.size() >= 24) { // INT/UINT
        outValue->dataType = COMM_TYPE_INT16;
        outValue->quality = 1;
        outValue->num.i32Val = static_cast<int16_t>(resp[22] | (resp[23] << 8));
    } else if (resp.size() >= 26) { // DINT/REAL
        outValue->dataType = COMM_TYPE_INT32;
        outValue->quality = 1;
        outValue->num.i32Val = static_cast<int32_t>(resp[22] | (resp[23] << 8) | (resp[24] << 16) | (resp[25] << 24));
    }
    return 0;
}

COMM_API int32_t Comm_WriteTag(void* handle, const char* address, const CommTagValue* value, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<EipConn*>(handle);
    if (!c || !value || !address || !*address) return -1;

    auto path = buildCipSymbolicPath(address);
    std::vector<uint8_t> cip;
    cip.push_back(0x4D); // CIP Write Tag Service
    cip.push_back(static_cast<uint8_t>(path.size() / 2));
    cip.insert(cip.end(), path.begin(), path.end());
    if (value->dataType == COMM_TYPE_BOOL) {
        pushU16(cip, 0x00C1);
        pushU16(cip, 1);
        cip.push_back(value->num.boolVal ? 1 : 0);
    } else {
        pushU16(cip, 0x00C4); // DINT
        pushU16(cip, 1);
        pushU32(cip, static_cast<uint32_t>(value->num.i32Val));
    }

    std::vector<uint8_t> rr;
    pushU32(rr, 0);
    pushU16(rr, 5);
    pushU16(rr, 2);
    pushU16(rr, 0x0000); pushU16(rr, 0);
    pushU16(rr, 0x00B2); pushU16(rr, static_cast<uint16_t>(cip.size()));
    rr.insert(rr.end(), cip.begin(), cip.end());

    std::vector<uint8_t> resp;
    std::lock_guard<std::mutex> lock(c->mtx);
    if (!exchangeEip(c, 0x006F, rr, resp, errBuf, errBufLen)) return -1;
    if (resp.size() >= 19 && resp[18] != 0) {
        comm_util::setErr(errBuf, errBufLen, "CIP WriteTag error status " + std::to_string(resp[18]));
        return -1;
    }
    return 0;
}
