#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <cctype>
#include <cstdio>
#include <cstring>
#include <string>

#include "comm_driver_api.h"
#include "../json_mini.hpp"

namespace comm_util {

inline void setErr(char* errBuf, int32_t errBufLen, const std::string& msg) {
    if (!errBuf || errBufLen <= 0) return;
    std::snprintf(errBuf, static_cast<size_t>(errBufLen), "%s", msg.c_str());
}

inline bool ensureWinsock(char* errBuf, int32_t errBufLen) {
    static bool initialized = false;
    if (initialized) return true;
    WSADATA wsa{};
    int rc = WSAStartup(MAKEWORD(2, 2), &wsa);
    if (rc != 0) {
        setErr(errBuf, errBufLen, "WSAStartup failed: " + std::to_string(rc));
        return false;
    }
    initialized = true;
    return true;
}

inline SOCKET connectTcp(const std::string& host, int port, int timeoutMs, char* errBuf, int32_t errBufLen) {
    if (!ensureWinsock(errBuf, errBufLen)) return INVALID_SOCKET;

    struct addrinfo hints{};
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;

    struct addrinfo* res = nullptr;
    std::string portStr = std::to_string(port);
    int rc = getaddrinfo(host.c_str(), portStr.c_str(), &hints, &res);
    if (rc != 0 || !res) {
        setErr(errBuf, errBufLen, "DNS/address resolution failed for " + host + ":" + portStr);
        return INVALID_SOCKET;
    }

    SOCKET sock = INVALID_SOCKET;
    for (struct addrinfo* p = res; p != nullptr; p = p->ai_next) {
        sock = socket(p->ai_family, p->ai_socktype, p->ai_protocol);
        if (sock == INVALID_SOCKET) continue;

        DWORD tv = static_cast<DWORD>(timeoutMs > 0 ? timeoutMs : 2000);
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&tv), sizeof(tv));
        setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&tv), sizeof(tv));

        // Non-blocking connect with select for reliable timeout
        u_long nonBlock = 1;
        ioctlsocket(sock, FIONBIO, &nonBlock);
        int connRc = connect(sock, p->ai_addr, static_cast<int>(p->ai_addrlen));
        if (connRc == SOCKET_ERROR) {
            int werr = WSAGetLastError();
            if (werr == WSAEWOULDBLOCK || werr == WSAEINPROGRESS) {
                fd_set wfds;
                FD_ZERO(&wfds);
                FD_SET(sock, &wfds);
                timeval selTv{};
                selTv.tv_sec = tv / 1000;
                selTv.tv_usec = (tv % 1000) * 1000;
                int selRc = select(0, nullptr, &wfds, nullptr, &selTv);
                if (selRc > 0) {
                    int soErr = 0;
                    int optLen = sizeof(soErr);
                    getsockopt(sock, SOL_SOCKET, SO_ERROR, reinterpret_cast<char*>(&soErr), &optLen);
                    if (soErr == 0) {
                        u_long block = 0;
                        ioctlsocket(sock, FIONBIO, &block);
                        break;
                    }
                }
            }
            closesocket(sock);
            sock = INVALID_SOCKET;
            continue;
        }
        u_long block = 0;
        ioctlsocket(sock, FIONBIO, &block);
        break;
    }

    freeaddrinfo(res);
    if (sock == INVALID_SOCKET) {
        setErr(errBuf, errBufLen, "TCP connect failed to " + host + ":" + portStr);
    }
    return sock;
}

inline bool sendAll(SOCKET sock, const uint8_t* data, int len) {
    int sent = 0;
    while (sent < len) {
        int n = send(sock, reinterpret_cast<const char*>(data + sent), len - sent, 0);
        if (n <= 0) return false;
        sent += n;
    }
    return true;
}

inline bool recvExact(SOCKET sock, uint8_t* buf, int len) {
    int recvd = 0;
    while (recvd < len) {
        int n = recv(sock, reinterpret_cast<char*>(buf + recvd), len - recvd, 0);
        if (n <= 0) return false;
        recvd += n;
    }
    return true;
}

inline std::string cfgStr(const std::string& cfgJson, const char* key, const std::string& defVal) {
    if (cfgJson.empty()) return defVal;
    std::string out;
    if (json_mini::getStringField(cfgJson, key, out) && !out.empty()) return out;
    return defVal;
}

inline int cfgInt(const std::string& cfgJson, const char* key, int defVal) {
    if (cfgJson.empty()) return defVal;
    std::string raw;
    if (!json_mini::getRawField(cfgJson, key, raw) || raw.empty()) return defVal;
    return std::atoi(raw.c_str());
}

inline std::string toUpperTrim(const char* s) {
    if (!s) return "";
    std::string out;
    while (*s) {
        if (!std::isspace(static_cast<unsigned char>(*s))) {
            out.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(*s))));
        }
        ++s;
    }
    return out;
}

} // namespace comm_util
