@echo off
REM ================================
REM Setup & Run Python Application
REM ================================

REM Cek apakah venv sudah ada
if not exist venv (
    echo Membuat virtual environment...
    python -m venv venv
)

REM Aktifkan virtual environment
call venv\Scripts\activate

REM Upgrade pip
python -m pip install --upgrade pip

REM Install dependencies
if exist requirements.txt (
    echo Menginstall dependencies...
    pip install -r requirements.txt
) else (
    echo requirements.txt tidak ditemukan.
)

REM Jalankan aplikasi
echo Menjalankan app.py...
python app.py

pause
