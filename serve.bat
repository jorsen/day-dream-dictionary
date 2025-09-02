@echo off
echo Starting Task Manager Server...
echo.
echo The application will be available at:
echo http://localhost:8080/task-manager.html
echo.
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8080 2>nul || python3 -m http.server 8080 2>nul || (
    echo Python is not installed or not in PATH.
    echo Please install Python or use another method to serve the files.
    pause
)