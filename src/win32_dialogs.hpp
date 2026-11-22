#pragma once
#include <string>
#include <vector>
#include <windows.h>

namespace win32_dialogs {

std::wstring utf8ToWide(const std::string& s);
std::string wideToUtf8(const std::wstring& w);

struct FileFilter {
    const wchar_t* name;
    const wchar_t* spec;
};

bool pickFolderDialog(HWND owner, const std::wstring& title, const std::wstring& defaultPath, std::wstring& outFolder);
bool openFileDialog(HWND owner, const std::wstring& title, const std::vector<FileFilter>& filters, std::wstring& outPath);
bool saveFileDialog(HWND owner, const std::wstring& title, const std::wstring& defaultName, const std::vector<FileFilter>& filters, const std::wstring& defaultExt, std::wstring& outPath);

bool ensureDirectoryRecursive(const std::wstring& dirPath);
bool readFileUtf8(const std::wstring& filePath, std::string& outContent, std::string& outError);
bool writeFileUtf8(const std::wstring& filePath, const std::string& content, std::string& outError);

} // namespace win32_dialogs

