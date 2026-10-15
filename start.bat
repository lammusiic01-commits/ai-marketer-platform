@echo off
setlocal
cd /d "%~dp0"
title AI Marketer Platform

echo.
echo ===========================================
echo   AI MARKETER PLATFORM - START
echo ===========================================

if exist "venv\Scripts\python.exe" goto env_ready
echo [1/3] Creating Python environment...
where py >nul 2>nul
if errorlevel 1 goto use_python_command
py -3 -m venv venv
if errorlevel 1 goto venv_failed
goto env_ready

:use_python_command
where python >nul 2>nul
if errorlevel 1 goto python_missing
python -m venv venv
if errorlevel 1 goto venv_failed

:env_ready
call venv\Scripts\activate.bat
if exist "venv\.installed" goto deps_ready
echo [2/3] Installing backend dependencies...
python -m pip install --upgrade pip
if errorlevel 1 goto pip_failed
pip install -r requirements.txt
if errorlevel 1 goto pip_failed
echo ready>venv\.installed

:deps_ready
if exist ".env" goto env_file_ready
echo Creating local configuration and unique secrets...
python -c "from cryptography.fernet import Fernet; import secrets; print('APP_URL=http://localhost:8000'); print('PORT=8000'); print('JWT_SECRET='+secrets.token_urlsafe(48)); print('ENCRYPTION_KEY='+Fernet.generate_key().decode()); print('OPENROUTER_API_KEY='); print('OPENROUTER_MODEL=apodex/apodex-1.1-mini:free'); print('SMTP_HOST='); print('SMTP_PORT=587'); print('SMTP_USER='); print('SMTP_PASSWORD='); print('SMTP_FROM=noreply@aimarketer.ru')" > .env
if errorlevel 1 goto env_failed

:env_file_ready
if exist "frontend\node_modules" goto frontend_ready
echo Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install --no-audit --no-fund
if errorlevel 1 goto npm_failed
cd /d "%~dp0"

:frontend_ready
echo [3/3] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 goto build_failed
cd /d "%~dp0"

echo.
echo Server: http://localhost:8000
echo Close this window to stop the server.
start "" http://localhost:8000
python main.py
goto :eof

:python_missing
echo Python 3.11 or newer was not found. Install Python and retry.
pause
exit /b 1

:venv_failed
echo Could not create the Python virtual environment.
pause
exit /b 1

:pip_failed
echo Could not install backend dependencies.
pause
exit /b 1

:env_failed
echo Could not create the local environment file.
pause
exit /b 1

:npm_failed
echo Could not install frontend dependencies.
pause
exit /b 1

:build_failed
echo Could not build the frontend.
pause
exit /b 1
