reg add HKEY_CURRENT_USER\Console /v QuickEdit /t REG_DWORD /d 00000000 /f
start cmd /K "go-cqhttp_windows_amd64.exe -faststart"