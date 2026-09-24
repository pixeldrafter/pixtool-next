@echo off
REM ======================================================================
REM  Pixtool Bridge — Windows baslatici
REM
REM  Cift tiklayarak calistirin. Konsol penceresi acilir ve token gosterilir.
REM  Token'i arayuzde Ayarlar > Kopru alanina girin.
REM
REM  Ilk calistirmada psutil kurmayi onerir (daha zengin veri icin).
REM ======================================================================

setlocal
cd /d "%~dp0"

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY (
  where python >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo.
  echo   HATA: Python bulunamadi.
  echo   https://www.python.org/downloads/ adresinden kurun.
  echo   Kurulumda "Add Python to PATH" secenegini isaretleyin.
  echo.
  pause
  exit /b 1
)

REM psutil onerisi (kurulu degilse sor)
%PY% -c "import psutil" >nul 2>&1
if errorlevel 1 (
  echo.
  echo   NOT: psutil kurulu degil - temel veri toplanacak.
  echo        Daha zengin bilgi icin:  %PY% -m pip install psutil
  echo.
)

echo.
echo   Pixtool Bridge baslatiliyor...
echo.

%PY% "%~dp0pixtool_bridge.py" %*

echo.
echo   Kopru kapandi.
pause
