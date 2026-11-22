cmake_minimum_required(VERSION 3.16)
project(MachineControlStudioCpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(MachineControlStudio WIN32
    src/main.cpp
    src/win32_dialogs.cpp
    src/prjr_crypto.cpp
)

target_include_directories(MachineControlStudio PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/vendor/webview2/build/native/include"
)

target_link_libraries(MachineControlStudio PRIVATE
    ole32
    oleaut32
    uuid
    shell32
    shlwapi
    bcrypt
    user32
    gdi32
)

if(MINGW)
    target_link_options(MachineControlStudio PRIVATE -static-libgcc -static-libstdc++ -municode)
endif()

add_custom_command(TARGET MachineControlStudio POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/vendor/webview2/build/native/x64/WebView2Loader.dll"
        "$<TARGET_FILE_DIR:MachineControlStudio>/WebView2Loader.dll"
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/app"
        "$<TARGET_FILE_DIR:MachineControlStudio>/app"
)

