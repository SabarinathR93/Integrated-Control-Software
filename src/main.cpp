#include <windows.h>
#include <initguid.h>
#include <shlwapi.h>
#include <string>
#include <atomic>
#include <cstdio>

#include "WebView2.h"
#include "json_mini.hpp"
#include "win32_dialogs.hpp"
#include "prjr_crypto.hpp"

// Dynamically loaded from WebView2Loader.dll
typedef HRESULT(STDAPICALLTYPE* PFN_CreateCoreWebView2EnvironmentWithOptions)(
    PCWSTR browserExecutableFolder,
    PCWSTR userDataFolder,
    ICoreWebView2EnvironmentOptions* environmentOptions,
    ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler* environmentCreatedHandler);

static HWND g_hwnd = nullptr;
static ICoreWebView2Controller* g_controller = nullptr;
static ICoreWebView2* g_webview = nullptr;
static std::wstring g_startupFilePath;

static std::wstring getExeDirectory() {
    wchar_t buf[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, buf, MAX_PATH);
    PathRemoveFileSpecW(buf);
    return std::wstring(buf);
}

static void sendBridgeReply(const std::string& id, const std::string& resultJson) {
    if (!g_webview) return;
    std::string script = "window.__cppBridgeResolve && window.__cppBridgeResolve(" +
        json_mini::escape(id) + ", " + resultJson + ");";
    std::wstring wScript = win32_dialogs::utf8ToWide(script);
    g_webview->ExecuteScript(wScript.c_str(), nullptr);
}

static bool isAbsoluteWinPath(const std::wstring& p) {
    if (p.size() >= 2 && p[1] == L':') return true;
    if (p.size() >= 2 && p[0] == L'\\' && p[1] == L'\\') return true;
    return false;
}

static std::wstring baseNameOf(const std::wstring& p) {
    const wchar_t* bn = PathFindFileNameW(p.c_str());
    return bn ? std::wstring(bn) : p;
}

static void handleBridgeMessage(const std::string& msgJson) {
    std::string id, method, argsRaw;
    if (!json_mini::getStringField(msgJson, "id", id)) return;
    if (!json_mini::getStringField(msgJson, "method", method)) {
        sendBridgeReply(id, "{\"success\":false,\"error\":\"Missing method\"}");
        return;
    }
    json_mini::getRawField(msgJson, "args", argsRaw);

    if (method == "get-startup-file") {
        if (!g_startupFilePath.empty() && PathFileExistsW(g_startupFilePath.c_str())) {
            std::string content, err;
            if (win32_dialogs::readFileUtf8(g_startupFilePath, content, err)) {
                std::string res = "{\"path\":" + json_mini::escape(win32_dialogs::wideToUtf8(g_startupFilePath)) +
                                  ",\"data\":" + content + "}";
                sendBridgeReply(id, res);
                return;
            }
        }
        sendBridgeReply(id, "null");
        return;
    }

    if (method == "select-folder") {
        std::string defPathUtf8;
        if (argsRaw.size() >= 2 && argsRaw[0] == '"') {
            size_t idx = 0;
            json_mini::parseStringAt(argsRaw, idx, defPathUtf8);
        } else {
            json_mini::getStringField(argsRaw, "defaultPath", defPathUtf8);
        }
        std::wstring defWide = win32_dialogs::utf8ToWide(defPathUtf8);
        if (!defWide.empty() && !PathFileExistsW(defWide.c_str())) defWide.clear();

        std::wstring chosen;
        if (win32_dialogs::pickFolderDialog(g_hwnd, L"Select Project Location Folder", defWide, chosen)) {
            sendBridgeReply(id, "{\"success\":true,\"folderPath\":" + json_mini::escape(win32_dialogs::wideToUtf8(chosen)) + "}");
        } else {
            sendBridgeReply(id, "{\"success\":false,\"canceled\":true}");
        }
        return;
    }

    if (method == "save-project") {
        std::string projNameUtf8, projDataRaw;
        json_mini::getStringField(argsRaw, "projectName", projNameUtf8);
        if (!json_mini::getRawField(argsRaw, "projectData", projDataRaw)) projDataRaw = "{}";

        std::wstring targetPath = win32_dialogs::utf8ToWide(projNameUtf8);
        if (targetPath.empty() || !isAbsoluteWinPath(targetPath)) {
            std::wstring chosen;
            std::wstring defName = targetPath.empty() ? L"MyProject.hmiproj" : baseNameOf(targetPath);
            if (!win32_dialogs::saveFileDialog(
                    g_hwnd, L"Save HMI Designer Project", defName,
                    {{ L"HMI Project (*.hmiproj)", L"*.hmiproj" }, { L"JSON Project (*.json)", L"*.json" }},
                    L"hmiproj", chosen)) {
                sendBridgeReply(id, "{\"success\":false,\"canceled\":true}");
                return;
            }
            targetPath = chosen;
        }

        std::string err;
        if (win32_dialogs::writeFileUtf8(targetPath, projDataRaw, err)) {
            sendBridgeReply(id, "{\"success\":true,\"path\":" + json_mini::escape(win32_dialogs::wideToUtf8(targetPath)) + "}");
        } else {
            sendBridgeReply(id, "{\"success\":false,\"error\":" + json_mini::escape(err) + "}");
        }
        return;
    }

    if (method == "save-project-as") {
        std::string projNameUtf8, projDataRaw;
        json_mini::getStringField(argsRaw, "projectName", projNameUtf8);
        if (!json_mini::getRawField(argsRaw, "projectData", projDataRaw)) projDataRaw = "{}";

        std::wstring defName = projNameUtf8.empty() ? L"MyProject.hmiproj" : baseNameOf(win32_dialogs::utf8ToWide(projNameUtf8));
        std::wstring chosen;
        if (!win32_dialogs::saveFileDialog(
                g_hwnd, L"Save HMI Project As", defName,
                {{ L"HMI Project (*.hmiproj)", L"*.hmiproj" }, { L"JSON Project (*.json)", L"*.json" }},
                L"hmiproj", chosen)) {
            sendBridgeReply(id, "{\"success\":false,\"canceled\":true}");
            return;
        }

        std::string err;
        if (win32_dialogs::writeFileUtf8(chosen, projDataRaw, err)) {
            sendBridgeReply(id, "{\"success\":true,\"path\":" + json_mini::escape(win32_dialogs::wideToUtf8(chosen)) + "}");
        } else {
            sendBridgeReply(id, "{\"success\":false,\"error\":" + json_mini::escape(err) + "}");
        }
        return;
    }

    if (method == "open-project") {
        std::string filePathUtf8;
        json_mini::getStringField(argsRaw, "filePath", filePathUtf8);
        std::wstring filePath = win32_dialogs::utf8ToWide(filePathUtf8);
        if (filePath.empty()) {
            if (!win32_dialogs::openFileDialog(
                    g_hwnd, L"Open HMI Designer Project",
                    {{ L"HMI Project Files (*.hmiproj; *.json)", L"*.hmiproj;*.json" }},
                    filePath)) {
                sendBridgeReply(id, "{\"success\":false,\"canceled\":true}");
                return;
            }
        }

        std::string content, err;
        if (win32_dialogs::readFileUtf8(filePath, content, err)) {
            std::string res = "{\"success\":true,\"path\":" + json_mini::escape(win32_dialogs::wideToUtf8(filePath)) +
                              ",\"data\":" + content + "}";
            sendBridgeReply(id, res);
        } else {
            sendBridgeReply(id, "{\"success\":false,\"error\":" + json_mini::escape(err) + "}");
        }
        return;
    }

    if (method == "compile-project") {
        std::string projNameUtf8, compiledDataRaw;
        json_mini::getStringField(argsRaw, "projectName", projNameUtf8);
        if (!json_mini::getRawField(argsRaw, "compiledData", compiledDataRaw)) compiledDataRaw = "{}";

        std::wstring defName = projNameUtf8.empty() ? L"ProductionProject.prjr" : baseNameOf(win32_dialogs::utf8ToWide(projNameUtf8));
        std::wstring chosen;
        if (!win32_dialogs::saveFileDialog(
                g_hwnd, L"Compile & Export Runtime Package (.prjr)", defName,
                {{ L"HMI Runtime Package (*.prjr)", L"*.prjr" }},
                L"prjr", chosen)) {
            sendBridgeReply(id, "{\"success\":false,\"canceled\":true}");
            return;
        }

        size_t totalBytes = 0;
        std::string err;
        if (prjr_crypto::writeEncryptedPrjr(chosen, compiledDataRaw, totalBytes, err)) {
            char sizeBuf[64] = {};
            std::snprintf(sizeBuf, sizeof(sizeBuf), "%zu", totalBytes);
            sendBridgeReply(id, "{\"success\":true,\"path\":" + json_mini::escape(win32_dialogs::wideToUtf8(chosen)) +
                                ",\"sizeBytes\":" + sizeBuf + "}");
        } else {
            sendBridgeReply(id, "{\"success\":false,\"error\":" + json_mini::escape(err) + "}");
        }
        return;
    }

    if (method == "export-project") {
        std::string projNameUtf8, projDataRaw;
        json_mini::getStringField(argsRaw, "projectName", projNameUtf8);
        if (!json_mini::getRawField(argsRaw, "projectData", projDataRaw)) projDataRaw = "{}";

        std::wstring defName = projNameUtf8.empty() ? L"MyProject.json" : baseNameOf(win32_dialogs::utf8ToWide(projNameUtf8));
        std::wstring chosen;
        if (!win32_dialogs::saveFileDialog(
                g_hwnd, L"Export Project JSON", defName,
                {{ L"JSON Project (*.json)", L"*.json" }},
                L"json", chosen)) {
            sendBridgeReply(id, "{\"success\":false,\"canceled\":true}");
            return;
        }

        std::string err;
        if (win32_dialogs::writeFileUtf8(chosen, projDataRaw, err)) {
            sendBridgeReply(id, "{\"success\":true,\"path\":" + json_mini::escape(win32_dialogs::wideToUtf8(chosen)) + "}");
        } else {
            sendBridgeReply(id, "{\"success\":false,\"error\":" + json_mini::escape(err) + "}");
        }
        return;
    }

    if (method == "delete-project") {
        std::string filePathUtf8;
        json_mini::getStringField(argsRaw, "filePath", filePathUtf8);
        std::wstring fp = win32_dialogs::utf8ToWide(filePathUtf8);
        if (fp.empty() || !PathFileExistsW(fp.c_str())) {
            sendBridgeReply(id, "{\"success\":false,\"error\":\"File not found\"}");
            return;
        }
        if (DeleteFileW(fp.c_str())) {
            sendBridgeReply(id, "{\"success\":true}");
        } else {
            sendBridgeReply(id, "{\"success\":false,\"error\":\"DeleteFileW failed\"}");
        }
        return;
    }

    sendBridgeReply(id, "{\"success\":false,\"error\":\"Unknown method\"}");
}

// Lightweight COM Callback Implementations for MinGW-w64 Compatibility
template <typename Interface>
class ComBase : public Interface {
public:
    virtual ~ComBase() = default;
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refCount_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG r = --refCount_;
        if (r == 0) delete this;
        return r;
    }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppv) override {
        if (!ppv) return E_POINTER;
        if (riid == IID_IUnknown) {
            *ppv = static_cast<Interface*>(this);
            AddRef();
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }
private:
    std::atomic<ULONG> refCount_{1};
};

class WebMessageHandler : public ComBase<ICoreWebView2WebMessageReceivedEventHandler> {
public:
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) override {
        if (!args) return S_OK;
        PWSTR msgWide = nullptr;
        if (SUCCEEDED(args->get_WebMessageAsJson(&msgWide)) && msgWide) {
            std::string msgUtf8 = win32_dialogs::wideToUtf8(msgWide);
            CoTaskMemFree(msgWide);
            handleBridgeMessage(msgUtf8);
        }
        return S_OK;
    }
};

class ControllerCompletedHandler : public ComBase<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler> {
public:
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT result, ICoreWebView2Controller* controller) override {
        if (FAILED(result) || !controller) {
            MessageBoxW(g_hwnd, L"Failed to initialize WebView2 Controller.", L"Machine Control Studio (C++)", MB_ICONERROR);
            return S_OK;
        }
        g_controller = controller;
        g_controller->AddRef();
        g_controller->get_CoreWebView2(&g_webview);

        RECT bounds;
        GetClientRect(g_hwnd, &bounds);
        g_controller->put_Bounds(bounds);

        // Match WebView2 background to #EDEBE6 startup backdrop (eliminates white flash)
        ICoreWebView2Controller2* controller2 = nullptr;
        if (SUCCEEDED(g_controller->QueryInterface(IID_ICoreWebView2Controller2, reinterpret_cast<void**>(&controller2))) && controller2) {
            COREWEBVIEW2_COLOR bg{ 255, 0xED, 0xEB, 0xE6 };
            controller2->put_DefaultBackgroundColor(bg);
            controller2->Release();
        }

        // Map https://app.local/ -> <exe_dir>/app for clean local asset loading
        ICoreWebView2_3* webview3 = nullptr;
        if (SUCCEEDED(g_webview->QueryInterface(IID_ICoreWebView2_3, reinterpret_cast<void**>(&webview3))) && webview3) {
            std::wstring appDir = getExeDirectory() + L"\\app";
            webview3->SetVirtualHostNameToFolderMapping(
                L"app.local",
                appDir.c_str(),
                COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
            webview3->Release();
        }

        // Inject window.electronAPI C++ Native Bridge before any page script executes
        static const wchar_t* kBridgeScript = LR"JS(
(function() {
  if (window.electronAPI) return;
  let seq = 1;
  const pending = new Map();
  const fileOpenedCallbacks = [];

  window.__cppBridgeResolve = function(id, result) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    entry.resolve(result);
  };

  window.__cppDispatchFileOpened = function(payload) {
    fileOpenedCallbacks.forEach(cb => {
      try { cb(payload); } catch (_) {}
    });
  };

  function invoke(method, args) {
    return new Promise((resolve, reject) => {
      const id = 'cpp_' + (seq++);
      pending.set(id, { resolve, reject });
      window.chrome.webview.postMessage({ id, method, args: args === undefined ? null : args });
    });
  }

  window.electronAPI = {
    selectFolder: (defaultPath) => invoke('select-folder', { defaultPath: defaultPath || '' }),
    saveProject: (payload) => invoke('save-project', payload),
    saveProjectAs: (payload) => invoke('save-project-as', payload),
    openProject: (payload) => invoke('open-project', payload || {}),
    compileProject: (payload) => invoke('compile-project', payload),
    exportProject: (payload) => invoke('export-project', payload),
    deleteProject: (payload) => invoke('delete-project', payload),
    getStartupFile: () => invoke('get-startup-file', {}),
    onFileOpened: (cb) => { if (typeof cb === 'function') fileOpenedCallbacks.push(cb); }
  };
})();
)JS";
        g_webview->AddScriptToExecuteOnDocumentCreated(kBridgeScript, nullptr);

        EventRegistrationToken token{};
        g_webview->add_WebMessageReceived(new WebMessageHandler(), &token);

        g_webview->Navigate(L"https://app.local/index.html");
        return S_OK;
    }
};

class EnvironmentCompletedHandler : public ComBase<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler> {
public:
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT result, ICoreWebView2Environment* env) override {
        if (FAILED(result) || !env) {
            MessageBoxW(g_hwnd,
                        L"Microsoft Edge WebView2 Runtime is required to run Machine Control Studio (C++).",
                        L"Machine Control Studio (C++)", MB_ICONERROR);
            return S_OK;
        }
        env->CreateCoreWebView2Controller(g_hwnd, new ControllerCompletedHandler());
        return S_OK;
    }
};

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_GETMINMAXINFO: {
            MINMAXINFO* mmi = reinterpret_cast<MINMAXINFO*>(lParam);
            if (mmi) {
                mmi->ptMinTrackSize.x = 960;
                mmi->ptMinTrackSize.y = 620;
            }
            return 0;
        }
        case WM_DPICHANGED: {
            const RECT* prcNewWindow = reinterpret_cast<const RECT*>(lParam);
            if (prcNewWindow) {
                SetWindowPos(hwnd, nullptr,
                    prcNewWindow->left,
                    prcNewWindow->top,
                    prcNewWindow->right - prcNewWindow->left,
                    prcNewWindow->bottom - prcNewWindow->top,
                    SWP_NOZORDER | SWP_NOACTIVATE);
            }
            if (g_controller) {
                RECT bounds;
                GetClientRect(hwnd, &bounds);
                g_controller->put_Bounds(bounds);
            }
            return 0;
        }
        case WM_SIZE:
            if (g_controller) {
                RECT bounds;
                GetClientRect(hwnd, &bounds);
                g_controller->put_Bounds(bounds);
            }
            return 0;
        case WM_DESTROY:
            if (g_webview) { g_webview->Release(); g_webview = nullptr; }
            if (g_controller) { g_controller->Release(); g_controller = nullptr; }
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static void enablePerMonitorDpiAwareness() {
    HMODULE hUser32 = GetModuleHandleW(L"user32.dll");
    if (hUser32) {
        using PFN_SetDpiCtx = BOOL(WINAPI*)(DPI_AWARENESS_CONTEXT);
        auto pfn = reinterpret_cast<PFN_SetDpiCtx>(GetProcAddress(hUser32, "SetProcessDpiAwarenessContext"));
        if (pfn && pfn(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
            return;
        }
    }
    SetProcessDPIAware();
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR, int nCmdShow) {
    enablePerMonitorDpiAwareness();
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (argv) {
        for (int i = 1; i < argc; ++i) {
            std::wstring arg = argv[i];
            if (!arg.empty() && arg[0] != L'-' && PathFileExistsW(arg.c_str())) {
                g_startupFilePath = arg;
                break;
            }
        }
        LocalFree(argv);
    }

    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.hbrBackground = CreateSolidBrush(RGB(0xED, 0xEB, 0xE6));
    wc.lpszClassName = L"MachineControlStudioCppWnd";
    RegisterClassExW(&wc);

    RECT wa{ 0, 0, 1440, 920 };
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &wa, 0);
    int waW = wa.right - wa.left;
    int waH = wa.bottom - wa.top;
    int initW = (waW * 9) / 10;
    int initH = (waH * 9) / 10;
    if (initW < 960) initW = waW;
    if (initH < 620) initH = waH;
    int initX = wa.left + (waW - initW) / 2;
    int initY = wa.top + (waH - initH) / 2;

    g_hwnd = CreateWindowExW(
        0,
        wc.lpszClassName,
        L"Machine Control Studio (C++ Native)",
        WS_OVERLAPPEDWINDOW,
        initX, initY, initW, initH,
        nullptr, nullptr, hInstance, nullptr);

    if (!g_hwnd) return 1;

    ShowWindow(g_hwnd, SW_SHOWMAXIMIZED);
    UpdateWindow(g_hwnd);

    std::wstring loaderPath = getExeDirectory() + L"\\WebView2Loader.dll";
    HMODULE hLoader = LoadLibraryW(loaderPath.c_str());
    if (!hLoader) hLoader = LoadLibraryW(L"WebView2Loader.dll");

    auto pfnCreateEnv = hLoader
        ? reinterpret_cast<PFN_CreateCoreWebView2EnvironmentWithOptions>(
              GetProcAddress(hLoader, "CreateCoreWebView2EnvironmentWithOptions"))
        : nullptr;

    if (!pfnCreateEnv) {
        MessageBoxW(g_hwnd, L"WebView2Loader.dll not found next to executable.", L"Machine Control Studio (C++)", MB_ICONERROR);
        return 1;
    }

    wchar_t localAppData[MAX_PATH] = {};
    std::wstring userDataDir;
    if (GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH) > 0) {
        userDataDir = std::wstring(localAppData) + L"\\MachineControlStudio\\WebView2Data";
    } else {
        userDataDir = getExeDirectory() + L"\\webview2_userdata";
    }
    pfnCreateEnv(nullptr, userDataDir.c_str(), nullptr, new EnvironmentCompletedHandler());

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    CoUninitialize();
    return static_cast<int>(msg.wParam);
}
