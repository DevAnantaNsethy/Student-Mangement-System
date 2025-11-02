@echo off
echo Starting Student Management System...
echo.

echo Starting API Server on port 3003...
start cmd /k "cd /d api && node complete-server.js"

echo Waiting for API server to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server on port 8000...
start cmd /k "npx http-server -p 8000"

echo.
echo ========================================
echo   Student Management System Started!
echo ========================================
echo.
echo Frontend: http://localhost:8000
echo API: http://localhost:3003
echo Health Check: http://localhost:3003/api/health
echo.
echo Press any key to open the application...
pause >nul

start http://localhost:8000