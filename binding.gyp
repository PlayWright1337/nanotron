{
  "includes": [
    "node_modules/node-addon-api/except.gypi"
  ],
  "targets": [
    {
      "target_name": "nanotron",
      "sources": [
        "src/addon.cpp"
      ],
      "include_dirs": [
        "node_modules/node-addon-api",
        "src",
        "src/webview2/include",
        "src/compatibility/mingw/include"
      ],
      "dependencies": [
        "node_modules/node-addon-api/node_api.gyp:nothing"
      ],
      "cflags_cc": [
        "-std=c++17"
      ],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "OTHER_CPLUSPLUSFLAGS": [
          "-std=c++17"
        ]
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [
            "/std:c++17"
          ]
        }
      },
      "conditions": [
        [
          "OS==\"win\"",
          {
            "libraries": [
              "user32.lib",
              "ole32.lib",
              "shell32.lib",
              "shlwapi.lib",
              "version.lib"
            ],
            "defines": [
              "WIN32_LEAN_AND_MEAN",
              "NOMINMAX"
            ]
          }
        ],
        [
          "OS==\"mac\"",
          {
            "link_settings": {
              "libraries": [
                "-framework Cocoa",
                "-framework WebKit"
              ]
            }
          }
        ],
        [
          "OS==\"linux\"",
          {
            "cflags": [
              "<!@(pkg-config --cflags gtk+-3.0 webkit2gtk-4.0)"
            ],
            "libraries": [
              "<!@(pkg-config --libs gtk+-3.0 webkit2gtk-4.0)"
            ]
          }
        ]
      ]
    }
  ]
}
