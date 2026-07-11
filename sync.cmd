@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === tw-taxonomy 一鍵備份：commit + 雙推（origin=seyen37 / backup=seyenbot）===
echo.

REM 清 index.lock 殘留（沙箱曾碰過 .git 的保險，呼應 2026-05-13 lock 事故教訓）
if exist ".git\index.lock" del /f /q ".git\index.lock"

git add -A

REM 產生時間戳 commit 訊息；無變更則跳過 commit、仍推現有 HEAD
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set NOW=%%i
git commit -m "backup: sync %NOW%" 2>nul
if errorlevel 1 echo (無新變更可 commit，直接推送現有 HEAD)
echo.

echo -- push origin  (seyen37, public) --
git push origin main
echo.
echo -- push backup  (seyenbot, private) --
git push backup main
echo.

echo 備份完成。
pause
