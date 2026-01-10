@echo off
echo Menjalankan npm run dev...
start cmd /k "npm run dev"

timeout /t 3 > nul
echo Membuka index.html...
start "" "index.html"
