<#
.SYNOPSIS
    PixUser v1.0 - TITAN USER MANAGER
    Developer: Omer Cataloglu
.DESCRIPTION
    Advanced User, Group and Policy Management Suite.
    60 Tools: Account Control, Password Policy, Session Manager.
    Safe ASCII. Safe Turkish. Fixed Colors.
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
$Host.UI.RawUI.WindowTitle = 'PixUser v1.0 | TITAN USER MANAGER'
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
    for ($i=0; $i -lt 10; $i++) {
        Write-Host '|' -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 5
    }
    Write-Host '] OK' -ForegroundColor Green
    Start-Sleep -Milliseconds 10
}

# YARDIMCI: Veri Yazdirma
function Print-Data {
    param($Data, $Props)
    if ($Data) {
        if ($Props) { $Data | Select-Object $Props | Format-Table -AutoSize | Out-String | Write-Host }
        else { $Data | Format-Table -AutoSize | Out-String | Write-Host }
    } else {
        Write-Host " [!] LISTE BOS / VERI YOK" -ForegroundColor Red
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
    Write-Host ' PIXTOOL USER MANAGEMENT KERNEL v1.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('ACCOUNT ENGINE', 'GROUP POLICY', 'SESSION MANAGER', 'AUDIT LOGS', 'SECURITY LAYER')
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
    Write-Host ' PIXUSER v1.0 - TITAN USER MANAGER (60 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# --- 3. KULLANICI ARACLARI (60 ADET) ---

# GRUP 1: TEMEL KULLANICI ISLEMLERI
function U01 { Write-Host ' [LIST] TUM KULLANICILARI LISTELE...' -ForegroundColor Yellow; $d=Get-LocalUser; Print-Data $d "Name,Enabled,LastLogon"; Read-Host ' ...' }
function U02 { Write-Host ' [ADD] YENI KULLANICI OLUSTUR...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici Adi'; $p=Read-Host -AsSecureString ' Sifre'; New-LocalUser -Name $u -Password $p -FullName "$u (PixUser)" -Description "PixUser ile olusturuldu"; Write-Host " [OK] $u OLUSTURULDU" -ForegroundColor Green; Read-Host ' ...' }
function U03 { Write-Host ' [DEL] KULLANICI SIL...' -ForegroundColor Red; $u=Read-Host ' Silinecek Kullanici'; Remove-LocalUser -Name $u; Write-Host " [OK] $u SILINDI" -ForegroundColor Green; Read-Host ' ...' }
function U04 { Write-Host ' [PASS] SIFRE SIFIRLA...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici Adi'; $p=Read-Host -AsSecureString ' Yeni Sifre'; Set-LocalUser -Name $u -Password $p; Write-Host " [OK] SIFRE DEGISTI" -ForegroundColor Green; Read-Host ' ...' }
function U05 { Write-Host ' [ENABLE] HESABI AKTIF ET...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici Adi'; Enable-LocalUser -Name $u; Write-Host " [OK] HESAP ACILDI" -ForegroundColor Green; Read-Host ' ...' }
function U06 { Write-Host ' [DISABLE] HESABI DEVRE DISI BIRAK...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici Adi'; Disable-LocalUser -Name $u; Write-Host " [OK] HESAP KAPATILDI" -ForegroundColor Green; Read-Host ' ...' }
function U07 { Write-Host ' [RENAME] KULLANICI ADINI DEGISTIR...' -ForegroundColor Yellow; $old=Read-Host ' Eski Isim'; $new=Read-Host ' Yeni Isim'; Rename-LocalUser -Name $old -NewName $new; Write-Host " [OK] $old -> $new" -ForegroundColor Green; Read-Host ' ...' }
function U08 { Write-Host ' [DESC] ACIKLAMA EKLE...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; $d=Read-Host ' Aciklama'; Set-LocalUser -Name $u -Description $d; Write-Host " [OK] GUNCELLENDI" -ForegroundColor Green; Read-Host ' ...' }
function U09 { Write-Host ' [FULLNAME] TAM ISIM DEGISTIR...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; $f=Read-Host ' Tam Isim'; Set-LocalUser -Name $u -FullName $f; Write-Host " [OK] GUNCELLENDI" -ForegroundColor Green; Read-Host ' ...' }
function U10 { Write-Host ' [DETAILS] DETAYLI BILGI...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Get-LocalUser -Name $u | Select *; Read-Host ' ...' }

# GRUP 2: GRUP YONETIMI
function U11 { Write-Host ' [GROUPS] GRUPLARI LISTELE...' -ForegroundColor Yellow; $d=Get-LocalGroup; Print-Data $d "Name,Description"; Read-Host ' ...' }
function U12 { Write-Host ' [MEMBERS] GRUP UYELERINI GOR...' -ForegroundColor Yellow; $g=Read-Host ' Grup Adi (Orn: Administrators)'; $d=Get-LocalGroupMember -Group $g; Print-Data $d "Name,ObjectClass"; Read-Host ' ...' }
function U13 { Write-Host ' [ADD ADMIN] YONETICI YAP (ADMIN)...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici Adi'; Add-LocalGroupMember -Group "Administrators" -Member $u; Write-Host " [OK] $u ARTIK ADMIN" -ForegroundColor Green; Read-Host ' ...' }
function U14 { Write-Host ' [DEL ADMIN] YONETICILIKTEN CIKAR...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici Adi'; Remove-LocalGroupMember -Group "Administrators" -Member $u; Write-Host " [OK] YETKI ALINDI" -ForegroundColor Green; Read-Host ' ...' }
function U15 { Write-Host ' [ADD GROUP] GRUBA EKLE...' -ForegroundColor Yellow; $g=Read-Host ' Grup Adi'; $u=Read-Host ' Kullanici Adi'; Add-LocalGroupMember -Group $g -Member $u; Write-Host " [OK] EKLENDI" -ForegroundColor Green; Read-Host ' ...' }
function U16 { Write-Host ' [DEL GROUP] GRUPTAN CIKAR...' -ForegroundColor Yellow; $g=Read-Host ' Grup Adi'; $u=Read-Host ' Kullanici Adi'; Remove-LocalGroupMember -Group $g -Member $u; Write-Host " [OK] CIKARILDI" -ForegroundColor Green; Read-Host ' ...' }
function U17 { Write-Host ' [NEW GROUP] YENI GRUP OLUSTUR...' -ForegroundColor Yellow; $g=Read-Host ' Grup Adi'; New-LocalGroup -Name $g; Write-Host " [OK] GRUP OLUSTURULDU" -ForegroundColor Green; Read-Host ' ...' }
function U18 { Write-Host ' [RM GROUP] GRUP SIL...' -ForegroundColor Red; $g=Read-Host ' Grup Adi'; Remove-LocalGroup -Name $g; Write-Host " [OK] GRUP SILINDI" -ForegroundColor Green; Read-Host ' ...' }
function U19 { Write-Host ' [USER GROUPS] KULLANICININ GRUPLARI...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; net user $u | Select-String "Local Group Memberships"; Read-Host ' ...' }
function U20 { Write-Host ' [RDP GRP] RDP YETKISI VER...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Add-LocalGroupMember -Group "Remote Desktop Users" -Member $u; Write-Host " [OK] RDP YETKISI VERILDI" -ForegroundColor Green; Read-Host ' ...' }

# GRUP 3: POLITIKA VE GUVENLIK
function U21 { Write-Host ' [NO EXPIRE] SIFRE SURESINI SONSUZ YAP...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Set-LocalUser -Name $u -PasswordNeverExpires $true; Write-Host " [OK] SIFRE SULESIZ OLDU" -ForegroundColor Green; Read-Host ' ...' }
function U22 { Write-Host ' [EXPIRE] SIFRE SURESI DOLSUN...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Set-LocalUser -Name $u -PasswordNeverExpires $false; Write-Host " [OK] NORMALE DONDU" -ForegroundColor Green; Read-Host ' ...' }
function U23 { Write-Host ' [UNLOCK] KILITLI HESABI AC...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Unlock-LocalUser -Name $u; Write-Host " [OK] KILIT ACILDI" -ForegroundColor Green; Read-Host ' ...' }
function U24 { Write-Host ' [NO CHANGE] KULLANICI SIFRE DEGISTIREMESIN...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Set-LocalUser -Name $u -UserMayChangePassword $false; Write-Host " [OK] KISITLANDI" -ForegroundColor Green; Read-Host ' ...' }
function U25 { Write-Host ' [CAN CHANGE] SIFRE DEGISTIREBILSIN...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Set-LocalUser -Name $u -UserMayChangePassword $true; Write-Host " [OK] IZIN VERILDI" -ForegroundColor Green; Read-Host ' ...' }
function U26 { Write-Host ' [POLICY] SIFRE POLITIKASINI GOR...' -ForegroundColor Yellow; net accounts; Read-Host ' ...' }
function U27 { Write-Host ' [MIN LEN] MINIMUM SIFRE UZUNLUGU...' -ForegroundColor Yellow; $l=Read-Host ' Uzunluk (Orn: 8)'; net accounts /minpwlen:$l; Write-Host " [OK] AYARLANDI" -ForegroundColor Green; Read-Host ' ...' }
function U28 { Write-Host ' [MAX AGE] MAKSIMUM SIFRE YASI...' -ForegroundColor Yellow; $d=Read-Host ' Gun (Orn: 90)'; net accounts /maxpwage:$d; Write-Host " [OK] AYARLANDI" -ForegroundColor Green; Read-Host ' ...' }
function U29 { Write-Host ' [LOCKOUT] KILITLENME ESIGI...' -ForegroundColor Yellow; $c=Read-Host ' Deneme Sayisi (Orn: 5)'; net accounts /lockoutthreshold:$c; Write-Host " [OK] AYARLANDI" -ForegroundColor Green; Read-Host ' ...' }
function U30 { Write-Host ' [UNLOCK TIME] KILIT SURESI...' -ForegroundColor Yellow; $m=Read-Host ' Dakika (Orn: 30)'; net accounts /lockoutduration:$m; Write-Host " [OK] AYARLANDI" -ForegroundColor Green; Read-Host ' ...' }

# GRUP 4: SISTEM HESAPLARI
function U31 { Write-Host ' [ADMIN ON] GIZLI ADMIN HESABINI AC...' -ForegroundColor Red; Enable-LocalUser -Name "Administrator"; Write-Host " [UYARI] ADMINISTRATOR ACILDI" -ForegroundColor Yellow; Read-Host ' ...' }
function U32 { Write-Host ' [ADMIN OFF] GIZLI ADMIN HESABINI KAPAT...' -ForegroundColor Yellow; Disable-LocalUser -Name "Administrator"; Write-Host " [OK] GUVENDE" -ForegroundColor Green; Read-Host ' ...' }
function U33 { Write-Host ' [GUEST ON] GUEST HESABINI AC...' -ForegroundColor Yellow; Enable-LocalUser -Name "Guest"; Write-Host " [OK] ACILDI" -ForegroundColor Green; Read-Host ' ...' }
function U34 { Write-Host ' [GUEST OFF] GUEST HESABINI KAPAT...' -ForegroundColor Yellow; Disable-LocalUser -Name "Guest"; Write-Host " [OK] KAPATILDI" -ForegroundColor Green; Read-Host ' ...' }
function U35 { Write-Host ' [WHOAMI] SU ANKI KULLANICI...' -ForegroundColor Yellow; whoami /all; Read-Host ' ...' }
function U36 { Write-Host ' [SID] HESAP SID BUL...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; (Get-LocalUser -Name $u).SID; Read-Host ' ...' }
function U37 { Write-Host ' [PROFILE] PROFIL YOLUNU BUL...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; Get-WmiObject Win32_UserProfile | Where {$_.LocalPath -like "*$u*"} | Select LocalPath; Read-Host ' ...' }
function U38 { Write-Host ' [DEL PROF] KULLANICI PROFILINI SIL (DISK)...' -ForegroundColor Red; $u=Read-Host ' Kullanici'; Get-WmiObject Win32_UserProfile | Where {$_.LocalPath -like "*$u*"} | Remove-WmiObject; Write-Host " [OK] PROFIL SILINDI" -ForegroundColor Green; Read-Host ' ...' }
function U39 { Write-Host ' [AUTO LOGIN] OTO GIRIS AYARLARI...' -ForegroundColor Yellow; control userpasswords2; Read-Host ' ...' }
function U40 { Write-Host ' [UAC LEVEL] UAC AYARLARI...' -ForegroundColor Yellow; UserAccountControlSettings.exe; Read-Host ' ...' }

# GRUP 5: OTURUM & SESSION
function U41 { Write-Host ' [SESSIONS] AKTIF OTURUMLAR (QUSER)...' -ForegroundColor Yellow; quser 2>$null; Read-Host ' ...' }
function U42 { Write-Host ' [MSG] KULLANICIYA MESAJ GONDER...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici (* = Tum)'; $m=Read-Host ' Mesaj'; msg $u $m; Write-Host " [OK] GONDERILDI" -ForegroundColor Green; Read-Host ' ...' }
function U43 { Write-Host ' [LOGOFF] KULLANICIYI ATTIR (LOGOFF)...' -ForegroundColor Red; $id=Read-Host ' Oturum ID (Quser''dan bakin)'; logoff $id; Write-Host " [OK] ATILDI" -ForegroundColor Green; Read-Host ' ...' }
function U44 { Write-Host ' [LOCK] EKRANI KILITLE...' -ForegroundColor Yellow; rundll32.exe user32.dll,LockWorkStation; }
function U45 { Write-Host ' [SIGN OUT] OTURUMU KAPAT...' -ForegroundColor Red; logoff; }
function U46 { Write-Host ' [CURRENT] MEVCUT KULLANICI DETAY...' -ForegroundColor Yellow; [System.Security.Principal.WindowsIdentity]::GetCurrent().Name; Read-Host ' ...' }
function U47 { Write-Host ' [STARTUP] BASLANGIC KLASORUNU AC...' -ForegroundColor Yellow; Invoke-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"; Read-Host ' ...' }
function U48 { Write-Host ' [TEMP] KULLANICI TEMP KLASORU...' -ForegroundColor Yellow; Invoke-Item $env:TEMP; Read-Host ' ...' }
function U49 { Write-Host ' [DOCS] BELGELER KLASORU...' -ForegroundColor Yellow; Invoke-Item ([Environment]::GetFolderPath("MyDocuments")); Read-Host ' ...' }
function U50 { Write-Host ' [DESK] MASAUSTU KLASORU...' -ForegroundColor Yellow; Invoke-Item ([Environment]::GetFolderPath("Desktop")); Read-Host ' ...' }

# GRUP 6: LOG & EKSTRA
function U51 { Write-Host ' [LAST LOGON] SON GIRIS ZAMANLARI...' -ForegroundColor Yellow; Get-LocalUser | Select Name,LastLogon; Read-Host ' ...' }
function U52 { Write-Host ' [FAILED] HATALI GIRISLER (LOG)...' -ForegroundColor Yellow; Get-EventLog -LogName Security -InstanceId 4625 -Newest 5 | Select TimeGenerated,Message; Read-Host ' ...' }
function U53 { Write-Host ' [SUCCESS] BASARILI GIRISLER (LOG)...' -ForegroundColor Yellow; Get-EventLog -LogName Security -InstanceId 4624 -Newest 5 | Select TimeGenerated; Read-Host ' ...' }
function U54 { Write-Host ' [CREATED] OLUSTURULMA TARIHLERI (TAHMINI)...' -ForegroundColor Yellow; Get-WmiObject Win32_UserAccount | Select Name,InstallDate; Read-Host ' ...' }
function U55 { Write-Host ' [OWNER] DOSYA SAHIBINI DEGISTIR...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; takeown /f $f; Write-Host " [OK] SAHIPLIK ALINDI" -ForegroundColor Green; Read-Host ' ...' }
function U56 { Write-Host ' [ACL] DOSYA IZINLERINI GOR...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Get-Acl $f | Select -ExpandProperty Access; Read-Host ' ...' }
function U57 { Write-Host ' [CRED] KAYITLI KIMLIK BILGILERI...' -ForegroundColor Yellow; cmdkey /list; Read-Host ' ...' }
function U58 { Write-Host ' [RUNAS] FARKLI KULLANICI ILE CALISTIR...' -ForegroundColor Yellow; $u=Read-Host ' Kullanici'; $p=Read-Host ' Program (cmd)'; runas /user:$u $p; Read-Host ' ...' }
function U59 { Write-Host ' [ENV] KULLANICI ORTAM DEGISKENLERI...' -ForegroundColor Yellow; Get-ChildItem env: | Select -First 10; Read-Host ' ...' }
function U60 { Write-Host ' [EXIT] CIKIS YAPILIYOR...' -ForegroundColor Red; Exit }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [HESAP ISLEMLERI]      [GRUP YONETIMI]        [POLITIKA & GUVENLIK]  [SISTEM HESAPLARI]" -ForegroundColor Yellow
        Write-Host "   01. KULLANICI LISTE    11. GRUP LISTESI       21. SIFRE SURESIZ YAP  31. ADMINI AC (ON)" -ForegroundColor White
        Write-Host "   02. YENI KULLANICI     12. GRUP UYELERI       22. SIFRE SURELI YAP   32. ADMINI KAPAT" -ForegroundColor White
        Write-Host "   03. KULLANICI SIL      13. ADMIN YAP          23. KILITLI HESABI AC  33. GUEST HESABI AC" -ForegroundColor White
        Write-Host "   04. SIFRE SIFIRLA      14. ADMINDEN CIKAR     24. SIFRE DEG. ENGEL   34. GUEST KAPAT" -ForegroundColor White
        Write-Host "   05. HESABI AKTIF ET    15. GRUBA EKLE         25. SIFRE DEG. IZIN    35. WHOAMI DETAY" -ForegroundColor White
        Write-Host "   06. HESABI KAPAT       16. GRUPTAN CIKAR      26. SIFRE POLITIKASI   36. SID OGREN" -ForegroundColor White
        Write-Host "   07. ISIM DEGISTIR      17. YENI GRUP EKLE     27. MIN SIFRE UZUNLUK  37. PROFIL YOLU" -ForegroundColor White
        Write-Host "   08. ACIKLAMA EKLE      18. GRUP SIL           28. MAX SIFRE YASI     38. PROFILI SIL" -ForegroundColor White
        Write-Host "   09. TAM ISIM DEGISTIR  19. UYE GRUPLARI       29. KILITLENME ESIGI   39. OTO GIRIS AYARI" -ForegroundColor White
        Write-Host "   10. HESAP DETAYLARI    20. RDP YETKISI VER    30. KILIT SURESI       40. UAC AYARLARI" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [OTURUM & SESSION]     [LOG & EKSTRA]" -ForegroundColor Yellow
        Write-Host "   41. AKTIF OTURUMLAR    51. SON GIRISLER" -ForegroundColor Cyan
        Write-Host "   42. MESAJ GONDER       52. HATALI GIRISLER" -ForegroundColor Cyan
        Write-Host "   43. ZORLA CIKIS (KICK) 53. BASARILI GIRISLER" -ForegroundColor Cyan
        Write-Host "   44. EKRANI KILITLE     54. OLUSTURMA TARIHI" -ForegroundColor Cyan
        Write-Host "   45. OTURUMU KAPAT      55. SAHIPLIK AL" -ForegroundColor Cyan
        Write-Host "   46. MEVCUT KULLANICI   56. DOSYA IZINLERI" -ForegroundColor Cyan
        Write-Host "   47. STARTUP KLASORU    57. KAYITLI KIMLIKLER" -ForegroundColor Cyan
        Write-Host "   48. TEMP KLASORU       58. RUNAS (FARKLI)" -ForegroundColor Cyan
        Write-Host "   49. BELGELERIM         59. ORTAM DEGISKENLERI" -ForegroundColor Cyan
        Write-Host "   50. MASAUSTU           60. CIKIS YAP" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        if ($c -eq 'Q' -or $c -eq 'q') { U60 }
        
        switch ($c) {
            '1' {U01} '11' {U11} '21' {U21} '31' {U31} '41' {U41} '51' {U51}
            '01' {U01} '12' {U12} '22' {U22} '32' {U32} '42' {U42} '52' {U52}
            '2' {U02} '13' {U13} '23' {U23} '33' {U33} '43' {U43} '53' {U53}
            '02' {U02} '14' {U14} '24' {U24} '34' {U34} '44' {U44} '54' {U54}
            '3' {U03} '15' {U15} '25' {U25} '35' {U35} '45' {U45} '55' {U55}
            '03' {U03} '16' {U16} '26' {U26} '36' {U36} '46' {U46} '56' {U56}
            '4' {U04} '17' {U17} '27' {U27} '37' {U37} '47' {U47} '57' {U57}
            '04' {U04} '18' {U18} '28' {U28} '38' {U38} '48' {U48} '58' {U58}
            '5' {U05} '19' {U19} '29' {U29} '39' {U39} '49' {U49} '59' {U59}
            '05' {U05} '20' {U20} '30' {U30} '40' {U40} '50' {U50} '60' {U60}
            '6' {U06}
            '06' {U06}
            '7' {U07}
            '07' {U07}
            '8' {U08}
            '08' {U08}
            '9' {U09}
            '09' {U09}
            '10' {U10}
        }
    }
}

Main-Loop