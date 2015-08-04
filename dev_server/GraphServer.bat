@echo off
start C:\xampp\xampp-control.exe
tasklist /nh /fi "IMAGENAME eq xampp-control.exe" | find /i "xampp-control.exe" > nul && start cmd.exe /k "cd c:\xampp\htdocs\GraphDisplay\dev_server & node server.js"