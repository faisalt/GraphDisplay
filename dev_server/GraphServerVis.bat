@echo off
start C:\xampp\xampp-control.exe
tasklist /nh /fi "IMAGENAME eq xampp-control.exe" | find /i "xampp-control.exe" > nul && start cmd.exe /k "cd c:\xampp\htdocs\GraphDisplay\dev_server & node server.js"
cd C:\Program Files (x86)\Microsoft Visual Studio 12.0\Common7\IDE
start devenv.exe