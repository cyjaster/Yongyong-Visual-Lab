@echo off
cd /d "%~dp0"
echo Starting Yongyong Visual Lab...
echo Keep this window open while editing.
node checks\serve-local.cjs --open
if errorlevel 1 pause
