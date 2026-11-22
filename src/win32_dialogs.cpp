#include "win32_dialogs.hpp"
#include <shobjidl.h>
#include <shlwapi.h>
#include <filesystem>
#include <fstream>
#include <sstream>

namespace win32_dialogs {

std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), &w[0], n);
    return w;
}

std::string wideToUtf8(const std::wstring& w) {
    if (w.empty()) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, w.data(), static_cast<int>(w.size()), nullptr, 0, nullptr, nullptr);
    std::string s(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.data(), static_cast<int>(w.size()), &s[0], n, nullptr, nullptr);
    return s;
}

bool pickFolderDialog(HWND owner, const std::wstring& title, const std::wstring& defaultPath, std::wstring& outFolder) {
    IFileOpenDialog* pfd = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pfd));
    if (FAILED(hr) || !pfd) return false;

    DWORD opts = 0;
    pfd->GetOptions(&opts);
    pfd->SetOptions(opts | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
    pfd->SetTitle(title.c_str());

    if (!defaultPath.empty()) {
        IShellItem* psi = nullptr;
        if (SUCCEEDED(SHCreateItemFromParsingName(defaultPath.c_str(), nullptr, IID_PPV_ARGS(&psi))) && psi) {
            pfd->SetFolder(psi);
            psi->Release();
        }
    }

    bool ok = false;
    if (SUCCEEDED(pfd->Show(owner))) {
        IShellItem* psiResult = nullptr;
        if (SUCCEEDED(pfd->GetResult(&psiResult)) && psiResult) {
            PWSTR pszPath = nullptr;
            if (SUCCEEDED(psiResult->GetDisplayName(SIGDN_FILESYSPATH, &pszPath)) && pszPath) {
                outFolder = pszPath;
                CoTaskMemFree(pszPath);
                ok = true;
            }
            psiResult->Release();
        }
    }
    pfd->Release();
    return ok;
}

bool openFileDialog(HWND owner, const std::wstring& title, const std::vector<FileFilter>& filters, std::wstring& outPath) {
    IFileOpenDialog* pfd = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pfd));
    if (FAILED(hr) || !pfd) return false;

    DWORD opts = 0;
    pfd->GetOptions(&opts);
    pfd->SetOptions(opts | FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST);
    pfd->SetTitle(title.c_str());

    if (!filters.empty()) {
        std::vector<COMDLG_FILTERSPEC> specs;
        for (const auto& f : filters) {
            specs.push_back({ f.name, f.spec });
        }
        pfd->SetFileTypes(static_cast<UINT>(specs.size()), specs.data());
    }

    bool ok = false;
    if (SUCCEEDED(pfd->Show(owner))) {
        IShellItem* psiResult = nullptr;
        if (SUCCEEDED(pfd->GetResult(&psiResult)) && psiResult) {
            PWSTR pszPath = nullptr;
            if (SUCCEEDED(psiResult->GetDisplayName(SIGDN_FILESYSPATH, &pszPath)) && pszPath) {
                outPath = pszPath;
                CoTaskMemFree(pszPath);
                ok = true;
            }
            psiResult->Release();
        }
    }
    pfd->Release();
    return ok;
}

bool saveFileDialog(HWND owner, const std::wstring& title, const std::wstring& defaultName, const std::vector<FileFilter>& filters, const std::wstring& defaultExt, std::wstring& outPath) {
    IFileSaveDialog* pfd = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pfd));
    if (FAILED(hr) || !pfd) return false;

    DWORD opts = 0;
    pfd->GetOptions(&opts);
    pfd->SetOptions(opts | FOS_FORCEFILESYSTEM | FOS_OVERWRITEPROMPT);
    pfd->SetTitle(title.c_str());
    if (!defaultName.empty()) pfd->SetFileName(defaultName.c_str());
    if (!defaultExt.empty()) pfd->SetDefaultExtension(defaultExt.c_str());

    if (!filters.empty()) {
        std::vector<COMDLG_FILTERSPEC> specs;
        for (const auto& f : filters) {
            specs.push_back({ f.name, f.spec });
        }
        pfd->SetFileTypes(static_cast<UINT>(specs.size()), specs.data());
    }

    bool ok = false;
    if (SUCCEEDED(pfd->Show(owner))) {
        IShellItem* psiResult = nullptr;
        if (SUCCEEDED(pfd->GetResult(&psiResult)) && psiResult) {
            PWSTR pszPath = nullptr;
            if (SUCCEEDED(psiResult->GetDisplayName(SIGDN_FILESYSPATH, &pszPath)) && pszPath) {
                outPath = pszPath;
                CoTaskMemFree(pszPath);
                ok = true;
            }
            psiResult->Release();
        }
    }
    pfd->Release();
    return ok;
}

bool ensureDirectoryRecursive(const std::wstring& dirPath) {
    if (dirPath.empty()) return true;
    std::error_code ec;
    std::filesystem::create_directories(std::filesystem::path(dirPath), ec);
    return !ec;
}

bool readFileUtf8(const std::wstring& filePath, std::string& outContent, std::string& outError) {
    std::ifstream ifs(filePath.c_str(), std::ios::binary);
    if (!ifs.is_open()) {
        outError = "Failed to open file for reading.";
        return false;
    }
    std::ostringstream ss;
    ss << ifs.rdbuf();
    outContent = ss.str();
    return true;
}

bool writeFileUtf8(const std::wstring& filePath, const std::string& content, std::string& outError) {
    wchar_t buf[MAX_PATH * 2] = {};
    wcsncpy(buf, filePath.c_str(), MAX_PATH * 2 - 1);
    PathRemoveFileSpecW(buf);
    if (wcslen(buf) > 0) {
        ensureDirectoryRecursive(buf);
    }

    std::ofstream ofs(filePath.c_str(), std::ios::binary | std::ios::trunc);
    if (!ofs.is_open()) {
        outError = "Failed to open file for writing.";
        return false;
    }
    ofs.write(content.data(), static_cast<std::streamsize>(content.size()));
    ofs.close();
    return true;
}

} // namespace win32_dialogs
