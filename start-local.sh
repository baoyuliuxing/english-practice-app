#!/bin/bash
# 英语练习应用 - 本地启动脚本（Mac/Linux）
cd "$(dirname "$0")"

echo "============================================"
echo "  英语练习应用 - 本地启动"
echo "============================================"
echo

if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js！"
    echo "请先安装：https://nodejs.org/zh-cn 下载 LTS 版本安装"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[1/3] 首次运行，安装依赖（约 1-2 分钟）..."
    npm install || { echo "[错误] 依赖安装失败"; exit 1; }
else
    echo "[1/3] 依赖已就绪"
fi

if [ ! -d "dist" ]; then
    echo "[2/3] 构建应用..."
    npm run build || { echo "[错误] 构建失败"; exit 1; }
else
    echo "[2/3] 构建产物已就绪"
fi

echo "[3/3] 启动本地服务..."
echo
echo "============================================"
echo "  电脑访问:  http://localhost:4173"
echo "  手机访问:  连同一 WiFi，浏览器打开下面任意地址"
if command -v ipconfig &> /dev/null; then
    # macOS
    ipconfig getifaddr en0 2>/dev/null | xargs -I{} echo "  http://{}:4173"
    ipconfig getifaddr en1 2>/dev/null | xargs -I{} echo "  http://{}:4173"
else
    # Linux
    hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+' | xargs -I{} echo "  http://{}:4173"
fi
echo "============================================"
echo
echo "代码有更新后想重新构建：删除 dist 文件夹再运行本脚本"
echo "Ctrl+C 停止服务"
echo

npm run preview
