@echo off
setlocal

echo [1/2] 启动我们自己的 mihomo-ui (8877)...
start "Mihomo-UI-Custom" powershell -ExecutionPolicy Bypass -File "%~dp0mihomo-ui\start-mihomo-ui.ps1"

echo [2/2] 启动官方 MetaCubeXD Host (8878)...
start "Mihomo-UI-Official" powershell -ExecutionPolicy Bypass -File "%~dp0mihomo-ui-official-host\start-official-ui.ps1"

timeout /t 2 >nul
start "" "http://127.0.0.1:8877/"
start "" "http://127.0.0.1:8878/"

echo 已启动：
echo - 自研 UI:   http://127.0.0.1:8877/
echo - 官方 UI:   http://127.0.0.1:8878/
echo.
echo 关闭方式：分别关闭两个 PowerShell 窗口，或 Ctrl + C
endlocal
