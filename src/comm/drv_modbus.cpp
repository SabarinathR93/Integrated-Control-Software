#define COMM_DRIVER_EXPORTS
#include "comm_common.hpp"

#include <mutex>
#include <vector>

namespace {

struct ModbusConn {
    std::mutex mtx;
    bool isRtu = false;
    bool connected = false;
    std::string host = "127.0.0.1";
    int port = 502;
    std::string comPort = "COM1";
    int baudRate = 9600;
    int unitId = 1;
    int timeoutMs = 1500;
    SOCKET sock = INVALID_SOCKET;
    HANDLE hSerial = INVALID_HANDLE_VALUE;
    uint16_t txId = 1;
};

uint16_t modbusCrc16(const uint8_t* buf, int len) {
    uint16_t crc = 0xFFFF;
    for (int i = 0; i < len; ++i) {
        crc ^= buf[i];
        for (int b = 0; b < 8; ++b) {
            if (crc & 1) crc = (crc >> 1) ^ 0xA001;
            else crc >>= 1;
        }
    }
    return crc;
}

bool parseModbusAddr(const char* rawAddr, int& outTable, uint16_t& outOffset) {
    std::string s = comm_util::toUpperTrim(rawAddr);
    if (s.empty()) return false;

    // Formats: "40001", "00001", "10001", "30001", or "4x:100", "0x:0"
    auto colonPos = s.find(':');
    if (colonPos != std::string::npos && colonPos >= 1) {
        char prefix = s[0];
        if (prefix != '0' && prefix != '1' && prefix != '3' && prefix != '4') return false;
        int idx = std::atoi(s.substr(colonPos + 1).c_str());
        if (idx < 0 || idx > 65535) return false;
        outTable = prefix - '0';
        outOffset = static_cast<uint16_t>(idx);
        return true;
    }

    if (s.size() >= 5 && (s[0] == '0' || s[0] == '1' || s[0] == '3' || s[0] == '4')) {
        int num = std::atoi(s.substr(1).c_str());
        if (num < 1 || num > 65536) return false;
        outTable = s[0] - '0';
        outOffset = static_cast<uint16_t>(num - 1);
        return true;
    }

    // Fallback: D100 -> holding register 100
    if (s[0] == 'D' && s.size() > 1) {
        int idx = std::atoi(s.substr(1).c_str());
        if (idx < 0 || idx > 65535) return false;
        outTable = 4;
        outOffset = static_cast<uint16_t>(idx);
        return true;
    }
    return false;
}

bool exchangePdu(ModbusConn* c, const std::vector<uint8_t>& pdu, std::vector<uint8_t>& respPdu, char* errBuf, int32_t errBufLen) {
    if (!c->isRtu) {
        if (c->sock == INVALID_SOCKET) {
            comm_util::setErr(errBuf, errBufLen, "Modbus TCP socket not connected");
            return false;
        }
        uint16_t tid = c->txId++;
        uint16_t len = static_cast<uint16_t>(1 + pdu.size());
        std::vector<uint8_t> frame(7 + pdu.size());
        frame[0] = static_cast<uint8_t>(tid >> 8);
        frame[1] = static_cast<uint8_t>(tid & 0xFF);
        frame[2] = 0;
        frame[3] = 0;
        frame[4] = static_cast<uint8_t>(len >> 8);
        frame[5] = static_cast<uint8_t>(len & 0xFF);
        frame[6] = static_cast<uint8_t>(c->unitId & 0xFF);
        std::memcpy(frame.data() + 7, pdu.data(), pdu.size());

        if (!comm_util::sendAll(c->sock, frame.data(), static_cast<int>(frame.size()))) {
            comm_util::setErr(errBuf, errBufLen, "Modbus TCP send failed");
            return false;
        }

        uint8_t mbap[7]{};
        if (!comm_util::recvExact(c->sock, mbap, 7)) {
            comm_util::setErr(errBuf, errBufLen, "Modbus TCP receive timeout/error");
            return false;
        }
        uint16_t respLen = static_cast<uint16_t>((mbap[4] << 8) | mbap[5]);
        if (respLen < 2 || respLen > 260) {
            comm_util::setErr(errBuf, errBufLen, "Invalid Modbus TCP response length");
            return false;
        }
        respPdu.resize(respLen - 1);
        if (!comm_util::recvExact(c->sock, respPdu.data(), static_cast<int>(respPdu.size()))) {
            comm_util::setErr(errBuf, errBufLen, "Modbus TCP truncated PDU");
            return false;
        }
    } else {
        if (c->hSerial == INVALID_HANDLE_VALUE) {
            comm_util::setErr(errBuf, errBufLen, "Modbus RTU serial port not open");
            return false;
        }
        std::vector<uint8_t> frame(1 + pdu.size() + 2);
        frame[0] = static_cast<uint8_t>(c->unitId & 0xFF);
        std::memcpy(frame.data() + 1, pdu.data(), pdu.size());
        uint16_t crc = modbusCrc16(frame.data(), static_cast<int>(1 + pdu.size()));
        frame[1 + pdu.size()] = static_cast<uint8_t>(crc & 0xFF);
        frame[2 + pdu.size()] = static_cast<uint8_t>((crc >> 8) & 0xFF);

        PurgeComm(c->hSerial, PURGE_RXCLEAR | PURGE_TXCLEAR);
        DWORD written = 0;
        if (!WriteFile(c->hSerial, frame.data(), static_cast<DWORD>(frame.size()), &written, nullptr) || written != frame.size()) {
            comm_util::setErr(errBuf, errBufLen, "Modbus RTU serial write failed");
            return false;
        }

        uint8_t rx[260]{};
        DWORD total = 0;
        DWORD chunk = 0;
        // Read unitId + function code first
        if (!ReadFile(c->hSerial, rx, 2, &chunk, nullptr) || chunk < 2) {
            comm_util::setErr(errBuf, errBufLen, "Modbus RTU response timeout");
            return false;
        }
        total = chunk;

        int expectedTail = 0;
        if (rx[1] & 0x80) {
            expectedTail = 3; // exception code + 2 CRC
        } else if (rx[1] == 1 || rx[1] == 2 || rx[1] == 3 || rx[1] == 4) {
            uint8_t byteCount = 0;
            if (!ReadFile(c->hSerial, &byteCount, 1, &chunk, nullptr) || chunk < 1) {
                comm_util::setErr(errBuf, errBufLen, "Modbus RTU byte count timeout");
                return false;
            }
            rx[total++] = byteCount;
            expectedTail = byteCount + 2;
        } else {
            expectedTail = 6; // echo addr(2) + val/qty(2) + crc(2)
        }

        if (!ReadFile(c->hSerial, rx + total, static_cast<DWORD>(expectedTail), &chunk, nullptr) || static_cast<int>(chunk) < expectedTail) {
            comm_util::setErr(errBuf, errBufLen, "Modbus RTU truncated frame");
            return false;
        }
        total += chunk;

        uint16_t rxCrc = static_cast<uint16_t>(rx[total - 2] | (rx[total - 1] << 8));
        uint16_t calcCrc = modbusCrc16(rx, static_cast<int>(total - 2));
        if (rxCrc != calcCrc) {
            comm_util::setErr(errBuf, errBufLen, "Modbus RTU CRC mismatch");
            return false;
        }
        respPdu.assign(rx + 1, rx + total - 2);
    }

    if (!respPdu.empty() && (respPdu[0] & 0x80)) {
        uint8_t ex = respPdu.size() > 1 ? respPdu[1] : 0;
        comm_util::setErr(errBuf, errBufLen, "Modbus exception code " + std::to_string(ex));
        return false;
    }
    return true;
}

} // namespace

COMM_API int32_t Comm_GetDriverInfo(CommDriverInfo* outInfo) {
    if (!outInfo) return -1;
    std::memset(outInfo, 0, sizeof(*outInfo));
    outInfo->apiVersion = COMM_API_VERSION;
    std::snprintf(outInfo->id, sizeof(outInfo->id), "modbus");
    std::snprintf(outInfo->name, sizeof(outInfo->name), "Modbus TCP / RTU");
    std::snprintf(outInfo->version, sizeof(outInfo->version), "1.0.0");
    outInfo->transportMask = COMM_TRANSPORT_TCP | COMM_TRANSPORT_SERIAL;
    outInfo->defaultPort = 502;
    return 0;
}

COMM_API int32_t Comm_Connect(const char* configJson, void** outHandle, char* errBuf, int32_t errBufLen) {
    if (!outHandle) return -1;
    *outHandle = nullptr;

    std::string cfg = (configJson && *configJson) ? configJson : "{}";

    auto* c = new ModbusConn();
    std::string transport = comm_util::cfgStr(cfg, "transport", "TCP");
    c->isRtu = (transport == "SERIAL" || transport == "RTU" || transport == "serial" || transport == "rtu");
    c->host = comm_util::cfgStr(cfg, "address", comm_util::cfgStr(cfg, "host", "127.0.0.1"));
    c->port = comm_util::cfgInt(cfg, "port", 502);
    c->comPort = comm_util::cfgStr(cfg, "comPort", "COM1");
    c->baudRate = comm_util::cfgInt(cfg, "baudRate", 9600);
    c->unitId = comm_util::cfgInt(cfg, "unitId", 1);
    c->timeoutMs = comm_util::cfgInt(cfg, "timeoutMs", 1500);

    if (!c->isRtu) {
        c->sock = comm_util::connectTcp(c->host, c->port, c->timeoutMs, errBuf, errBufLen);
        if (c->sock == INVALID_SOCKET) {
            delete c;
            return -1;
        }
        c->connected = true;
    } else {
        std::string dev = "\\\\.\\" + c->comPort;
        c->hSerial = CreateFileA(dev.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
        if (c->hSerial == INVALID_HANDLE_VALUE) {
            comm_util::setErr(errBuf, errBufLen, "Failed to open serial port " + c->comPort);
            delete c;
            return -1;
        }
        DCB dcb{};
        dcb.DCBlength = sizeof(dcb);
        if (GetCommState(c->hSerial, &dcb)) {
            dcb.BaudRate = static_cast<DWORD>(c->baudRate);
            dcb.ByteSize = 8;
            dcb.Parity = NOPARITY;
            dcb.StopBits = ONESTOPBIT;
            SetCommState(c->hSerial, &dcb);
        }
        COMMTIMEOUTS to{};
        to.ReadIntervalTimeout = 50;
        to.ReadTotalTimeoutConstant = static_cast<DWORD>(c->timeoutMs);
        to.ReadTotalTimeoutMultiplier = 10;
        to.WriteTotalTimeoutConstant = static_cast<DWORD>(c->timeoutMs);
        SetCommTimeouts(c->hSerial, &to);
        c->connected = true;
    }

    *outHandle = c;
    return 0;
}

COMM_API int32_t Comm_Disconnect(void* handle) {
    auto* c = static_cast<ModbusConn*>(handle);
    if (!c) return 0;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (c->sock != INVALID_SOCKET) {
            closesocket(c->sock);
            c->sock = INVALID_SOCKET;
        }
        if (c->hSerial != INVALID_HANDLE_VALUE) {
            CloseHandle(c->hSerial);
            c->hSerial = INVALID_HANDLE_VALUE;
        }
        c->connected = false;
    }
    delete c;
    return 0;
}

COMM_API int32_t Comm_GetStatus(void* handle, int32_t* outConnected, char* statusBuf, int32_t statusBufLen) {
    auto* c = static_cast<ModbusConn*>(handle);
    if (!c) {
        if (outConnected) *outConnected = 0;
        comm_util::setErr(statusBuf, statusBufLen, "Disconnected");
        return 0;
    }
    std::lock_guard<std::mutex> lock(c->mtx);
    if (outConnected) *outConnected = c->connected ? 1 : 0;
    if (c->isRtu) {
        comm_util::setErr(statusBuf, statusBufLen, c->connected ? ("Modbus RTU " + c->comPort) : "Disconnected");
    } else {
        comm_util::setErr(statusBuf, statusBufLen, c->connected ? ("Modbus TCP " + c->host + ":" + std::to_string(c->port)) : "Disconnected");
    }
    return 0;
}

COMM_API int32_t Comm_ReadTag(void* handle, const char* address, CommTagValue* outValue, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<ModbusConn*>(handle);
    if (!c || !outValue) return -1;
    std::memset(outValue, 0, sizeof(*outValue));

    int table = 0;
    uint16_t offset = 0;
    if (!parseModbusAddr(address, table, offset)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid Modbus address (use 00001/10001/30001/40001 or 4x:0)");
        return -1;
    }

    uint8_t fc = 3;
    if (table == 0) fc = 1;
    else if (table == 1) fc = 2;
    else if (table == 3) fc = 4;
    else fc = 3;

    std::vector<uint8_t> pdu = {
        fc,
        static_cast<uint8_t>(offset >> 8),
        static_cast<uint8_t>(offset & 0xFF),
        0x00, 0x01
    };

    std::vector<uint8_t> resp;
    {
        std::lock_guard<std::mutex> lock(c->mtx);
        if (!exchangePdu(c, pdu, resp, errBuf, errBufLen)) {
            return -1;
        }
    }

    if (fc == 1 || fc == 2) {
        if (resp.size() < 3) return -1;
        outValue->dataType = COMM_TYPE_BOOL;
        outValue->quality = 1;
        outValue->num.boolVal = (resp[2] & 0x01) ? 1 : 0;
    } else {
        if (resp.size() < 4) return -1;
        uint16_t reg = static_cast<uint16_t>((resp[2] << 8) | resp[3]);
        outValue->dataType = COMM_TYPE_UINT16;
        outValue->quality = 1;
        outValue->num.u32Val = reg;
    }
    return 0;
}

COMM_API int32_t Comm_WriteTag(void* handle, const char* address, const CommTagValue* value, char* errBuf, int32_t errBufLen) {
    auto* c = static_cast<ModbusConn*>(handle);
    if (!c || !value) return -1;

    int table = 0;
    uint16_t offset = 0;
    if (!parseModbusAddr(address, table, offset)) {
        comm_util::setErr(errBuf, errBufLen, "Invalid Modbus address");
        return -1;
    }

    std::vector<uint8_t> pdu;
    if (table == 0) {
        bool b = (value->dataType == COMM_TYPE_BOOL) ? (value->num.boolVal != 0) : (value->num.u32Val != 0);
        pdu = {
            0x05,
            static_cast<uint8_t>(offset >> 8),
            static_cast<uint8_t>(offset & 0xFF),
            static_cast<uint8_t>(b ? 0xFF : 0x00),
            0x00
        };
    } else if (table == 4) {
        uint16_t v = static_cast<uint16_t>(value->dataType == COMM_TYPE_INT16 ? value->num.i32Val : value->num.u32Val);
        pdu = {
            0x06,
            static_cast<uint8_t>(offset >> 8),
            static_cast<uint8_t>(offset & 0xFF),
            static_cast<uint8_t>(v >> 8),
            static_cast<uint8_t>(v & 0xFF)
        };
    } else {
        comm_util::setErr(errBuf, errBufLen, "Read-only Modbus area (1x/3x)");
        return -1;
    }

    std::vector<uint8_t> resp;
    std::lock_guard<std::mutex> lock(c->mtx);
    return exchangePdu(c, pdu, resp, errBuf, errBufLen) ? 0 : -1;
}
