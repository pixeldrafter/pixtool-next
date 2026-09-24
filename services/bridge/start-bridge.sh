#!/usr/bin/env bash
# ======================================================================
#  Pixtool Bridge — Linux / macOS başlatıcı
#
#      chmod +x start-bridge.sh && ./start-bridge.sh
#
#  Token konsolda gösterilir; arayüzde Ayarlar > Köprü alanına girin.
# ======================================================================
set -euo pipefail

cd "$(dirname "$0")"

PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done

if [ -z "$PY" ]; then
  echo
  echo "  HATA: Python bulunamadı. Kurun:  sudo apt install python3"
  echo
  exit 1
fi

if ! "$PY" -c "import psutil" >/dev/null 2>&1; then
  echo
  echo "  NOT: psutil kurulu değil — temel veri toplanacak."
  echo "       Daha zengin bilgi için:  $PY -m pip install psutil"
  echo
fi

echo
echo "  Pixtool Bridge başlatılıyor..."
echo

exec "$PY" ./pixtool_bridge.py "$@"
