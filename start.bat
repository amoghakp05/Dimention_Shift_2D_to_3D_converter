@echo off
title DimensionShift - 2D to 3D Converter
cd /d "%~dp0"

echo ============================================================
echo       DimensionShift - 2D to 3D Converter Launcher
echo ============================================================
echo.

:: Check if Python is installed
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not found in your system PATH.
    echo Please install Python 3.8 or higher, and ensure
    echo "Add Python to PATH" is checked during installation.
    echo.
    pause
    exit /b 1
)

:: Run the starter script
python run.py

if %ERRORLEVEL% neq 0 (
    echo.
    echo [INFO] Launcher closed with code %ERRORLEVEL%.
    pause
)

