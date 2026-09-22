<#
.SYNOPSIS
    PixDriver v2.0 - TITAN HARDWARE MANAGER (REFORGED)
    Developer: Omer Cataloglu
.DESCRIPTION
    Advanced Driver and Device Management Suite.
    FIXED: Get-PnpDevice empty query errors suppressed.
    FIXED: "Disabled" device filter logic (Error Code 22).
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
$Host.UI.RawUI.WindowTitle = 'PixDriver v2.0 | TITAN HARDWARE MANAGER'
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

# GARANTILI VERI YAZDIRMA MOTORU
function Print-Data {
    param($Data, $Props)
    
    Write-Host ""
    if ($Data) {
        # Tekil objeyi diziye cevir
        if ($Data -isnot [array]) { $Data = @($Data) }

        if ($Data.Count -gt 0) {
            if ($Props) {
                # String Array Split Fix
                $PropArray = $Props -split "," | ForEach-Object { $_.Trim() }
                $Data | Select-Object $PropArray | Format-Table -AutoSize -Wrap | Out-Host
            } else {
                $Data | Format-Table -AutoSize -Wrap | Out-Host
            }
            Write-Host " [BILGI] TOPLAM KAYIT: $($Data.Count)" -ForegroundColor Green
        } else {
            Write-Host " [!] LISTE BOS (Kriterlere uygun cihaz yok)." -ForegroundColor Yellow
        }
    } else {
        Write-Host " [!] VERI BULUNAMADI (Sistem temiz veya cihaz yok)." -ForegroundColor Green
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
    Write-Host ' PIXTOOL DRIVER KERNEL v2.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('PNP MANAGER', 'DRIVER STORE', 'BACKUP ENGINE', 'DEVICE FILTER', 'HARDWARE PROBE')
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
    Write-Host ' PIXDRIVER v2.0 - TITAN HARDWARE MANAGER (60 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# --- 3. SURUCU ARACLARI (TAMIR EDILMIS) ---

# GRUP 1: GENEL DURUM & LISTELEME
function D01 { Write-Host ' [ALL] TUM AYGITLARI LISTELE (UZUN)...' -ForegroundColor Yellow; $d=Get-PnpDevice -EA SilentlyContinue; Print-Data $d "FriendlyName,Status,Class"; Read-Host ' ...' }
function D02 { Write-Host ' [ACTIVE] AKTIF AYGITLAR (OK)...' -ForegroundColor Yellow; $d=Get-PnpDevice -Status OK -EA SilentlyContinue; Print-Data $d "FriendlyName,Class"; Read-Host ' ...' }
function D03 { Write-Host ' [ERROR] SORUNLU AYGITLAR (ERROR)...' -ForegroundColor Red; $d=Get-PnpDevice -Status Error -EA SilentlyContinue; Print-Data $d "FriendlyName,InstanceId"; Read-Host ' ...' }
function D04 { Write-Host ' [UNKNOWN] BILINMEYEN AYGITLAR...' -ForegroundColor Yellow; $d=Get-PnpDevice -Status Unknown -EA SilentlyContinue; Print-Data $d "InstanceId,Class"; Read-Host ' ...' }
function D05 { Write-Host ' [DEGRADED] BOZULMUS AYGITLAR...' -ForegroundColor Red; $d=Get-PnpDevice -Status Degraded -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D06 { 
    Write-Host ' [DISABLED] DEVRE DISI AYGITLAR...' -ForegroundColor Yellow; 
    # FIX: Get-PnpDevice "Disabled" statusu yoktur. ErrorCode 22 olanlar Disabled'dir.
    $d = Get-PnpDevice -EA SilentlyContinue | Where-Object { $_.ConfigManagerErrorCode -eq 22 }
    Print-Data $d "FriendlyName,Status,Class"
    Read-Host ' ...' 
}
function D07 { Write-Host ' [PRESENT] SU AN TAKILI OLANLAR...' -ForegroundColor Yellow; $d=Get-PnpDevice -PresentOnly -EA SilentlyContinue; Print-Data $d "FriendlyName,Class"; Read-Host ' ...' }
function D08 { Write-Host ' [GHOST] HAYALET AYGITLAR (TAKILI DEGIL)...' -ForegroundColor Yellow; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.Present -eq $false}; Print-Data $d "FriendlyName,Class"; Read-Host ' ...' }
function D09 { Write-Host ' [STARTED] BASLATILMIS SERVIS SURUCULERI...' -ForegroundColor Yellow; $d=Get-WmiObject Win32_SystemDriver -EA SilentlyContinue | Where-Object {$_.State -eq 'Running'}; Print-Data $d "Name,DisplayName,State"; Read-Host ' ...' }
function D10 { Write-Host ' [STOPPED] DURMUS SERVIS SURUCULERI...' -ForegroundColor Yellow; $d=Get-WmiObject Win32_SystemDriver -EA SilentlyContinue | Where-Object {$_.State -eq 'Stopped'}; Print-Data $d "Name,DisplayName,State"; Read-Host ' ...' }

# GRUP 2: KATEGORIK LISTELEME
function D11 { Write-Host ' [USB] USB AYGITLARI...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class USB -EA SilentlyContinue; Print-Data $d "FriendlyName,Status,InstanceId"; Read-Host ' ...' }
function D12 { Write-Host ' [NET] AG ADAPTERLERI...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class Net -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D13 { Write-Host ' [DISPLAY] EKRAN KARTLARI...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class Display -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D14 { Write-Host ' [AUDIO] SES AYGITLARI...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class Media -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D15 { Write-Host ' [BLUETOOTH] BLUETOOTH AYGITLARI...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class Bluetooth -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D16 { Write-Host ' [PRINT] YAZICI KUYRUKLARI...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class PrintQueue -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D17 { Write-Host ' [DISK] DISK SURUCULERI...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class DiskDrive -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D18 { Write-Host ' [CAMERA] KAMERALAR...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class Camera -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D19 { Write-Host ' [PROCESSOR] ISLEMCILER...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class Processor -EA SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D20 { Write-Host ' [HID] INSAN ARAYUZ AYGITLARI (Klavye/Mouse)...' -ForegroundColor Yellow; $d=Get-PnpDevice -Class HIDClass -EA SilentlyContinue | Select-Object -First 20; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }

# GRUP 3: YONETIM & YEDEKLEME
function D21 { 
    Write-Host ' [BACKUP] TUM SURUCULERI YEDEKLE (EXPORT)...' -ForegroundColor Yellow; 
    $path = "$([Environment]::GetFolderPath('Desktop'))\DriverBackup"
    New-Item -Path $path -ItemType Directory -Force | Out-Null
    Write-Host " Yedekleniyor: $path (Bu islem surebilir)..." -ForegroundColor Cyan
    try {
        Export-WindowsDriver -Online -Destination $path -ErrorAction Stop
        Write-Host " [OK] ISLEM TAMAMLANDI" -ForegroundColor Green
    } catch {
        Write-Host " [!] YEDEKLEME HATASI: $($_.Exception.Message)" -ForegroundColor Red
    }
    Read-Host ' ...' 
}
function D22 { 
    Write-Host ' [LIST STORE] SURUCU DEPOSUNU LISTELE (OEM)...' -ForegroundColor Yellow; 
    Write-Host " Veriler cekiliyor (Get-WindowsDriver)..." -ForegroundColor Gray
    try {
        $d = Get-WindowsDriver -Online -All -ErrorAction SilentlyContinue
        Print-Data $d "OriginalFileName,Version,ProviderName,ClassName"
    } catch { Write-Host " [!] HATA" -ForegroundColor Red }
    Read-Host ' ...' 
}
function D23 { Write-Host ' [ENABLE] AYGITI ETKINLESTIR (INTERAKTIF)...' -ForegroundColor Yellow; $n=Read-Host ' Aygit Adi (Ara)'; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.FriendlyName -like "*$n*"}; if($d){$d|Format-Table -AutoSize|Out-Host;$i=Read-Host ' InstanceID'; Enable-PnpDevice -InstanceId $i -Confirm:$false -EA SilentlyContinue; Write-Host ' [OK] ISLEM YAPILDI' -ForegroundColor Green}else{Write-Host ' [!] BULUNAMADI'-ForegroundColor Red}; Read-Host ' ...' }
function D24 { Write-Host ' [DISABLE] AYGITI DEVRE DISI BIRAK (INTERAKTIF)...' -ForegroundColor Red; $n=Read-Host ' Aygit Adi (Ara)'; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.FriendlyName -like "*$n*"}; if($d){$d|Format-Table -AutoSize|Out-Host;$i=Read-Host ' InstanceID'; Disable-PnpDevice -InstanceId $i -Confirm:$false -EA SilentlyContinue; Write-Host ' [OK] ISLEM YAPILDI' -ForegroundColor Green}else{Write-Host ' [!] BULUNAMADI'-ForegroundColor Red}; Read-Host ' ...' }
function D25 { Write-Host ' [SCAN] DONANIM DEGISIKLIKLERINI TARA...' -ForegroundColor Yellow; pnputil /scan-devices; Write-Host ' [OK] TARAMA BITTI' -ForegroundColor Green; Read-Host ' ...' }
function D26 { Write-Host ' [ENUM] TUM SURUCULERI SAY (PNPUTIL)...' -ForegroundColor Yellow; pnputil /enum-drivers; Read-Host ' ...' }
function D27 { Write-Host ' [EXPORT] LISTEYI DISA AKTAR (.TXT)...' -ForegroundColor Yellow; $p="$env:TEMP\drivers.txt"; Get-PnpDevice | Out-File $p; Start-Process $p; Write-Host ' [OK] ACILDI' -ForegroundColor Green; Read-Host ' ...' }
function D28 { Write-Host ' [ADD] SURUCU EKLE (INF)...' -ForegroundColor Yellow; $f=Read-Host ' INF Dosya Yolu'; pnputil /add-driver $f /install; Read-Host ' ...' }
function D29 { Write-Host ' [REMOVE] SURUCU SIL (OEM XX.INF)...' -ForegroundColor Red; $f=Read-Host ' OEM Dosya Adi (oem12.inf)'; pnputil /delete-driver $f /force; Read-Host ' ...' }
function D30 { Write-Host ' [RESTART DEV] AYGITI YENIDEN BASLAT...' -ForegroundColor Yellow; $n=Read-Host ' Aygit Adi (Ara)'; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.FriendlyName -like "*$n*"}; if($d){$d|Format-Table -AutoSize|Out-Host;$i=Read-Host ' InstanceID'; Disable-PnpDevice -InstanceId $i -Confirm:$false; Start-Sleep 2; Enable-PnpDevice -InstanceId $i -Confirm:$false; Write-Host ' [OK] YENILENDI' -ForegroundColor Green}else{Write-Host ' [!] BULUNAMADI'-ForegroundColor Red}; Read-Host ' ...' }

# GRUP 4: DETAYLI BILGI
function D31 { Write-Host ' [SIGNED] IMZALI SURUCULER (3. PARTI)...' -ForegroundColor Yellow; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Where-Object {$_.ProviderName -ne "Microsoft"}; Print-Data $d "ProviderName,ClassName,Date"; Read-Host ' ...' }
function D32 { Write-Host ' [UNSIGNED] IMZASIZ SURUCULER...' -ForegroundColor Red; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Where-Object {$_.Signer -eq "Unsigned"}; Print-Data $d "OriginalFileName,ClassName"; Read-Host ' ...' }
function D33 { Write-Host ' [PROVIDER] SAGLAYICIYA GORE ARA...' -ForegroundColor Yellow; $p=Read-Host ' Saglayici (Intel/Nvidia)'; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.Manufacturer -like "*$p*"}; Print-Data $d "FriendlyName,Class"; Read-Host ' ...' }
function D34 { Write-Host ' [DATE] SURUCU TARIHLERI...' -ForegroundColor Yellow; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Select-Object ProviderName,Date,Version | Sort-Object Date -Descending; Print-Data $d; Read-Host ' ...' }
function D35 { Write-Host ' [VERSION] SURUCU SURUMLERI...' -ForegroundColor Yellow; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Select-Object OriginalFileName,Version; Print-Data $d; Read-Host ' ...' }
function D36 { Write-Host ' [INF PATH] INF DOSYA YOLLARI...' -ForegroundColor Yellow; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Select-Object OriginalFileName,OriginalInfName; Print-Data $d; Read-Host ' ...' }
function D37 { Write-Host ' [CLASS] SINIF LISTESI...' -ForegroundColor Yellow; $d=Get-PnpDevice -EA SilentlyContinue | Group-Object Class | Select-Object Name,Count | Sort-Object Count -Descending; Print-Data $d; Read-Host ' ...' }
function D38 { Write-Host ' [BOOT CRIT] BOOT KRITIK SURUCULER...' -ForegroundColor Yellow; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Where-Object {$_.BootCritical -eq $true}; Print-Data $d "OriginalFileName,ClassName"; Read-Host ' ...' }
function D39 { Write-Host ' [INBOX] WINDOWS GOMULU SURUCULER...' -ForegroundColor Yellow; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Where-Object {$_.Inbox -eq $true} | Select-Object -First 20; Print-Data $d "OriginalFileName,ClassName"; Read-Host ' ...' }
function D40 { Write-Host ' [3RD PARTY] 3. PARTI SURUCULER...' -ForegroundColor Yellow; $d=Get-WindowsDriver -Online -EA SilentlyContinue | Where-Object {$_.Inbox -eq $false}; Print-Data $d "ProviderName,ClassName,Date"; Read-Host ' ...' }

# GRUP 5: SORUN GIDERME & ARAMA
function D41 { Write-Host ' [SEARCH] ISIM ILE AYGIT ARA...' -ForegroundColor Yellow; $n=Read-Host ' Aygit Ismi'; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.FriendlyName -like "*$n*"}; Print-Data $d "FriendlyName,Status,InstanceId"; Read-Host ' ...' }
function D42 { Write-Host ' [ID SEARCH] INSTANCE ID ILE ARA...' -ForegroundColor Yellow; $id=Read-Host ' Instance ID'; $d=Get-PnpDevice -InstanceId $id -ErrorAction SilentlyContinue; Print-Data $d "FriendlyName,Status"; Read-Host ' ...' }
function D43 { Write-Host ' [PROBLEM] PROBLEMLI AYGIT KODLARI...' -ForegroundColor Red; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.Problem -ne "CM_PROB_NONE" -and $_.Problem -ne $null}; Print-Data $d "FriendlyName,Problem,ProblemDescription"; Read-Host ' ...' }
function D44 { Write-Host ' [SERVICE] SERVIS ISMIYLE ARA...' -ForegroundColor Yellow; $s=Read-Host ' Servis Adi'; $d=Get-PnpDevice -EA SilentlyContinue | Where-Object {$_.Service -eq $s}; Print-Data $d "FriendlyName,Class"; Read-Host ' ...' }
function D45 { Write-Host ' [LAST ARRIVAL] SON EKLENME TARIHI...' -ForegroundColor Yellow; Write-Host " Bu bilgi Event Log'dan cekilir." -ForegroundColor Gray; Get-WinEvent -LogName "Microsoft-Windows-Kernel-PnP/Configuration" -MaxEvents 10 -EA 0 | Select-Object TimeCreated,Message | Format-Table -Wrap | Out-Host; Read-Host ' ...' }
function D46 { Write-Host ' [DXDIAG] DIRECTX TANILAMA...' -ForegroundColor Yellow; dxdiag; Read-Host ' ...' }
function D47 { Write-Host ' [MSINFO] SISTEM BILGISI...' -ForegroundColor Yellow; msinfo32; Read-Host ' ...' }
function D48 { Write-Host ' [DEVMGMT] AYGIT YONETICISI...' -ForegroundColor Yellow; devmgmt.msc; Read-Host ' ...' }
function D49 { Write-Host ' [PRINTERS] YAZICI VE TARAYICILAR...' -ForegroundColor Yellow; control printers; Read-Host ' ...' }
function D50 { Write-Host ' [SIGVERIF] IMZA DOGRULAMA ARACI...' -ForegroundColor Yellow; sigverif; Read-Host ' ...' }

# GRUP 6: EKSTRA SISTEM
function D51 { Write-Host ' [BIOS] BIOS SURUM BILGISI...' -ForegroundColor Yellow; Get-WmiObject Win32_BIOS | Select-Object Manufacturer,SMBIOSBIOSVersion,ReleaseDate | Out-Host; Read-Host ' ...' }
function D52 { Write-Host ' [MOBO] ANAKART BILGISI...' -ForegroundColor Yellow; Get-WmiObject Win32_BaseBoard | Select-Object Manufacturer,Product | Out-Host; Read-Host ' ...' }
function D53 { Write-Host ' [CPU] ISLEMCI BILGISI...' -ForegroundColor Yellow; Get-WmiObject Win32_Processor | Select-Object Name,NumberOfCores | Out-Host; Read-Host ' ...' }
function D54 { Write-Host ' [GPU] EKRAN KARTI BILGISI...' -ForegroundColor Yellow; Get-WmiObject Win32_VideoController | Select-Object Name,DriverVersion | Out-Host; Read-Host ' ...' }
function D55 { Write-Host ' [RAM] BELLEK MODULLERI...' -ForegroundColor Yellow; Get-WmiObject Win32_PhysicalMemory | Select-Object BankLabel,Capacity,Speed,Manufacturer | Out-Host; Read-Host ' ...' }
function D56 { Write-Host ' [DISK] DISK MODELLERI...' -ForegroundColor Yellow; Get-PhysicalDisk | Select-Object FriendlyName,MediaType,HealthStatus | Out-Host; Read-Host ' ...' }
function D57 { Write-Host ' [SOUND] SES SURUCULERI...' -ForegroundColor Yellow; Get-WmiObject Win32_SoundDevice | Select-Object Name,Status | Out-Host; Read-Host ' ...' }
function D58 { Write-Host ' [NET ADAPTER] AG KARTLARI...' -ForegroundColor Yellow; Get-NetAdapter | Select-Object Name,InterfaceDescription,DriverVersion | Out-Host; Read-Host ' ...' }
function D59 { Write-Host ' [UPTIME] SISTEM CALISMA SURESI...' -ForegroundColor Yellow; (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime | Select-Object Days,Hours,Minutes | Out-Host; Read-Host ' ...' }
function D60 { Write-Host ' [EXIT] CIKIS YAPILIYOR...' -ForegroundColor Red; Exit }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [GENEL DURUM]          [KATEGORIK LISTE]      [YONETIM & YEDEK]      [DETAYLI ANALIZ]" -ForegroundColor Yellow
        Write-Host "   01. TUM AYGITLAR       11. USB AYGITLARI      21. YEDEKLE (BACKUP)   31. IMZALI SURUCULER" -ForegroundColor White
        Write-Host "   02. AKTIF AYGITLAR     12. AG KARTLARI        22. DEPOYU LISTELE     32. IMZASIZ OLANLAR" -ForegroundColor White
        Write-Host "   03. HATALI (ERROR)     13. EKRAN KARTLARI     23. AKTIFLESTIR        33. SAGLAYICI ARA" -ForegroundColor White
        Write-Host "   04. BILINMEYENLER      14. SES AYGITLARI      24. DEVRE DISI BIRAK   34. TARIHE GORE" -ForegroundColor White
        Write-Host "   05. BOZUK (DEGRADED)   15. BLUETOOTH          25. DEGISIKLIK TARA    35. SURUME GORE" -ForegroundColor White
        Write-Host "   06. DEVRE DISI OLAN    16. YAZICILAR          26. LISTE (PNPUTIL)    36. INF DOSYA YOLU" -ForegroundColor White
        Write-Host "   07. TAKILI OLANLAR     17. DISK SURUCULERI    27. LISTEYI DISARI AT  37. SINIF DAGILIMI" -ForegroundColor White
        Write-Host "   08. HAYALET (GHOST)    18. KAMERALAR          28. SURUCU YUKLE       38. BOOT KRITIKLER" -ForegroundColor White
        Write-Host "   09. SERVIS (RUNNING)   19. ISLEMCILER         29. SURUCU SIL (OEM)   39. WINDOWS GOMULU" -ForegroundColor White
        Write-Host "   10. SERVIS (STOPPED)   20. HID (KLAVYE/MOUSE) 30. YENIDEN BASLAT     40. 3. PARTI SURUCU" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [SORUN GIDERME]        [SISTEM & DONANIM]" -ForegroundColor Yellow
        Write-Host "   41. ISIMLE ARA         51. BIOS BILGISI" -ForegroundColor Cyan
        Write-Host "   42. ID ILE ARA         52. ANAKART BILGISI" -ForegroundColor Cyan
        Write-Host "   43. SORUN KODLARI      53. ISLEMCI BILGISI" -ForegroundColor Cyan
        Write-Host "   44. SERVIS ILE ARA     54. GPU BILGISI" -ForegroundColor Cyan
        Write-Host "   45. SON EKLENENLER     55. RAM BILGISI" -ForegroundColor Cyan
        Write-Host "   46. DXDIAG AC          56. DISK BILGISI" -ForegroundColor Cyan
        Write-Host "   47. MSINFO32 AC        57. SES BILGISI" -ForegroundColor Cyan
        Write-Host "   48. AYGIT YONETICISI   58. AG KARTI BILGI" -ForegroundColor Cyan
        Write-Host "   49. YAZICI AYARLARI    59. CALISMA SURESI" -ForegroundColor Cyan
        Write-Host "   50. IMZA DOGRULAMA     60. CIKIS YAP" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        if ($c -eq 'Q' -or $c -eq 'q') { D60 }
        
        switch ($c) {
            '1' {D01} '11' {D11} '21' {D21} '31' {D31} '41' {D41} '51' {D51}
            '01' {D01} '12' {D12} '22' {D22} '32' {D32} '42' {D42} '52' {D52}
            '2' {D02} '13' {D13} '23' {D23} '33' {D33} '43' {D43} '53' {D53}
            '02' {D02} '14' {D14} '24' {D24} '34' {D34} '44' {D44} '54' {D54}
            '3' {D03} '15' {D15} '25' {D25} '35' {D35} '45' {D45} '55' {D55}
            '03' {D03} '16' {D16} '26' {D26} '36' {D36} '46' {D46} '56' {D56}
            '4' {D04} '17' {D17} '27' {D27} '37' {D37} '47' {D47} '57' {D57}
            '4' {D04} '18' {D18} '28' {D28} '38' {D38} '48' {D48} '58' {D58}
            '5' {D05} '19' {D19} '29' {D29} '39' {D39} '49' {D49} '59' {D59}
            '05' {D05} '20' {D20} '30' {D30} '40' {D40} '50' {D50} '60' {D60}
            '6' {D06}
            '06' {D06}
            '7' {D07}
            '07' {D07}
            '8' {D08}
            '08' {D08}
            '9' {D09}
            '09' {D09}
            '10' {D10}
        }
    }
}

Main-Loop