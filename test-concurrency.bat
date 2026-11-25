@echo off
echo ===================================================
echo 🔒 Running Mutex Concurrency Test...
echo ===================================================
cd backend
npm run test:concurrency
pause
