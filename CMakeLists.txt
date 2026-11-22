cmake_minimum_required(VERSION 3.16)
project(MachineControlStudioCpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(MachineControlStudio WIN32
    src/main.cpp
    src/win32_dialogs.cpp
    src/prjr_crypto.cpp
    src/comm/comm_manager.cpp
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
    target_link_options(MachineControlStudio PRIVATE -static -static-libgcc -static-libstdc++ -municode)
endif()

add_custom_command(TARGET MachineControlStudio POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/vendor/webview2/build/native/x64/WebView2Loader.dll"
        "$<TARGET_FILE_DIR:MachineControlStudio>/WebView2Loader.dll"
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/app"
        "$<TARGET_FILE_DIR:MachineControlStudio>/app"
)

function(add_comm_driver target_name source_file)
    add_library(${target_name} SHARED ${source_file})
    target_include_directories(${target_name} PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/src")
    target_link_libraries(${target_name} PRIVATE ws2_32 iphlpapi)
    set_target_properties(${target_name} PROPERTIES
        PREFIX ""
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/drivers"
        LIBRARY_OUTPUT_DIRECTORY "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/drivers"
    )
    if(MINGW)
        target_link_options(${target_name} PRIVATE -static -static-libgcc -static-libstdc++)
    endif()
endfunction()

add_comm_driver(drv_modbus     src/comm/drv_modbus.cpp)
add_comm_driver(drv_melsec_mc  src/comm/drv_melsec_mc.cpp)
add_comm_driver(drv_ethercat   src/comm/drv_ethercat.cpp)
add_comm_driver(drv_s7         src/comm/drv_s7.cpp)
add_comm_driver(drv_omron_fins src/comm/drv_omron_fins.cpp)
add_comm_driver(drv_eip_cip    src/comm/drv_eip_cip.cpp)

