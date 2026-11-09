@echo off
echo ===================================================
echo Starting GPS-CRM Local Development Environment
echo ===================================================

echo [1/2] Starting Backend Server on port 5000 and GT06 on port 5023...
start "GPS-CRM Backend (Port 5000)" cmd /k "cd /d %~dp0backend && node index.js"

echo [2/2] Starting Frontend React Server on port 3000...
start "GPS-CRM Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo Both servers are launching in separate windows!
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo ===================================================
pause
