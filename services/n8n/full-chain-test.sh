#!/bin/bash
# Tam zincir testi: talep olustur -> Telegram gonder -> n8n butonu isle -> API karar
API="https://pixtool.omercataloglu.com"
N8N="https://otomasyon.omercataloglu.com"
SECRET="$(grep '^N8N_WEBHOOK_SECRET=' /opt/pixtool/api/.env | cut -d= -f2-)"
CHAT="$(grep '^TELEGRAM_CHAT_ID=' /opt/pixtool/api/.env | cut -d= -f2-)"

echo "=== 1) TALEP OLUSTUR ==="
RESP=$(curl -s -m 45 -X POST -H "Content-Type: application/json" \
  -d '{"username":"zincir.testi","full_name":"Zincir Testi","note":"tam zincir"}' \
  "$API/api/v1/access/register-request")
RID=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['request']['id'])" 2>/dev/null)
CH=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('channel'))" 2>/dev/null)
echo "  kanal        : $CH"
echo "  talep kimligi: $RID"

if [ -z "$RID" ]; then
  echo "  TALEP OLUSTURULAMADI: $(echo "$RESP" | head -c 250)"
  exit 1
fi

echo ""
echo "=== 2) DURUM (bekleyen olmali) ==="
curl -s -m 20 "$API/api/v1/access/request/$RID" | python3 -c "
import sys,json;d=json.load(sys.stdin)['request'];print('  durum:', d['status'])"

echo ""
echo "=== 3) BUTONA BASILDI (n8n tetikleyicisine gercek Telegram guncellemesi) ==="
sleep 5
UPDATE=$(python3 -c "
import json
print(json.dumps({
  'update_id': 900000001,
  'callback_query': {
    'id': 'test-cb-$(date +%s)',
    'from': {'id': int('$CHAT'), 'is_bot': False, 'first_name': 'Omer', 'username': 'omercataloglu'},
    'message': {
      'message_id': 999,
      'date': 1790000000,
      'chat': {'id': int('$CHAT'), 'type': 'private'},
      'text': 'TEST MESAJI'
    },
    'chat_instance': 'test',
    'data': 'px:approve:$RID'
  }
}))
")
CB=$(curl -s -m 40 -X POST -H "Content-Type: application/json" -d "$UPDATE" \
  "$N8N/webhook/pixtool-karar/webhook" -w "\n  HTTP: %{http_code}")
echo "  $CB"

echo ""
echo "=== 4) 6 SN SONRA DURUM ==="
sleep 6
curl -s -m 20 "$API/api/v1/access/request/$RID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['request']
print('  durum      :', d['status'])
print('  karar veren:', d.get('decided_by') or '-')
print('  mesaj      :', d.get('message') or '-')
"

echo ""
echo "=== 5) N8N CALISMA KAYDI ==="
JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MTYxMThhYi0zZDk5LTRkYjUtYmRmOC1mM2YxYzQ3OGQ5MzIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzY3ZWRjMGEtNmUzYy00YWQ0LTg5NTktMGY2OTdjZjA4NjRmIiwiaWF0IjoxNzkwMzI0NDE4fQ.1tL8ko0r-K06DKxf6tY_bJGmVOy_p5RqG-rAMWKr6C4"
curl -s -m 30 -H "X-N8N-API-KEY: $JWT" "$N8N/api/v1/executions?workflowId=eM2BGGd45FNmmJUi&limit=3&includeData=true" -o /tmp/ex.json
python3 - <<'PY'
import json
try:
    d=json.load(open('/tmp/ex.json'))
    for e in (d.get('data') or [])[:3]:
        print(f"  #{e.get('id')} {e.get('status')} {str(e.get('startedAt'))[:19]}")
        run=((e.get('data') or {}).get('resultData') or {}).get('runData') or {}
        for node,runs in run.items():
            if not runs: continue
            err=runs[0].get('error')
            if err:
                print(f"      [HATA] {node}: {str(err.get('message'))[:100]}")
            else:
                out=runs[0].get('data',{}).get('main',[[]])
                n=len(out[0]) if out and out[0] else 0
                print(f"      [ok]   {node} ({n} oge)")
except Exception as exc:
    print('  okunamadi:', exc)
PY
