#!/bin/bash
# n8n webhook imzasini bul (tam zincir testi icin)
echo "=== n8n VERITABANI ==="
systemctl cat n8n 2>/dev/null | grep -iE "DB_TYPE|DB_SQLITE|DB_POSTGRESDB|EnvironmentFile" | sed 's/^/  /'

ENVF=$(systemctl cat n8n 2>/dev/null | grep EnvironmentFile | head -1 | sed 's/.*=//')
echo "  env dosyasi: $ENVF"
[ -f "$ENVF" ] && grep -iE "^DB_" "$ENVF" | sed 's/\(PASSWORD=\).*/\1***/' | sed 's/^/  /'

echo ""
echo "=== SQLITE ==="
DB=/var/www/n8n/.n8n/database.sqlite
[ -f "$DB" ] || DB=$(find /var/www/n8n /root/.n8n /home/*/.n8n -name "database.sqlite" 2>/dev/null | head -1)
echo "  dosya: $DB"

if [ -f "$DB" ]; then
  echo "  --- webhook_entity tablosu ---"
  python3 - <<PY
import sqlite3, json
try:
    con = sqlite3.connect("$DB")
    cur = con.cursor()
    cur.execute("SELECT webhookPath, method, node, workflowId FROM webhook_entity")
    for row in cur.fetchall():
        print("   ", row[0], row[1], row[2][:40] if row[2] else "", row[3])
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tabs = [r[0] for r in cur.fetchall()]
    print("   tablolar:", ", ".join(tabs[:14]))
except Exception as e:
    print("   hata:", e)
PY
else
  echo "  sqlite bulunamadi — postgresql olabilir"
  psql -U n8n -d n8n -c "SELECT \\"webhookPath\\", method FROM webhook_entity;" 2>/dev/null | sed 's/^/  /' || echo "  psql erisilemedi"
fi
