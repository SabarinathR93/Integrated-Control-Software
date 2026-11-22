#pragma once
#include <string>
#include <cctype>
#include <sstream>
#include <iomanip>

namespace json_mini {

inline std::string escape(const std::string& s) {
    std::ostringstream o;
    o << '"';
    for (unsigned char c : s) {
        switch (c) {
            case '"':  o << "\\\""; break;
            case '\\': o << "\\\\"; break;
            case '\b': o << "\\b";  break;
            case '\f': o << "\\f";  break;
            case '\n': o << "\\n";  break;
            case '\r': o << "\\r";  break;
            case '\t': o << "\\t";  break;
            default:
                if (c < 0x20) {
                    o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    o << static_cast<char>(c);
                }
        }
    }
    o << '"';
    return o.str();
}

inline size_t skipWs(const std::string& s, size_t i) {
    while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n')) ++i;
    return i;
}

inline bool parseStringAt(const std::string& s, size_t& i, std::string& out) {
    if (i >= s.size() || s[i] != '"') return false;
    ++i;
    out.clear();
    while (i < s.size()) {
        char c = s[i++];
        if (c == '"') return true;
        if (c == '\\' && i < s.size()) {
            char e = s[i++];
            switch (e) {
                case '"':  out.push_back('"');  break;
                case '\\': out.push_back('\\'); break;
                case '/':  out.push_back('/');  break;
                case 'b':  out.push_back('\b'); break;
                case 'f':  out.push_back('\f'); break;
                case 'n':  out.push_back('\n'); break;
                case 'r':  out.push_back('\r'); break;
                case 't':  out.push_back('\t'); break;
                case 'u':
                    if (i + 4 <= s.size()) {
                        unsigned int cp = 0;
                        for (int k = 0; k < 4; ++k) {
                            char h = s[i + k];
                            cp <<= 4;
                            if (h >= '0' && h <= '9') cp |= (h - '0');
                            else if (h >= 'a' && h <= 'f') cp |= (h - 'a' + 10);
                            else if (h >= 'A' && h <= 'F') cp |= (h - 'A' + 10);
                        }
                        i += 4;
                        if (cp < 0x80) {
                            out.push_back(static_cast<char>(cp));
                        } else if (cp < 0x800) {
                            out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
                            out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
                        } else {
                            out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
                            out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
                            out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
                        }
                    }
                    break;
                default: out.push_back(e); break;
            }
        } else {
            out.push_back(c);
        }
    }
    return false;
}

inline size_t findValueEnd(const std::string& s, size_t i) {
    i = skipWs(s, i);
    if (i >= s.size()) return i;
    char c = s[i];
    if (c == '"') {
        std::string tmp;
        parseStringAt(s, i, tmp);
        return i;
    }
    if (c == '{' || c == '[') {
        int depth = 0;
        bool inStr = false;
        while (i < s.size()) {
            char ch = s[i];
            if (inStr) {
                if (ch == '\\') { i += 2; continue; }
                if (ch == '"') inStr = false;
            } else {
                if (ch == '"') inStr = true;
                else if (ch == '{' || ch == '[') ++depth;
                else if (ch == '}' || ch == ']') {
                    --depth;
                    if (depth == 0) return i + 1;
                }
            }
            ++i;
        }
        return i;
    }
    while (i < s.size() && s[i] != ',' && s[i] != '}' && s[i] != ']' && !std::isspace(static_cast<unsigned char>(s[i]))) {
        ++i;
    }
    return i;
}

inline bool getRawField(const std::string& obj, const std::string& key, std::string& rawOut) {
    size_t i = skipWs(obj, 0);
    if (i >= obj.size() || obj[i] != '{') return false;
    ++i;
    while (i < obj.size()) {
        i = skipWs(obj, i);
        if (i >= obj.size() || obj[i] == '}') break;
        if (obj[i] == ',') { ++i; continue; }
        std::string curKey;
        if (!parseStringAt(obj, i, curKey)) return false;
        i = skipWs(obj, i);
        if (i >= obj.size() || obj[i] != ':') return false;
        i = skipWs(obj, i + 1);
        size_t end = findValueEnd(obj, i);
        if (curKey == key) {
            rawOut = obj.substr(i, end - i);
            return true;
        }
        i = end;
    }
    return false;
}

inline bool getStringField(const std::string& obj, const std::string& key, std::string& out) {
    std::string raw;
    if (!getRawField(obj, key, raw)) return false;
    size_t idx = 0;
    return parseStringAt(raw, idx, out);
}

} // namespace json_mini

