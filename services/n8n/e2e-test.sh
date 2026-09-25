#!/bin/bash
# Uçtan uca erişim talebi testi
API="https://pixtool.omercataloglu.com"
SECRET="$(grep '^N8N_WEBHOOK_SECRET=' /opt/pixtool/api/.env | cut -d= -f2-)"

echo "=== 1) KAYIT TALEBI OLUSTUR (API uzerinden) ==="
RESP=$(curl -s -m 40 -X POST -H "Content-Type: application/json" \
  -d '{"username":"test.telefon.onay","full_name":"Test Kullanici","email":"test@ornek.com","note":"uctan uca test"}' \
  "$API/api/v1/access/register-request")
echo "  yanit: $(echo "$RESP" | head -c 260)"
echo ""

RID=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['request']['id'])" 2>/dev/null)
echo "  talep kimligi: $RID"

if [ -z "$RID" ]; then
  echo "  TALEP OLUSTURULAMADI"
  exit 1
fi

echo ""
echo "=== 2) TELEGRAM GONDERIMI (n8n uzerinden) ==="
sleep 4
echo "  akis calisti mi kontrol ediliyor..."

echo ""
echo "=== 3) BUTONA BASILMASINI TAKLIT ET ==="
CB=$(curl -s -m 30 -X POST -H "Content-Type: application/json" -H "X-Pixtool-Secret: $SECRET" \
  -d "{\"request_id\":\"$RID\",\"approve\":false,\"decided_by\":\"telegram:@omercataloglu\"}" \
  "$API/api/v1/access/callback")
echo "  yanit: $CB"

echo ""
echo "=== 4) DURUM KONTROLU ==="
curl -s -m 20 "$API/api/v1/access/request/$RID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['request']
print('  durum      :', d['status'])
print('  karar veren:', d.get('decided_by'))
print('  mesaj      :', d.get('message'))
"

echo ""
echo "=== 5) IMZASIZ KARAR REDDEDILIYOR MU ==="
curl -s -m 20 -o /dev/null -w "  imzasiz -> %{http_code} (401 beklenir)\n" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"request_id\":\"$RID\",\"approve\":true}" \
  "$API/api/v1/access/callback"

echo ""
echo "=== 6) TUM TALEPLER ==="
curl -s -m 20 "$API/api/v1/access/requests?limit=5" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('  toplam:', d['count'])
for r in d['requests']:
    print(f\"    {r['kind']:<9} {r['status']:<9} {r['username']:<22} {r.get('decided_by') or '-'}\")
"
