@echo off
:Reconnected
title cimidi - ticket system
node .
if %errorlevel% neq 0 (
    echo An error occurred. Restarting...
    timeout /t 5 /nobreak >nul
    goto Reconnected
) else (
    echo Process completed successfully.
) 