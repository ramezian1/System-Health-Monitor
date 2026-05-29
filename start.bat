@echo off
REM ===========================================================
REM  System Health Monitor - one-click Windows launcher
REM  First run: installs Python (if needed), creates a virtual
REM  environment, and downloads all dependencies.
REM  Later runs: just starts the dashboard.
REM ===========================================================
setlocal
cd /d "%~dp0"
title System Health Monitor

echo ============================================
echo    System Health Monitor - Windows launcher
echo ============================================
echo.

REM --- 1. Make sure Python is available --------------------
where python >nul 2>&1
if errorlevel 1 goto NOPYTHON

REM --- 2. Create the virtual environment if missing --------
if not exist venv\ (
    echo [*] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 goto VENVFAIL
)

REM --- 3. Install / update dependencies --------------------
echo [*] Installing dependencies (this can take a minute the first time)...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt
if errorlevel 1 goto PIPFAIL

REM --- 4. Launch -------------------------------------------
echo.
echo [OK] Ready. Starting the dashboard...
echo     Opening http://localhost:5000   (default login: admin / admin)
echo     Leave this window open while you use it. Press Ctrl+C to stop.
echo.
start "" http://localhost:5000
python app.py
goto END

:NOPYTHON
echo [!] Python was not found on this computer.
where winget >nul 2>&1
if errorlevel 1 goto NOWINGET
echo     Installing Python 3 automatically via winget...
echo.
winget install -e --id Python.Python.3 --accept-source-agreements --accept-package-agreements
echo.
echo [OK] Python installed. Please CLOSE this window and double-click
echo      start.bat again so Windows picks up the new installation.
goto PAUSEEND

:NOWINGET
echo     winget is not available, so please install Python 3 manually:
echo       https://www.python.org/downloads/
echo     During setup, tick "Add python.exe to PATH", then re-run start.bat.
goto PAUSEEND

:VENVFAIL
echo [!] Could not create the virtual environment.
echo     Make sure Python 3 installed correctly and try again.
goto PAUSEEND

:PIPFAIL
echo [!] Installing dependencies failed.
echo     Check your internet connection, then run start.bat again.
goto PAUSEEND

:PAUSEEND
echo.
pause
exit /b 1

:END
echo.
echo Dashboard stopped.
pause
endlocal
