@echo off
REM =============================================================================
REM MCP Server - Secure Startup Script
REM =============================================================================
REM
REM This script loads environment variables from .env.mcp (NOT versioned)
REM and starts the MCP server for Claude Desktop.
REM
REM =============================================================================

cd /d F:\corematch

REM Check if .env.mcp exists
if not exist .env.mcp (
    echo.
    echo ERROR: .env.mcp file not found!
    echo.
    echo Please create .env.mcp from .env.mcp.example:
    echo   1. Copy .env.mcp.example to .env.mcp
    echo   2. Fill in your actual secrets
    echo   3. Never commit .env.mcp to Git
    echo.
    pause
    exit /b 1
)

REM Load environment variables from .env.mcp
echo Loading environment from .env.mcp...
for /f "usebackq tokens=1,2 delims==" %%a in (".env.mcp") do (
    REM Skip comments and empty lines
    echo %%a | findstr /r "^#" >nul
    if errorlevel 1 (
        if not "%%a"=="" (
            set %%a=%%b
        )
    )
)

REM Verify required variables are set
if "%NEXT_PUBLIC_SUPABASE_URL%"=="" (
    echo ERROR: NEXT_PUBLIC_SUPABASE_URL not set in .env.mcp
    pause
    exit /b 1
)

if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
    echo ERROR: SUPABASE_SERVICE_ROLE_KEY not set in .env.mcp
    pause
    exit /b 1
)

if "%MCP_AUTH_HEADER%"=="" (
    echo ERROR: MCP_AUTH_HEADER not set in .env.mcp
    pause
    exit /b 1
)

echo Environment loaded successfully.
echo.

REM Start MCP server
"C:\Program Files\nodejs\npx.cmd" tsx bin/mcp-server.ts
