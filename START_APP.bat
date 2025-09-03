@echo off
echo ========================================
echo   Day Dream Dictionary - Quick Start
echo ========================================
echo.

echo [1] Starting Backend Server...
echo.
cd backend
start cmd /k "node src/server.js"
cd ..

echo [2] Backend server starting on http://localhost:5000
echo.
timeout /t 3 /nobreak > nul

echo [3] Opening Test Interface in Browser...
start "" "test-app.html"

echo.
echo ========================================
echo   Application Started Successfully!
echo ========================================
echo.
echo Backend API: http://localhost:5000/health
echo Test Interface: test-app.html (should open automatically)
echo.
echo To stop the server, close the backend terminal window.
echo.
pause