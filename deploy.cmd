@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Выкладываю сайт на GitHub Pages ===
git add -A
git commit -m "обновление сайта" || echo (нет новых изменений)
git push
echo.
echo Готово! Сайт обновится через ~1 минуту: https://pavelneumoin.github.io/2200/
pause
