@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 首次运行，正在安装依赖...
  call npm install
)
echo 正在启动：大鱼吃小鱼  http://localhost:5173
call npx vite --port 5173 --open
