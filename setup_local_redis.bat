@echo off
echo Setting up local Redis with Docker...
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo Download from: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo ✅ Docker is installed
echo.

REM Pull Redis image
echo Pulling Redis Docker image...
docker pull redis:7-alpine

REM Run Redis container
echo Starting Redis container...
docker run -d --name redis-gateway -p 6379:6379 redis:7-alpine

REM Wait a moment for Redis to start
timeout /t 3 /nobreak >nul

REM Test connection
echo Testing Redis connection...
docker exec redis-gateway redis-cli ping

if %errorlevel% equ 0 (
    echo.
    echo ✅ Redis is running successfully!
    echo Redis is available at: redis://localhost:6379/0
    echo.
    echo To stop Redis: docker stop redis-gateway
    echo To start Redis: docker start redis-gateway
    echo To remove Redis: docker rm redis-gateway
) else (
    echo ❌ Redis failed to start
)

pause
