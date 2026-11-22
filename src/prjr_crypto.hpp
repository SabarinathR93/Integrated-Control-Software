#pragma once
#include <string>
#include <vector>
#include <cstdint>

namespace prjr_crypto {

bool writeEncryptedPrjr(const std::wstring& filePath,
                        const std::string& compiledJsonUtf8,
                        size_t& outTotalBytes,
                        std::string& outError);

} // namespace prjr_crypto

