#pragma once

#include <stdint.h>

#ifdef _WIN32
  #ifdef COMM_DRIVER_EXPORTS
    #define COMM_API extern "C" __declspec(dllexport)
  #else
    #define COMM_API extern "C" __declspec(dllimport)
  #endif
#else
  #define COMM_API extern "C"
#endif

#define COMM_API_VERSION 1

enum CommTransportType {
    COMM_TRANSPORT_TCP = 1,
    COMM_TRANSPORT_SERIAL = 2,
    COMM_TRANSPORT_ETHERNET_RAW = 3,
    COMM_TRANSPORT_UDP = 4
};

enum CommDataType {
    COMM_TYPE_BOOL = 1,
    COMM_TYPE_INT16 = 2,
    COMM_TYPE_UINT16 = 3,
    COMM_TYPE_INT32 = 4,
    COMM_TYPE_UINT32 = 5,
    COMM_TYPE_FLOAT32 = 6,
    COMM_TYPE_STRING = 7
};

#pragma pack(push, 8)
struct CommDriverInfo {
    int32_t apiVersion;
    char id[32];          // e.g. "modbus", "melsec_mc", "ethercat"
    char name[64];        // e.g. "Modbus TCP / RTU"
    char version[16];     // e.g. "1.0.0"
    int32_t transportMask;// bitmask of CommTransportType
    int32_t defaultPort;  // e.g. 502, 5000, 102, 9600, 44818, 0
};

struct CommTagValue {
    int32_t dataType;     // CommDataType
    int32_t quality;      // 1 = GOOD, 0 = BAD
    union {
        int32_t boolVal;
        int32_t i32Val;
        uint32_t u32Val;
        double f64Val;
    } num;
    char strVal[128];
};
#pragma pack(pop)

// Exported function signatures for dynamic loading
typedef int32_t (*PFN_Comm_GetDriverInfo)(CommDriverInfo* outInfo);
typedef int32_t (*PFN_Comm_Connect)(const char* configJson, void** outHandle, char* errBuf, int32_t errBufLen);
typedef int32_t (*PFN_Comm_Disconnect)(void* handle);
typedef int32_t (*PFN_Comm_GetStatus)(void* handle, int32_t* outConnected, char* statusBuf, int32_t statusBufLen);
typedef int32_t (*PFN_Comm_ReadTag)(void* handle, const char* address, CommTagValue* outValue, char* errBuf, int32_t errBufLen);
typedef int32_t (*PFN_Comm_WriteTag)(void* handle, const char* address, const CommTagValue* value, char* errBuf, int32_t errBufLen);

