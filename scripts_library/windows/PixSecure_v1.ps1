<#
.SYNOPSIS
    PixSecure v2.0 - TITAN SECURITY SUITE (REFORGED)
    Developer: Omer Cataloglu
.DESCRIPTION
    Advanced System Hardening and Security Auditing Tool.
    FIXED: Empty results now show explicit warnings.
    IMPROVED: USB History and Startup logic rewritten.
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
$Host.UI.RawUI.WindowTitle = 'PixSecure v2.0 | TITAN SECURITY OPERATIONS'
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

# YARDIMCI: Veri Yazdirma ve Bosluk Kontrolu
function Print-Data {
    param($Data, $Props)
    if ($Data) {
        if ($Props) { $Data | Select-Object $Props | Format-Table -AutoSize | Out-String | Write-Host }
        else { $Data | Format-Table -AutoSize | Out-String | Write-Host }
    } else {
        Write-Host " [!] KAYIT BULUNAMADI / LISTE BOS" -ForegroundColor Red
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
    Write-Host ' PIXTOOL SECURITY KERNEL v2.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('AUDIT ENGINE', 'HARDENING MODULE', 'DEFENDER LINK', 'FIREWALL CONTROL', 'LOG ANALYZER')
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
    Write-Host ' PIXSECURE v2.0 - TITAN SECURITY (60 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# --- 3. GUVENLIK FONKSIYONLARI (60 ADET) ---

# GRUP 1: HESAP & ERISIM DENETIMI
function S01 { Write-Host ' [ADMIN] YONETICI HESAPLARI...' -ForegroundColor Yellow; $d=Get-LocalGroupMember -Group "Administrators" -ErrorAction SilentlyContinue; Print-Data $d "Name,ObjectClass" ; Read-Host ' ...' }
function S02 { Write-Host ' [GUEST] MISAFIR HESABI...' -ForegroundColor Yellow; $d=Get-LocalUser -Name "Guest" -ErrorAction SilentlyContinue; Print-Data $d "Name,Enabled"; Read-Host ' ...' }
function S03 { Write-Host ' [USERS] TUM KULLANICILAR...' -ForegroundColor Yellow; $d=Get-LocalUser; Print-Data $d "Name,Enabled,LastLogon"; Read-Host ' ...' }
function S04 { Write-Host ' [PASSWORD] SIFRE POLITIKASI...' -ForegroundColor Yellow; net accounts; Read-Host ' ...' }
function S05 { Write-Host ' [SESSION] AKTIF OTURUMLAR...' -ForegroundColor Yellow; try { $d = quser 2>&1; if($d -match "No user"){Write-Host " OTURUM YOK" -Red}else{$d | Out-String | Write-Host} } catch { Write-Host " HATA" -Red }; Read-Host ' ...' }
function S06 { Write-Host ' [HIDDEN] AKTIF HESAPLAR...' -ForegroundColor Yellow; $d=Get-LocalUser | Where {$_.Enabled -eq $true}; Print-Data $d "Name,Description"; Read-Host ' ...' }
function S07 { Write-Host ' [GROUPS] YEREL GRUPLAR...' -ForegroundColor Yellow; $d=Get-LocalGroup; Print-Data $d "Name"; Read-Host ' ...' }
function S08 { Write-Host ' [RDP USERS] UZAK MASAUSTU KULLANICILARI...' -ForegroundColor Yellow; $d=Get-LocalGroupMember -Group "Remote Desktop Users" -ErrorAction SilentlyContinue; Print-Data $d "Name"; Read-Host ' ...' }
function S09 { Write-Host ' [AUTO ADMIN] OTOMATIK GIRIS KONTROLU...' -ForegroundColor Yellow; $d=Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" | Select DefaultUserName,AutoAdminLogon; Print-Data $d; Read-Host ' ...' }
function S10 { Write-Host ' [SID] KULLANICI SID BILGILERI...' -ForegroundColor Yellow; $d=Get-LocalUser; Print-Data $d "Name,SID"; Read-Host ' ...' }

# GRUP 2: SISTEM SIKILASTIRMA (HARDENING)
function S11 { Write-Host ' [SMBv1] SMBv1 KAPATILIYOR...' -ForegroundColor Yellow; Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force -Confirm:$false; Write-Host ' [OK] SMBv1 KAPATILDI' -ForegroundColor Green; Read-Host ' ...' }
function S12 { Write-Host ' [R-REGISTRY] UZAKTAN KAYIT KAPATILIYOR...' -ForegroundColor Yellow; Stop-Service RemoteRegistry -Force -EA 0; Set-Service RemoteRegistry -StartupType Disabled; Write-Host ' [OK] SERVIS DURDURULDU' -ForegroundColor Green; Read-Host ' ...' }
function S13 { Write-Host ' [AUTORUN] OTOMATIK CALISTIRMA KAPATILIYOR...' -ForegroundColor Yellow; Set-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "NoDriveTypeAutoRun" -Value 255; Write-Host ' [OK] KAPATILDI' -ForegroundColor Green; Read-Host ' ...' }
function S14 { Write-Host ' [UAC] UAC MAKSIMUMA CIKARILIYOR...' -ForegroundColor Yellow; Set-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "ConsentPromptBehaviorAdmin" -Value 2; Write-Host ' [OK] SIKILASTIRILDI' -ForegroundColor Green; Read-Host ' ...' }
function S15 { Write-Host ' [POWERSHELL] SCRIPT POLITIKASI (RESTRICTED)...' -ForegroundColor Yellow; Set-ExecutionPolicy Restricted -Scope CurrentUser -Force; Write-Host ' [OK] KISITLANDI' -ForegroundColor Green; Read-Host ' ...' }
function S16 { Write-Host ' [EXT] DOSYA UZANTILARI ACILIYOR...' -ForegroundColor Yellow; Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideFileExt" -Value 0; Write-Host ' [OK] GIZLILIK KALDIRILDI' -ForegroundColor Green; Read-Host ' ...' }
function S17 { Write-Host ' [RDP] UZAK BAGLANTI KAPATILIYOR...' -ForegroundColor Yellow; Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -Value 1; Write-Host ' [OK] KAPATILDI' -ForegroundColor Green; Read-Host ' ...' }
function S18 { Write-Host ' [SHARE] YONETICI PAYLASIMLARI KAPATILIYOR...' -ForegroundColor Yellow; New-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" -Name "AutoShareWks" -Value 0 -PropertyType DWord -Force; Write-Host ' [OK] KISITLANDI' -ForegroundColor Green; Read-Host ' ...' }
function S19 { Write-Host ' [LLMNR] LLMNR KAPATILIYOR...' -ForegroundColor Yellow; New-Item "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Force -EA 0 | Out-Null; Set-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableMulticast" -Value 0; Write-Host ' [OK] ENGELLENDI' -ForegroundColor Green; Read-Host ' ...' }
function S20 { Write-Host ' [HIBERNATE] HIBERNATION DOSYASI SILINIYOR...' -ForegroundColor Yellow; powercfg /h off; Write-Host ' [OK] TEMIZLENDI' -ForegroundColor Green; Read-Host ' ...' }

# GRUP 3: WINDOWS DEFENDER
function S21 { Write-Host ' [SCAN] HIZLI TARAMA...' -ForegroundColor Yellow; Start-MpScan -ScanType QuickScan; Write-Host ' [OK] TAMAMLANDI' -ForegroundColor Green; Read-Host ' ...' }
function S22 { Write-Host ' [UPDATE] IMZA GUNCELLEME...' -ForegroundColor Yellow; Update-MpSignature; Write-Host ' [OK] GUNCEL' -ForegroundColor Green; Read-Host ' ...' }
function S23 { Write-Host ' [STATUS] KORUMA DURUMU...' -ForegroundColor Yellow; $d=Get-MpComputerStatus; Print-Data $d "AntivirusEnabled,RealTimeProtectionEnabled"; Read-Host ' ...' }
function S24 { Write-Host ' [HISTORY] TEHDIT GECMISI...' -ForegroundColor Yellow; $d=Get-MpThreatDetection; Print-Data $d; Read-Host ' ...' }
function S25 { Write-Host ' [EXCLUSIONS] DISLANANLAR...' -ForegroundColor Yellow; $d=Get-MpPreference | Select -ExpandProperty ExclusionPath; if($d){$d}else{Write-Host " [!] LISTE BOS" -Red}; Read-Host ' ...' }
function S26 { Write-Host ' [MAPS] BULUT KORUMASI...' -ForegroundColor Yellow; Set-MpPreference -MAPSReporting Advanced; Write-Host ' [OK] AKTIF' -ForegroundColor Green; Read-Host ' ...' }
function S27 { Write-Host ' [PUA] PUA KORUMASI...' -ForegroundColor Yellow; Set-MpPreference -PUAProtection Enabled; Write-Host ' [OK] AKTIF' -ForegroundColor Green; Read-Host ' ...' }
function S28 { Write-Host ' [BOOT] BOOT TARAMASI...' -ForegroundColor Yellow; Start-MpScan -ScanType CustomScan -ScanPath "C:\"; Write-Host ' [OK] TAMAMLANDI' -ForegroundColor Green; Read-Host ' ...' }
function S29 { Write-Host ' [TAMPER] TAMPER KORUMASI...' -ForegroundColor Yellow; $d=Get-MpComputerStatus | Select IsTamperProtected; Print-Data $d; Read-Host ' ...' }
function S30 { Write-Host ' [FULL] TAM TARAMA...' -ForegroundColor Red; $k=Read-Host ' E/H'; if($k -eq 'E'){Start-MpScan -ScanType FullScan}; Read-Host ' ...' }

# GRUP 4: FIREWALL & AG
function S31 { Write-Host ' [FW] FIREWALL DURUMU...' -ForegroundColor Yellow; $d=Get-NetFirewallProfile; Print-Data $d "Name,Enabled"; Read-Host ' ...' }
function S32 { Write-Host ' [FW ON] FIREWALL ACILIYOR...' -ForegroundColor Yellow; Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True; Write-Host ' [OK] AKTIF' -ForegroundColor Green; Read-Host ' ...' }
function S33 { Write-Host ' [BLOCK] GELEN BAGLANTI ENGELI...' -ForegroundColor Yellow; Set-NetFirewallProfile -Profile Public -DefaultInboundAction Block; Write-Host ' [OK] ENGELLENDI' -ForegroundColor Green; Read-Host ' ...' }
function S34 { Write-Host ' [PORTS] DINLEYEN PORTLAR...' -ForegroundColor Yellow; $d=Get-NetTCPConnection -State Listen | Select LocalPort,OwningProcess | Sort LocalPort -Unique; Print-Data $d; Read-Host ' ...' }
function S35 { Write-Host ' [RULES] AKTIF KURALLAR...' -ForegroundColor Yellow; $d=Get-NetFirewallRule | Where Enabled -eq True | Select -First 10 DisplayName,Direction,Action; Print-Data $d; Read-Host ' ...' }
function S36 { Write-Host ' [RESET] FIREWALL SIFIRLAMA...' -ForegroundColor Yellow; netsh advfirewall reset; Write-Host ' [OK] SIFIRLANDI' -ForegroundColor Green; Read-Host ' ...' }
function S37 { Write-Host ' [PING] PING ENGELLEME...' -ForegroundColor Yellow; New-NetFirewallRule -DisplayName "Block Ping" -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -Action Block; Write-Host ' [OK] PING KAPALI' -ForegroundColor Green; Read-Host ' ...' }
function S38 { Write-Host ' [ARP] ARP TABLOSU...' -ForegroundColor Yellow; arp -a; Read-Host ' ...' }
function S39 { Write-Host ' [HOSTS] HOSTS DOSYASI...' -ForegroundColor Yellow; Get-Content C:\Windows\System32\drivers\etc\hosts | Where {$_ -notmatch '^#' -and $_ -ne ""}; Read-Host ' ...' }
function S40 { Write-Host ' [DNS] DNS ONBELLEGI...' -ForegroundColor Yellow; $d=Get-DnsClientCache | Select -First 10 Entry,Data; Print-Data $d; Read-Host ' ...' }

# GRUP 5: LOG & FORENSIC
function S41 { Write-Host ' [FAIL] BASARISIZ GIRIS LOGLARI...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Security -InstanceId 4625 -Newest 10 -EA SilentlyContinue; Print-Data $d "TimeGenerated,Message"; Read-Host ' ...' }
function S42 { Write-Host ' [LOGON] BASARILI GIRISLER...' -ForegroundColor Yellow; $d=Get-EventLog -LogName Security -InstanceId 4624 -Newest 10 -EA SilentlyContinue; Print-Data $d "TimeGenerated,EntryType"; Read-Host ' ...' }
function S43 { 
    Write-Host ' [USB] USB GECMISI TARANIYOR...' -ForegroundColor Yellow; 
    # USB Registry Fix: Derinlemesine Tarama
    $usbList = @()
    try {
        $path = "HKLM:\SYSTEM\CurrentControlSet\Enum\USBSTOR"
        if (Test-Path $path) {
            $devices = Get-ChildItem $path
            foreach ($dev in $devices) {
                $subs = Get-ChildItem $dev.PSPath
                foreach ($sub in $subs) {
                    $props = Get-ItemProperty $sub.PSPath
                    if ($props.FriendlyName) {
                        $usbList += [PSCustomObject]@{
                            Cihaz = $props.FriendlyName
                            Zaman = $sub.Name
                        }
                    }
                }
            }
        }
    } catch {}
    Print-Data $usbList
    Read-Host ' ...' 
}
function S44 { 
    Write-Host ' [STARTUP] BASLANGIC OGELERI...' -ForegroundColor Yellow; 
    $list = @()
    # WMI Yontemi
    $wmi = Get-CimInstance Win32_StartupCommand | Select Name,Command,Location
    if ($wmi) { $list += $wmi }
    # Registry Yontemi (Manual Check)
    $reg = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Run
    if ($reg) {
        foreach ($p in $reg.PSObject.Properties) {
            if ($p.Name -ne "PSPath" -and $p.Name -ne "PSParentPath" -and $p.Name -ne "PSChildName" -and $p.Name -ne "PSDrive" -and $p.Name -ne "PSProvider") {
               $list += [PSCustomObject]@{Name=$p.Name; Command=$p.Value; Location="HKLM_Run"}
            }
        }
    }
    Print-Data $list "Name,Command,Location"
    Read-Host ' ...' 
}
function S45 { Write-Host ' [HISTORY] POWERSHELL KOMUTLARI...' -ForegroundColor Yellow; $d=Get-History | Select CommandLine; Print-Data $d; Read-Host ' ...' }
function S46 { Write-Host ' [SERVICE] SERVISLER (TUMU)...' -ForegroundColor Yellow; $d=Get-Service | Where Status -eq 'Running' | Select -First 15 Name,DisplayName; Print-Data $d; Read-Host ' ...' }
function S47 { Write-Host ' [INSTALL] YUKLEMELER...' -ForegroundColor Yellow; $d=Get-ItemProperty HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* | Select DisplayName,InstallDate | Sort InstallDate -Descending | Select -First 10; Print-Data $d; Read-Host ' ...' }
function S48 { Write-Host ' [SHUTDOWN] KAPANIS LOGLARI...' -ForegroundColor Yellow; $d=Get-EventLog -LogName System -InstanceId 1074 -Newest 5 -EA SilentlyContinue | Select TimeGenerated,Message; Print-Data $d; Read-Host ' ...' }
function S49 { Write-Host ' [WIFI] WIFI PROFILLERI...' -ForegroundColor Yellow; netsh wlan show profiles; Read-Host ' ...' }
function S50 { Write-Host ' [SHARE] PAYLASIMLAR...' -ForegroundColor Yellow; $d=Get-SmbShare; Print-Data $d "Name,Path"; Read-Host ' ...' }

# GRUP 6: ARACLAR
function S51 { Write-Host ' [HASH] DOSYA SHA256...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; if(Test-Path $f){Get-FileHash $f -Algorithm SHA256|Format-List}else{Write-Host " BULUNAMADI" -ForegroundColor Red}; Read-Host ' ...' }
function S52 { Write-Host ' [GEN] SIFRE URETILIYOR...' -ForegroundColor Yellow; Add-Type -AssemblyName System.Web; $p=[System.Web.Security.Membership]::GeneratePassword(16,2); Write-Host " SIFRE: $p" -ForegroundColor Green; Read-Host ' ...' }
function S53 { Write-Host ' [WIPE] GUVENLI SILME (CIPHER)...' -ForegroundColor Red; $k=Read-Host ' E/H'; if($k -eq 'E'){cipher /w:C:} Read-Host ' ...' }
function S54 { Write-Host ' [LOCK] KLASOR KILITLEME...' -ForegroundColor Yellow; $f=Read-Host ' Klasor'; if(Test-Path $f){icacls $f /deny Everyone:F; Write-Host ' KILITLENDI' -ForegroundColor Green} Read-Host ' ...' }
function S55 { Write-Host ' [UNLOCK] KLASOR ACMA...' -ForegroundColor Yellow; $f=Read-Host ' Klasor'; if(Test-Path $f){icacls $f /reset; Write-Host ' ACILDI' -ForegroundColor Green} Read-Host ' ...' }
function S56 { Write-Host ' [KILL] ISLEM OLDURME...' -ForegroundColor Yellow; $n=Read-Host ' Islem Adi'; Stop-Process -Name $n -Force -EA SilentlyContinue; Write-Host ' ISLEM TAMAM' -ForegroundColor Green; Read-Host ' ...' }
function S57 { Write-Host ' [HOSTS] SITE ENGELLEME...' -ForegroundColor Yellow; $d=Read-Host ' Domain'; Add-Content C:\Windows\System32\drivers\etc\hosts "127.0.0.1 $d"; Write-Host ' ENGELLENDI' -ForegroundColor Green; Read-Host ' ...' }
function S58 { Write-Host ' [IP] IP ENGELLEME...' -ForegroundColor Yellow; $i=Read-Host ' IP'; New-NetFirewallRule -DisplayName "Block $i" -Direction Inbound -Action Block -RemoteAddress $i; Write-Host ' ENGELLENDI' -ForegroundColor Green; Read-Host ' ...' }
function S59 { Write-Host ' [SNAP] EKRAN ALINTISI...' -ForegroundColor Yellow; SnippingTool.exe; Read-Host ' ...' }
function S60 { Write-Host ' [EXIT] KAPATILIYOR...' -ForegroundColor Red; Exit }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [HESAP & ERISIM]       [SIKILASTIRMA (HARD)]  [DEFENDER & AV]        [FIREWALL & AG]" -ForegroundColor Yellow
        Write-Host "   01. ADMIN HESAPLARI    11. SMBv1 KAPAT        21. HIZLI TARAMA       31. FW DURUMU" -ForegroundColor White
        Write-Host "   02. GUEST DURUMU       12. UZAK KAYIT KAPAT   22. IMZA GUNCELLE      32. FW AKTIF ET" -ForegroundColor White
        Write-Host "   03. KULLANICI LISTE    13. AUTORUN KAPAT      23. KORUMA DURUMU      33. DISARIDAN ENGEL" -ForegroundColor White
        Write-Host "   04. SIFRE POLITIKASI   14. UAC MAKSIMUM       24. TEHDIT GECMISI     34. DINLEYEN PORT" -ForegroundColor White
        Write-Host "   05. AKTIF OTURUMLAR    15. SCRIPT KISITLA     25. DISLANANLAR        35. AKTIF KURALLAR" -ForegroundColor White
        Write-Host "   06. GIZLI HESAPLAR     16. UZANTI GOSTER      26. BULUT KORUMA       36. FW SIFIRLA" -ForegroundColor White
        Write-Host "   07. YEREL GRUPLAR      17. RDP KAPAT          27. PUA KORUMASI       37. PING ENGELLE" -ForegroundColor White
        Write-Host "   08. RDP KULLANICILARI  18. ADMIN SHARE KAPAT  28. BOOT TARAMA        38. ARP KONTROL" -ForegroundColor White
        Write-Host "   09. OTO GIRIS KONTROL  19. LLMNR KAPAT        29. TAMPER KORUMA      39. HOSTS DOSYASI" -ForegroundColor White
        Write-Host "   10. SID BILGILERI      20. HIBERNATE SIL      30. TAM TARAMA         40. DNS CACHE" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [LOG & FORENSIC]       [ARACLAR & EKSTRA]" -ForegroundColor Yellow
        Write-Host "   41. HATALI GIRISLER    51. DOSYA HASHLE (SHA)" -ForegroundColor Cyan
        Write-Host "   42. BASARILI GIRISLER  52. SIFRE URETICI" -ForegroundColor Cyan
        Write-Host "   43. USB GECMISI        53. BOS ALANI SIL" -ForegroundColor Cyan
        Write-Host "   44. BASLANGIC OGELERI  54. KLASOR KILITLE" -ForegroundColor Cyan
        Write-Host "   45. KOMUT GECMISI      55. KILIT AC" -ForegroundColor Cyan
        Write-Host "   46. SERVIS TARAMA      56. ISLEM OLDUR" -ForegroundColor Cyan
        Write-Host "   47. YUKLEME TARIHLERI  57. SITE ENGELLE" -ForegroundColor Cyan
        Write-Host "   48. KAPANIS NEDENLERI  58. IP ENGELLE" -ForegroundColor Cyan
        Write-Host "   49. WIFI PROFILLERI    59. EKRAN ALINTISI" -ForegroundColor Cyan
        Write-Host "   50. PAYLASIMLAR        60. CIKIS YAP" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        if ($c -eq 'Q' -or $c -eq 'q') { S60 }
        
        switch ($c) {
            '1' {S01} '11' {S11} '21' {S21} '31' {S31} '41' {S41} '51' {S51}
            '01' {S01} '12' {S12} '22' {S22} '32' {S32} '42' {S42} '52' {S52}
            '2' {S02} '13' {S13} '23' {S23} '33' {S33} '43' {S43} '53' {S53}
            '02' {S02} '14' {S14} '24' {S24} '34' {S34} '44' {S44} '54' {S54}
            '3' {S03} '15' {S15} '25' {S25} '35' {S35} '45' {S45} '55' {S55}
            '03' {S03} '16' {S16} '26' {S26} '36' {S36} '46' {S46} '56' {S56}
            '4' {S04} '17' {S17} '27' {S27} '37' {S37} '47' {S47} '57' {S57}
            '04' {S04} '18' {S18} '28' {S28} '38' {S38} '48' {S48} '58' {S58}
            '5' {S05} '19' {S19} '29' {S29} '39' {S39} '49' {S49} '59' {S59}
            '05' {S05} '20' {S20} '30' {S30} '40' {S40} '50' {S50} '60' {S60}
            '6' {S06}
            '06' {S06}
            '7' {S07}
            '07' {S07}
            '8' {S08}
            '08' {S08}
            '9' {S09}
            '09' {S09}
            '10' {S10}
        }
    }
}

Main-Loop