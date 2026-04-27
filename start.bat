@echo off
setlocal

echo.
echo  Product Quality Report
echo  ========================
echo.

REM Check .NET
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK not found. Install from https://dotnet.microsoft.com/download
    pause & exit /b 1
)

REM Check Node
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)

REM Install frontend deps if needed
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo Starting backend on http://localhost:5000 ...
start "Backend" cmd /k "cd backend\src\ProductQualityReport.Api && dotnet run"

echo Waiting for backend to start...
timeout /t 6 /nobreak >nul

echo Starting frontend on http://localhost:4200 ...
start "Frontend" cmd /k "cd frontend && npx ng serve --open"

echo.
echo  Both services are starting.
echo  Frontend will open automatically at http://localhost:4200
echo.
echo  Close both terminal windows to stop the app.
echo.
pause
