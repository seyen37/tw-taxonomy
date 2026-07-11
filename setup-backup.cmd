@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === tw-taxonomy 備份 remote 設定（playbook SSH 別名法）===
echo.

REM 清掉先前 HTTPS dual-push 在 origin 上多加的推送網址（若有）
git remote set-url --delete --push origin https://github.com/seyenbot/tw-taxonomy.git 2>nul

REM backup remote 指向 seyenbot；github-backup = 你 ~/.ssh/config 內 seyenbot 專用金鑰別名
git remote remove backup 2>nul
git remote add backup git@github-backup:seyenbot/tw-taxonomy.git

echo 目前 remotes：
git remote -v
echo.
echo 設定完成。之後每次備份只要雙擊 sync.cmd 即可。
pause
