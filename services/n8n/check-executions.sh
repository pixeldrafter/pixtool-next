#!/bin/bash
# n8n akis calisma kayitlarini kontrol et
JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MTYxMThhYi0zZDk5LTRkYjUtYmRmOC1mM2YxYzQ3OGQ5MzIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzY3ZWRjMGEtNmUzYy00YWQ0LTg5NTktMGY2OTdjZjA4NjRmIiwiaWF0IjoxNzkwMzI0NDE4fQ.1tL8ko0r-K06DKxf6tY_bJGmVOy_p5RqG-rAMWKr6C4"
B="https://otomasyon.omercataloglu.com"
WF="eM2BGGd45FNmmJUi"

echo "=== n8n CALISMA KAYITLARI ==="
curl -s -m 30 -H "X-N8N-API-KEY: $JWT" "$B/api/v1/executions?workflowId=$WF&limit=5&includeData=true" -o /tmp/ex.json
python3 - <<'PY'
import json
try:
    d=json.load(open('/tmp/ex.json'))
    exs=d.get('data',[])
    print(f'  kayit sayisi: {len(exs)}')
    for e in exs:
        print(f"    #{e.get('id')}  {e.get('status'):<10} {e.get('startedAt','')[:19]}  dugum={e.get('finished')}")
        data=e.get('data') or {}
        res=data.get('resultData') or {}
        run=res.get('runData') or {}
        for node, runs in run.items():
            code=None
            try:
                code=runs[0].get('data',{}).get('main',[{}])[0].get('json',{}).get('ok')
            except Exception:
                pass
            err = runs[0].get('error') if runs else None
            mark='!!' if err else 'ok'
            print(f"       [{mark}] {node}" + (f"  HATA: {str(err.get('message'))[:90]}" if err else ''))
except Exception as exc:
    print('  okunamadi:', exc)
    print('  ham:', open('/tmp/ex.json').read()[:400])
PY

echo ""
echo "=== BOT DURUMU ==="
TOKEN="$(grep '^TELEGRAM_BOT_TOKEN=' /opt/pixtool/api/.env | cut -d= -f2-)"
curl -s -m 20 "https://api.telegram.org/bot${TOKEN}/getMe" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('result') or {}
print('  bot     :', r.get('first_name'), '(@'+str(r.get('username'))+')')
print('  durum   :', 'OK' if d.get('ok') else d)
" 2>/dev/null

echo ""
echo "=== WEBHOOK KAYITLI MI (telegram) ==="
curl -s -m 20 "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('result') or {}
print('  url             :', r.get('url') or '(yok)')
print('  bekleyen guncel.:', r.get('pending_update_count'))
print('  son hata        :', r.get('last_error_message') or '-')
" 2>/dev/null
