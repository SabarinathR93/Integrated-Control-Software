#pragma once

#include <string>

namespace comm_mgr {

// Scans <exeDir>/drivers/*.dll and loads all valid driver plugins.
void initDrivers(const std::wstring& exeDir);

// Unloads all active connections and driver DLLs.
void shutdown();

// JSON APIs called by WebMessageHandler in main.cpp
std::string listDriversJson();
std::string connectJson(const std::string& argsJson);
std::string disconnectJson(const std::string& argsJson);
std::string getStatusJson(const std::string& argsJson);
std::string readTagJson(const std::string& argsJson);
std::string writeTagJson(const std::string& argsJson);

} // namespace comm_mgr

