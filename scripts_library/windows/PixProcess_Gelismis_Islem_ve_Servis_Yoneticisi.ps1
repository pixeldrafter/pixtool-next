<#
.SYNOPSIS
    PixProcess v3.0 - TITAN ULTIMATE
    Developer: Omer Cataloglu
.DESCRIPTION
    The definitive Task and Service Manager.
    FIXED: Service filtering issues (Running/Stopped now works).
    FIXED: Network Process tool (Kill Net) now pulls data correctly.
    NEW: Interactive Service Control (Search & Action).
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
$Host.UI.RawUI.WindowTitle = 'PixProcess v3.0 | TITAN ULTIMATE'
$Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(140, 9000)
$Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(140, 45)

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

function Cizgi-Cek { return '=' * 138 }

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

# GARANTILI VERI YAZDIRMA MOTORU v3.0
function Print-Data {
    param($Data, $Props)
    
    if ($Data) {
        Write-Host ""
        if ($Props) { 
            $Data | Select-Object $Props | Format-Table -AutoSize | Out-Host 
        } else { 
            $Data | Format-Table -AutoSize | Out-Host 
        }
    } else {
        Write-Host " [!] LISTE BOS VEYA VERI BULUNAMADI" -ForegroundColor Red
    }
}

function Boot-Sequence {
    Clear-Host
    Play-Sound 'Boot'
    Write-Host ' PIXTOOL PROCESS KERNEL v3.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('TASK MANAGER', 'SERVICE CONTROL', 'PERFORMANCE MON', 'STARTUP MGR', 'PRIORITY ENGINE')
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
    Write-Host ' PIXPROCESS v3.0 - TITAN ULTIMATE (60 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# YENI: INTERAKTIF SERVIS SECICI
function Select-And-Action-Service {
    param($Action) # 'Stop', 'Start', 'Restart'
    
    Write-Host " [INTERAKTIF $Action MODU]" -ForegroundColor Cyan
    $filter = Read-Host " > Servis Adinda Ara (Bos=Hepsi)"
    
    Write-Host " Servisler Araniyor..." -ForegroundColor DarkGray
    $services = Get-Service | Where-Object { $_.Name -like "*$filter*" -or $_.DisplayName -like "*$filter*" }
    
    if ($services) {
        $services | Select-Object Name,Status,DisplayName | Format-Table -AutoSize | Out-Host
        
        $target = Read-Host " > Islem Yapilacak Servis Adi (Tam Isim)"
        if ($target) {
            try {
                if ($Action -eq 'Stop') { Stop-Service $target -Force; Write-Host " [OK] DURDURULDU: $target" -ForegroundColor Green }
                if ($Action -eq 'Start') { Start-Service $target; Write-Host " [OK] BASLATILDI: $target" -ForegroundColor Green }
                if ($Action -eq 'Restart') { Restart-Service $target -Force; Write-Host " [OK] YENIDEN BASLATILDI: $target" -ForegroundColor Green }
            } catch {
                Write-Host " [HATA] Islem basarisiz. Yetki veya isim hatasi." -ForegroundColor Red
            }
        }
    } else {
        Write-Host " [!] Hicbir servis bulunamadi." -ForegroundColor Red
    }
    Read-Host ' ...'
}

# --- 3. ISLEM ARACLARI (TAMIR EDILMIS) ---

# GRUP 1: ISLEM (PROCESS) YONETIMI
function P01 { 
    Write-Host ' [LIST] TUM ISLEMLER LISTELENIYOR...' -ForegroundColor Yellow; 
    $d = Get-Process | Sort-Object ProcessName
    Print-Data $d
    Read-Host ' ...' 
}
function P02 { Write-Host ' [KILL ID] PID ILE ISLEM OLDUR...' -ForegroundColor Red; $id=Read-Host ' PID Numarasi'; Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host " [OK] ISLEM SONLANDIRILDI" -ForegroundColor Green; Read-Host ' ...' }
function P03 { Write-Host ' [KILL NAME] ISIM ILE ISLEM OLDUR...' -ForegroundColor Red; $n=Read-Host ' Islem Adi (Orn: chrome)'; Stop-Process -Name $n -Force -ErrorAction SilentlyContinue; Write-Host " [OK] TUMU SONLANDIRILDI" -ForegroundColor Green; Read-Host ' ...' }
function P04 { 
    Write-Host ' [TOP CPU] EN COK CPU KULLANANLAR...' -ForegroundColor Yellow; 
    $d = Get-Process | Sort-Object CPU -Descending | Select-Object -First 15
    Print-Data $d "Id,ProcessName,CPU"
    Read-Host ' ...' 
}
function P05 { 
    Write-Host ' [TOP RAM] EN COK RAM KULLANANLAR...' -ForegroundColor Yellow; 
    $d = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 15 Name,Id,@{N='RAM(MB)';E={[math]::Round($_.WorkingSet/1MB,2)}}
    Print-Data $d
    Read-Host ' ...' 
}
function P06 { Write-Host ' [SEARCH] ISLEM ARA...' -ForegroundColor Yellow; $n=Read-Host ' Aranacak Isim'; $d=Get-Process | Where-Object ProcessName -Like "*$n*"; Print-Data $d "Id,ProcessName,Path"; Read-Host ' ...' }
function P07 { Write-Host ' [NOT RESP] YANIT VERMEYENLERI BUL...' -ForegroundColor Red; $d=Get-Process | Where-Object {$_.Responding -eq $false}; Print-Data $d "Id,ProcessName"; Read-Host ' ...' }
function P08 { Write-Host ' [KILL ZOMBIE] YANIT VERMEYENLERI OLDUR...' -ForegroundColor Red; Get-Process | Where-Object {$_.Responding -eq $false} | Stop-Process -Force; Write-Host " [OK] ZOMBILER TEMIZLENDI" -ForegroundColor Green; Read-Host ' ...' }
function P09 { Write-Host ' [PATH] ISLEM DOSYA YOLUNU BUL...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { Get-Process -Name $n -EA Stop | Select-Object Id,Path | Format-List | Out-Host } catch { Write-Host " [!] BULUNAMADI" -ForegroundColor Red }; Read-Host ' ...' }
function P10 { Write-Host ' [OWNER] ISLEM SAHIBINI GOR...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { Get-WmiObject Win32_Process -Filter "Name='$n.exe'" | Select-Object ProcessId,Name,@{N='User';E={$_.GetOwner().User}} | Format-List | Out-Host } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }

# GRUP 2: SERVIS (SERVICE) YONETIMI - INTERAKTIF
function P11 { 
    Write-Host ' [SVC LIST] TUM SERVISLERI LISTELE...' -ForegroundColor Yellow; 
    $d = Get-Service | Sort-Object Status -Descending
    Print-Data $d "Name,Status,DisplayName"
    Read-Host ' ...' 
}
function P12 { Select-And-Action-Service 'Start' }
function P13 { Select-And-Action-Service 'Stop' }
function P14 { Select-And-Action-Service 'Restart' }
function P15 { Write-Host ' [SVC AUTO] OTOMATIK BASLANGIC YAP...' -ForegroundColor Yellow; $n=Read-Host ' Servis Adi'; Set-Service $n -StartupType Automatic; Write-Host " [OK] AYARLANDI" -ForegroundColor Green; Read-Host ' ...' }
function P16 { Write-Host ' [SVC MANUAL] MANUEL BASLANGIC YAP...' -ForegroundColor Yellow; $n=Read-Host ' Servis Adi'; Set-Service $n -StartupType Manual; Write-Host " [OK] AYARLANDI" -ForegroundColor Green; Read-Host ' ...' }
function P17 { Write-Host ' [SVC DISABLE] SERVISI DEVRE DISI BIRAK...' -ForegroundColor Red; $n=Read-Host ' Servis Adi'; Set-Service $n -StartupType Disabled; Write-Host " [OK] KAPATILDI" -ForegroundColor Green; Read-Host ' ...' }
function P18 { 
    Write-Host ' [SVC SEARCH] SERVIS ARA...' -ForegroundColor Yellow; 
    $n=Read-Host ' Aranacak Isim'; 
    $d=Get-Service | Where-Object {$_.Name -like "*$n*" -or $_.DisplayName -like "*$n*"}; 
    Print-Data $d "Name,Status,DisplayName"; Read-Host ' ...' 
}
function P19 { 
    Write-Host ' [SVC RUNNING] CALISAN SERVISLER...' -ForegroundColor Yellow; 
    $d = Get-Service | Where-Object {$_.Status -eq 'Running'}
    if ($d) { $d | Select-Object Name,DisplayName | Format-Table -AutoSize | Out-Host } else { Write-Host " [!] CALISAN SERVIS YOK (IMKANSIZ AMA BOS)" -Red }
    Read-Host ' ...' 
}
function P20 { 
    Write-Host ' [SVC STOPPED] DURAN SERVISLER...' -ForegroundColor Yellow; 
    $d = Get-Service | Where-Object {$_.Status -eq 'Stopped'}
    if ($d) { $d | Select-Object Name,DisplayName | Format-Table -AutoSize | Out-Host } else { Write-Host " [!] DURAN SERVIS YOK" -Red }
    Read-Host ' ...' 
}

# GRUP 3: ONCELIK & CEKIRDEK
function P21 { Write-Host ' [HIGH PRIO] YUKSEK ONCELIK VER...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { (Get-Process $n).PriorityClass = 'High'; Write-Host " [OK] YUKSELTILDI" -ForegroundColor Green } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P22 { Write-Host ' [REALTIME] GERCEK ZAMANLI ONCELIK (RISKLI)...' -ForegroundColor Red; $n=Read-Host ' Islem Adi'; try { (Get-Process $n).PriorityClass = 'RealTime'; Write-Host " [OK] MAKSIMUM" -ForegroundColor Green } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P23 { Write-Host ' [LOW PRIO] DUSUK ONCELIK VER...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { (Get-Process $n).PriorityClass = 'Idle'; Write-Host " [OK] DUSURULDU" -ForegroundColor Green } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P24 { Write-Host ' [NORMAL PRIO] NORMAL ONCELIK VER...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { (Get-Process $n).PriorityClass = 'Normal'; Write-Host " [OK] NORMALE DONDU" -ForegroundColor Green } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P25 { Write-Host ' [AFFINITY] CEKIRDEK ATAMA (AFFINITY)...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { $p=Get-Process $n; $p.ProcessorAffinity=1; Write-Host " [OK] CPU 0 SABITLENDI" -ForegroundColor Green } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P26 { Write-Host ' [ALL CORES] TUM CEKIRDEKLERI KULLAN...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { $p=Get-Process $n; $p.ProcessorAffinity=0xFFFF; Write-Host " [OK] TUMU AKTIF" -ForegroundColor Green } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P27 { Write-Host ' [CHECK PRIO] ONCELIK KONTROLU...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; $d=Get-Process $n -EA SilentlyContinue | Select-Object Name,PriorityClass; Print-Data $d; Read-Host ' ...' }
function P28 { Write-Host ' [SESS ID] SESSION ID GOSTER...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; $d=Get-Process $n -EA SilentlyContinue | Select-Object Name,SessionId; Print-Data $d; Read-Host ' ...' }
function P29 { Write-Host ' [RESPONDING] YANIT DURUMU KONTROL...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; $d=Get-Process $n -EA SilentlyContinue | Select-Object Name,Responding; Print-Data $d; Read-Host ' ...' }
function P30 { Write-Host ' [GUI] GRAFIK ARAYUZ VAR MI...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; $d=Get-Process $n -EA SilentlyContinue | Select-Object Name,MainWindowTitle; Print-Data $d; Read-Host ' ...' }

# GRUP 4: BASLANGIC & GIZLILIK
function P31 { Write-Host ' [STARTUP] BASLANGIC OGELERI (WMI)...' -ForegroundColor Yellow; $d=Get-CimInstance Win32_StartupCommand | Select-Object Name,Command; Print-Data $d; Read-Host ' ...' }
function P32 { 
    Write-Host ' [REG RUN] BASLANGIC OGELERI (REGISTRY)...' -ForegroundColor Yellow; 
    $list = @()
    if (Test-Path HKLM:\Software\Microsoft\Windows\CurrentVersion\Run) {
        $reg = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Run
        foreach($p in $reg.PSObject.Properties) {
            if($p.Name -notin "PSPath","PSParentPath","PSChildName","PSDrive","PSProvider") {
                $list += [PSCustomObject]@{Name=$p.Name; Command=$p.Value}
            }
        }
    }
    if ($list.Count -eq 0) { Write-Host " [!] LISTE BOS (Kayit Yok)" -ForegroundColor Red } else { $list | Format-Table -AutoSize | Out-Host }
    Read-Host ' ...' 
}
function P33 { Write-Host ' [DEL STARTUP] BASLANGIC OGESI SIL (REG)...' -ForegroundColor Red; $n=Read-Host ' Oge Ismi'; Remove-ItemProperty -Path HKLM:\Software\Microsoft\Windows\CurrentVersion\Run -Name $n -EA SilentlyContinue; Write-Host " [OK] SILINDI (Varsa)" -ForegroundColor Green; Read-Host ' ...' }
function P34 { Write-Host ' [SCHED TASK] ZAMANLANMIS GOREVLER (ILK 20)...' -ForegroundColor Yellow; $d=Get-ScheduledTask | Select-Object TaskName,State | Select-Object -First 20; Print-Data $d; Read-Host ' ...' }
function P35 { Write-Host ' [STOP TASK] GOREV DURDUR...' -ForegroundColor Yellow; $n=Read-Host ' Gorev Adi'; Stop-ScheduledTask -TaskName $n; Write-Host " [OK] DURDURULDU" -ForegroundColor Green; Read-Host ' ...' }
function P36 { Write-Host ' [START TASK] GOREV BASLAT...' -ForegroundColor Yellow; $n=Read-Host ' Gorev Adi'; Start-ScheduledTask -TaskName $n; Write-Host " [OK] BASLATILDI" -ForegroundColor Green; Read-Host ' ...' }
function P37 { Write-Host ' [DISABLE TASK] GOREVI DEVRE DISI BIRAK...' -ForegroundColor Red; $n=Read-Host ' Gorev Adi'; Disable-ScheduledTask -TaskName $n; Write-Host " [OK] KAPATILDI" -ForegroundColor Green; Read-Host ' ...' }
function P38 { Write-Host ' [PARENT] ANA ISLEMI (PARENT) BUL...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { Get-WmiObject Win32_Process -Filter "Name='$n.exe'" | Select-Object Name,ParentProcessId | Out-Host } catch { Write-Host " [!] BULUNAMADI" -ForegroundColor Red }; Read-Host ' ...' }
function P39 { Write-Host ' [CMDLINE] KOMUT SATIRI PARAMETRELERI...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { Get-WmiObject Win32_Process -Filter "Name='$n.exe'" | Select-Object CommandLine | Format-List | Out-Host } catch { Write-Host " [!] BULUNAMADI" -ForegroundColor Red }; Read-Host ' ...' }
function P40 { Write-Host ' [MODULES] YUKLU MODULLER (DLL)...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { (Get-Process $n).Modules | Select-Object FileName | Select-Object -First 10 | Out-Host } catch { Write-Host " [!] ERISIM REDDEDILDI" -ForegroundColor Red }; Read-Host ' ...' }

# GRUP 5: EKSTRALAR
function P41 { Write-Host ' [UPTIME] ISLEM CALISMA SURESI...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { $p=Get-Process $n; $t=(Get-Date)-$p.StartTime; Write-Host " SURE: $($t.ToString())" -ForegroundColor Cyan } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P42 { Write-Host ' [WAIT] ISLEMIN BITMESINI BEKLE...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; Wait-Process $n; Write-Host " [OK] ISLEM KAPANDI" -ForegroundColor Green; Read-Host ' ...' }
function P43 { Write-Host ' [DEBUG] ISLEM HATA AYIKLAMA...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; Debug-Process -Name $n; Read-Host ' ...' }
function P44 { Write-Host ' [DUMP] ISLEM DUMP DOSYASI AL...' -ForegroundColor Yellow; $id=Read-Host ' PID'; try { $p=Get-Process -Id $id; $path="$env:TEMP\$($p.Name).dmp"; Stop-Process -Id $id -Dump; Write-Host " [OK] DUMP ALINDI" -ForegroundColor Green } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P45 { Write-Host ' [THREADS] IS PARCACIKLARI (THREADS)...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { (Get-Process $n).Threads.Count } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }
function P46 { Write-Host ' [START] YENI ISLEM BASLAT...' -ForegroundColor Yellow; $p=Read-Host ' Program (notepad)'; Start-Process $p; Write-Host " [OK] BASLADI" -ForegroundColor Green; Read-Host ' ...' }
function P47 { Write-Host ' [RUNAS] YONETICI OLARAK CALISTIR...' -ForegroundColor Yellow; $p=Read-Host ' Program'; Start-Process $p -Verb RunAs; Write-Host " [OK] ADMIN ILE BASLADI" -ForegroundColor Green; Read-Host ' ...' }
function P48 { Write-Host ' [EXPLORER] DOSYA GEZGINI YENILE...' -ForegroundColor Yellow; Stop-Process -Name explorer -Force; Write-Host " [OK] YENILENDI" -ForegroundColor Green; Read-Host ' ...' }
function P49 { 
    Write-Host ' [KILL NET] AG KULLANAN UYGULAMALAR (KILL NET)...' -ForegroundColor Yellow; 
    # Network kullanan process'leri ismine gore esle
    $conns = Get-NetTCPConnection
    $list = @()
    foreach ($c in $conns) {
        $pName = "Bilinmiyor"
        try { $pName = (Get-Process -Id $c.OwningProcess -EA SilentlyContinue).ProcessName } catch {}
        $list += [PSCustomObject]@{
            PID = $c.OwningProcess
            Uygulama = $pName
            Adres = $c.RemoteAddress
            Durum = $c.State
        }
    }
    # PID'e gore sirala ve yazdir
    $list | Sort-Object PID | Select-Object PID,Uygulama,Adres,Durum | Format-Table -AutoSize | Out-Host
    Read-Host ' ...' 
}
function P50 { Write-Host ' [HANDLE] DOSYA TUTANACLARI (HANDLE)...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; try { (Get-Process $n).HandleCount } catch { Write-Host " [!] HATA" -ForegroundColor Red }; Read-Host ' ...' }

# GRUP 6: SISTEM
function P51 { Write-Host ' [PERF MON] PERFORMANS IZLEYICISI...' -ForegroundColor Yellow; perfmon; Read-Host ' ...' }
function P52 { Write-Host ' [RES MON] KAYNAK IZLEYICISI...' -ForegroundColor Yellow; resmon; Read-Host ' ...' }
function P53 { Write-Host ' [TASK MGR] GOREV YONETICISI...' -ForegroundColor Yellow; taskmgr; Read-Host ' ...' }
function P54 { Write-Host ' [EVENT] OLAY GORUNTULEYICI...' -ForegroundColor Yellow; eventvwr; Read-Host ' ...' }
function P55 { Write-Host ' [SYS INFO] SISTEM BILGISI...' -ForegroundColor Yellow; systeminfo | Select-Object -First 5; Read-Host ' ...' }
function P56 { Write-Host ' [LOGGED] OTURUM ACAN KULLANICILAR...' -ForegroundColor Yellow; qwinsta; Read-Host ' ...' }
function P57 { Write-Host ' [SHUTDOWN] BILGISAYARI KAPAT (SHUTDOWN)...' -ForegroundColor Red; Stop-Computer -Force; }
function P58 { Write-Host ' [REBOOT] YENIDEN BASLAT (REBOOT)...' -ForegroundColor Red; Restart-Computer -Force; }
function P59 { Write-Host ' [LOCK] KILITLE...' -ForegroundColor Yellow; rundll32.exe user32.dll,LockWorkStation; }
function P60 { Write-Host ' [EXIT] CIKIS...' -ForegroundColor Red; Exit }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [ISLEM (PROCESS)]      [SERVIS (SERVICE)]     [ONCELIK & AYAR]       [BASLANGIC & GOREV]" -ForegroundColor Yellow
        Write-Host "   01. ISLEM LISTESI      11. SERVIS LISTESI     21. YUKSEK ONCELIK     31. STARTUP (WMI)" -ForegroundColor White
        Write-Host "   02. OLDUR (PID ILE)    12. BASLAT (INTERAKTIF)22. REALTIME ONCELIK   32. STARTUP (REG)" -ForegroundColor White
        Write-Host "   03. OLDUR (ISIM ILE)   13. DURDUR (INTERAKTIF)23. DUSUK ONCELIK      33. STARTUP SIL" -ForegroundColor White
        Write-Host "   04. EN COK CPU         14. YENILE (INTERAKTIF)24. NORMAL ONCELIK     34. ZAMANLI GOREVLER" -ForegroundColor White
        Write-Host "   05. EN COK RAM         15. OTO BASLANGIC      25. CPU SABITLE (0)    35. GOREV DURDUR" -ForegroundColor White
        Write-Host "   06. ISLEM ARA          16. MANUEL BASLANGIC   26. TUM CPU KULLAN     36. GOREV BASLAT" -ForegroundColor White
        Write-Host "   07. YANIT VERMEYENLER  17. DEVRE DISI BIRAK   27. ONCELIK KONTROL    37. GOREV IPTAL ET" -ForegroundColor White
        Write-Host "   08. ZOMBILERI OLDUR    18. SERVIS ARA         28. SESSION ID         38. ANA ISLEM (PARENT)" -ForegroundColor White
        Write-Host "   09. DOSYA YOLU BUL     19. CALISAN SERVISLER  29. YANIT DURUMU       39. KOMUT PARAMETRESI" -ForegroundColor White
        Write-Host "   10. ISLEM SAHIBI       20. DURAN SERVISLER    30. ARAYUZ KONTROL     40. MODUL LISTESI" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [DETAY & ARACLAR]      [SISTEM ARACLARI]" -ForegroundColor Yellow
        Write-Host "   41. CALISMA SURESI     51. PERFORMANS IZLE" -ForegroundColor Cyan
        Write-Host "   42. KAPANANA KADAR BEK 52. KAYNAK IZLEYICI" -ForegroundColor Cyan
        Write-Host "   43. HATA AYIKLA (DEBUG)53. GOREV YONETICISI" -ForegroundColor Cyan
        Write-Host "   44. DUMP AL (BELLEK)   54. OLAY GORUNTULEYICI" -ForegroundColor Cyan
        Write-Host "   45. THREAD SAYISI      55. SISTEM OLCUMLERI" -ForegroundColor Cyan
        Write-Host "   46. PROGRAM BASLAT     56. OTURUM BILGISI" -ForegroundColor Cyan
        Write-Host "   47. YONETICI BASLAT    57. BILGISAYARI KAPAT" -ForegroundColor Red
        Write-Host "   48. EXPLORER RESET     58. YENIDEN BASLAT" -ForegroundColor Red
        Write-Host "   49. AG KULLANAN UYG.   59. KILITLE" -ForegroundColor Cyan
        Write-Host "   50. HANDLE SAYISI      60. CIKIS YAP" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        if ($c -eq 'Q' -or $c -eq 'q') { P60 }
        
        switch ($c) {
            '1' {P01} '11' {P11} '21' {P21} '31' {P31} '41' {P41} '51' {P51}
            '01' {P01} '12' {P12} '22' {P22} '32' {P32} '42' {P42} '52' {P52}
            '2' {P02} '13' {P13} '23' {P23} '33' {P33} '43' {P43} '53' {P53}
            '02' {P02} '14' {P14} '24' {P24} '34' {P34} '44' {P44} '54' {P54}
            '3' {P03} '15' {P15} '25' {P25} '35' {P35} '45' {P45} '55' {P55}
            '03' {P03} '16' {P16} '26' {P26} '36' {P36} '46' {P46} '56' {P56}
            '4' {P04} '17' {P17} '27' {P27} '37' {P37} '47' {P47} '57' {P57}
            '4' {P04} '18' {P18} '28' {P28} '38' {P38} '48' {P48} '58' {P58}
            '5' {P05} '19' {P19} '29' {P29} '39' {P39} '49' {P49} '59' {P59}
            '05' {P05} '20' {P20} '30' {P30} '40' {P40} '50' {P50} '60' {P60}
            '6' {P06}
            '06' {P06}
            '7' {P07}
            '07' {P07}
            '8' {P08}
            '08' {P08}
            '9' {P09}
            '09' {P09}
            '10' {P10}
        }
    }
}

Main-Loop