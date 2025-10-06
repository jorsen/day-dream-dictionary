@echo off
echo 🔧 Setting up Day Dream Dictionary Authentication...
echo.

cd /d "%~dp0"

echo 📦 Installing backend dependencies...
cd backend
npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ✅ Dependencies installed successfully

echo.
echo 🧪 Testing authentication system...
node test-auth-fix.js

echo.
echo 🚀 Starting the server...
echo Open http://localhost:5000 in your browser after startup
echo Test login with: sample1@gmail.com / sample
echo.

npm run dev

pause
