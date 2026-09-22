<#
.SYNOPSIS
    PixLog v5.0 - TITAN LOG ANALYZER (REBORN)
    Developer: Omer Cataloglu
.DESCRIPTION
    Advanced Event Log Analysis.
    CRITICAL FIX: Solved the "Select-Object" string parsing bug.
    Data is now split into arrays correctly, guaranteeing visibility.
    Safe ASCII. Safe Turkish. 60 Tools.
#>

# --- 0. SISTEM HAZIRLIK ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# --- 1. AYARLAR ---
$DevName  = 'Omer Cataloglu'
$DevWeb   = 'omercataloglu.com'
$DevMail  = 'pixeldrafter@omercataloglu.com'
$DevPhone = '0533 701 00 89'

# Konsol Ayarlari
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'PixLog v5.0 | TITAN LOG ANALYZER'
$Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(160, 9000)
$Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(160, 45)

# --- 2. GORSEL MOTOR ---

function Play-Sound {
    param($Type)
    try {
        if ($Type -eq 'Success') { [Console]::Beep(1200, 100); [Console]::Beep(1500, 100) }
        if ($Type -eq 'Alert')   { [Console]::Beep(1000, 50); [Console]::Beep(1000, 50) }
        if ($Type -eq 'Boot')    { [Console]::Beep(300, 100); Start-Sleep -m 50; [Console]::Beep(600, 100) }
        if ($Type -eq 'Error')   { [Console]::Beep(400, 300) }
    } catch {}
}

function Cizgi-Cek { return '=' * 158 }

function Loading-Bar ($TaskName) {
    Write-Host " $TaskName " -NoNewline -ForegroundColor Yellow
    Write-Host '[' -NoNewline -ForegroundColor DarkGray
    for ($i=0; $i -lt 5; $i++) {
        Write-Host '|' -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 5
    }
    Write-Host '] OK' -ForegroundColor Green
    Start-Sleep -Milliseconds 10
}

# --- KRITIK DUZELTME: ARRAY SPLITTER ---
function Print-Logs {
    param($Logs, [string]$Props) # Props artik string olarak geliyor
    
    Write-Host ""
    if ($Logs) {
        # Tekil objeyi diziye cevir (Count hatasini onlemek icin)
        if ($Logs -isnot [array]) { $Logs = @($Logs) }

        if ($Logs.Count -gt 0) {
            # --- FIX BURADA: Virgulle ayrilmis stringi gercek bir diziye ceviriyoruz ---
            # Onceki hata: Select-Object "A,B" (Tek sutun arar)
            # Yeni Yapi: Select-Object "A","B" (Iki sutun arar)
            $PropArray = $Props -split "," | ForEach-Object { $_.Trim() }

            if ($Props) {
                $Logs | Select-Object $PropArray | Format-Table -AutoSize -Wrap | Out-Host
            } else {
                $Logs | Format-Table -AutoSize -Wrap | Out-Host
            }
            Write-Host " [BILGI] TOPLAM KAYIT SAYISI: $($Logs.Count)" -ForegroundColor Green
        } else {
            Write-Host " [!] SORGU CALISTI FAKAT SONUC DONMEDI (0 KAYIT)." -ForegroundColor Yellow
        }
    } else {
        Write-Host " [!] LOG KAYDI BULUNAMADI." -ForegroundColor Red
    }
}

function Check-Exit-Key {
    if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq 'Q' -or $key.Key -eq 'Escape') { return $true }
    }
    return $false
}

function Boot-Sequence {
    Clear-Host
    Play-Sound 'Boot'
    Write-Host ' PIXTOOL LOG KERNEL v5.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('SYSTEM LOGS', 'SECURITY AUDIT', 'APP TRACER', 'LIVE MONITOR', 'EXPORT ENGINE')
    foreach ($m in $modules) { Loading-Bar "INIT: $m" }
    Start-Sleep -Milliseconds 200
    Clear-Host
}

function Logo-Ciz {
    Clear-Host
    # DEMIRBAS PIXTOOL LOGOSU
$ascii = @'
   ____  ___  __  __  _____  _____  _____  _     
  |  _ \|_ _|\ \/ / |_   _|/  _  \|  _  \| |    
  | |_) || |  \  /    | |  | | | || | | || |    
  |  __/ | |  /  \    | |  | | | || | | || |___ 
  |_|   |___|/_/\_\   |_|  \_____/|_____/|_____|
'@
    Write-Host $ascii -ForegroundColor Cyan
    
    Write-Host ''
    Write-Host ' PIXLOG v5.0 - TITAN LOG ANALYZER (REBORN)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# --- 3. LOG FONKSIYONLARI (KESIN FIXLI) ---

# GRUP 1: SISTEM LOGLARI (SYSTEM)
function L01 { Write-Host ' [SYS LAST] SISTEM SON 20 KAYIT...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -Newest 20 -EA SilentlyContinue; Print-Logs $d "TimeGenerated,EntryType,Source,Message"; Read-Host ' ...' }
function L02 { Write-Host ' [SYS ERR] SISTEM SON 20 HATA (ERROR)...' -ForegroundColor Red; $d=Get-EventLog -LogName System -Newest 20 -EntryType Error -EA SilentlyContinue; Print-Logs $d "TimeGenerated,Source,Message"; Read-Host ' ...' }
function L03 { Write-Host ' [SYS WARN] SISTEM SON 20 UYARI (WARNING)...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -Newest 20 -EntryType Warning -EA SilentlyContinue; Print-Logs $d "TimeGenerated,Source,Message"; Read-Host ' ...' }
function L04 { Write-Host ' [BOOT] SISTEM ACILIS LOGLARI (6005)...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 6005} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L05 { Write-Host ' [SHUTDOWN] SISTEM KAPANIS LOGLARI (6006)...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 6006} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L06 { Write-Host ' [BSOD] MAVI EKRAN HATALARI (1001/41)...' -ForegroundColor Red; $d=Get-EventLog -LogName System -Newest 2000 -EA SilentlyContinue | Where-Object {$_.EventID -eq 1001 -or $_.EventID -eq 41} | Select-Object -First 10; Print-Logs $d "TimeGenerated,EventID,Message"; Read-Host ' ...' }
function L07 { Write-Host ' [UPDATE] WINDOWS UPDATE LOGLARI...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -Newest 500 -EA SilentlyContinue | Where-Object {$_.Source -eq "Microsoft-Windows-WindowsUpdateClient"} | Select-Object -First 20; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L08 { Write-Host ' [POWER] GUC YONETIMI LOGLARI...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -Newest 200 -EA SilentlyContinue | Where-Object {$_.Source -like "*Power-Troubleshooter*"} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L09 { Write-Host ' [DISK] DISK HATALARI...' -ForegroundColor Red; $d=Get-EventLog -LogName System -EntryType Error -Newest 2000 -EA SilentlyContinue | Where-Object {$_.Source -match "Disk|Ntfs"} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Source,Message"; Read-Host ' ...' }
function L10 { Write-Host ' [SERVICE] SERVIS DURMA/BASLAMA...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -Newest 200 -EA SilentlyContinue | Where-Object {$_.Source -eq "Service Control Manager"}; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }

# GRUP 2: GUVENLIK LOGLARI (SECURITY)
function L11 { Write-Host ' [SEC LAST] GUVENLIK SON 20 KAYIT...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Security -Newest 20 -EA SilentlyContinue; Print-Logs $d "TimeGenerated,EventID,Message"; Read-Host ' ...' }
function L12 { Write-Host ' [FAIL] BASARISIZ GIRISLER (4625)...' -ForegroundColor Red; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4625} | Select-Object -First 20; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L13 { Write-Host ' [SUCCESS] BASARILI GIRISLER (4624)...' -ForegroundColor Green; $d=Get-EventLog -LogName Security -Newest 20 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4624}; Print-Logs $d "TimeGenerated,ReplacementStrings"; Read-Host ' ...' }
function L14 { Write-Host ' [LOGOFF] OTURUM KAPATMALAR (4647)...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4647} | Select-Object -First 20; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L15 { Write-Host ' [LOCKOUT] HESAP KILITLENMELERI (4740)...' -ForegroundColor Red; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4740} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L16 { Write-Host ' [NEW USER] YENI KULLANICI OLUSTURMA (4720)...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4720} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L17 { Write-Host ' [DEL USER] KULLANICI SILME (4726)...' -ForegroundColor Red; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4726} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L18 { Write-Host ' [GROUP ADD] GRUBA UYE EKLEME (4728)...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4728} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L19 { Write-Host ' [PASS CHG] SIFRE DEGISTIRME (4723)...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 4723} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L20 { Write-Host ' [CLEAR] LOG TEMIZLEME OLAYLARI (1102)...' -ForegroundColor Red; $d=Get-EventLog -LogName Security -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 1102} | Select-Object -First 10; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }

# GRUP 3: UYGULAMA LOGLARI (APPLICATION)
function L21 { Write-Host ' [APP LAST] UYGULAMA SON 20 KAYIT...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Application -Newest 20 -EA SilentlyContinue; Print-Logs $d "TimeGenerated,EntryType,Source,Message"; Read-Host ' ...' }
function L22 { Write-Host ' [APP ERR] UYGULAMA HATALARI...' -ForegroundColor Red; $d=Get-EventLog -LogName Application -Newest 20 -EntryType Error -EA SilentlyContinue; Print-Logs $d "TimeGenerated,Source,Message"; Read-Host ' ...' }
function L23 { Write-Host ' [APP CRASH] UYGULAMA COKMELERI (1000)...' -ForegroundColor Red; $d=Get-EventLog -LogName Application -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 1000} | Select-Object -First 20; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L24 { Write-Host ' [APP HANG] UYGULAMA DONMALARI (1002)...' -ForegroundColor Red; $d=Get-EventLog -LogName Application -Newest 100 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq 1002} | Select-Object -First 20; Print-Logs $d "TimeGenerated,Message"; Read-Host ' ...' }
function L25 { Write-Host ' [MSI] YUKLEYICI (INSTALLER) LOGLARI...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Application -Source "MsiInstaller" -Newest 50 -EA SilentlyContinue; Print-Logs $d "TimeGenerated,EntryType,Message"; Read-Host ' ...' }

# GRUP 3.5: OZEL LOGLAR (Get-WinEvent - Sutun isimleri farklidir: TimeCreated)
function L26 { Write-Host ' [DEFENDER] WINDOWS DEFENDER LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-Windows Defender/Operational" -MaxEvents 20 -EA Stop; Print-Logs $d "TimeCreated,Id,Message" } catch { Write-Host " [!] LOG BULUNAMADI (Dosya Bos)" -ForegroundColor Red }; Read-Host ' ...' }
function L27 { Write-Host ' [WIFI] KABLOSUZ AG LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-WLAN-AutoConfig/Operational" -MaxEvents 20 -EA Stop; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG BULUNAMADI (Dosya Bos)" -ForegroundColor Red }; Read-Host ' ...' }
function L28 { Write-Host ' [USB] CIHAZ KURULUM LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-Kernel-PnP/Configuration" -MaxEvents 20 -EA Stop; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG BULUNAMADI (Dosya Bos)" -ForegroundColor Red }; Read-Host ' ...' }
function L29 { Write-Host ' [TASK] ZAMANLANMIS GOREV LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 -EA Stop; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG BULUNAMADI (Dosya Bos)" -ForegroundColor Red }; Read-Host ' ...' }
function L30 { Write-Host ' [PRINT] YAZICI LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-PrintService/Operational" -MaxEvents 20 -EA Stop; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG BULUNAMADI (Dosya Bos)" -ForegroundColor Red }; Read-Host ' ...' }

# GRUP 4: ARAMA & OZEL (SEARCH)
function L31 { Write-Host ' [SEARCH] KELIME ILE ARA (TUM LOGLAR)...' -ForegroundColor Yellow; $k=Read-Host ' Aranacak Kelime'; $d=Get-EventLog -LogName System,Application,Security -Newest 2000 -EA SilentlyContinue | Where-Object {$_.Message -like "*$k*"} | Select-Object -First 20; Print-Logs $d "Log,TimeGenerated,Message"; Read-Host ' ...' }
function L32 { Write-Host ' [ID SEARCH] EVENT ID ILE ARA...' -ForegroundColor Yellow; $id=Read-Host ' Event ID'; $log=Read-Host ' Log (System/Application/Security)'; $d=Get-EventLog -LogName $log -Newest 1000 -EA SilentlyContinue | Where-Object {$_.InstanceId -eq $id} | Select-Object -First 20; Print-Logs $d "TimeGenerated,Source,Message"; Read-Host ' ...' }
function L33 { Write-Host ' [SOURCE] KAYNAK ILE ARA (SOURCE)...' -ForegroundColor Yellow; $s=Read-Host ' Kaynak (Orn: Service Control Manager)'; $d=Get-EventLog -LogName System -Source $s -Newest 20 -EA SilentlyContinue; Print-Logs $d "TimeGenerated,EntryType,Message"; Read-Host ' ...' }
function L34 { Write-Host ' [DATE] BUGUNUN LOGLARI...' -ForegroundColor Yellow; $today=(Get-Date).Date; $d=Get-EventLog -LogName System -After $today -EA SilentlyContinue; Print-Logs $d "TimeGenerated,EntryType,Message"; Read-Host ' ...' }
function L35 { Write-Host ' [YESTERDAY] DUNUN LOGLARI...' -ForegroundColor Yellow; $start=(Get-Date).AddDays(-1).Date; $end=(Get-Date).Date; $d=Get-EventLog -LogName System -After $start -Before $end -EA SilentlyContinue; Print-Logs $d "TimeGenerated,EntryType,Message"; Read-Host ' ...' }
function L36 { Write-Host ' [USER] KULLANICIYA GORE ARA...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici Adi'; $d=Get-EventLog -LogName Security -Newest 1000 -EA SilentlyContinue | Where-Object {$_.UserName -like "*$u*"} | Select-Object -First 20; Print-Logs $d "TimeGenerated,EventID,Message"; Read-Host ' ...' }
function L37 { Write-Host ' [RDP IP] RDP BAGLANTI IP ADRESLERI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational" -MaxEvents 50 -EA Stop | Where-Object {$_.Id -eq 1149}; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG YOK" -ForegroundColor Red }; Read-Host ' ...' }
function L38 { Write-Host ' [POWERSHELL] POWERSHELL KOMUT LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-PowerShell/Operational" -MaxEvents 20 -EA Stop | Where-Object {$_.Id -eq 4104}; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG YOK" -ForegroundColor Red }; Read-Host ' ...' }
function L39 { Write-Host ' [FIREWALL] FIREWALL ENGEL LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-Windows Firewall With Advanced Security/Firewall" -MaxEvents 20 -EA Stop | Where-Object {$_.Id -eq 2004}; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG YOK" -ForegroundColor Red }; Read-Host ' ...' }
function L40 { Write-Host ' [DRIVER] SURUCU YUKLEME LOGLARI...' -ForegroundColor Yellow; try { $d=Get-WinEvent -LogName "Microsoft-Windows-UserPnp/DeviceInstall" -MaxEvents 20 -EA Stop; Print-Logs $d "TimeCreated,Message" } catch { Write-Host " [!] LOG YOK" -ForegroundColor Red }; Read-Host ' ...' }

# GRUP 5: CANLI IZLEME (LIVE MONITOR)
function Live-Log {
    param($LogName)
    Write-Host " [LIVE] $LogName LOGLARI IZLENIYOR... (Durdurmak icin Q basin)" -ForegroundColor Cyan
    Write-Host " ----------------------------------------------------------------" -ForegroundColor DarkGray
    $lastTime = Get-Date
    while ($true) {
        if (Check-Exit-Key) { break }
        $newLogs = Get-EventLog -LogName $LogName -After $lastTime -ErrorAction SilentlyContinue
        if ($newLogs) {
            foreach ($log in $newLogs) {
                $color = 'White'
                if ($log.EntryType -eq 'Error') { $color = 'Red' }
                elseif ($log.EntryType -eq 'Warning') { $color = 'Yellow' }
                
                # Mesaji temizle
                $msg = $log.Message -replace "`r`n"," " 
                if($msg.Length -gt 80){ $msg = $msg.Substring(0,80) + "..." }
                
                Write-Host " [$($log.TimeGenerated.ToString('HH:mm:ss'))] [$($log.EntryType)] $($log.Source): $msg" -ForegroundColor $color
                $lastTime = $log.TimeGenerated
            }
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Host " [STOP] IZLEME DURDURULDU" -ForegroundColor Red
    Read-Host ' ...'
}
function L41 { Live-Log "System" }
function L42 { Live-Log "Application" }
function L43 { Live-Log "Security" }
function L44 { Write-Host ' [LIVE] SETUP LOGLARI IZLE...' -ForegroundColor Yellow; Write-Host " [!] SETUP LOGU CANLI IZLENEMEZ (STATIK)" -ForegroundColor Red; Read-Host ' ...' }
function L45 { 
    Write-Host " [LIVE] SADECE HATALAR IZLENIYOR (SISTEM)... (Q ile Cikis)" -ForegroundColor Cyan
    $lastTime = Get-Date
    while ($true) {
        if (Check-Exit-Key) { break }
        $newLogs = Get-EventLog -LogName System -After $lastTime -EntryType Error -EA SilentlyContinue
        if ($newLogs) { 
            foreach ($l in $newLogs) { 
                Write-Host " [ERR] $($l.TimeGenerated): $($l.Message.Substring(0,[math]::Min($l.Message.Length, 80)))" -ForegroundColor Red; 
                $lastTime = $l.TimeGenerated 
            } 
        }
        Start-Sleep 1
    }
}

# GRUP 6: YONETIM & DISA AKTAR (EXPORT)
function L46 { Write-Host ' [EXPORT SYS] SISTEM LOG -> MASAUSTU (CSV)...' -ForegroundColor Yellow; $p="$([Environment]::GetFolderPath('Desktop'))\SystemLog.csv"; Get-EventLog -LogName System -Newest 1000 -EA SilentlyContinue | Export-Csv $p -NoTypeInformation -Encoding UTF8; Write-Host " [OK] KAYDEDILDI: $p" -ForegroundColor Green; Read-Host ' ...' }
function L47 { Write-Host ' [EXPORT SEC] GUVENLIK LOG -> MASAUSTU (CSV)...' -ForegroundColor Yellow; $p="$([Environment]::GetFolderPath('Desktop'))\SecurityLog.csv"; Get-EventLog -LogName Security -Newest 1000 -EA SilentlyContinue | Export-Csv $p -NoTypeInformation -Encoding UTF8; Write-Host " [OK] KAYDEDILDI: $p" -ForegroundColor Green; Read-Host ' ...' }
function L48 { Write-Host ' [EXPORT APP] UYGULAMA LOG -> MASAUSTU (CSV)...' -ForegroundColor Yellow; $p="$([Environment]::GetFolderPath('Desktop'))\AppLog.csv"; Get-EventLog -LogName Application -Newest 1000 -EA SilentlyContinue | Export-Csv $p -NoTypeInformation -Encoding UTF8; Write-Host " [OK] KAYDEDILDI: $p" -ForegroundColor Green; Read-Host ' ...' }
function L49 { Write-Host ' [COUNT] LOG SAYILARI...' -ForegroundColor Yellow; $s=(Get-EventLog System -EA 0).Count; $a=(Get-EventLog Application -EA 0).Count; $sec=(Get-EventLog Security -EA 0).Count; Write-Host " SYSTEM: $s | APP: $a | SECURITY: $sec" -ForegroundColor Cyan; Read-Host ' ...' }
function L50 { Write-Host ' [SIZE] LOG DOSYA BOYUTLARI...' -ForegroundColor Yellow; Get-EventLog -List | Select Log,@{N='Boyut(MB)';E={[math]::Round($_.MaximumKilobytes/1024,2)}} | Format-Table -AutoSize | Out-String | Write-Host; Read-Host ' ...' }
function L51 { Write-Host ' [CLEAR SYS] SISTEM LOGLARINI TEMIZLE...' -ForegroundColor Red; Clear-EventLog -LogName System; Write-Host " [OK] TEMIZLENDI" -ForegroundColor Green; Read-Host ' ...' }
function L52 { Write-Host ' [CLEAR APP] UYGULAMA LOGLARINI TEMIZLE...' -ForegroundColor Red; Clear-EventLog -LogName Application; Write-Host " [OK] TEMIZLENDI" -ForegroundColor Green; Read-Host ' ...' }
function L53 { Write-Host ' [CLEAR SEC] GUVENLIK LOGLARINI TEMIZLE...' -ForegroundColor Red; Clear-EventLog -LogName Security; Write-Host " [OK] TEMIZLENDI" -ForegroundColor Green; Read-Host ' ...' }
function L54 { Write-Host ' [CLEAR ALL] TUM LOGLARI TEMIZLE (FULL)...' -ForegroundColor Red; Get-EventLog -List | ForEach-Object { Clear-EventLog -LogName $_.Log }; Write-Host " [OK] HEPSI TEMIZLENDI" -ForegroundColor Green; Read-Host ' ...' }
function L55 { Write-Host ' [BACKUP] TUM LOGLARI YEDEKLE (.EVTX)...' -ForegroundColor Yellow; $folder="$([Environment]::GetFolderPath('Desktop'))\LogBackup"; New-Item $folder -ItemType Directory -Force | Out-Null; wevtutil epl System "$folder\System.evtx"; wevtutil epl Security "$folder\Security.evtx"; wevtutil epl Application "$folder\Application.evtx"; Write-Host " [OK] YEDEKLENDI: $folder" -ForegroundColor Green; Read-Host ' ...' }
function L56 { Write-Host ' [RETENTION] LOG SAKLAMA AYARLARI...' -ForegroundColor Yellow; Get-EventLog -List | Select Log,OverflowAction,MinimumRetentionDays | Format-Table -AutoSize | Out-String | Write-Host; Read-Host ' ...' }
function L57 { Write-Host ' [PROVIDER] LOG SAGLAYICILARI (ILK 20)...' -ForegroundColor Yellow; Get-WinEvent -ListProvider * -EA SilentlyContinue | Select -First 20 Name | Format-Table | Out-String | Write-Host; Read-Host ' ...' }
function L58 { Write-Host ' [OLD LOGS] 30 GUNDEN ESKI LOGLAR...' -ForegroundColor Yellow; $d=(Get-Date).AddDays(-30); Get-EventLog System -Before $d -Newest 20 -EA SilentlyContinue | Select TimeGenerated,Message | Format-Table | Out-String | Write-Host; Read-Host ' ...' }
function L59 { Write-Host ' [HTML REP] BASIT HTML RAPOR OLUSTUR...' -ForegroundColor Yellow; $p="$env:TEMP\log_report.html"; Get-EventLog System -Newest 50 -EA SilentlyContinue | ConvertTo-Html > $p; Start-Process $p; Write-Host " [OK] ACILDI" -ForegroundColor Green; Read-Host ' ...' }
function L60 { Write-Host ' [EXIT] CIKIS YAPILIYOR...' -ForegroundColor Red; Exit }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [SISTEM LOGLARI]       [GUVENLIK LOGLARI]     [UYGULAMA LOGLARI]     [ARAMA & OZEL]" -ForegroundColor Yellow
        Write-Host "   01. SISTEM (SON 20)    11. GUVENLIK (SON 20)  21. UYGULAMA (SON 20)  31. KELIME ARA" -ForegroundColor White
        Write-Host "   02. SISTEM HATALARI    12. BASARISIZ GIRIS    22. UYGULAMA HATALARI  32. ID ILE ARA" -ForegroundColor White
        Write-Host "   03. SISTEM UYARILARI   13. BASARILI GIRIS     23. PROGRAM COKMELERI  33. KAYNAK ARA" -ForegroundColor White
        Write-Host "   04. ACILIS LOGLARI     14. OTURUM KAPATMA     24. PROGRAM DONMALARI  34. BUGUNUN LOGLARI" -ForegroundColor White
        Write-Host "   05. KAPANIS LOGLARI    15. HESAP KILITLENME   25. MSI YUKLEYICI      35. DUNUN LOGLARI" -ForegroundColor White
        Write-Host "   06. MAVI EKRAN (BSOD)  16. YENI KULLANICI     26. DEFENDER LOGLARI   36. KULLANICI LOGLARI" -ForegroundColor White
        Write-Host "   07. UPDATE LOGLARI     17. KULLANICI SILME    27. WIFI LOGLARI       37. RDP IP LOGLARI" -ForegroundColor White
        Write-Host "   08. GUC/BATARYA LOG    18. GRUP DEGISIMLERI   28. USB TAKMA/CIKARMA  38. POWERSHELL LOG" -ForegroundColor White
        Write-Host "   09. DISK HATALARI      19. SIFRE DEGISIMI     29. GOREV ZAMANLAYICI  39. FIREWALL ENGEL" -ForegroundColor White
        Write-Host "   10. SERVIS HAREKETLERI 20. LOG TEMIZLEMELERI  30. YAZICI LOGLARI     40. DRIVER YUKLEME" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [CANLI IZLE (LIVE)]    [YONETIM & EXPORT]" -ForegroundColor Yellow
        Write-Host "   41. CANLI SISTEM AKISI 46. SISTEM -> CSV" -ForegroundColor Cyan
        Write-Host "   42. CANLI UYGULAMA     47. GUVENLIK -> CSV" -ForegroundColor Cyan
        Write-Host "   43. CANLI GUVENLIK     48. UYGULAMA -> CSV" -ForegroundColor Cyan
        Write-Host "   44. CANLI SETUP        49. LOG SAYILARI" -ForegroundColor Cyan
        Write-Host "   45. CANLI HATALAR      50. DOSYA BOYUTLARI" -ForegroundColor Cyan
        Write-Host "                          51. SISTEMI TEMIZLE" -ForegroundColor Red
        Write-Host "                          52. UYGULAMAYI TEMIZLE" -ForegroundColor Red
        Write-Host "                          53. GUVENLIGI TEMIZLE" -ForegroundColor Red
        Write-Host "                          54. TUMUNU TEMIZLE" -ForegroundColor Red
        Write-Host "                          55. YEDEKLE (.EVTX)" -ForegroundColor Magenta
        Write-Host "                          56. RETENTION AYARI" -ForegroundColor Cyan
        Write-Host "                          57. SAGLAYICILAR" -ForegroundColor Cyan
        Write-Host "                          58. ESKI LOGLAR" -ForegroundColor Cyan
        Write-Host "                          59. HTML RAPOR" -ForegroundColor Cyan
        Write-Host "                          60. CIKIS YAP" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        if ($c -eq 'Q' -or $c -eq 'q') { L60 }
        
        switch ($c) {
            '1' {L01} '11' {L11} '21' {L21} '31' {L31} '41' {L41} '51' {L51}
            '01' {L01} '12' {L12} '22' {L22} '32' {L32} '42' {L42} '52' {L52}
            '2' {L02} '13' {L13} '23' {L23} '33' {L33} '43' {L43} '53' {L53}
            '02' {L02} '14' {L14} '24' {L24} '34' {L34} '44' {L44} '54' {L54}
            '3' {L03} '15' {L15} '25' {L25} '35' {L35} '45' {L45} '55' {L55}
            '03' {L03} '16' {L16} '26' {L26} '36' {L36} '46' {L46} '56' {L56}
            '4' {L04} '17' {L17} '27' {L27} '37' {L37} '47' {L47} '57' {L57}
            '4' {L04} '18' {L18} '28' {L28} '38' {L38} '48' {L48} '58' {L58}
            '5' {L05} '19' {L19} '29' {L29} '39' {L39} '49' {L49} '59' {L59}
            '05' {L05} '20' {L20} '30' {L30} '40' {L40} '50' {L50} '60' {L60}
            '6' {L06}
            '06' {L06}
            '7' {L07}
            '07' {L07}
            '8' {L08}
            '08' {L08}
            '9' {L09}
            '09' {L09}
            '10' {L10}
        }
    }
}

Main-Loop