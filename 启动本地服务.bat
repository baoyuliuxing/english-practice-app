@echo off
chcp 65001 >nul
title 英语练习 - 本地服务
cd /d %~dp0

echo ============================================
echo   英语练习应用 - 本地启动
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js！
    echo 请先安装：https://nodejs.org/zh-cn 下载 LTS 版本安装
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [1/3] 首次运行，安装依赖（约 1-2 分钟）...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败，请检查网络
        pause
        exit /b 1
    )
) else (
    echo [1/3] 依赖已就绪
)

if not exist dist (
    echo [2/3] 构建应用...
    call npm run build
    if errorlevel 1 (
        echo [错误] 构建失败
        pause
        exit /b 1
    )
) else (
    echo [2/3] 构建产物已就绪
)

echo [3/3] 启动本地服务...
echo.
echo ============================================
echo   电脑访问:  http://localhost:4173
echo   手机访问:  连同一 WiFi，浏览器打开下面任意地址
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens* delims= " %%b in ("%%a") do echo   http://%%b:4173
)
echo ============================================
echo.
echo 代码有更新后想重新构建：删除 dist 文件夹再双击本脚本
echo 关闭本窗口即停止服务
echo.

call npm run preview
pause
