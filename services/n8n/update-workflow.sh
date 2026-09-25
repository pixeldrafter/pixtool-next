#!/bin/bash
# n8n akisini guncelle + aktive et + dogrula
JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MTYxMThhYi0zZDk5LTRkYjUtYmRmOC1mM2YxYzQ3OGQ5MzIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzY3ZWRjMGEtNmUzYy00YWQ0LTg5NTktMGY2OTdjZjA4NjRmIiwiaWF0IjoxNzkwMzI0NDE4fQ.1tL8ko0r-K06DKxf6tY_bJGmVOy_p5RqG-rAMWKr6C4"
B="https://otomasyon.omercataloglu.com"
WF="eM2BGGd45FNmmJUi"

echo "=== 1) AKIS GUNCELLE (PUT) ==="
curl -s -m 40 -X PUT -H "X-N8N-API-KEY: $JWT" -H "Content-Type: application/json" \
  --data-binary @/tmp/px-wf.json "$B/api/v1/workflows/$WF" -o /tmp/up.json -w "  HTTP: %{http_code}\n"
python3 -c "
import json
try:
    d=json.load(open('/tmp/up.json'))
    print('  ad      :', d.get('name'))
    print('  dugumler:', len(d.get('nodes') or []))
    print('  aktif   :', d.get('active'))
except Exception as e:
    print('  okunamadi:', open('/tmp/up.json').read()[:300])
"

echo ""
echo "=== 2) AKTIVE ET ==="
sleep 2
curl -s -m 40 -X POST -H "X-N8N-API-KEY: $JWT" -H "Content-Type: application/json" \
  "$B/api/v1/workflows/$WF/activate" -o /tmp/act.json -w "  HTTP: %{http_code}\n"
python3 -c "
import json
d=json.load(open('/tmp/act.json'))
print('  ad    :', d.get('name'))
print('  aktif :', d.get('active'))
print('  dugum :', ', '.join(n.get('name','?') for n in (d.get('nodes') or [])))
"

echo ""
echo "=== 3) TELEGRAM WEBHOOK KAYDI ==="
sleep 4
TOKEN="$(grep '^TELEGRAM_BOT_TOKEN=' /opt/pixtool/api/.env | cut -d= -f2-)"
curl -s -m 20 "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | python3 -c "
import sys,json
r=(json.load(sys.stdin).get('result') or {})
print('  url   :', r.get('url') or '(yok)')
print('  hata  :', r.get('last_error_message') or '-')
print('  bekleyen:', r.get('pending_update_count'))
"
