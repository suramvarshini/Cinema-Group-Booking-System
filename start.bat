@echo off
echo ===================================================
echo 🍿 Starting Cinema Group Ticket Booking System...
echo ===================================================

echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH!
    pause
    exit /b 1
)

echo [2/3] Starting Backend Server (PostgreSQL + Express)...
start "Cinema Booking - Backend" cmd /k "cd backend && npm start"

echo [3/3] Starting Frontend Server (Vite + React)...
start "Cinema Booking - Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 3 >nul
start http://localhost:3000
echo System started successfully at http://localhost:3000!
