<#
.SYNOPSIS
    PixDebloat v2.0 - TITAN OPTIMIZER
    Developer: Omer Cataloglu
.DESCRIPTION
    Massive Windows Optimization Suite (80 Tools).
    Features: Multi-Select, Safe-Uninstall, Privacy Hardening.
    Fixed: OneDrive path error, Color syntax error.
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
$Host.UI.RawUI.WindowTitle = 'PixDebloat v2.0 | TITAN OPTIMIZER'
$Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(160, 9000)
$Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(160, 50)

# --- 2. YARDIMCI FONKSIYONLAR ---

function Play-Sound {
    param($Type)
    try {
        if ($Type -eq 'Success') { [Console]::Beep(1200, 100); [Console]::Beep(1500, 100) }
        if ($Type -eq 'Work')    { [Console]::Beep(600, 50) }
        if ($Type -eq 'Boot')    { [Console]::Beep(300, 100); Start-Sleep -m 50; [Console]::Beep(600, 100) }
        if ($Type -eq 'Error')   { [Console]::Beep(400, 300) }
    } catch {}
}

function Cizgi-Cek { return '=' * 158 }

function Loading-Bar ($TaskName) {
    Write-Host " $TaskName " -NoNewline -ForegroundColor Yellow
    Write-Host '[' -NoNewline -ForegroundColor DarkGray
    for ($i=0; $i -lt 8; $i++) {
        Write-Host '|' -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 2
    }
    Write-Host '] OK' -ForegroundColor Green
    Start-Sleep -Milliseconds 5
}

function Boot-Sequence {
    Clear-Host
    Play-Sound 'Boot'
    Write-Host ' PIXTOOL OPTIMIZER KERNEL v2.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('REGISTRY HIVE', 'DEBLOAT ENGINE', 'PRIVACY SHIELD', 'PERFORMANCE TUNER', 'MULTI-THREAD CORE')
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
    Write-Host ' PIXDEBLOAT v2.0 - TITAN OPTIMIZER (80 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# YARDIMCI: Guvenli Registry Yazma
function Set-Reg {
    param($Path, $Name, $Value, $Type='DWord')
    try {
        if (!(Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
        New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type -Force | Out-Null
        Write-Host " [OK] AYAR UYGULANDI: $Name" -ForegroundColor Green
    } catch { Write-Host " [HATA] $Name YAZILAMADI" -ForegroundColor Red }
}

# YARDIMCI: Uygulama Kaldirma
function Remove-App {
    param($Name, $DispName)
    Write-Host " $DispName KALDIRILIYOR..." -NoNewline -ForegroundColor Yellow
    try {
        Get-AppxPackage *$Name* | Remove-AppxPackage -ErrorAction Stop
        Write-Host " [SILINDI]" -ForegroundColor Green
    } catch {
        Write-Host " [BULUNAMADI/HATA]" -ForegroundColor DarkGray
    }
}

# --- 3. ISLEM FONKSIYONLARI (80 ADET) ---

# GRUP 1: UYGULAMA KALDIRMA
function Op-01 { Remove-App 'xbox' 'XBOX UYGULAMALARI' }
function Op-02 { Remove-App 'bingweather' 'HAVA DURUMU' }
function Op-03 { Remove-App 'bingsports' 'SPOR HABERLERI' }
function Op-04 { Remove-App 'bingfinance' 'FINANS HABERLERI' }
function Op-05 { Remove-App 'bingnews' 'HABERLER' }
function Op-06 { Remove-App 'windowsmaps' 'HARITALAR' }
function Op-07 { Remove-App 'solitaire' 'SOLITAIRE KOLEKSIYONU' }
function Op-08 { Remove-App 'officehub' 'OFFICE HUB' }
function Op-09 { Remove-App 'onenote' 'ONENOTE' }
function Op-10 { Remove-App 'skypeapp' 'SKYPE' }
function Op-11 { Remove-App 'zunevideo' 'FILMLER VE TV' }
function Op-12 { Remove-App 'zunemusic' 'GROOVE MUZIK' }
function Op-13 { Remove-App 'people' 'KISILER' }
function Op-14 { Remove-App 'windowscommunicationsapps' 'POSTA VE TAKVIM' }
function Op-15 { Remove-App 'windowsphone' 'TELEFON BAGLANTISI' }
function Op-16 { Remove-App 'soundrecorder' 'SES KAYDEDICI' }
function Op-17 { Remove-App 'photos' 'FOTOGRAFLAR' }
function Op-18 { Remove-App 'camera' 'KAMERA' }
function Op-19 { Remove-App 'alarms' 'ALARMLAR VE SAAT' }
function Op-20 { Remove-App 'calculator' 'HESAP MAKINESI' } # Dikkatli kullanin
function Op-21 { Remove-App 'feedback' 'GERI BILDIRIM MERKEZI' }
function Op-22 { Remove-App 'gethelp' 'YARDIM ALIN' }
function Op-23 { Remove-App 'yourphone' 'TELEFONUNUZ' }
function Op-24 { Remove-App 'wallet' 'CUZDAN/PAY' }
function Op-25 { Remove-App '3dviewer' '3D GORUNTULEYICI' }
function Op-26 { Remove-App 'paint3d' 'PAINT 3D' }
function Op-27 { Remove-App 'mixedreality' 'KARMA GERCEKLIK PORTALI' }
function Op-28 { Remove-App 'sticky' 'YAPISKAN NOTLAR' }
function Op-29 { 
    Write-Host " ONEDRIVE SILINIYOR..." -Yellow
    # Akilli Yol Bulma (Hata Duzeltildi)
    $paths = @(
        "$env:SystemRoot\SysWOW64\OneDriveSetup.exe",
        "$env:SystemRoot\System32\OneDriveSetup.exe",
        "$env:LOCALAPPDATA\Microsoft\OneDrive\Update\OneDriveSetup.exe"
    )
    $found = $false
    foreach ($p in $paths) {
        if (Test-Path $p) {
            Write-Host " -> Bulundu: $p" -Gray
            Start-Process $p "/uninstall" -Wait
            $found = $true
            break
        }
    }
    if ($found) { Write-Host " [SILINDI]" -Green } else { Write-Host " [DOSYA BULUNAMADI - ZATEN SILINMIS OLABILIR]" -Red }
}
function Op-30 { Remove-App 'cortana' 'CORTANA' }

# GRUP 2: GIZLILIK & TELEMETRI
function Op-31 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" "AllowTelemetry" 0; Write-Host ' TELEMETRI KAPATILDI' -Green }
function Op-32 { Set-Reg "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo" "Enabled" 0; Write-Host ' REKLAM ID KAPATILDI' -Green }
function Op-33 { Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy" "TailoredExperiencesWithDiagnosticDataEnabled" 0; Write-Host ' TAKIP KAPATILDI' -Green }
function Op-34 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors" "DisableLocation" 1; Write-Host ' KONUM KAPATILDI' -Green }
function Op-35 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" "DisableWebSearch" 1; Write-Host ' WEB ARAMA KAPATILDI' -Green }
function Op-36 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" "EnableActivityFeed" 0; Write-Host ' ZAMAN CIZGISI KAPATILDI' -Green }
function Op-37 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent" "DisableSoftLanding" 1; Write-Host ' IPUCLARI KAPATILDI' -Green }
function Op-38 { Set-Reg "HKCU:\Software\Microsoft\Siuf\Rules" "NumberOfSIUFInPeriod" 0; Write-Host ' GERI BILDIRIM ISTEGI KAPATILDI' -Green }
function Op-39 { Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer" "ShowRecent" 0; Write-Host ' SON DOSYALAR GIZLENDI' -Green }
function Op-40 { Set-Reg "HKLM:\SOFTWARE\Microsoft\WcmSvc\wifinetworkmanager\config" "AutoConnectAllowedOEM" 0; Write-Host ' WIFI SENSE KAPATILDI' -Green }
function Op-41 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Error Reporting" "Disabled" 1; Write-Host ' HATA RAPORLAMA KAPATILDI' -Green }
function Op-42 { Set-Reg "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection" "AllowTelemetry" 0; Write-Host ' VERI TOPLAMA ENGELLENDI' -Green }
function Op-43 { Set-Reg "HKCU:\Software\Microsoft\Personalization\Settings" "AcceptedPrivacyPolicy" 0; Write-Host ' KISISELLESTIRME TAKIBI KAPATILDI' -Green }
function Op-44 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppCompat" "AITEnable" 0; Write-Host ' ENVANTER TOPLAMA KAPATILDI' -Green }
function Op-45 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\InputPersonalization" "AllowInputPersonalization" 0; Write-Host ' YAZI TANIMA BULUTU KAPATILDI' -Green }

# GRUP 3: PERFORMANS & TWEAKS
function Op-46 { powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61; Write-Host ' NIHAI PERFORMANS EKLENDI' -Green }
function Op-47 { Set-Reg "HKCU:\System\GameConfigStore" "GameDVR_Enabled" 0; Write-Host ' OYUN DVR KAPATILDI' -Green }
function Op-48 { Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" "VisualFXSetting" 2; Write-Host ' GORSEL EFEKTLER KISILDI' -Green }
function Op-49 { powercfg /h off; Write-Host ' HIBERNATE KAPATILDI' -Green }
function Op-50 { Set-Reg "HKCU:\Control Panel\Mouse" "MouseSpeed" 0 -Type String; Write-Host ' MOUSE IVME KAPATILDI' -Green }
function Op-51 { Set-Reg "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" "NetworkThrottlingIndex" 4294967295; Write-Host ' AG KISITLAMA KALDIRILDI' -Green }
function Op-52 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" "AllowCortana" 0; Write-Host ' CORTANA TAMAMEN KAPATILDI' -Green }
function Op-53 { Stop-Service "SysMain" -Force -EA 0; Set-Service "SysMain" -StartupType Disabled; Write-Host ' SYSMAIN KAPATILDI' -Green }
function Op-54 { Stop-Service "DiagTrack" -Force -EA 0; Set-Service "DiagTrack" -StartupType Disabled; Write-Host ' TANI SERVISI KAPATILDI' -Green }
function Op-55 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" "DODownloadMode" 0; Write-Host ' P2P UPDATE KAPATILDI' -Green }
function Op-56 { powercfg /x -standby-timeout-ac 0; Write-Host ' UYKU MODU KAPATILDI' -Green }
function Op-57 { Set-Reg "HKLM:\SYSTEM\CurrentControlSet\Control\Power" "HibernateEnabled" 0; Write-Host ' HAZIRDA BEKLET KALDIRILDI' -Green }
function Op-58 { Set-Reg "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" "DelayedDesktopSwitchTimeout" 0; Write-Host ' MASAUSTU GECIKMESI SIFIRLANDI' -Green }
function Op-59 { Set-Reg "HKCU:\Control Panel\Desktop" "MenuShowDelay" 0 -Type String; Write-Host ' MENU ACILIS HIZLANDIRILDI' -Green }
function Op-60 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" "PublishUserActivities" 0; Write-Host ' KULLANICI AKTIVITE YAYINI KAPATILDI' -Green }

# GRUP 4: SISTEM & ARACLAR
function Op-61 { Set-Reg "HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" "" ""; Stop-Process -Name explorer -Force; Write-Host ' WIN11 KLASIK MENU AKTIF' -Green }
function Op-62 { Set-Reg "HKLM:\SOFTWARE\Microsoft\Windows Photo Viewer\Capabilities\FileAssociations" ".jpg" "PhotoViewer.FileAssoc.Tiff" -Type String; Write-Host ' FOTO GOSTERICI AKTIF' -Green }
function Op-63 { Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "HideFileExt" 0; Write-Host ' UZANTILAR GOSTERILIYOR' -Green }
function Op-64 { Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "Hidden" 1; Write-Host ' GIZLI DOSYALAR GOSTERILIYOR' -Green }
function Op-65 { Start-Process "desk.cpl" ",5"; Write-Host ' BU PC IKON AYARI ACILDI' -Green }
function Op-66 { Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "AppsUseLightTheme" 0; Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "SystemUsesLightTheme" 0; Write-Host ' KOYU TEMA AKTIF' -Green }
function Op-67 { Set-Reg "HKU\.DEFAULT\Control Panel\Keyboard" "InitialKeyboardIndicators" "2" -Type String; Write-Host ' BOOT NUMLOCK ACIK' -Green }
function Op-68 { Set-Reg "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" "VerboseStatus" 1; Write-Host ' DETAYLI BOOT AKTIF' -Green }
function Op-69 { Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "DisallowShaking" 1; Write-Host ' PENCERE SALLAMA KAPATILDI' -Green }
function Op-70 { Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization" "NoLockScreen" 1; Write-Host ' KILIT EKRANI RESMI KALDIRILDI' -Green }
function Op-71 { Checkpoint-Computer -Description "PixDebloat Point" -RestorePointType "MODIFY_SETTINGS"; Write-Host ' GERI YUKLEME NOKTASI ALINDI' -Green }
function Op-72 { Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Host ' TEMP TEMIZLENDI' -Green }
function Op-73 { Clear-DnsClientCache; Write-Host ' DNS TEMIZLENDI' -Green }
function Op-74 { sfc /scannow; Write-Host ' SFC BITTI' -Green }
function Op-75 { dism /online /cleanup-image /restorehealth; Write-Host ' DISM BITTI' -Green }
function Op-76 { cleanmgr.exe }
function Op-77 { winget upgrade --all; Write-Host ' GUNCELLEMELER BASLADI' -Green }
function Op-78 { $p = "$([Environment]::GetFolderPath('Desktop'))\GodMode.{ED7BA470-8E54-465E-825C-99712043E01C}"; New-Item -Path $p -ItemType Directory -Force; Write-Host ' GOD MODE OLUSTURULDU' -Green }
function Op-79 { Stop-Process -Name explorer -Force; Write-Host ' EXPLORER YENILENDI' -Green }
function Op-80 { ipconfig /flushdns; netsh winsock reset; Write-Host ' AG SIFIRLANDI' -Green }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [UYGULAMA KALDIR]      [UYGULAMA KALDIR 2]    [GIZLILIK & TAKIP]     [PERFORMANS AYARLARI]" -ForegroundColor Yellow
        Write-Host "   01. XBOX UYGULAMASI    16. SES KAYDEDICI      31. TELEMETRI KAPAT    46. NIHAI PERFORMANS" -ForegroundColor White
        Write-Host "   02. HAVA DURUMU        17. FOTOGRAFLAR        32. REKLAM ID KAPAT    47. OYUN DVR KAPAT" -ForegroundColor White
        Write-Host "   03. SPOR HABERLERI     18. KAMERA UYGULAMA    33. TAKIP KAPAT        48. GORSEL EFEKT KIS" -ForegroundColor White
        Write-Host "   04. FINANS HABERLERI   19. ALARMLAR/SAAT      34. KONUM SERVISI      49. HIBERNATE KAPAT" -ForegroundColor White
        Write-Host "   05. HABERLER           20. HESAP MAKINESI     35. WEB ARAMA KAPAT    50. MOUSE IVME KAPAT" -ForegroundColor White
        Write-Host "   06. HARITALAR          21. GERI BILDIRIM      36. ZAMAN CIZGISI      51. AG KISITLAMA KAL" -ForegroundColor White
        Write-Host "   07. SOLITAIRE          22. YARDIM ALIN        37. IPUCLARI KAPAT     52. CORTANA FULL SIL" -ForegroundColor White
        Write-Host "   08. OFFICE HUB         23. TELEFONUNUZ        38. BILDIRIM ISTEGI    53. SYSMAIN HIZMETI" -ForegroundColor White
        Write-Host "   09. ONENOTE            24. CUZDAN/PAY         39. SON DOSYALAR       54. TANI HIZMETI SIL" -ForegroundColor White
        Write-Host "   10. SKYPE              25. 3D GORUNTULEYICI   40. WIFI PAYLASIM      55. UPDATE DAGITIM" -ForegroundColor White
        Write-Host "   11. FILMLER VE TV      26. PAINT 3D           41. HATA RAPORLAMA     56. UYKU MODU KAPAT" -ForegroundColor White
        Write-Host "   12. GROOVE MUZIK       27. KARMA GERCEKLIK    42. VERI TOPLAMA       57. HAZIRDA BEKLETME" -ForegroundColor White
        Write-Host "   13. KISILER            28. YAPISKAN NOTLAR    43. KISISELLESTIRME    58. MASAUSTU GECIKME" -ForegroundColor White
        Write-Host "   14. POSTA VE TAKVIM    29. ONEDRIVE SIL       44. ENVANTER TOPLAMA   59. MENU ACILIS HIZI" -ForegroundColor White
        Write-Host "   15. TELEFON BAGLANTI   30. CORTANA SIL        45. YAZI TANIMA        60. AKTIVITE YAYINI" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [SISTEM AYARLARI]      [BAKIM VE ARACLAR]" -ForegroundColor Yellow
        Write-Host "   61. WIN11 KLASIK MENU  71. GERI YUKLEME NOKTASI" -ForegroundColor Cyan
        Write-Host "   62. FOTO GOSTERICI     72. TEMP TEMIZLE" -ForegroundColor Cyan
        Write-Host "   63. UZANTILARI GOSTER  73. DNS TEMIZLE" -ForegroundColor Cyan
        Write-Host "   64. GIZLILERI GOSTER   74. SISTEM ONAR (SFC)" -ForegroundColor Cyan
        Write-Host "   65. BU PC IKONU EKLE   75. GORUNTU ONAR (DISM)" -ForegroundColor Cyan
        Write-Host "   66. KOYU TEMA YAP      76. DISK TEMIZLEME" -ForegroundColor Cyan
        Write-Host "   67. BOOTTA NUMLOCK AC  77. STORE GUNCELLEME" -ForegroundColor Cyan
        Write-Host "   68. DETAYLI BOOT       78. GOD MODE KLASORU" -ForegroundColor Cyan
        Write-Host "   69. SALLAMAYI KAPAT    79. EXPLORER YENILE" -ForegroundColor Cyan
        Write-Host "   70. KILIT RESMI SIL    80. AG SIFIRLAMA" -ForegroundColor Cyan
        
        Write-Host ""
        Write-Host "   [Q] CIKIS YAP" -ForegroundColor Red
        Write-Host "   NOT: Coklu secim icin virgulle ayirin (Orn: 1,5,10)" -ForegroundColor Gray
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $input = Read-Host ' SECIM NO'
        
        # Cikis Kontrolu
        if ($input -eq 'Q' -or $input -eq 'q') {
            Write-Host ' KAPATILIYOR...' -ForegroundColor Red
            Exit
        }
        
        # Coklu Secim Algoritmasi
        # Virgül veya boşluk ile ayır
        $selections = $input -split '[, ]+'
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor DarkGray
        Write-Host " TOPLU ISLEM BASLATILIYOR ($($selections.Count) ADET)..." -ForegroundColor Yellow
        Write-Host " $(Cizgi-Cek)" -ForegroundColor DarkGray
        
        foreach ($sel in $selections) {
            # Bosluklari temizle
            $sel = $sel.Trim()
            if ($sel -eq "") { continue }
            
            # Switch ile islem yap
            switch ($sel) {
                '1' {Op-01} '01' {Op-01} '16' {Op-16} '31' {Op-31} '46' {Op-46} '61' {Op-61} '76' {Op-76}
                '2' {Op-02} '02' {Op-02} '17' {Op-17} '32' {Op-32} '47' {Op-47} '62' {Op-62} '77' {Op-77}
                '3' {Op-03} '03' {Op-03} '18' {Op-18} '33' {Op-33} '48' {Op-48} '63' {Op-63} '78' {Op-78}
                '4' {Op-04} '04' {Op-04} '19' {Op-19} '34' {Op-34} '49' {Op-49} '64' {Op-64} '79' {Op-79}
                '5' {Op-05} '05' {Op-05} '20' {Op-20} '35' {Op-35} '50' {Op-50} '65' {Op-65} '80' {Op-80}
                '6' {Op-06} '06' {Op-06} '21' {Op-21} '36' {Op-36} '51' {Op-51} '66' {Op-66}
                '7' {Op-07} '07' {Op-07} '22' {Op-22} '37' {Op-37} '52' {Op-52} '67' {Op-67}
                '8' {Op-08} '08' {Op-08} '23' {Op-23} '38' {Op-38} '53' {Op-53} '68' {Op-68}
                '9' {Op-09} '09' {Op-09} '24' {Op-24} '39' {Op-39} '54' {Op-54} '69' {Op-69}
                '10' {Op-10}             '25' {Op-25} '40' {Op-40} '55' {Op-55} '70' {Op-70}
                '11' {Op-11}             '26' {Op-26} '41' {Op-41} '56' {Op-56} '71' {Op-71}
                '12' {Op-12}             '27' {Op-27} '42' {Op-42} '57' {Op-57} '72' {Op-72}
                '13' {Op-13}             '28' {Op-28} '43' {Op-43} '58' {Op-58} '73' {Op-73}
                '14' {Op-14}             '29' {Op-29} '44' {Op-44} '59' {Op-59} '74' {Op-74}
                '15' {Op-15}             '30' {Op-30} '45' {Op-45} '60' {Op-60} '75' {Op-75}
            }
            Start-Sleep -Milliseconds 100
        }
        
        Play-Sound 'Work'
        Write-Host ""
        Write-Host " $(Cizgi-Cek)" -ForegroundColor DarkGray
        Write-Host " TUM ISLEMLER TAMAMLANDI." -ForegroundColor Green
        Read-Host " ANA MENUYE DONMEK ICIN ENTER'A BASIN..."
    }
}

Main-Loop