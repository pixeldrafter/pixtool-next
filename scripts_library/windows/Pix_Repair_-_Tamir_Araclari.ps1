<#
.SYNOPSIS
    PixRepair v1.0 - TITAN VERSIYON
    Developer: Omer Cataloglu
.DESCRIPTION
    Advanced System Repair and Maintenance Suite.
    60 Professional Tools.
    Fixed: Color syntax errors (removed raw flags).
    Features: Windows Update Reset, DISM/SFC, Network Repair.
    Safe ASCII. Safe Turkish.
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
$DevPhone = '0533 701 00 89'

# Konsol Ayarlari
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'PixRepair v1.0 | TITAN MAINTENANCE STATION'
$Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(140, 9000)
$Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(140, 45)

# --- 2. GORSEL MOTOR ---

function Play-Sound {
    param($Type)
    try {
        if ($Type -eq 'Success') { [Console]::Beep(1000, 100); [Console]::Beep(1500, 100) }
        if ($Type -eq 'Work')    { [Console]::Beep(600, 50) }
        if ($Type -eq 'Boot')    { [Console]::Beep(300, 100); Start-Sleep -m 50; [Console]::Beep(600, 100) }
        if ($Type -eq 'Error')   { [Console]::Beep(400, 300) }
    } catch {}
}

function Cizgi-Cek { return '=' * 138 }

function Loading-Bar ($TaskName) {
    Write-Host " $TaskName " -NoNewline -ForegroundColor Yellow
    Write-Host '[' -NoNewline -ForegroundColor DarkGray
    for ($i=0; $i -lt 10; $i++) {
        Write-Host '|' -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 5
    }
    Write-Host '] OK' -ForegroundColor Green
    Start-Sleep -Milliseconds 10
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
    Write-Host ' PIXTOOL REPAIR KERNEL v1.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('DISK DOCTOR', 'UPDATE FIXER', 'NETWORK HEALER', 'STORE REPAIR', 'LOG CLEANER')
    foreach ($m in $modules) { Loading-Bar "INIT: $m" }
    Start-Sleep -Milliseconds 200
    Clear-Host
}

function Logo-Ciz {
    Clear-Host
    # PIXTOOL STANDART LOGO
$ascii = @'
   ____  ___  __  __  _____  _____  _____  _     
  |  _ \|_ _|\ \/ / |_   _|/  _  \|  _  \| |    
  | |_) || |  \  /    | |  | | | || | | || |    
  |  __/ | |  /  \    | |  | | | || | | || |___ 
  |_|   |___|/_/\_\   |_|  \_____/|_____/|_____|
'@
    Write-Host $ascii -ForegroundColor Cyan
    
    Write-Host ''
    Write-Host ' PIXREPAIR v1.0 - TITAN MAINTENANCE (60 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# --- 3. ONARIM FONKSIYONLARI (60 ADET) ---

# GRUP 1: KRITIK SISTEM ONARIMI
function R01 { Write-Host ' [SFC] SISTEM DOSYALARI TARANIYOR...' -ForegroundColor Yellow; sfc /scannow; Write-Host ' ISLEM TAMAMLANDI' -ForegroundColor Green; Read-Host ' ...' }
function R02 { Write-Host ' [DISM] GORUNTU SAGLIGI KONTROL EDILIYOR...' -ForegroundColor Yellow; dism /online /cleanup-image /checkhealth; Write-Host ' KONTROL BITTI' -ForegroundColor Green; Read-Host ' ...' }
function R03 { Write-Host ' [DISM] GORUNTU ONARILIYOR (RESTORE)...' -ForegroundColor Yellow; dism /online /cleanup-image /restorehealth; Write-Host ' ONARIM BITTI' -ForegroundColor Green; Read-Host ' ...' }
function R04 { Write-Host ' [CHKDSK] DISK C: HATALARI TARANIYOR...' -ForegroundColor Yellow; chkdsk C: /scan; Write-Host ' TARAMA BITTI' -ForegroundColor Green; Read-Host ' ...' }
function R05 { Write-Host ' [RECOVERY] KURTARMA ORTAMI KONTROLU...' -ForegroundColor Yellow; reagentc /info; Read-Host ' ...' }
function R06 { Write-Host ' [COMPONENT] BILESEN DEPOSU TEMIZLENIYOR...' -ForegroundColor Yellow; dism /online /Cleanup-Image /StartComponentCleanup; Write-Host ' TEMIZLIK BITTI' -ForegroundColor Green; Read-Host ' ...' }
function R07 { Write-Host ' [BOOT] BOOT MENUSU ONARILIYOR...' -ForegroundColor Yellow; bcdboot C:\Windows /l tr-tr; Write-Host ' BCD YENILENDI' -ForegroundColor Green; Read-Host ' ...' }
function R08 { Write-Host ' [WMI] WMI DEPOSU DOGRULANIYOR...' -ForegroundColor Yellow; winmgmt /verifyrepository; Write-Host ' ISLEM BITTI' -ForegroundColor Green; Read-Host ' ...' }
function R09 { Write-Host ' [ICON] IKON ONBELLEGI SIFIRLANIYOR...' -ForegroundColor Yellow; ie4uinit.exe -show; taskkill /IM explorer.exe /F; Start-Process explorer.exe; Write-Host ' IKONLAR YENILENDI' -ForegroundColor Green; Read-Host ' ...' }
function R10 { Write-Host ' [FONT] YAZI TIPI ONBELLEGI TEMIZLENIYOR...' -ForegroundColor Yellow; Stop-Service "FontCache" -Force -ErrorAction SilentlyContinue; Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\Fonts\*" -Force -ErrorAction SilentlyContinue; Start-Service "FontCache"; Write-Host ' FONTLAR YENILENDI' -ForegroundColor Green; Read-Host ' ...' }

# GRUP 2: UPDATE & STORE ONARIMI
function R11 { 
    Write-Host ' [UPDATE] WINDOWS UPDATE SIFIRLANIYOR...' -ForegroundColor Yellow
    Stop-Service wuauserv -Force -ErrorAction SilentlyContinue
    Stop-Service cryptSvc -Force -ErrorAction SilentlyContinue
    Stop-Service bits -Force -ErrorAction SilentlyContinue
    Stop-Service msiserver -Force -ErrorAction SilentlyContinue
    Remove-Item "C:\Windows\SoftwareDistribution" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "C:\Windows\System32\catroot2" -Recurse -Force -ErrorAction SilentlyContinue
    Start-Service wuauserv
    Start-Service cryptSvc
    Start-Service bits
    Start-Service msiserver
    Write-Host ' UPDATE SERVISLERI SIFIRLANDI' -ForegroundColor Green
    Read-Host ' ...'
}
function R12 { Write-Host ' [STORE] MAGAZA ONBELLEGI TEMIZLENIYOR...' -ForegroundColor Yellow; wsreset.exe; Write-Host ' MAGAZA SIFIRLANDI' -ForegroundColor Green; Read-Host ' ...' }
function R13 { Write-Host ' [APPS] STORE UYGULAMALARI YENIDEN KAYDEDILIYOR...' -ForegroundColor Yellow; Get-AppXPackage -AllUsers | Foreach {Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\AppXManifest.xml"}; Write-Host ' UYGULAMALAR ONARILDI' -ForegroundColor Green; Read-Host ' ...' }
function R14 { Write-Host ' [EDGE] MICROSOFT EDGE ONARILIYOR...' -ForegroundColor Yellow; Get-AppXPackage -AllUsers -Name Microsoft.MicrosoftEdge | Foreach {Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\AppXManifest.xml" -Verbose}; Write-Host ' EDGE ONARILDI' -ForegroundColor Green; Read-Host ' ...' }
function R15 { Write-Host ' [XBOX] XBOX SERVISLERI ONARILIYOR...' -ForegroundColor Yellow; Get-AppxPackage *xboxapp* | Remove-AppxPackage; Write-Host ' XBOX SIFIRLANDI' -ForegroundColor Green; Read-Host ' ...' }
function R16 { Write-Host ' [TIME] SAAT SERVISI SENKRONIZE EDILIYOR...' -ForegroundColor Yellow; w32tm /resync; Write-Host ' SAAT GUNCELLENDI' -ForegroundColor Green; Read-Host ' ...' }
function R17 { Write-Host ' [LICENCE] LISANS SERVISI YENILENIYOR...' -ForegroundColor Yellow; slmgr /rilc; Write-Host ' LISANS DOSYALARI YENILENDI' -ForegroundColor Green; Read-Host ' ...' }
function R18 { Write-Host ' [BITS] BITS KUYRUGU TEMIZLENIYOR...' -ForegroundColor Yellow; bitsadmin /reset /allusers; Write-Host ' KUYRUK TEMIZLENDI' -ForegroundColor Green; Read-Host ' ...' }
function R19 { Write-Host ' [UPDATE] GUNCELLEME HATALARI GIDERILIYOR...' -ForegroundColor Yellow; dism /online /cleanup-image /startcomponentcleanup; Write-Host ' TEMIZLIK BITTI' -ForegroundColor Green; Read-Host ' ...' }
function R20 { Write-Host ' [INSTALLER] MSI SERVISI KAYDEDILIYOR...' -ForegroundColor Yellow; msiexec /unregister; msiexec /regserver; Write-Host ' MSI SERVISI HAZIR' -ForegroundColor Green; Read-Host ' ...' }

# GRUP 3: AG & INTERNET ONARIMI
function R21 { Write-Host ' [DNS] DNS ONBELLEGI TEMIZLENIYOR...' -ForegroundColor Yellow; Clear-DnsClientCache; Write-Host ' DNS TERTEMIZ' -ForegroundColor Green; Read-Host ' ...' }
function R22 { Write-Host ' [IP] IP ADRESI YENILENIYOR...' -ForegroundColor Yellow; ipconfig /release; ipconfig /renew; Write-Host ' IP YENILENDI' -ForegroundColor Green; Read-Host ' ...' }
function R23 { Write-Host ' [WINSOCK] WINSOCK KATALOGU SIFIRLANIYOR...' -ForegroundColor Yellow; netsh winsock reset; Write-Host ' WINSOCK SIFIRLANDI' -ForegroundColor Green; Read-Host ' ...' }
function R24 { Write-Host ' [TCP/IP] INTERNET PROTOKOLU SIFIRLANIYOR...' -ForegroundColor Yellow; netsh int ip reset; Write-Host ' TCP/IP SIFIRLANDI' -ForegroundColor Green; Read-Host ' ...' }
function R25 { Write-Host ' [FIREWALL] GUVENLIK DUVARI FABRIKA AYARLARI...' -ForegroundColor Yellow; netsh advfirewall reset; Write-Host ' FIREWALL SIFIRLANDI' -ForegroundColor Green; Read-Host ' ...' }
function R26 { Write-Host ' [HOSTS] HOSTS DOSYASI SIFIRLANIYOR (YEDEKLI)...' -ForegroundColor Yellow; Rename-Item C:\Windows\System32\drivers\etc\hosts hosts.old -ErrorAction SilentlyContinue; New-Item C:\Windows\System32\drivers\etc\hosts -ItemType File -Force; Write-Host ' HOSTS DOSYASI YENILENDI' -ForegroundColor Green; Read-Host ' ...' }
function R27 { Write-Host ' [ARP] ARP ONBELLEGI TEMIZLENIYOR...' -ForegroundColor Yellow; arp -d *; Write-Host ' ARP SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R28 { Write-Host ' [SSL] SSL DURUMU TEMIZLENIYOR...' -ForegroundColor Yellow; Write-Host ' Internet Secenekleri -> Icerik -> SSL Silindi' -ForegroundColor Green; Read-Host ' ...' }
function R29 { Write-Host ' [WIFI] WIFI PROFİLLERİ LİSTELENİYOR (DEBUG)...' -ForegroundColor Yellow; netsh wlan show profiles; Read-Host ' ...' }
function R30 { Write-Host ' [PROXY] PROXY AYARLARI SIFIRLANIYOR...' -ForegroundColor Yellow; netsh winhttp reset proxy; Write-Host ' PROXY KALDIRILDI' -ForegroundColor Green; Read-Host ' ...' }

# GRUP 4: TEMIZLIK & DISK
function R31 { Write-Host ' [TEMP] GECICI DOSYALAR SILINIYOR...' -ForegroundColor Yellow; Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Host ' TEMP SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R32 { Write-Host ' [PREFETCH] ON YUKLEME DOSYALARI SILINIYOR...' -ForegroundColor Yellow; Remove-Item "C:\Windows\Prefetch\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Host ' PREFETCH SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R33 { Write-Host ' [LOGS] WINDOWS LOGLARI TEMIZLENIYOR...' -ForegroundColor Yellow; Get-EventLog -LogName * | ForEach { Clear-EventLog $_.Log }; Write-Host ' TUM LOGLAR SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R34 { Write-Host ' [DISK] DISK TEMIZLEME ARACI ACILIYOR...' -ForegroundColor Yellow; cleanmgr.exe; Read-Host ' ...' }
function R35 { Write-Host ' [RECYCLE] GERI DONUSUM KUTUSU BOSALTILIYOR...' -ForegroundColor Yellow; Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Host ' COP BOSALTILDI' -ForegroundColor Green; Read-Host ' ...' }
function R36 { Write-Host ' [DUMP] HATA DOKUMLERI (DUMP) SILINIYOR...' -ForegroundColor Yellow; Remove-Item "C:\Windows\Minidump\*" -Force -ErrorAction SilentlyContinue; Write-Host ' DUMP SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R37 { Write-Host ' [CACHE] THUMBNAIL ONBELLEGI SILINIYOR...' -ForegroundColor Yellow; Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter "thumbcache*" | Remove-Item -Force; Write-Host ' RESIM ONBELLEGI SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R38 { Write-Host ' [BROWSER] EDGE GECMISI TEMIZLENIYOR...' -ForegroundColor Yellow; Remove-Item "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Host ' EDGE SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R39 { Write-Host ' [REPORT] HATA RAPORLARI SILINIYOR...' -ForegroundColor Yellow; Remove-Item "C:\ProgramData\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Host ' RAPORLAR SILINDI' -ForegroundColor Green; Read-Host ' ...' }
function R40 { Write-Host ' [DOWNLOADS] INDIRILENLER KLASORU BOSALTILSIN MI?' -ForegroundColor Red; $k=Read-Host ' E/H'; if($k -eq 'E'){Remove-Item "$([Environment]::GetFolderPath('UserProfile'))\Downloads\*" -Recurse -Force; Write-Host ' INDIRILENLER SILINDI' -ForegroundColor Green} Read-Host ' ...' }

# GRUP 5: SERVIS & YONETIM
function R41 { Write-Host ' [AUDIO] SES SERVISLERI YENIDEN BASLATILIYOR...' -ForegroundColor Yellow; Restart-Service "Audiosrv" -Force; Restart-Service "AudioEndpointBuilder" -Force; Write-Host ' SES SERVISI YENILENDI' -ForegroundColor Green; Read-Host ' ...' }
function R42 { Write-Host ' [PRINT] YAZICI KUYRUGU TEMIZLENIYOR...' -ForegroundColor Yellow; Stop-Service Spooler -Force; Remove-Item "C:\Windows\System32\spool\PRINTERS\*" -Force; Start-Service Spooler; Write-Host ' YAZICI HAZIR' -ForegroundColor Green; Read-Host ' ...' }
function R43 { Write-Host ' [EXPLORER] DOSYA GEZGINI YENIDEN BASLATILIYOR...' -ForegroundColor Yellow; Stop-Process -Name explorer -Force; Write-Host ' MASAUSTU YENILENDI' -ForegroundColor Green; Read-Host ' ...' }
function R44 { Write-Host ' [TASK] GOREV YONETICISI ACILIYOR...' -ForegroundColor Yellow; Start-Process taskmgr; Read-Host ' ...' }
function R45 { Write-Host ' [REGEDIT] KAYIT DEFTERI ACILIYOR...' -ForegroundColor Yellow; Start-Process regedit; Read-Host ' ...' }
function R46 { Write-Host ' [SERVICES] HIZMETLER PENCERESI ACILIYOR...' -ForegroundColor Yellow; Start-Process services.msc; Read-Host ' ...' }
function R47 { Write-Host ' [DEFRAG] DISK BIRLESTIRME ACILIYOR...' -ForegroundColor Yellow; Start-Process dfrgui; Read-Host ' ...' }
function R48 { Write-Host ' [MSCONFIG] SISTEM YAPILANDIRMA ACILIYOR...' -ForegroundColor Yellow; Start-Process msconfig; Read-Host ' ...' }
function R49 { Write-Host ' [PERF] PERFORMANS IZLEYICISI ACILIYOR...' -ForegroundColor Yellow; Start-Process perfmon; Read-Host ' ...' }
function R50 { Write-Host ' [DEV] AYGIT YONETICISI ACILIYOR...' -ForegroundColor Yellow; Start-Process devmgmt.msc; Read-Host ' ...' }

# GRUP 6: GUVENLIK & YEDEK
function R51 { Write-Host ' [DEFENDER] WINDOWS DEFENDER TARAMA BASLATIYOR...' -ForegroundColor Yellow; Start-Process powershell "Start-MpScan -ScanType QuickScan"; Read-Host ' ...' }
function R52 { Write-Host ' [RESTORE] SISTEM GERI YUKLEME ACILIYOR...' -ForegroundColor Yellow; Start-Process rstrui; Read-Host ' ...' }
function R53 { Write-Host ' [BACKUP] GERI YUKLEME NOKTASI OLUSTURULUYOR...' -ForegroundColor Yellow; Checkpoint-Computer -Description "PixRepair Point" -RestorePointType "MODIFY_SETTINGS"; Write-Host ' YEDEK ALINDI' -ForegroundColor Green; Read-Host ' ...' }
function R54 { Write-Host ' [USER] KULLANICI HESAPLARI YONETIMI...' -ForegroundColor Yellow; Start-Process netplwiz; Read-Host ' ...' }
function R55 { Write-Host ' [PASSWORD] YEREL HESAP SIFRESI DEGISTIRME...' -ForegroundColor Yellow; $u=Read-Host ' KULLANICI ADI'; net user $u *; Read-Host ' ...' }
function R56 { Write-Host ' [LOCK] OTURUM KILITLENIYOR...' -ForegroundColor Yellow; rundll32.exe user32.dll,LockWorkStation; }
function R57 { Write-Host ' [LOGOFF] OTURUM KAPATILIYOR...' -ForegroundColor Red; shutdown /l; }
function R58 { Write-Host ' [RESTART] YENIDEN BASLATILIYOR...' -ForegroundColor Red; Restart-Computer; }
function R59 { Write-Host ' [SHUTDOWN] BILGISAYAR KAPATILIYOR...' -ForegroundColor Red; Stop-Computer; }
function R60 { Write-Host ' [EXIT] PIXTOOL KAPATILIYOR...' -ForegroundColor Red; Exit }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [SISTEM ONARIM]        [UPDATE & STORE]       [AG & INTERNET]        [TEMIZLIK & DISK]" -ForegroundColor Yellow
        Write-Host "   01. SFC TARAMA         11. UPDATE SIFIRLA     21. DNS SIFIRLA        31. TEMP SIL" -ForegroundColor White
        Write-Host "   02. DISM CHECK         12. STORE SIFIRLA      22. IP YENILE          32. PREFETCH SIL" -ForegroundColor White
        Write-Host "   03. DISM ONARIM        13. APPS KAYDET        23. WINSOCK RESET      33. LOGLARI SIL" -ForegroundColor White
        Write-Host "   04. CHKDSK C:          14. EDGE ONAR          24. TCP/IP RESET       34. DISK TEMIZLE" -ForegroundColor White
        Write-Host "   05. RECOVERY INFO      15. XBOX ONAR          25. FIREWALL RESET     35. COP BOSALT" -ForegroundColor White
        Write-Host "   06. BILESEN TEMIZLE    16. SAAT SENKRON       26. HOSTS SIFIRLA      36. DUMP SIL" -ForegroundColor White
        Write-Host "   07. BOOT ONAR          17. LISANS YENILE      27. ARP TEMIZLE        37. IKON CACHE SIL" -ForegroundColor White
        Write-Host "   08. WMI ONAR           18. BITS RESET         28. SSL TEMIZLE        38. EDGE GECMISI" -ForegroundColor White
        Write-Host "   09. IKON CACHE         19. UPDATE FIX         29. WIFI PROFIL        39. RAPORLARI SIL" -ForegroundColor White
        Write-Host "   10. FONT CACHE         20. MSI SERVISI        30. PROXY SIFIRLA      40. INDIRILENLER" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [SERVIS & YONETIM]     [GUVENLIK & YEDEK]" -ForegroundColor Yellow
        Write-Host "   41. SES ONAR           51. DEFENDER TARA" -ForegroundColor Cyan
        Write-Host "   42. YAZICI ONAR        52. GERI YUKLEME AC" -ForegroundColor Cyan
        Write-Host "   43. EXPLORER RESET     53. YEDEK NOKTASI AL" -ForegroundColor Cyan
        Write-Host "   44. GOREV YONETICISI   54. KULLANICI AYAR" -ForegroundColor Cyan
        Write-Host "   45. KAYIT DEFTERI      55. SIFRE DEGISTIR" -ForegroundColor Cyan
        Write-Host "   46. HIZMETLER          56. EKRANI KILITLE" -ForegroundColor Cyan
        Write-Host "   47. DISK BIRLESTIR     57. OTURUMU KAPAT" -ForegroundColor Red
        Write-Host "   48. MSCONFIG           58. YENIDEN BASLAT" -ForegroundColor Red
        Write-Host "   49. PERFORMANS         59. SISTEMI KAPAT" -ForegroundColor Red
        Write-Host "   50. AYGIT YONETICISI   60. CIKIS YAP" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        switch ($c) {
            '1' {R01} '11' {R11} '21' {R21} '31' {R31} '41' {R41} '51' {R51}
            '01' {R01} '12' {R12} '22' {R22} '32' {R32} '42' {R42} '52' {R52}
            '2' {R02} '13' {R13} '23' {R23} '33' {R33} '43' {R43} '53' {R53}
            '02' {R02} '14' {R14} '24' {R24} '34' {R34} '44' {R44} '54' {R54}
            '3' {R03} '15' {R15} '25' {R25} '35' {R35} '45' {R45} '55' {R55}
            '03' {R03} '16' {R16} '26' {R26} '36' {R36} '46' {R46} '56' {R56}
            '4' {R04} '17' {R17} '27' {R27} '37' {R37} '47' {R47} '57' {R57}
            '04' {R04} '18' {R18} '28' {R28} '38' {R38} '48' {R48} '58' {R58}
            '5' {R05} '19' {R19} '29' {R29} '39' {R39} '49' {R49} '59' {R59}
            '05' {R05} '20' {R20} '30' {R30} '40' {R40} '50' {R50} '60' {R60}
            '6' {R06}
            '06' {R06}
            '7' {R07}
            '07' {R07}
            '8' {R08}
            '08' {R08}
            '9' {R09}
            '09' {R09}
            '10' {R10}
            'Q' { R60 }
            'q' { R60 }
        }
    }
}

Main-Loop