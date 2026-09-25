#!/usr/bin/env bash
#
# PixVuln - Guvenlik Zafiyet Taramasi (Linux)
#
# Uzak panelden calistirilabilen, ETKILESIMSIZ guvenlik denetimi.
# Acik portlar, guvenlik duvari, SSH yapilandirmasi, kullanicilar,
# guncellemeler ve yaygin yanlis yapilandirmalari tarar; risk puanlar.
#
# Kullanim:
#   ./PixVuln_Guvenlik_Taramasi.sh              # konsol raporu + dosya
#   ./PixVuln_Guvenlik_Taramasi.sh --json       # yalnizca JSON
#   ./PixVuln_Guvenlik_Taramasi.sh --quick      # hizli (ag taramasi yok)
#   ./PixVuln_Guvenlik_Taramasi.sh --no-report  # dosya yazma
#
# Yazar   : Omer Cataloglu
# Surum   : 1.0.0
# Kategori: Guvenlik
#
set -uo pipefail

VERSION="1.0.0"
STARTED_EPOCH=$(date +%s)
STARTED_HUMAN=$(date '+%d.%m.%Y %H:%M:%S')

JSON_ONLY=0
QUICK=0
NO_REPORT=0

for arg in "$@"; do
  case "$arg" in
    --json)      JSON_ONLY=1 ;;
    --quick)     QUICK=1 ;;
    --no-report) NO_REPORT=1 ;;
    -h|--help)
      sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

HOSTNAME_="$(hostname 2>/dev/null || echo bilinmiyor)"
IS_ROOT=0
[ "$(id -u 2>/dev/null || echo 1)" -eq 0 ] && IS_ROOT=1

# ----------------------------------------------------------------------
#  Renkler (yalnizca TTY'de)
# ----------------------------------------------------------------------
if [ -t 1 ] && [ "$JSON_ONLY" -eq 0 ]; then
  C_RESET=$'\033[0m'; C_CYAN=$'\033[36m'; C_DCYAN=$'\033[36m'
  C_RED=$'\033[31m'; C_YEL=$'\033[33m'; C_DYEL=$'\033[33m'
  C_GRAY=$'\033[90m'; C_GREEN=$'\033[32m'; C_BOLD=$'\033[1m'
else
  C_RESET=""; C_CYAN=""; C_DCYAN=""; C_RED=""; C_YEL=""; C_DYEL=""; C_GRAY=""; C_GREEN=""; C_BOLD=""
fi

# ----------------------------------------------------------------------
#  Bulgular — JSON dogrudan uretilir (jq bagimsiz)
# ----------------------------------------------------------------------
FINDINGS_FILE="$(mktemp)"
trap 'rm -f "$FINDINGS_FILE"' EXIT
FINDING_FIRST=1

#: JSON metnini kacisli hale getirir.
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' | tr -d '\n\r'
}

#: add_finding <id> <baslik> <seviye> <detay> <cozum>
add_finding() {
  local id="$1" baslik="$2" seviye="$3" detay="${4:-}" cozum="${5:-}"

  [ "$FINDING_FIRST" -eq 1 ] || printf ',' >> "$FINDINGS_FILE"
  FINDING_FIRST=0
  printf '{"id":"%s","baslik":"%s","seviye":"%s","detay":"%s","cozum":"%s"}' \
    "$(json_escape "$id")" "$(json_escape "$baslik")" "$(json_escape "$seviye")" \
    "$(json_escape "$detay")" "$(json_escape "$cozum")" >> "$FINDINGS_FILE"
}

#: Bulgu sayisini seviyeye gore dondurur.
count_level() {
  local level="$1"
  grep -o "\"seviye\":\"$level\"" "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' '
}

if [ "$JSON_ONLY" -eq 0 ]; then
  echo ""
  echo "${C_DCYAN}  ################################################################${C_RESET}"
  echo "${C_CYAN}  #        PixVuln  -  GUVENLIK ZAFIYET TARAMASI  v${VERSION}         #${C_RESET}"
  echo "${C_DCYAN}  ################################################################${C_RESET}"
  echo ""
  echo "  Hedef    : ${HOSTNAME_}"
  echo "  Zaman    : ${STARTED_HUMAN}"
  if [ "$IS_ROOT" -eq 1 ]; then
    echo "  Yetki    : root"
  else
    echo "  Yetki    : normal kullanici ${C_DYEL}(bazi kontroller atlanir)${C_RESET}"
  fi
  echo "  Mod      : $([ "$QUICK" -eq 1 ] && echo 'Hizli' || echo 'Tam')"
  echo ""
fi

# ----------------------------------------------------------------------
#  1. Sistem bilgisi
# ----------------------------------------------------------------------
OS_NAME="Bilinmiyor"
if [ -r /etc/os-release ]; then
  OS_NAME="$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d= -f2- | tr -d '"')"
fi
KERNEL="$(uname -r 2>/dev/null || echo '')"
KERNEL_FULL="$(uname -a 2>/dev/null || echo '')"
UPTIME_S="$(cut -d. -f1 /proc/uptime 2>/dev/null || echo 0)"

# Destek sonu (EOL) kontrolu — yaklasik
if [ -r /etc/os-release ]; then
  DEB_VER="$(. /etc/os-release; echo "${VERSION_ID:-}")"
  case "$DEB_VER" in
    8|9) add_finding "os-eol" "Isletim sistemi destek disi (Debian ${DEB_VER})" "Kritik" \
           "Destek bitmis surum - guvenlik guncellemesi almiyor" "Guncel bir surume yukseltin." ;;
    10)  add_finding "os-eski" "Isletim sistemi eski (Debian 10)" "Yuksek" \
           "Debian 10 LTS destegi sinirli" "Debian 12 veya uzerine yukseltin." ;;
  esac
fi

[ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [1/9] Sistem bilgisi toplandi${C_RESET}"

# ----------------------------------------------------------------------
#  2. Acik portlar
# ----------------------------------------------------------------------
#: Riskli portlar -> aciklama (Bash 4 iliskisel dizi)
declare -A RISKY_PORTS=(
  [21]="FTP - sifresiz iletim"
  [23]="Telnet - sifresiz"
  [25]="SMTP - acik relay riski"
  [111]="rpcbind - amplifikasyon saldirisi"
  [135]="RPC"
  [139]="NetBIOS"
  [445]="SMB - fidye yazilimi hedefi"
  [1433]="MSSQL"
  [1521]="Oracle DB"
  [2049]="NFS - paylasim disari acilmamali"
  [2375]="Docker API - sifresiz root erisimi"
  [3306]="MySQL/MariaDB"
  [3389]="RDP"
  [5432]="PostgreSQL"
  [5900]="VNC - zayif sifreleme"
  [6379]="Redis - cogu zaman sifresiz"
  [9200]="Elasticsearch - cogu zaman sifresiz"
  [11211]="Memcached"
  [27017]="MongoDB"
)

PORTS_FILE="$(mktemp)"
trap 'rm -f "$FINDINGS_FILE" "$PORTS_FILE"' EXIT

# ss tercih edilir, yoksa netstat
if command -v ss >/dev/null 2>&1; then
  ss -tulpnH 2>/dev/null | awk '{
    proto=$1; local=$5; proc=""
    for (i=7; i<=NF; i++) proc = proc " " $i
    gsub(/^ +| +$/, "", proc)
    print proto "|" local "|" proc
  }' > "$PORTS_FILE" 2>/dev/null || true
elif command -v netstat >/dev/null 2>&1; then
  netstat -tulpn 2>/dev/null | awk 'NR>2 { print $1 "|" $4 "|" $7 }' > "$PORTS_FILE" 2>/dev/null || true
fi

COUNT_LISTEN=0
COUNT_EXTERNAL=0
EXTERNAL_PORTS=""

while IFS='|' read -r proto local proc; do
  [ -z "$local" ] && continue
  COUNT_LISTEN=$((COUNT_LISTEN + 1))

  port="${local##*:}"
  addr="${local%:*}"
  [ -z "$port" ] && continue

  # Disari acik mi? (0.0.0.0, ::, * veya gercek IP)
  is_external=0
  case "$addr" in
    0.0.0.0|'::'|'*'|'[::]') is_external=1 ;;
    *) is_external=1 ;;
  esac

  if [ "$is_external" -eq 1 ]; then
    COUNT_EXTERNAL=$((COUNT_EXTERNAL + 1))
    EXTERNAL_PORTS="${EXTERNAL_PORTS}${port} "
  fi

  if [ -n "${RISKY_PORTS[$port]:-}" ]; then
    severity="Orta"
    case "$port" in
      23|445|2375|6379|9200|11211) severity="Yuksek" ;;
      3389|5900|2049) severity="Yuksek" ;;
    esac
    add_finding "port-${port}" \
      "Riskli port acik: ${port} (${RISKY_PORTS[$port]})" \
      "$severity" \
      "${local} dinleniyor - ${proc:-islem bilinmiyor}" \
      "Bu port gerekli mi? Gerekli degilse servisi durdurun veya guvenlik duvariyla kisitlayin."
  fi
done < "$PORTS_FILE"

[ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [2/9] Acik portlar tarandi (${COUNT_LISTEN} dinleyici, ${COUNT_EXTERNAL} disari)${C_RESET}"

# ----------------------------------------------------------------------
#  3. Guvenlik duvari
# ----------------------------------------------------------------------
FW_STATE="yok"

if command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -qi '^Status: active'; then
    FW_STATE="ufw (etkin)"
  else
    FW_STATE="ufw (kapali)"
    add_finding "fw-ufw" "ufw guvenlik duvari KAPALI" "Kritik" \
      "ufw kurulu ama etkin degil" "sudo ufw enable"
  fi
elif command -v firewall-cmd >/dev/null 2>&1; then
  if firewall-cmd --state 2>/dev/null | grep -qi running; then
    FW_STATE="firewalld (etkin)"
  else
    FW_STATE="firewalld (kapali)"
    add_finding "fw-firewalld" "firewalld KAPALI" "Kritik" \
      "firewalld kurulu ama calismiyor" "sudo systemctl enable --now firewalld"
  fi
elif command -v iptables >/dev/null 2>&1; then
  # iptables kural sayisina bak
  policies="$(iptables -L -n 2>/dev/null | grep -c 'ACCEPT\|DROP\|REJECT' || echo 0)"
  if [ "$policies" -gt 0 ]; then
    FW_STATE="iptables (${policies} kural)"
  else
    FW_STATE="iptables (kural yok)"
    add_finding "fw-iptables" "Guvenlik duvari kurali bulunamadi" "Yuksek" \
      "iptables kurallari bos - tum trafik serbest" \
      "nftables/ufw gibi bir yonetim katmani kurun ve varsayilan politikayi DROP yapin."
  fi
else
  add_finding "fw-yok" "Hicbir guvenlik duvari bulunamadi" "Kritik" \
    "ufw/firewalld/iptables kurulu degil" "ufw veya firewalld kurun ve etkinlestirin."
fi

[ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [3/9] Guvenlik duvari: ${FW_STATE}${C_RESET}"

# ----------------------------------------------------------------------
#  4. SSH yapilandirmasi
# ----------------------------------------------------------------------
SSH_ISSUES=0
if [ -r /etc/ssh/sshd_config ]; then
  ssh_cfg="$(grep -vE '^\s*#|^\s*$' /etc/ssh/sshd_config 2>/dev/null || true)"

  # Ortam degiskenlerini genislet
  echo "$ssh_cfg" | grep -qiE '^\s*Include\s' && ssh_cfg="$(cat /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | grep -vE '^\s*#|^\s*$' || true)"

  # PermitRootLogin
  root_login="$(echo "$ssh_cfg" | grep -iE '^\s*PermitRootLogin' | tail -1 | awk '{print $2}')"
  if [ "${root_login:-yes}" = "yes" ]; then
    add_finding "ssh-root" "SSH ile root girisimine izin veriliyor" "Yuksek" \
      "PermitRootLogin yes" "sshd_config: PermitRootLogin prohibit-password (veya no)"
    SSH_ISSUES=$((SSH_ISSUES + 1))
  fi

  # PasswordAuthentication
  pw_auth="$(echo "$ssh_cfg" | grep -iE '^\s*PasswordAuthentication' | tail -1 | awk '{print $2}')"
  if [ "${pw_auth:-yes}" = "yes" ]; then
    add_finding "ssh-sifre" "SSH sifre ile giris acik (kaba kuvvet riski)" "Orta" \
      "PasswordAuthentication yes" "Anahtar tabanli giris kullanin: PasswordAuthentication no"
    SSH_ISSUES=$((SSH_ISSUES + 1))
  fi

  # Bos sifreli hesaplar
  empty_pw="$(echo "$ssh_cfg" | grep -iE '^\s*PermitEmptyPasswords' | tail -1 | awk '{print $2}')"
  if [ "${empty_pw:-no}" = "yes" ]; then
    add_finding "ssh-bos-sifre" "SSH bos sifreye izin veriyor" "Kritik" \
      "PermitEmptyPasswords yes" "PermitEmptyPasswords no"
    SSH_ISSUES=$((SSH_ISSUES + 1))
  fi

  # Standart port mu
  ssh_port="$(echo "$ssh_cfg" | grep -iE '^\s*Port' | tail -1 | awk '{print $2}')"
  if [ "${ssh_port:-22}" = "22" ]; then
    add_finding "ssh-port" "SSH varsayilan portta (22)" "Dusuk" \
      "Otomatik tarayicilar 22 numarali portu surekli dener" \
      "Alternatif bir port kullanmak veya fail2ban ile koruma saglamak."
  fi

  # X11Forwarding
  x11="$(echo "$ssh_cfg" | grep -iE '^\s*X11Forwarding' | tail -1 | awk '{print $2}')"
  if [ "${x11:-no}" = "yes" ]; then
    add_finding "ssh-x11" "SSH X11 yonlendirmesi acik" "Dusuk" \
      "X11Forwarding yes" "Kullanilmiyorsa: X11Forwarding no"
  fi

  # MaxAuthTries
  tries="$(echo "$ssh_cfg" | grep -iE '^\s*MaxAuthTries' | tail -1 | awk '{print $2}')"
  if [ -n "${tries:-}" ] && [ "$tries" -gt 6 ] 2>/dev/null; then
    add_finding "ssh-deneme" "SSH deneme sayisi yuksek (${tries})" "Dusuk" \
      "MaxAuthTries ${tries}" "MaxAuthTries 3 veya 4"
  fi
else
  add_finding "ssh-yok" "sshd_config okunamadi" "Dusuk" \
    "/etc/ssh/sshd_config yok veya okunamaz" "SSH kurulu mu kontrol edin."
fi

# fail2ban
if command -v fail2ban-client >/dev/null 2>&1; then
  if fail2ban-client status 2>/dev/null | grep -qi 'Jail list'; then
    jail_count="$(fail2ban-client status 2>/dev/null | grep -i 'Jail list' | cut -d: -f2 | tr ',' '\n' | grep -c . || echo 0)"
    [ "$jail_count" -eq 0 ] && add_finding "f2b-bos" "fail2ban kurulu ama hicbir jail etkin degil" "Orta" \
      "Kaba kuvvet korumasi devre disi" "/etc/fail2ban/jail.local icinde [sshd] jailini etkinlestirin."
  fi
else
  add_finding "f2b-yok" "fail2ban kurulu degil" "Orta" \
    "SSH kaba kuvvet saldirilarina karsi koruma yok" \
    "sudo apt install fail2ban && sudo systemctl enable --now fail2ban"
fi

[ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [4/9] SSH yapilandirmasi denetlendi (${SSH_ISSUES} sorun)${C_RESET}"

# ----------------------------------------------------------------------
#  5. Kullanicilar ve hesaplar
# ----------------------------------------------------------------------
USER_COUNT=0
ROOT_USERS=0
EMPTY_PW_USERS=""
NOEXPIRY=""

while IFS=: read -r name pw uid gid gecos home shell; do
  USER_COUNT=$((USER_COUNT + 1))

  # UID 0 (root yetkili) hesaplar
  if [ "$uid" = "0" ] && [ "$name" != "root" ]; then
    ROOT_USERS=$((ROOT_USERS + 1))
    add_finding "uid0-${name}" "UID 0 verilmis ek hesap: ${name}" "Kritik" \
      "root ile ayni yetkiye sahip" "Bu hesabi kaldirin veya normal UID verin."
  fi

  # Kabuk erisimi olan kullanicilar icin sifre kontrolu
  case "$shell" in
    */bash|*/sh|*/zsh|*/fish)
      if [ "$uid" -ge 1000 ] && [ -r /etc/shadow ] && [ "$IS_ROOT" -eq 1 ]; then
        hash="$(grep "^${name}:" /etc/shadow 2>/dev/null | cut -d: -f2)"
        if [ -z "$hash" ] || [ "$hash" = "" ]; then
          EMPTY_PW_USERS="${EMPTY_PW_USERS}${name} "
        fi
      fi
      ;;
  esac
done < /etc/passwd

if [ -n "$EMPTY_PW_USERS" ]; then
  add_finding "bos-sifre" "Sifresiz hesaplar bulundu" "Kritik" \
    "${EMPTY_PW_USERS}" "passwd -l <kullanici> ile kilitleyin veya sifre atayin."
fi

# Sifresi hic degismeyen / suresiz hesaplar
if [ -r /etc/shadow ] && [ "$IS_ROOT" -eq 1 ]; then
  while IFS=: read -r name hash days max min warn inact expire reserved; do
    # max alani bos veya 99999 => suresiz
    if [ "$days" != "" ] && [ "$days" -gt 0 ] 2>/dev/null; then
      if [ "${max:-}" = "" ] || [ "$max" = "99999" ]; then
        case "$name" in
          root|nobody|sync|halt|shutdown) ;;
          *) NOEXPIRY="${NOEXPIRY}${name} " ;;
        esac
      fi
    fi
  done < /etc/shadow

  if [ -n "$NOEXPIRY" ]; then
    add_finding "sifre-suresiz" "Sifresi hic dolmayan hesaplar" "Dusuk" \
      "${NOEXPIRY}" "chage -M 365 <kullanici> ile sifre yaslandirmasi uygulayin."
  fi
fi

# sudo grubu
if [ -r /etc/group ]; then
  sudo_members="$(grep -E '^(sudo|wheel):' /etc/group 2>/dev/null | cut -d: -f4 | tr ',' ' ')"
  sudo_count="$(echo "$sudo_members" | wc -w | tr -d ' ')"
  if [ "$sudo_count" -gt 3 ]; then
    add_finding "sudo-kalabalik" "sudo yetkili cok fazla hesap: ${sudo_count}" "Orta" \
      "${sudo_members}" "En az yetki ilkesi: gereksiz hesaplari sudo grubundan cikarin."
  fi
fi

[ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [5/9] Kullanicilar denetlendi (${USER_COUNT} hesap)${C_RESET}"

# ----------------------------------------------------------------------
#  6. Dosya izinleri (SUID / dunya yazilabilir)
# ----------------------------------------------------------------------
if [ "$QUICK" -eq 0 ]; then
  # SUID - bilinen guvenli liste disindakiler
  sudo_suid="$(find /usr/bin /usr/sbin /bin /sbin -perm -4000 -type f 2>/dev/null | head -40)"
  saf_suid="^(/usr/bin/(sudo|su|passwd|chsh|chfn|newgrp|gpasswd|mount|umount|pkexec|crontab|ssh-agent|fusermount|fusermount3|at|Xorg|dbus-daemon-launch-helper|vmware-user-suid-wrapper|ntfs-3g|polkit-agent-helper-1)$)"
  susp_suid="$(echo "$sudo_suid" | grep -vE "$saf_suid" | grep -v '/snap/' | head -8 || true)"

  if [ -n "$susp_suid" ]; then
    count="$(echo "$susp_suid" | wc -l | tr -d ' ')"
    add_finding "suid-beklenmeyen" "Beklenmeyen SUID dosyalari: ${count}" "Orta" \
      "$(echo "$susp_suid" | tr '\n' ' ')" \
      "Bu dosyalar gercekten SUID olmali mi? Degilse: chmod u-s <dosya>"
  fi

  # Dunya yazilabilir dosyalar (kritik dizinler)
  world_writable="$(find /etc /usr/bin /usr/sbin -perm -0002 -type f 2>/dev/null | head -8 || true)"
  if [ -n "$world_writable" ]; then
    add_finding "dunya-yazilabilir" "Kritik dizinlerde herkesin yazabildigi dosyalar" "Yuksek" \
      "$(echo "$world_writable" | tr '\n' ' ')" "chmod o-w <dosya>"
  fi

  # /etc/passwd izinleri
  if [ -f /etc/passwd ]; then
    pw_perm="$(stat -c '%a' /etc/passwd 2>/dev/null || echo '')"
    [ -n "$pw_perm" ] && [ "$pw_perm" != "644" ] && add_finding "passwd-izin" "/etc/passwd izinleri beklenmedik: ${pw_perm}" "Yuksek" \
      "0644 olmali" "chmod 644 /etc/passwd"
  fi

  # /etc/shadow izinleri
  if [ -f /etc/shadow ]; then
    sh_perm="$(stat -c '%a' /etc/shadow 2>/dev/null || echo '')"
    case "$sh_perm" in
      640|600|000) ;;
      "") ;;
      *) add_finding "shadow-izin" "/etc/shadow izinleri cok acik: ${sh_perm}" "Kritik" \
           "0600 veya 0640 olmali" "chmod 640 /etc/shadow && chown root:shadow /etc/shadow" ;;
    esac
  fi
fi

[ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [6/9] Dosya izinleri denetlendi${C_RESET}"

# ----------------------------------------------------------------------
#  7. Guncellemeler ve zamanlanmis gorevler
# ----------------------------------------------------------------------
# Bekleyen guvenlik guncellemeleri
if command -v apt-get >/dev/null 2>&1; then
  upgradable="$(apt-get -s -o Debug::NoLocking=1 upgrade 2>/dev/null | grep -c '^Inst' || echo 0)"
  security="$(apt-get -s -o Debug::NoLocking=1 upgrade 2>/dev/null | grep -c '^Inst.*-security' || echo 0)"

  if [ "${security:-0}" -gt 0 ]; then
    add_finding "guncelleme-guvenlik" "Bekleyen guvenlik guncellemesi: ${security}" "Yuksek" \
      "Toplam ${upgradable} guncelleme bekliyor" "sudo apt update && sudo apt upgrade -y"
  elif [ "${upgradable:-0}" -gt 15 ]; then
    add_finding "guncelleme-cok" "Cok sayida bekleyen guncelleme: ${upgradable}" "Orta" \
      "Sistem uzun suredir guncellenmemis" "sudo apt update && sudo apt upgrade -y"
  fi
elif command -v dnf >/dev/null 2>&1; then
  security="$(dnf -q updateinfo list security 2>/dev/null | wc -l | tr -d ' ')"
  [ "${security:-0}" -gt 0 ] && add_finding "guncelleme-guvenlik" "Bekleyen guvenlik guncellemesi: ${security}" "Yuksek" \
    "dnf updateinfo" "sudo dnf upgrade --security -y"
fi

# Otomatik guvenlik guncellemesi
if [ -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
  if ! grep -q 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null; then
    add_finding "oto-guncelleme" "Otomatik guvenlik guncellemesi kapali" "Orta" \
      "unattended-upgrades etkin degil" "sudo dpkg-reconfigure -plow unattended-upgrades"
  fi
elif command -v apt-get >/dev/null 2>&1; then
  add_finding "oto-guncelleme-yok" "Otomatik guncelleme yapilandirilmamis" "Orta" \
    "unattended-upgrades paketi kurulu degil" "sudo apt install unattended-upgrades"
fi

# Supheli cron girdileri
cron_tmp="$(mktemp)"
{
  crontab -l 2>/dev/null
  cat /etc/crontab 2>/dev/null
  cat /etc/cron.d/* 2>/dev/null
} | grep -vE '^\s*#|^\s*$|^\s*(SHELL|PATH|MAILTO|HOME|LOGNAME)=' > "$cron_tmp" 2>/dev/null || true

if [ -s "$cron_tmp" ]; then
  curl_cron="$(grep -iE 'curl|wget|nc |ncat|/dev/tcp|base64 -d' "$cron_tmp" 2>/dev/null | head -3 || true)"
  if [ -n "$curl_cron" ]; then
    add_finding "cron-supheli" "Cron girdilerinde indirme komutu var" "Yuksek" \
      "$(echo "$curl_cron" | head -2 | tr '\n' ' ')" \
      "Bu girdileri dogrulayin - kotucul yazilim kaliciligi olabilir."
  fi
fi
rm -f "$cron_tmp"

# ASLR
if [ -r /proc/sys/kernel/randomize_va_space ]; then
  aslr="$(cat /proc/sys/kernel/randomize_va_space)"
  [ "$aslr" != "2" ] && add_finding "aslr" "ASLR tam etkin degil (${aslr})" "Orta" \
    "randomize_va_space = ${aslr} (2 olmali)" "echo 2 | sudo tee /proc/sys/kernel/randomize_va_space"
fi

# Dosya sistemi /tmp noexec
if findmnt -no OPTIONS /tmp 2>/dev/null | grep -qv noexec; then
  add_finding "tmp-noexec" "/tmp noexec ile baglanmamis" "Dusuk" \
    "Indirilen betikler /tmp'den calistirilabilir" \
    "/etc/fstab: tmpfs /tmp tmpfs defaults,noexec,nosuid,nodev 0 0"
fi

[ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [7/9] Guncellemeler ve gorevler denetlendi${C_RESET}"

# ----------------------------------------------------------------------
#  8. nmap ag taramasi (istege bagli)
# ----------------------------------------------------------------------
NMAP_RESULT=""
if [ "$QUICK" -eq 0 ]; then
  if command -v nmap >/dev/null 2>&1; then
    target="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -z "$target" ] && target="127.0.0.1"

    [ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}       nmap ile taranıyor: ${target}${C_RESET}"
    NMAP_RESULT="$(nmap -sT -T4 --top-ports 100 "$target" 2>/dev/null | head -40 || echo 'nmap calistirilamadi')"

    # Riskli bulunanlari bulguya cevir
    while read -r port; do
      [ -z "$port" ] && continue
      if [ -n "${RISKY_PORTS[$port]:-}" ]; then
        add_finding "nmap-${port}" "nmap: riskli servis ${port}/tcp" "Orta" \
          "Hedef ${target} uzerinde ${port}/tcp acik (${RISKY_PORTS[$port]})" \
          "Servisi kapatın veya yalnizca guvenilir adreslere izin verin."
      fi
    done <<< "$(echo "$NMAP_RESULT" | grep -oE '^[0-9]+/tcp[[:space:]]+open' | cut -d/ -f1)"
  else
    NMAP_RESULT="nmap kurulu degil - ag taramasi atlandi"
  fi

  [ "$JSON_ONLY" -eq 0 ] && echo "${C_GRAY}  [8/9] Ag taramasi tamamlandi${C_RESET}"
fi

# ----------------------------------------------------------------------
#  9. Risk puanlama ve rapor
# ----------------------------------------------------------------------
KRITIK=$(count_level "Kritik")
YUKSEK=$(count_level "Yuksek")
ORTA=$(count_level "Orta")
DUSUK=$(count_level "Dusuk")

# Kademeli tavan: ham toplam yerine seviye basina sinir - puan bilgi tasisin
c_kritik=$(( KRITIK * 30 )); [ "$c_kritik" -gt 55 ] && c_kritik=55
c_yuksek=$(( YUKSEK * 12 )); [ "$c_yuksek" -gt 30 ] && c_yuksek=30
c_orta=$(( ORTA * 4 ));      [ "$c_orta" -gt 12 ]   && c_orta=12
c_dusuk=$(( DUSUK * 3 / 2 )); [ "$c_dusuk" -gt 6 ]  && c_dusuk=6

score=$(( c_kritik + c_yuksek + c_orta + c_dusuk ))
[ "$score" -gt 100 ] && score=100

if   [ "$score" -ge 70 ]; then VERDICT="CRITICAL"; VERDICT_TR="KRITIK - acil mudahale gerekli"
elif [ "$score" -ge 45 ]; then VERDICT="HIGH";     VERDICT_TR="YUKSEK - kisa surede duzeltilmeli"
elif [ "$score" -ge 20 ]; then VERDICT="MEDIUM";   VERDICT_TR="ORTA - iyilestirme onerilir"
elif [ "$score" -ge 5  ]; then VERDICT="LOW";      VERDICT_TR="DUSUK - kucuk iyilestirmeler"
else                           VERDICT="CLEAN";    VERDICT_TR="TEMIZ - onemli bulgu yok"
fi

ELAPSED=$(( $(date +%s) - STARTED_EPOCH ))
TOTAL=$(( KRITIK + YUKSEK + ORTA + DUSUK ))

# --- Konsol raporu ---
if [ "$JSON_ONLY" -eq 0 ]; then
  echo ""
  echo "${C_DCYAN}  ================================================================${C_RESET}"
  echo "${C_CYAN}   BULGULAR${C_RESET}"
  echo "${C_DCYAN}  ================================================================${C_RESET}"
  echo ""

  if [ "$TOTAL" -eq 0 ]; then
    echo "${C_GREEN}   Onemli bir guvenlik bulgusu tespit edilmedi.${C_RESET}"
  else
    for level in Kritik Yuksek Orta Dusuk; do
      case "$level" in
        Kritik) count=$KRITIK; color=$C_RED ;;
        Yuksek) count=$YUKSEK; color=$C_DYEL ;;
        Orta)   count=$ORTA;   color=$C_YEL ;;
        Dusuk)  count=$DUSUK;  color=$C_GRAY ;;
      esac
      [ "$count" -eq 0 ] && continue

      echo "${color}   --- ${level^^} (${count}) ---${C_RESET}"
      # Bulgulari JSON'dan oku ve yazdir
      tr ',' '\n' < "$FINDINGS_FILE" | grep "\"seviye\":\"${level}\"" | while IFS= read -r item; do
        baslik="$(printf '%s' "$item" | sed -n 's/.*"baslik":"\([^"]*\)".*/\1/p')"
        detay="$(printf '%s' "$item" | sed -n 's/.*"detay":"\([^"]*\)".*/\1/p')"
        cozum="$(printf '%s' "$item" | sed -n 's/.*"cozum":"\([^"]*\)".*/\1/p')"
        echo "${color}   * ${baslik}${C_RESET}"
        [ -n "$detay" ] && echo "${C_GRAY}     ${detay}${C_RESET}"
        [ -n "$cozum" ] && echo "${C_GRAY}     Cozum: ${cozum}${C_RESET}"
      done
      echo ""
    done
  fi

  echo "${C_DCYAN}  ================================================================${C_RESET}"
  case "$VERDICT" in
    CRITICAL) sc=$C_RED ;; HIGH) sc=$C_DYEL ;; MEDIUM) sc=$C_YEL ;;
    LOW) sc=$C_GRAY ;; *) sc=$C_GREEN ;;
  esac
  echo "${sc}   RISK PUANI : ${score}/100  ->  ${VERDICT_TR}${C_RESET}"
  echo "${C_GRAY}   Bulgular   : ${KRITIK} kritik, ${YUKSEK} yuksek, ${ORTA} orta, ${DUSUK} dusuk${C_RESET}"
  echo "${C_GRAY}   Acik port  : ${COUNT_LISTEN} dinleyici${C_RESET}"
  echo "${C_GRAY}   Sure       : ${ELAPSED} saniye${C_RESET}"
  echo "${C_DCYAN}  ================================================================${C_RESET}"
  echo ""
fi

# --- JSON govdesi ---
FINDINGS_JSON="$(cat "$FINDINGS_FILE")"
[ -z "$FINDINGS_JSON" ] && FINDINGS_JSON=""

SYSTEM_JSON=$(cat <<EOF
{"hostname":"$(json_escape "$HOSTNAME_")","os":"$(json_escape "$OS_NAME")","kernel":"$(json_escape "$KERNEL")","uptime_s":${UPTIME_S},"root":$([ "$IS_ROOT" -eq 1 ] && echo true || echo false)}
EOF
)

PORTS_JSON=""
while IFS='|' read -r proto local proc; do
  [ -z "$local" ] && continue
  entry=$(printf '{"proto":"%s","adres":"%s","islem":"%s"}' \
    "$(json_escape "$proto")" "$(json_escape "$local")" "$(json_escape "${proc:-}")")
  [ -z "$PORTS_JSON" ] && PORTS_JSON="$entry" || PORTS_JSON="${PORTS_JSON},${entry}"
done < "$PORTS_FILE"

# --- Rapor dosyalari ---
REPORT_PATHS=""
if [ "$NO_REPORT" -eq 0 ] && [ "$JSON_ONLY" -eq 0 ]; then
  out_dir="${HOME:-/tmp}"
  [ -d "$out_dir" ] || out_dir="/tmp"
  stamp="$(date +%Y%m%d-%H%M%S)"
  txt_path="${out_dir}/PixVuln-Rapor-${HOSTNAME_}-${stamp}.txt"

  {
    echo "PixVuln - Guvenlik Zafiyet Raporu"
    echo "============================================================"
    echo "Hedef       : ${HOSTNAME_}"
    echo "Zaman       : ${STARTED_HUMAN}"
    echo "Isletim sis.: ${OS_NAME}"
    echo "Cekirdek    : ${KERNEL}"
    echo "Risk puani  : ${score}/100  (${VERDICT_TR})"
    echo "Bulgular    : ${KRITIK} kritik, ${YUKSEK} yuksek, ${ORTA} orta, ${DUSUK} dusuk"
    echo ""
    echo "ACIK PORTLAR"
    echo "------------------------------------------------------------"
    while IFS='|' read -r proto local proc; do
      [ -z "$local" ] && continue
      echo "  ${proto}  ${local}  ${proc:-}"
    done < "$PORTS_FILE"
    echo ""
    echo "BULGULAR"
    echo "------------------------------------------------------------"
    tr ',' '\n' < "$FINDINGS_FILE" | while IFS= read -r item; do
      seviye="$(printf '%s' "$item" | sed -n 's/.*"seviye":"\([^"]*\)".*/\1/p')"
      baslik="$(printf '%s' "$item" | sed -n 's/.*"baslik":"\([^"]*\)".*/\1/p')"
      detay="$(printf '%s' "$item" | sed -n 's/.*"detay":"\([^"]*\)".*/\1/p')"
      cozum="$(printf '%s' "$item" | sed -n 's/.*"cozum":"\([^"]*\)".*/\1/p')"
      [ -z "$baslik" ] && continue
      echo "[${seviye^^}] ${baslik}"
      [ -n "$detay" ] && echo "      ${detay}"
      [ -n "$cozum" ] && echo "      Cozum: ${cozum}"
    done
    [ "$TOTAL" -eq 0 ] && echo "  Onemli bulgu yok."
  } > "$txt_path" 2>/dev/null

  REPORT_PATHS="$txt_path"
  echo "${C_GREEN}   Rapor yazildi: ${txt_path}${C_RESET}"
  echo ""
fi

# --- JSON cikisi ---
cat <<EOF
{
  "arac": "PixVuln",
  "surum": "${VERSION}",
  "zaman": "$(date -Iseconds 2>/dev/null || date)",
  "sure_sn": ${ELAPSED},
  "hedef": "$(json_escape "$HOSTNAME_")",
  "platform": "linux",
  "mod": "$([ "$QUICK" -eq 1 ] && echo hizli || echo tam)",
  "risk_puani": ${score},
  "risk_durumu": "${VERDICT}",
  "ozet": { "kritik": ${KRITIK}, "yuksek": ${YUKSEK}, "orta": ${ORTA}, "dusuk": ${DUSUK}, "bilgi": 0 },
  "sistem": ${SYSTEM_JSON},
  "guvenlik_duvari": "$(json_escape "$FW_STATE")",
  "acik_portlar": [${PORTS_JSON}],
  "disari_port_sayisi": ${COUNT_EXTERNAL},
  "nmap": "$(json_escape "$NMAP_RESULT")",
  "bulgular": [${FINDINGS_JSON}],
  "toplam_bulgu": ${TOTAL},
  "rapor_dosyalari": "$(json_escape "$REPORT_PATHS")"
}
EOF

exit 0
