#include "comm_manager.hpp"
#include "comm_driver_api.h"
#include "../json_mini.hpp"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <map>
#include <mutex>
#include <sstream>
#include <vector>

namespace {

struct LoadedDriver {
    HMODULE hMod = nullptr;
    CommDriverInfo info{};
    PFN_Comm_GetDriverInfo fnInfo = nullptr;
    PFN_Comm_Connect fnConnect = nullptr;
    PFN_Comm_Disconnect fnDisconnect = nullptr;
    PFN_Comm_GetStatus fnStatus = nullptr;
    PFN_Comm_ReadTag fnRead = nullptr;
    PFN_Comm_WriteTag fnWrite = nullptr;
};

struct ActiveConn {
    int id = 0;
    std::string driverId;
    LoadedDriver* drv = nullptr;
    void* handle = nullptr;
};

std::mutex g_mtx;
std::vector<LoadedDriver> g_drivers;
std::map<int, ActiveConn> g_conns;
int g_nextConnId = 1;

LoadedDriver* findDriver(const std::string& id) {
    for (auto& d : g_drivers) {
        if (id == d.info.id) return &d;
    }
    return nullptr;
}

std::string jsonErr(const std::string& msg) {
    return std::string("{\"ok\":false,\"error\":") + json_mini::escape(msg) + "}";
}

} // namespace

namespace comm_mgr {

void initDrivers(const std::wstring& exeDir) {
    std::lock_guard<std::mutex> lock(g_mtx);
    if (!g_drivers.empty()) return;

    std::wstring dir = exeDir;
    if (!dir.empty() && dir.back() != L'\\' && dir.back() != L'/') dir.push_back(L'\\');
    std::wstring search = dir + L"drivers\\*.dll";

    WIN32_FIND_DATAW fd{};
    HANDLE hFind = FindFirstFileW(search.c_str(), &fd);
    if (hFind == INVALID_HANDLE_VALUE) return;

    do {
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) continue;
        std::wstring dllPath = dir + L"drivers\\" + fd.cFileName;
        HMODULE hMod = LoadLibraryW(dllPath.c_str());
        if (!hMod) continue;

        LoadedDriver d{};
        d.hMod = hMod;
        d.fnInfo = reinterpret_cast<PFN_Comm_GetDriverInfo>(GetProcAddress(hMod, "Comm_GetDriverInfo"));
        d.fnConnect = reinterpret_cast<PFN_Comm_Connect>(GetProcAddress(hMod, "Comm_Connect"));
        d.fnDisconnect = reinterpret_cast<PFN_Comm_Disconnect>(GetProcAddress(hMod, "Comm_Disconnect"));
        d.fnStatus = reinterpret_cast<PFN_Comm_GetStatus>(GetProcAddress(hMod, "Comm_GetStatus"));
        d.fnRead = reinterpret_cast<PFN_Comm_ReadTag>(GetProcAddress(hMod, "Comm_ReadTag"));
        d.fnWrite = reinterpret_cast<PFN_Comm_WriteTag>(GetProcAddress(hMod, "Comm_WriteTag"));

        if (!d.fnInfo || !d.fnConnect || !d.fnDisconnect || !d.fnStatus || !d.fnRead || !d.fnWrite ||
            d.fnInfo(&d.info) != 0 || d.info.apiVersion != COMM_API_VERSION) {
            FreeLibrary(hMod);
            continue;
        }
        g_drivers.push_back(d);
    } while (FindNextFileW(hFind, &fd));

    FindClose(hFind);
}

void shutdown() {
    std::lock_guard<std::mutex> lock(g_mtx);
    for (auto& kv : g_conns) {
        if (kv.second.drv && kv.second.handle) {
            kv.second.drv->fnDisconnect(kv.second.handle);
        }
    }
    g_conns.clear();
    for (auto& d : g_drivers) {
        if (d.hMod) FreeLibrary(d.hMod);
    }
    g_drivers.clear();
}

std::string listDriversJson() {
    std::lock_guard<std::mutex> lock(g_mtx);
    std::ostringstream os;
    os << "{\"ok\":true,\"drivers\":[";
    for (size_t i = 0; i < g_drivers.size(); ++i) {
        if (i > 0) os << ',';
        const auto& info = g_drivers[i].info;
        os << "{\"id\":" << json_mini::escape(info.id)
           << ",\"name\":" << json_mini::escape(info.name)
           << ",\"version\":" << json_mini::escape(info.version)
           << ",\"transportMask\":" << info.transportMask
           << ",\"defaultPort\":" << info.defaultPort << "}";
    }
    os << "]}";
    return os.str();
}

std::string connectJson(const std::string& argsJson) {
    std::string driverId;
    if (!json_mini::getStringField(argsJson, "driverId", driverId) || driverId.empty()) {
        return jsonErr("Missing driverId");
    }

    std::lock_guard<std::mutex> lock(g_mtx);
    LoadedDriver* drv = findDriver(driverId);
    if (!drv) return jsonErr("Driver not loaded: " + driverId);

    void* handle = nullptr;
    char errBuf[256]{};
    if (drv->fnConnect(argsJson.c_str(), &handle, errBuf, sizeof(errBuf)) != 0 || !handle) {
        return jsonErr(errBuf[0] ? errBuf : "Connection failed");
    }

    int connId = g_nextConnId++;
    g_conns[connId] = ActiveConn{ connId, driverId, drv, handle };
    return std::string("{\"ok\":true,\"connId\":") + std::to_string(connId) + "}";
}

std::string disconnectJson(const std::string& argsJson) {
    std::string rawId;
    if (!json_mini::getRawField(argsJson, "connId", rawId) || rawId.empty()) return jsonErr("Missing connId");
    int connId = std::atoi(rawId.c_str());

    std::lock_guard<std::mutex> lock(g_mtx);
    auto it = g_conns.find(connId);
    if (it == g_conns.end()) return jsonErr("Connection not found");
    it->second.drv->fnDisconnect(it->second.handle);
    g_conns.erase(it);
    return "{\"ok\":true}";
}

std::string getStatusJson(const std::string& argsJson) {
    std::string rawId;
    if (!json_mini::getRawField(argsJson, "connId", rawId) || rawId.empty()) return jsonErr("Missing connId");
    int connId = std::atoi(rawId.c_str());

    std::lock_guard<std::mutex> lock(g_mtx);
    auto it = g_conns.find(connId);
    if (it == g_conns.end()) return "{\"ok\":true,\"connected\":false,\"status\":\"Disconnected\"}";
    int32_t connected = 0;
    char statusBuf[256]{};
    it->second.drv->fnStatus(it->second.handle, &connected, statusBuf, sizeof(statusBuf));
    return std::string("{\"ok\":true,\"connected\":") + (connected ? "true" : "false") +
           ",\"status\":" + json_mini::escape(statusBuf) + "}";
}

std::string readTagJson(const std::string& argsJson) {
    std::string rawId, address;
    if (!json_mini::getRawField(argsJson, "connId", rawId) || !json_mini::getStringField(argsJson, "address", address)) {
        return jsonErr("Missing connId or address");
    }
    int connId = std::atoi(rawId.c_str());

    LoadedDriver* drv = nullptr;
    void* handle = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mtx);
        auto it = g_conns.find(connId);
        if (it == g_conns.end()) return jsonErr("Connection not found");
        drv = it->second.drv;
        handle = it->second.handle;
    }

    CommTagValue val{};
    char errBuf[256]{};
    if (drv->fnRead(handle, address.c_str(), &val, errBuf, sizeof(errBuf)) != 0) {
        return jsonErr(errBuf[0] ? errBuf : "Read failed");
    }

    std::ostringstream os;
    os << "{\"ok\":true,\"dataType\":" << val.dataType << ",\"quality\":" << val.quality << ",\"value\":";
    if (val.dataType == COMM_TYPE_BOOL) os << (val.num.boolVal ? "true" : "false");
    else if (val.dataType == COMM_TYPE_INT16 || val.dataType == COMM_TYPE_INT32) os << val.num.i32Val;
    else if (val.dataType == COMM_TYPE_FLOAT32) os << val.num.f64Val;
    else if (val.dataType == COMM_TYPE_STRING) os << json_mini::escape(val.strVal);
    else os << val.num.u32Val;
    os << "}";
    return os.str();
}

std::string writeTagJson(const std::string& argsJson) {
    std::string rawId, address, rawVal;
    if (!json_mini::getRawField(argsJson, "connId", rawId) ||
        !json_mini::getStringField(argsJson, "address", address) ||
        !json_mini::getRawField(argsJson, "value", rawVal)) {
        return jsonErr("Missing connId, address, or value");
    }
    int connId = std::atoi(rawId.c_str());

    LoadedDriver* drv = nullptr;
    void* handle = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_mtx);
        auto it = g_conns.find(connId);
        if (it == g_conns.end()) return jsonErr("Connection not found");
        drv = it->second.drv;
        handle = it->second.handle;
    }

    CommTagValue tv{};
    if (rawVal == "true" || rawVal == "false") {
        tv.dataType = COMM_TYPE_BOOL;
        tv.num.boolVal = (rawVal == "true") ? 1 : 0;
    } else if (!rawVal.empty() && rawVal.front() == '"') {
        std::string strVal;
        json_mini::getStringField(argsJson, "value", strVal);
        tv.dataType = COMM_TYPE_STRING;
        std::snprintf(tv.strVal, sizeof(tv.strVal), "%s", strVal.c_str());
    } else {
        tv.dataType = COMM_TYPE_UINT32;
        long long n = std::atoll(rawVal.c_str());
        tv.num.u32Val = static_cast<uint32_t>(n);
        tv.num.i32Val = static_cast<int32_t>(n);
    }

    char errBuf[256]{};
    if (drv->fnWrite(handle, address.c_str(), &tv, errBuf, sizeof(errBuf)) != 0) {
        return jsonErr(errBuf[0] ? errBuf : "Write failed");
    }
    return "{\"ok\":true}";
}

} // namespace comm_mgr
