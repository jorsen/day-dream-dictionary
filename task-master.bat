@echo off
rem Robust task-master shim for Windows
rem  - prefer local parse-prd.js in the repository root
rem  - if not present, try `npm run task-master -- ...`
rem  - otherwise fall back to `npx -y --package=task-master-ai task-master-ai ...`

setlocal
set SCRIPT_DIR=%~dp0

rem Remove trailing backslash if present
if "%SCRIPT_DIR:~-1%"=="\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

rem Show a quick help if no args or --help
if "%~1"=="" (
	echo task-master.bat - project task helper
	echo.
	echo Usage:
	echo   task-master.bat <subcommand> [options]
	echo.
	echo This shim prefers the local parse-prd.js, then an npm script, then npx package.
	endlocal
	goto :eof
)

if "%~1"=="--help" (
	echo task-master.bat - project task helper
	echo.
	echo Example subcommands:
	echo   add-task --prompt "Do something"
	echo   list-tasks --tag master
	echo   parse-prd <file> --format json --output tasks.json
	endlocal
	goto :eof
)

if exist "%SCRIPT_DIR%\parse-prd.js" (
	node "%SCRIPT_DIR%\parse-prd.js" %*
	endlocal
	goto :eof
)

rem Check for package.json with a task-master script
set HAS_SCRIPT=0
if exist "%SCRIPT_DIR%\package.json" (
	for /f "usebackq delims=" %%L in (`type "%SCRIPT_DIR%\package.json" ^| findstr /c:"\"task-master\""`) do (
		set HAS_SCRIPT=1
	)
)

if "%HAS_SCRIPT%"=="1" (
	echo Running npm script: task-master (in %SCRIPT_DIR%)
	pushd "%SCRIPT_DIR%"
	npm run task-master -- %*
	popd
	endlocal
	goto :eof
)

echo No local CLI found; falling back to npx task-master-ai (in %SCRIPT_DIR%)
pushd "%SCRIPT_DIR%"
npx -y --package=task-master-ai task-master-ai %*
popd
endlocal