#define COMM_DRIVER_EXPORTS
#include "comm_common.hpp"

#include <mutex>
#include <vector>

namespace {

struct S7Conn {
    std::mutex mtx;
    bool connected = false;
    std::string host = "192.168.1.10";
    int port = 102;
    int rack = 0;
    int slot = 1;
    int timeoutMs = 1500;
    uint16_t pduRef = 1;
    SOCKET sock = INVALID_SOCKET;
};

struct S7Addr {
    uint8_t area;     // 0x81=I, 0x82=Q, 0x83=M, 0x84=DB
    uint16_t dbNum;
    uint32_t byteOff;
    uint8_t bitOff;
    uint8_t sizeCode; // 0x01=BIT, 0x02=BYTE, 0x04=WORD
};

bool parseS7Address(const char* rawAddr, S7Addr& out) {
    std::string s = comm_util::toUpperTrim(rawAddr);
    if (s.empty()) return false;
    out = {};

    // DB1.DBW0, DB1.DBX0.0, DB1.DBB0
    if (s.rfind("DB", 0) == 0) {
        auto dot = s.find('.');
        if (dot == std::string::npos) return false;
        out.area = 0x84;
        out.dbNum = static_cast<uint16_t>(std::atoi(s.substr(2, dot - 2).c_str()));
        std::string rest = s.substr(dot + 1);
        if (rest.rfind("DBW", 0) == 0) {
            out.sizeCode = 0x04;
            out.byteOff = static_cast<uint32_t>(std::atoi(rest.substr(3).c_str()));
            return true;
        }
        if (rest.rfind("DBB", 0) == 0) {
            out.sizeCode = 0x02;
            out.byteOff = static_cast<uint32_t>(std::atoi(rest.substr(3).c_str()));
            return true;
        }
        if (rest.rfind("DBX", 0) == 0) {
            out.sizeCode = 0x01;
            auto bdot = rest.find('.', 3);
            if (bdot == std::string::npos) return false;
            out.byteOff = static_cast<uint32_t>(std::atoi(rest.substr(3, bdot - 3).c_str()));
            out.bitOff = static_cast<uint8_t>(std::atoi(rest.substr(bdot + 1).c_str()));
            return true;
        }
        return false;
    }

    // MW0, M0.0, IW0, QW0
    char c = s[0];
    if (c == 'I') out.area = 0x81;
    else if (c == 'Q') out.area = 0x82;
    else if (c == 'M') out.area = 0x83;
    else return false;

    if (s.size() > 2 && s[1] == 'W') {
        out.sizeCode = 0x04;
        out.byteOff = static_cast<uint32_t>(std::atoi(s.substr(2).c_str()));
        return true;
    }
    auto dot = s.find('.');
    if (dot != std::string::npos) {
        out.sizeCode = 0x01;
        out.byteOff = static_cast<uint32_t>(std::atoi(s.substr(1, dot - 1).c_str()));
        out.bitOff = static_cast<uint8_t>(std::atoi(s.substr(dot + 1).c_str()));
        return true;
    }
    return false;
}

bool recvTpkt(SOCKET sock, std::vector<uint8_t>& outPayload, char* errBuf, int32_t errBufLen) {
    uint8_t tpkt[4]{};
    if (!comm_util::recvExact(sock, tpkt, 4) || tpkt[0] != 0x03) {
        comm_util::setErr(errBuf, errBufLen, "S7 TPKT header timeout/invalid");
        return false;
    }
    uint16_t totalLen = static_cast<uint16_t>((tpkt[2] << 8) | tpkt[3]);
    if (totalLen < 4 || totalLen > 4096) {
        comm_util::setErr(errBuf, errBufLen, "S7 TPKT invalid length");
        return false;
    }
    outPayload.resize(totalLen - 4);
    if (!comm_util::recvExact(sock, outPayload.data(), static_cast<int>(outPayload.size()))) {
        comm_util::setErr(errBuf, errBufLen, "S7 TPKT truncated payload");
        return false;
    }
    return true;
}

bool sendTpkt(SOCKET sock, const std::vector<uint8_t>& payload) {
    uint16_t totalLen = static_cast<uint16_t>(4 + payload.size());
    std::vector<uint8_t> pkt(totalLen);
    pkt[0] = 0x03; pkt[1] = 0x00;
    pkt[2] = static_cast<uint8_t>(totalLen >> 8);
    pkt[3] = static_cast<uint8_t>(totalLen & 0xFF);
    std::memcpy(pkt.data() + 4, payload.data(), payload.size());
    return comm_util::sendAll(sock, pkt.data(), totalLen);
}

bool s7Handshake(S7Conn* c, char* errBuf, int32_t errBufLen) {
    // 1. COTP Connection Request (CR)
    uint16_t tsapDst = static_cast<uint16_t>(0x0100 | ((c->rack & 0x07) << 5) | (c->slot & 0x1F));
    std::vector<uint8_t> cr = {
        17, 0xE0, 0x00, 0x00, 0x00, 0x01, 0x00,
        0xC0, 0x01, 0x0A,
        0xC1, 0x02, 0x01, 0x00,
        0xC2, 0x02, static_cast<uint8_t>(tsapDst >> 8), static_cast<uint8_t>(tsapDst & 0xFF)
    };
    std::vector<uint8_t> resp;
    if (!sendTpkt(c->sock, cr) || !recvTpkt(c->sock, resp, errBuf, errBufLen) || resp.size() < 2 || resp[1] != 0xD0) {
        comm_util::setErr(errBuf, errBufLen, "S7 COTP connection confirm failed");
        return false;
    }

    // 2. S7 Setup Communication
    std::vector<uint8_t> setup = {
        0x02, 0xF0, 0x80,
        0x32, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x08, 0x00, 0x00,
        0xF0, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01, 0xE0
    };
    if (!sendTpkt(c->sock, setup) || !recvTpkt(c->sock, resp, errBuf, errBufLen)) {
        comm_util::setErr(errBuf, errBufLen, "S7 Setup Communication failed");
        return false;
    }
    return true;
}

} // namespace

COMM_API int32_t Comm_GetDriverInfo(CommDriverInfo* outInfo) {
    if (!outInfo) return -1;
    std::memset(outInfo, 0, sizeof(*outInfo));
    outInfo->apiVersion = COMM_API_VERSION;
    std::snprintf(outInfo->id, sizeof(outInfo->id), "s7");
    std::snprintf(outInfo->name, sizeof(outInfo->name), "Siemens S7comm (ISO-on-TCP)");
    std::snprintf(outInfo->version, sizeof(outInfo->version), "1.0.0");
    outInfo->transportMask = COMM_TRANSPORT_TCP;
    outInfo->defaultPort = 102;
    return 0;
}

COMM_API int32_t Comm_Connect(const char* configJson, void** outHandle, char* errBuf, int32_t errBufLen) {
    if (!outHandle) return -1;
    *outHandle = nullptr;

    std::string cfg = (configJson && *configJson) ? configJson : "{}";

    auto* c = new S7Conn();
    c->host = comm_util::cfgStr(cfg, "address", comm_util::cfgStr(cfg, "host", "192.168.1.10"));
    c->port = comm_util::cfgInt(cfg, "port", 102);
    c->rack = comm_util::cfgInt(cfg, "rack", 0);
    c->slot = comm_util::cfgInt(cfg, "slot", 1);
    c->timeoutMs = comm_util::cfgInt(cfg, "timeoutMs", 1500);

    c->sock = comm_util::connectTcp(c->host, c->port, c->timeoutMs, errBuf, errBufLen);
    if (c->sock == INVALID_SOCKET || !s7Handshake(c, errBuf, errBufLen)) {
        if (c->sock != INVALID_SOCKET) closesocket(c->sock);
        delete c;
        return -1;
    }
    c->connected = true;
    *outHandle = c;
    return 0;
}

COMM_API int32_t Comm_Disconnect(void* handle) {
    auto* c = static_cast<S7Conn*>(handle);
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
    auto* c = static_cast<S7Conn*>(handle);
    if (!c) {
        if (outConnected) *outConnected = 0;
        comm_util::setErr(statusBuf, statusBufLen, "Disconnected");
        return 0;
    }
    std::lock_guard<std::mutex> lock(c->mtx);
    if (outConnected) *outConnected = c->connected ? 1 : 0;
    comm_util::setErr(statusBuf, statusBufLen, c->connected ? ("S7 " + c->host + ":" + std::to_string(c->port)) : "Disconnected");
    return 0;
}

COMM_API int32_t Comm_ReadTag(void* handle, const char* address, CommTagValue* outValue, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<S7Conn*>(handle);
    if (!c || !outValue) return -1;
    std::memset(outValue, 0, sizeof(*outValue));

    S7Addr a{};
    if (!parseS7Address(address, a)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid S7 address (use DB1.DBW0, DB1.DBX0.0, MW0, M0.0, IW0, QW0)");
        return -1;
    }

    uint32_t bitAddr = (a.byteOff * 8) + a.bitOff;
    uint16_t ref = c->pduRef++;
    std::vector<uint8_t> pdu = {
        0x02, 0xF0, 0x80,
        0x32, 0x01, 0x00, 0x00,
        static_cast<uint8_t>(ref >> 8), static_cast<uint8_t>(ref & 0xFF),
        0x00, 0x0E, 0x00, 0x00,
        0x04, 0x01, // Read Var, 1 item
        0x12, 0x0A, 0x10,
        a.sizeCode,
        0x00, 0x01, // count = 1
        static_cast<uint8_t>(a.dbNum >> 8), static_cast<uint8_t>(a.dbNum & 0xFF),
        a.area,
        static_cast<uint8_t>((bitAddr >> 16) & 0xFF),
        static_cast<uint8_t>((bitAddr >> 8) & 0xFF),
        static_cast<uint8_t>(bitAddr & 0xFF)
    };

    std::vector<uint8_t> resp;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (!sendTpkt(c->sock, pdu) || !recvTpkt(c->sock, resp, errBuf, errBufLen)) return -1;
    }

    // Minimum Ack_Data header + item header
    if (resp.size() < 20 || resp[17] != 0xFF) {
        comm_util::setErr(errBuf, errBufLen, "S7 read rejected by PLC");
        return -1;
    }
    if (a.sizeCode == 0x01) {
        outValue->dataType = COMM_TYPE_BOOL;
        outValue->quality = 1;
        outValue->num.boolVal = resp[21] ? 1 : 0;
    } else if (a.sizeCode == 0x02) {
        outValue->dataType = COMM_TYPE_UINT16;
        outValue->quality = 1;
        outValue->num.u32Val = resp[21];
    } else {
        if (resp.size() < 23) return -1;
        outValue->dataType = COMM_TYPE_UINT16;
        outValue->quality = 1;
        outValue->num.u32Val = static_cast<uint16_t>((resp[21] << 8) | resp[22]);
    }
    return 0;
}

COMM_API int32_t Comm_WriteTag(void* handle, const char* address, const CommTagValue* value, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<S7Conn*>(handle);
    if (!c || !value) return -1;

    S7Addr a{};
    if (!parseS7Address(address, a)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid S7 address");
        return -1;
    }

    uint32_t bitAddr = (a.byteOff * 8) + a.bitOff;
    uint16_t ref = c->pduRef++;
    uint16_t dataBytes = (a.sizeCode == 0x04) ? 2 : 1;
    uint16_t dataLenField = static_cast<uint16_t>(4 + dataBytes);

    std::vector<uint8_t> pdu = {
        0x02, 0xF0, 0x80,
        0x32, 0x01, 0x00, 0x00,
        static_cast<uint8_t>(ref >> 8), static_cast<uint8_t>(ref & 0xFF),
        0x00, 0x0E,
        static_cast<uint8_t>(dataLenField >> 8), static_cast<uint8_t>(dataLenField & 0xFF),
        0x05, 0x01, // Write Var, 1 item
        0x12, 0x0A, 0x10,
        a.sizeCode,
        0x00, 0x01,
        static_cast<uint8_t>(a.dbNum >> 8), static_cast<uint8_t>(a.dbNum & 0xFF),
        a.area,
        static_cast<uint8_t>((bitAddr >> 16) & 0xFF),
        static_cast<uint8_t>((bitAddr >> 8) & 0xFF),
        static_cast<uint8_t>(bitAddr & 0xFF),
        0x00,
        static_cast<uint8_t>(a.sizeCode == 0x01 ? 0x03 : 0x04),
        static_cast<uint8_t>((dataBytes * 8) >> 8),
        static_cast<uint8_t>((dataBytes * 8) & 0xFF)
    };
    if (dataBytes == 1) {
        pdu.push_back(static_cast<uint8_t>(value->num.u32Val & 0xFF));
    } else {
        pdu.push_back(static_cast<uint8_t>((value->num.u32Val >> 8) & 0xFF));
        pdu.push_back(static_cast<uint8_t>(value->num.u32Val & 0xFF));
    }

    std::vector<uint8_t> resp;
    std::lock_guard<std::mutex> lock(c->mtx);
    if (!sendTpkt(c->sock, pdu) || !recvTpkt(c->sock, resp, errBuf, errBufLen)) return -1;
    if (resp.size() < 18 || resp[17] != 0xFF) {
        comm_util::setErr(errBuf, errBufLen, "S7 write rejected by PLC");
        return -1;
    }
    return 0;
}
