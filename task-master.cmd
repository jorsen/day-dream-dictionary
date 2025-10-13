@echo off
rem Lightweight shim to run the local parse-prd.js with node
rem Usage: task-master <subcommand> [options]
setlocal
set SCRIPT_DIR=%~dp0
node "%SCRIPT_DIR%parse-prd.js" %*
endlocal