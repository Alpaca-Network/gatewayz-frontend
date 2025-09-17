@echo off
echo Setting up Redis in WSL2...
echo.

REM Check if WSL is installed
wsl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ WSL is not installed. Please install WSL2 first.
    echo Run: wsl --install
    pause
    exit /b 1
)

echo ✅ WSL is available
echo.

REM Install Redis in WSL
echo Installing Redis in WSL...
wsl -e bash -c "sudo apt update && sudo apt install -y redis-server"

REM Start Redis service
echo Starting Redis service...
wsl -e bash -c "sudo service redis-server start"

REM Test connection
echo Testing Redis connection...
wsl -e bash -c "redis-cli ping"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Redis is running successfully in WSL!
    echo Redis is available at: redis://localhost:6379/0
    echo.
    echo To start Redis: wsl -e bash -c "sudo service redis-server start"
    echo To stop Redis: wsl -e bash -c "sudo service redis-server stop"
) else (
    echo ❌ Redis failed to start
)

pause
