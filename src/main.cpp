#include <windows.h>
#include <winhttp.h>
#include <initguid.h>
#include <shlwapi.h>
#include <string>
#include <atomic>
#include <algorithm>
#include <cstdio>
#include <cwctype>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <thread>
#include <utility>
#include <vector>
#include <cmath>

#include "WebView2.h"
#include "json_mini.hpp"
#include "win32_dialogs.hpp"
#include "prjr_crypto.hpp"
#include "comm/comm_manager.hpp"

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
static DWORD g_splashStartTick = 0;
static int g_splashProgress = 0;
static int g_splashTargetX = 0;
static int g_splashTargetY = 0;
static constexpr UINT WM_COMM_BRIDGE_REPLY = WM_APP + 1;

struct CommBridgeRequest {
    std::string id;
    std::string method;
    std::string argsJson;
};

struct CommBridgeReply {
    std::string id;
    std::string resultJson;
};

static std::mutex g_commRequestMutex;
static std::condition_variable g_commRequestReady;
static std::deque<CommBridgeRequest> g_commRequests;
static bool g_commWorkerStopping = false;
static std::thread g_commWorker;
static std::mutex g_commReplyMutex;
static std::deque<CommBridgeReply> g_commReplies;
static std::mutex g_ollamaRequestMutex;
static std::condition_variable g_ollamaRequestReady;
static std::deque<CommBridgeRequest> g_ollamaRequests;
static bool g_ollamaWorkerStopping = false;
static std::thread g_ollamaWorker;

static void drawSplashText(HDC dc, const wchar_t* text, RECT rect, int size, int weight, COLORREF color, UINT format) {
    HFONT font = CreateFontW(-size, 0, 0, 0, weight, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                             OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                             DEFAULT_PITCH | FF_DONTCARE, L"Arial");
    HGDIOBJ oldFont = SelectObject(dc, font);
    SetTextColor(dc, color);
    DrawTextW(dc, text, -1, &rect, format);
    SelectObject(dc, oldFont);
    DeleteObject(font);
}

static int drawSplashTitlePart(HDC dc, const wchar_t* text, int x, int y, COLORREF color) {
    HFONT font = CreateFontW(-26, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                             OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                             DEFAULT_PITCH | FF_DONTCARE, L"Arial");
    HGDIOBJ oldFont = SelectObject(dc, font);
    SIZE extent{};
    const int length = lstrlenW(text);
    GetTextExtentPoint32W(dc, text, length, &extent);
    SetTextColor(dc, color);
    TextOutW(dc, x, y, text, length);
    SelectObject(dc, oldFont);
    DeleteObject(font);
    return extent.cx;
}

static void drawSplashPercent(HDC dc, int value, int xRight, int y, COLORREF color) {
    const std::wstring number = std::to_wstring(value);
    HFONT numberFont = CreateFontW(-22, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                   DEFAULT_PITCH | FF_DONTCARE, L"Arial");
    HFONT suffixFont = CreateFontW(-12, 0, 0, 0, FW_MEDIUM, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                   DEFAULT_PITCH | FF_DONTCARE, L"Arial");
    SIZE numberSize{};
    SIZE suffixSize{};
    TEXTMETRICW numberMetrics{};
    TEXTMETRICW suffixMetrics{};
    HGDIOBJ oldFont = SelectObject(dc, numberFont);
    GetTextExtentPoint32W(dc, number.c_str(), static_cast<int>(number.length()), &numberSize);
    GetTextMetricsW(dc, &numberMetrics);
    SelectObject(dc, suffixFont);
    GetTextExtentPoint32W(dc, L"%", 1, &suffixSize);
    GetTextMetricsW(dc, &suffixMetrics);

    SetTextColor(dc, color);
    const int percentWidth = numberSize.cx + 2 + suffixSize.cx;
    const int numberX = xRight - percentWidth;
    TextOutW(dc, numberX, y, number.c_str(), static_cast<int>(number.length()));
    SelectObject(dc, suffixFont);
    TextOutW(dc, numberX + numberSize.cx + 2,
             y + numberMetrics.tmAscent - suffixMetrics.tmAscent, L"%", 1);
    SelectObject(dc, oldFont);
    DeleteObject(numberFont);
    DeleteObject(suffixFont);
}

static void drawSplashLogo(HDC dc, int x, int y, int size) {
    auto sx = [=](double value) -> int {
        return x + static_cast<int>(value * size / 80.0);
    };
    auto sy = [=](double value) -> int {
        return y + static_cast<int>(value * size / 80.0);
    };

    const int stroke = std::max(1, static_cast<int>(2.4 * size / 80.0));
    HPEN pen = CreatePen(PS_SOLID, stroke, RGB(13, 13, 13));
    HGDIOBJ oldPen = SelectObject(dc, pen);
    HGDIOBJ oldBrush = SelectObject(dc, GetStockObject(HOLLOW_BRUSH));

    POINT hexagon[] = {
        {sx(40), sy(8)}, {sx(67.7), sy(24)}, {sx(67.7), sy(56)},
        {sx(40), sy(72)}, {sx(12.3), sy(56)}, {sx(12.3), sy(24)},
        {sx(40), sy(8)}
    };
    Polyline(dc, hexagon, 7);

    Ellipse(dc, sx(30), sy(30), sx(50), sy(50));

    HPEN detailPen = CreatePen(PS_SOLID, stroke, RGB(153, 153, 153));
    SelectObject(dc, detailPen);
    MoveToEx(dc, sx(40), sy(8), nullptr);
    LineTo(dc, sx(40), sy(30));
    MoveToEx(dc, sx(67.7), sy(56), nullptr);
    LineTo(dc, sx(49), sy(45));
    MoveToEx(dc, sx(12.3), sy(56), nullptr);
    LineTo(dc, sx(31), sy(45));

    SelectObject(dc, oldPen);
    DeleteObject(detailPen);
    SelectObject(dc, oldBrush);
    DeleteObject(pen);

    const double angle = ((GetTickCount() - g_splashStartTick) / 3200.0) * 2.0 * 3.141592653589793;
    const int dotRadius = std::max(2, static_cast<int>(3.6 * size / 80.0));

    const int orbitRadius = static_cast<int>(size * 22.0 / 80.0);
    const int redDotCx = sx(40) + static_cast<int>(std::cos(angle) * orbitRadius);
    const int redDotCy = sy(40) + static_cast<int>(std::sin(angle) * orbitRadius);
    HBRUSH dotBrush = CreateSolidBrush(RGB(229, 50, 31));
    HGDIOBJ oldDotBrush = SelectObject(dc, dotBrush);
    Ellipse(dc, redDotCx - dotRadius, redDotCy - dotRadius,
           redDotCx + dotRadius, redDotCy + dotRadius);
    SelectObject(dc, oldDotBrush);
    DeleteObject(dotBrush);
}

static LRESULT CALLBACK SplashWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE:
            g_splashStartTick = GetTickCount();
            {
                RECT bounds{};
                GetClientRect(hwnd, &bounds);
                SetWindowRgn(hwnd, CreateRoundRectRgn(0, 0, bounds.right, bounds.bottom, 12, 12), TRUE);
            }
            SetTimer(hwnd, 1, 80, nullptr);
            return 0;
        case WM_TIMER:
            {
                const DWORD elapsed = GetTickCount() - g_splashStartTick;
                const double animation = std::min(elapsed / 350.0, 1.0);
                const double eased = animation * animation * (3.0 - 2.0 * animation);
                const int animatedW = 500 + static_cast<int>(20 * eased);
                const int animatedH = 250 + static_cast<int>(10 * eased);
                const int animatedX = g_splashTargetX + (520 - animatedW) / 2;
                const int animatedY = g_splashTargetY + static_cast<int>(8 * (1.0 - eased));
                SetWindowPos(hwnd, nullptr, animatedX, animatedY, animatedW, animatedH,
                             SWP_NOZORDER | SWP_NOACTIVATE);

                const double raw = std::min(elapsed / 2200.0, 1.0);
                const double progress = raw < 0.5
                    ? 2.0 * raw * raw
                    : 1.0 - std::pow(-2.0 * raw + 2.0, 2.0) / 2.0;
                g_splashProgress = std::min(static_cast<int>(progress * 100.0 + 0.5), 94);
            }
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        case WM_SIZE: {
            HRGN region = CreateRoundRectRgn(0, 0, LOWORD(lParam), HIWORD(lParam), 12, 12);
            SetWindowRgn(hwnd, region, TRUE);
            return 0;
        }
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT: {
            PAINTSTRUCT ps{};
            HDC dc = BeginPaint(hwnd, &ps);
            RECT client{};
            GetClientRect(hwnd, &client);
            const int width = client.right;
            const int height = client.bottom;
            FillRect(dc, &client, reinterpret_cast<HBRUSH>(GetStockObject(WHITE_BRUSH)));
            HBRUSH bg = CreateSolidBrush(RGB(250, 250, 250));
            FillRect(dc, &client, bg);
            DeleteObject(bg);

            RECT accent{0, 0, 8, height};
            HBRUSH red = CreateSolidBrush(RGB(229, 50, 31));
            FillRect(dc, &accent, red);
            DeleteObject(red);

            HPEN borderPen = CreatePen(PS_SOLID, 1, RGB(221, 221, 221));
            HGDIOBJ oldBorderPen = SelectObject(dc, borderPen);
            HGDIOBJ oldBorderBrush = SelectObject(dc, GetStockObject(HOLLOW_BRUSH));
            RoundRect(dc, 0, 0, width, height, 12, 12);
            SelectObject(dc, oldBorderBrush);
            SelectObject(dc, oldBorderPen);
            DeleteObject(borderPen);

            const int margin = 32;
            const int gridLeft = 24;
            const int gridRight = width - 24;
            HPEN gridPen = CreatePen(PS_SOLID, 1, RGB(246, 246, 246));
            HGDIOBJ oldGridPen = SelectObject(dc, gridPen);
            for (int i = 0; i <= 8; ++i) {
                const int x = gridLeft + (gridRight - gridLeft) * i / 8;
                MoveToEx(dc, x, 0, nullptr);
                LineTo(dc, x, height);
            }
            SelectObject(dc, oldGridPen);
            DeleteObject(gridPen);
            const int textExtra = SetTextCharacterExtra(dc, 1);
            drawSplashText(dc, L"ICS  /  STARTUP", RECT{margin, 25, width / 2, 43}, 10, FW_NORMAL,
                           RGB(13, 13, 13), DT_LEFT | DT_VCENTER | DT_SINGLELINE);
            drawSplashText(dc, L"AUTOMATION PLATFORM", RECT{width / 2, 25, width - margin, 43}, 10, FW_NORMAL,
                           RGB(119, 119, 119), DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
            SetTextCharacterExtra(dc, textExtra);

            const int logoX = 40;
            const int logoY = 69;
            const int logoSize = 46;
            const int titleX = logoX + logoSize + 18;
            drawSplashLogo(dc, logoX, logoY, logoSize);
            int titleXNext = titleX;
            titleXNext += drawSplashTitlePart(dc, L"Integrated ", titleXNext, 68, RGB(13, 13, 13));
            titleXNext += drawSplashTitlePart(dc, L"Control", titleXNext, 68, RGB(229, 50, 31));
            drawSplashTitlePart(dc, L" Software", titleXNext, 68, RGB(13, 13, 13));
            drawSplashText(dc, L"Automation. Monitoring. Command.",
                           RECT{titleX, 100, width - margin, 120}, 12, FW_NORMAL,
                           RGB(119, 119, 119), DT_LEFT | DT_VCENTER | DT_SINGLELINE);

            const int barLeft = 40;
            const int barRight = width - margin;
            const int barY = 145;
            RECT track{barLeft, barY, barRight, barY + 5};
            HBRUSH trackBrush = CreateSolidBrush(RGB(226, 226, 226));
            FillRect(dc, &track, trackBrush);
            DeleteObject(trackBrush);
            RECT progress = track;
            progress.right = barLeft + (barRight - barLeft) * g_splashProgress / 100;
            HBRUSH progressBrush = CreateSolidBrush(g_splashProgress >= 100 ? RGB(229, 50, 31) : RGB(13, 13, 13));
            FillRect(dc, &progress, progressBrush);
            DeleteObject(progressBrush);

            const wchar_t* status = L"INITIALIZING";
            if (g_splashProgress >= 100) status = L"READY";
            else if (g_splashProgress >= 94) status = L"STARTING DASHBOARD";
            else if (g_splashProgress >= 78) status = L"CHECKING SYSTEM HEALTH";
            else if (g_splashProgress >= 58) status = L"SYNCING DEVICES";
            else if (g_splashProgress >= 38) status = L"CONNECTING CONTROLLERS";
            else if (g_splashProgress >= 18) status = L"LOADING MODULES";
            const int statusExtra = SetTextCharacterExtra(dc, 1);
            drawSplashText(dc, status, RECT{barLeft, barY + 13, barRight - 70, barY + 35}, 11, FW_NORMAL,
                           RGB(119, 119, 119), DT_LEFT | DT_VCENTER | DT_SINGLELINE);
            SetTextCharacterExtra(dc, statusExtra);
            drawSplashPercent(dc, g_splashProgress, barRight, barY + 7,
                              g_splashProgress >= 100 ? RGB(229, 50, 31) : RGB(13, 13, 13));

            HPEN dividerPen = CreatePen(PS_SOLID, 1, RGB(234, 234, 234));
            HGDIOBJ oldDividerPen = SelectObject(dc, dividerPen);
            MoveToEx(dc, margin, 205, nullptr);
            LineTo(dc, width - margin, 205);
            SelectObject(dc, oldDividerPen);
            DeleteObject(dividerPen);
            const int footerExtra = SetTextCharacterExtra(dc, 1);
            drawSplashText(dc, L"VERSION 1.0", RECT{margin, 215, width / 2, 235}, 9, FW_NORMAL,
                           RGB(119, 119, 119), DT_LEFT | DT_VCENTER | DT_SINGLELINE);
            drawSplashText(dc, L"\x00A9 INTEGRATED CONTROL SOFTWARE", RECT{width / 2, 215, width - margin, 235},
                           9, FW_NORMAL, RGB(119, 119, 119), DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
            SetTextCharacterExtra(dc, footerExtra);
            EndPaint(hwnd, &ps);
            return 0;
        }
        case WM_CLOSE:
            if (g_hwnd) DestroyWindow(g_hwnd);
            DestroyWindow(hwnd);
            return 0;
        case WM_DESTROY:
            KillTimer(hwnd, 1);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static void closeStartupWindows() {
    if (g_hwnd) DestroyWindow(g_hwnd);
}

static void showStartupError(const wchar_t* message) {
    MessageBoxW(g_hwnd, message, L"Machine Control Studio (C++)", MB_ICONERROR);
    closeStartupWindows();
}

static void showMainWindow() {
    if (g_controller) g_controller->put_IsVisible(TRUE);
    ShowWindow(g_hwnd, SW_SHOWMAXIMIZED);
    UpdateWindow(g_hwnd);
    if (g_webview) {
        g_webview->ExecuteScript(L"window.dispatchEvent(new Event('ics-native-window-shown'));", nullptr);
    }
}

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

static std::string processCommBridgeRequest(const CommBridgeRequest& request) {
    if (request.method == "comm-list-drivers") return comm_mgr::listDriversJson();
    if (request.method == "comm-connect") return comm_mgr::connectJson(request.argsJson);
    if (request.method == "comm-disconnect") return comm_mgr::disconnectJson(request.argsJson);
    if (request.method == "comm-status") return comm_mgr::getStatusJson(request.argsJson);
    if (request.method == "comm-read-tag") return comm_mgr::readTagJson(request.argsJson);
    if (request.method == "comm-write-tag") return comm_mgr::writeTagJson(request.argsJson);
    return "{\"ok\":false,\"error\":\"Unknown communication method\"}";
}

static void communicationWorkerLoop() {
    for (;;) {
        CommBridgeRequest request;
        {
            std::unique_lock<std::mutex> lock(g_commRequestMutex);
            g_commRequestReady.wait(lock, [] {
                return g_commWorkerStopping || !g_commRequests.empty();
            });
            if (g_commWorkerStopping) return;
            request = std::move(g_commRequests.front());
            g_commRequests.pop_front();
        }

        CommBridgeReply reply{ request.id, processCommBridgeRequest(request) };
        {
            std::lock_guard<std::mutex> lock(g_commReplyMutex);
            g_commReplies.push_back(std::move(reply));
        }
        if (g_hwnd) PostMessageW(g_hwnd, WM_COMM_BRIDGE_REPLY, 0, 0);
    }
}

static void startCommunicationWorker() {
    g_commWorker = std::thread(communicationWorkerLoop);
}

static void stopCommunicationWorker() {
    {
        std::lock_guard<std::mutex> lock(g_commRequestMutex);
        g_commWorkerStopping = true;
        g_commRequests.clear();
    }
    g_commRequestReady.notify_all();
    if (g_commWorker.joinable()) g_commWorker.join();
    std::lock_guard<std::mutex> lock(g_commReplyMutex);
    g_commReplies.clear();
}

static void enqueueCommBridgeRequest(const std::string& id, const std::string& method, const std::string& argsJson) {
    bool unavailable = false;
    {
        std::lock_guard<std::mutex> lock(g_commRequestMutex);
        if (!g_commWorker.joinable() || g_commWorkerStopping) {
            unavailable = true;
        } else {
            g_commRequests.push_back(CommBridgeRequest{ id, method, argsJson });
        }
    }
    if (unavailable) {
        sendBridgeReply(id, "{\"ok\":false,\"error\":\"Communication worker is unavailable\"}");
        return;
    }
    g_commRequestReady.notify_one();
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

    if (method == "comm-list-drivers" || method == "comm-connect" ||
        method == "comm-disconnect" || method == "comm-status" ||
        method == "comm-read-tag" || method == "comm-write-tag") {
        enqueueCommBridgeRequest(id, method, argsRaw);
        return;
    }

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

class NavigationCompletedHandler : public ComBase<ICoreWebView2NavigationCompletedEventHandler> {
public:
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) override {
        BOOL success = FALSE;
        if (!args || FAILED(args->get_IsSuccess(&success)) || !success) {
            showStartupError(L"The project launcher could not be loaded. Check that the app folder is installed next to the executable.");
            return S_OK;
        }
        showMainWindow();
        return S_OK;
    }
};

class ControllerCompletedHandler : public ComBase<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler> {
public:
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT result, ICoreWebView2Controller* controller) override {
        if (FAILED(result) || !controller) {
            showStartupError(L"Failed to initialize the WebView2 Controller.");
            return S_OK;
        }
        g_controller = controller;
        g_controller->AddRef();
        g_controller->get_CoreWebView2(&g_webview);
        g_controller->put_IsVisible(FALSE);

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
          window.__cppNativeHost = true;
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
    onFileOpened: (cb) => { if (typeof cb === 'function') fileOpenedCallbacks.push(cb); },
    commListDrivers: () => invoke('comm-list-drivers', {}),
    commConnect: (config) => invoke('comm-connect', config),
    commDisconnect: (connId) => invoke('comm-disconnect', { connId }),
    commStatus: (connId) => invoke('comm-status', { connId }),
    commReadTag: (connId, address) => invoke('comm-read-tag', { connId, address }),
    commWriteTag: (connId, address, value) => invoke('comm-write-tag', { connId, address, value })
  };
})();
)JS";
        g_webview->AddScriptToExecuteOnDocumentCreated(kBridgeScript, nullptr);

        EventRegistrationToken token{};
        g_webview->add_WebMessageReceived(new WebMessageHandler(), &token);
        if (FAILED(g_webview->add_NavigationCompleted(new NavigationCompletedHandler(), &token))) {
            showStartupError(L"Failed to monitor project launcher loading.");
            return S_OK;
        }

        if (FAILED(g_webview->Navigate(L"https://app.local/index.html"))) {
            showStartupError(L"Failed to start loading the project launcher.");
        }
        return S_OK;
    }
};

class EnvironmentCompletedHandler : public ComBase<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler> {
public:
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT result, ICoreWebView2Environment* env) override {
        if (FAILED(result) || !env) {
            showStartupError(L"Microsoft Edge WebView2 Runtime is required to run Machine Control Studio (C++).");
            return S_OK;
        }
        if (FAILED(env->CreateCoreWebView2Controller(g_hwnd, new ControllerCompletedHandler()))) {
            showStartupError(L"Failed to start the WebView2 Controller.");
        }
        return S_OK;
    }
};

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_COMM_BRIDGE_REPLY: {
            std::deque<CommBridgeReply> replies;
            {
                std::lock_guard<std::mutex> lock(g_commReplyMutex);
                replies.swap(g_commReplies);
            }
            for (const auto& reply : replies) {
                sendBridgeReply(reply.id, reply.resultJson);
            }
            return 0;
        }
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

    std::wstring loaderPath = getExeDirectory() + L"\\WebView2Loader.dll";
    HMODULE hLoader = LoadLibraryW(loaderPath.c_str());
    if (!hLoader) hLoader = LoadLibraryW(L"WebView2Loader.dll");

    auto pfnCreateEnv = hLoader
        ? reinterpret_cast<PFN_CreateCoreWebView2EnvironmentWithOptions>(
              GetProcAddress(hLoader, "CreateCoreWebView2EnvironmentWithOptions"))
        : nullptr;

    if (!pfnCreateEnv) {
        showStartupError(L"WebView2Loader.dll not found next to executable.");
        return 1;
    }

    wchar_t localAppData[MAX_PATH] = {};
    std::wstring userDataDir;
    if (GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH) > 0) {
        userDataDir = std::wstring(localAppData) + L"\\MachineControlStudio\\WebView2Data";
    } else {
        userDataDir = getExeDirectory() + L"\\webview2_userdata";
    }
    if (FAILED(pfnCreateEnv(nullptr, userDataDir.c_str(), nullptr, new EnvironmentCompletedHandler()))) {
        showStartupError(L"Failed to start WebView2 Runtime initialization.");
        return 1;
    }

    comm_mgr::initDrivers(getExeDirectory());
    startCommunicationWorker();

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    stopCommunicationWorker();
    comm_mgr::shutdown();
    CoUninitialize();
    return static_cast<int>(msg.wParam);
}
