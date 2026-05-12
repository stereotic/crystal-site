@echo off
REM Deployment script for Windows

set HOST=170.168.103.10
set USER=root
set PASSWORD=j96Tq4ayF0u3
set DOMAIN=crystalcards.store

echo Starting deployment to %DOMAIN%...

REM Build the project
echo Building project...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)

echo Build successful!

REM Create deployment package
echo Creating deployment package...
tar -czf crystal-deploy.tar.gz dist public node_modules package.json package-lock.json database.db

echo Package created!

REM Upload using WinSCP or pscp
echo.
echo Upload the file crystal-deploy.tar.gz to your server at /tmp/
echo Then run the deployment commands on the server.
echo.
echo Manual deployment steps:
echo 1. Upload crystal-deploy.tar.gz to server
echo 2. SSH to server: ssh root@%HOST%
echo 3. Run deployment commands
echo.

pause
