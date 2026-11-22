#include "prjr_crypto.hpp"
#include <windows.h>
#include <bcrypt.h>
#include <fstream>
#include <cstring>

namespace prjr_crypto {

static bool sha256Digest(const void* data, size_t len, std::vector<uint8_t>& outHash) {
    BCRYPT_ALG_HANDLE hAlg = nullptr;
    BCRYPT_HASH_HANDLE hHash = nullptr;
    if (!BCRYPT_SUCCESS(BCryptOpenAlgorithmProvider(&hAlg, BCRYPT_SHA256_ALGORITHM, nullptr, 0))) {
        return false;
    }
    DWORD hashLen = 0, cbData = 0;
    BCryptGetProperty(hAlg, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hashLen), sizeof(hashLen), &cbData, 0);
    outHash.resize(hashLen);

    bool ok = false;
    if (BCRYPT_SUCCESS(BCryptCreateHash(hAlg, &hHash, nullptr, 0, nullptr, 0, 0))) {
        if (BCRYPT_SUCCESS(BCryptHashData(hHash, reinterpret_cast<PUCHAR>(const_cast<void*>(data)), static_cast<ULONG>(len), 0))) {
            if (BCRYPT_SUCCESS(BCryptFinishHash(hHash, outHash.data(), hashLen, 0))) {
                ok = true;
            }
        }
        BCryptDestroyHash(hHash);
    }
    BCryptCloseAlgorithmProvider(hAlg, 0);
    return ok;
}

bool writeEncryptedPrjr(const std::wstring& filePath,
                        const std::string& compiledJsonUtf8,
                        size_t& outTotalBytes,
                        std::string& outError) {
    // Master key matches main.js: SHA256('HMI_RUNTIME_PROTECTED_CORE_KEY_V1_2026')
    static const char* kPassphrase = "HMI_RUNTIME_PROTECTED_CORE_KEY_V1_2026";
    std::vector<uint8_t> masterKey;
    if (!sha256Digest(kPassphrase, std::strlen(kPassphrase), masterKey) || masterKey.size() != 32) {
        outError = "Failed to derive SHA-256 master key.";
        return false;
    }

    // 12-byte random IV for AES-256-GCM
    uint8_t iv[12] = {};
    if (!BCRYPT_SUCCESS(BCryptGenRandom(nullptr, iv, sizeof(iv), BCRYPT_USE_SYSTEM_PREFERRED_RNG))) {
        outError = "Failed to generate random IV.";
        return false;
    }

    BCRYPT_ALG_HANDLE hAesAlg = nullptr;
    if (!BCRYPT_SUCCESS(BCryptOpenAlgorithmProvider(&hAesAlg, BCRYPT_AES_ALGORITHM, nullptr, 0))) {
        outError = "Failed to open AES algorithm provider.";
        return false;
    }

    if (!BCRYPT_SUCCESS(BCryptSetProperty(hAesAlg, BCRYPT_CHAINING_MODE,
                                          reinterpret_cast<PUCHAR>(const_cast<wchar_t*>(BCRYPT_CHAIN_MODE_GCM)),
                                          sizeof(BCRYPT_CHAIN_MODE_GCM), 0))) {
        BCryptCloseAlgorithmProvider(hAesAlg, 0);
        outError = "Failed to configure AES-GCM chaining mode.";
        return false;
    }

    BCRYPT_KEY_HANDLE hKey = nullptr;
    if (!BCRYPT_SUCCESS(BCryptGenerateSymmetricKey(hAesAlg, &hKey, nullptr, 0,
                                                   masterKey.data(), static_cast<ULONG>(masterKey.size()), 0))) {
        BCryptCloseAlgorithmProvider(hAesAlg, 0);
        outError = "Failed to create AES-256 key.";
        return false;
    }

    uint8_t authTag[16] = {};
    BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO authInfo;
    BCRYPT_INIT_AUTH_MODE_INFO(authInfo);
    authInfo.pbNonce = iv;
    authInfo.cbNonce = sizeof(iv);
    authInfo.pbTag = authTag;
    authInfo.cbTag = sizeof(authTag);

    ULONG plainLen = static_cast<ULONG>(compiledJsonUtf8.size());
    std::vector<uint8_t> cipherText(plainLen);
    ULONG cipherBytesWritten = 0;

    NTSTATUS status = BCryptEncrypt(
        hKey,
        reinterpret_cast<PUCHAR>(const_cast<char*>(compiledJsonUtf8.data())),
        plainLen,
        &authInfo,
        nullptr, 0,
        cipherText.data(),
        static_cast<ULONG>(cipherText.size()),
        &cipherBytesWritten,
        0
    );

    BCryptDestroyKey(hKey);
    BCryptCloseAlgorithmProvider(hAesAlg, 0);

    if (!BCRYPT_SUCCESS(status)) {
        outError = "AES-256-GCM encryption failed.";
        return false;
    }
    cipherText.resize(cipherBytesWritten);

    // Binary Container matching main.js:
    // [0..3]:   'PRJR'
    // [4..7]:   0x00010000 (uint32BE)
    // [8..19]:  IV (12 bytes)
    // [20..35]: AuthTag (16 bytes)
    // [36..39]: Encrypted Payload Length (uint32BE)
    // [40..]:   Encrypted Payload
    std::vector<uint8_t> container;
    container.reserve(40 + cipherText.size());
    container.push_back('P'); container.push_back('R'); container.push_back('J'); container.push_back('R');

    uint32_t ver = 0x00010000;
    container.push_back(static_cast<uint8_t>((ver >> 24) & 0xFF));
    container.push_back(static_cast<uint8_t>((ver >> 16) & 0xFF));
    container.push_back(static_cast<uint8_t>((ver >> 8) & 0xFF));
    container.push_back(static_cast<uint8_t>(ver & 0xFF));

    container.insert(container.end(), iv, iv + 12);
    container.insert(container.end(), authTag, authTag + 16);

    uint32_t lenBE = static_cast<uint32_t>(cipherText.size());
    container.push_back(static_cast<uint8_t>((lenBE >> 24) & 0xFF));
    container.push_back(static_cast<uint8_t>((lenBE >> 16) & 0xFF));
    container.push_back(static_cast<uint8_t>((lenBE >> 8) & 0xFF));
    container.push_back(static_cast<uint8_t>(lenBE & 0xFF));

    container.insert(container.end(), cipherText.begin(), cipherText.end());

    std::ofstream ofs(filePath.c_str(), std::ios::binary | std::ios::trunc);
    if (!ofs.is_open()) {
        outError = "Unable to open output .prjr file for writing.";
        return false;
    }
    ofs.write(reinterpret_cast<const char*>(container.data()), static_cast<std::streamsize>(container.size()));
    ofs.close();

    outTotalBytes = container.size();
    return true;
}

} // namespace prjr_crypto

