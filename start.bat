@echo off
chcp 65001 > nul
echo ====================================================
echo   🤖 Prompt Carefully 로컬 프로토타입 서버 실행 중...
echo   브라우저에서 http://localhost:8000 이 열립니다.
echo ====================================================
start http://localhost:8000
python -m http.server 8000
pause
