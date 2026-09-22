<#
.SYNOPSIS
    PixTool Ultimate System Cleaner & Repair (ASCII Edition)
    Developer: Omer Cataloglu
.DESCRIPTION
    Comprehensive maintenance script: Cleanups, DISM, SFC, Chkdsk, Update Fix.
#>

# --- 0. OTOMATIK YONETICI IZNI (GUCLENDIRILMIS) ---
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()

if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    # Scriptin calistigi yolu tam olarak al
    $scriptPath = $MyInvocation.MyCommand.Path

    # Eger $scriptPath bos ise (bazen ISE veya farkli cagirmalarda olur), diger yontemi dene
    if ([string]::IsNullOrEmpty($scriptPath)) {
        $scriptPath = $PSCommandPath
    }

    # Eger hala yol yoksa, hata ver ve bekle (Kapanmayi engeller)
    if ([string]::IsNullOrEmpty($scriptPath)) {
        Write-Host "HATA: Scriptin dosya yolu tespit edilemedi!" -ForegroundColor Red
        Write-Host "Lutfen bu kodu bir .ps1 dosyasi olarak kaydedip tekrar calistirin." -ForegroundColor Yellow
        Write-Host "Cikmak icin bir tusa basin..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Exit
    }

    # Yonetici izni ile yeniden baslat
    try {
        Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -ErrorAction Stop
        Exit # Eski (yonetici olmayan) pencereyi kapat
    }
    catch {
        Write-Host "Yonetici izni reddedildi veya hata olustu." -ForegroundColor Red
        Write-Host "Devam etmek icin bir tusa basin..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Exit
    }
}

# --- 1. GELISTIRICI BILGILERI VE AYARLAR ---
$DevName  = "Omer Cataloglu"
$DevTitle = "Gelistirici (Developer)"
$DevWeb   = "www.omercataloglu.com"
$DevMail  = "pixeldrafter@omercataloglu.com"
$DevPhone = "0533 701 00 89"

# Konsol Encoding Ayari (Turkce karakterler ve semboller icin)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Global:LogBuffer = @()

# --- YARDIMCI FONKSIYONLAR ---
function Log-Out {
    param ([string]$Msg, [string]$Color="White", [bool]$AddToReport=$true)
    Write-Host $Msg -ForegroundColor $Color
    if ($AddToReport) { $Global:LogBuffer += $Msg }
}

function Cizgi-Cek { return "-" * 70 }

function Baslik-Yaz {
    Clear-Host
    Log-Out "$(Cizgi-Cek)" "Cyan"
    Log-Out "     PIXTOOL SISTEM TEMIZLIK VE BAKIM ARACI (ULTIMATE)" "Cyan"
    Log-Out "$(Cizgi-Cek)" "Cyan"
    Log-Out " Gelistirici: $DevName" "Gray"
    Log-Out " Web        : $DevWeb" "Gray"
    Log-Out " Iletisim   : $DevPhone" "Gray"
    Log-Out "$(Cizgi-Cek)" "Cyan"
    Log-Out ""
}

# --- 2. MODULER ISLEM FONKSIYONLARI ---

function Temizle-TempPrefetch {
    Log-Out "`n[+] GECICI DOSYALAR VE PREFETCH TEMIZLENIYOR..." "Yellow"
    
    $paths = @(
        "$env:TEMP",
        "$env:windir\Temp",
        "$env:windir\Prefetch"
    )

    foreach ($path in $paths) {
        if (Test-Path $path) {
            Log-Out " -> Temizleniyor: $path" "Gray"
            # Hata veren (kullanimdaki) dosyalari atla
            Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue | 
                Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        }
    }
    Log-Out " [OK] Gecici dosyalar temizlendi." "Green"
}

function Temizle-CopKutusu {
    Log-Out "`n[+] COP KUTUSU (RECYCLE BIN) BOSALTILIYOR..." "Yellow"
    try {
        Clear-RecycleBin -Force -ErrorAction SilentlyContinue
        Log-Out " [OK] Cop kutusu bosaltildi." "Green"
    } catch {
        Log-Out " [BILGI] Cop kutusu zaten bos veya erisilemedi." "Gray"
    }
}

function Temizle-EventLogs {
    Log-Out "`n[+] OLAY GUNLUKLERI (EVENT LOGS) SILINIYOR..." "Yellow"
    try {
        $logs = Get-EventLog -List
        foreach ($log in $logs) {
            Clear-EventLog -LogName $log.Log -ErrorAction SilentlyContinue
        }
        Log-Out " [OK] Tum sistem gunlukleri sifirlandi." "Green"
    } catch {
        Log-Out " [HATA] Loglar temizlenirken bazi hatalar oldu." "Red"
    }
}

function Onar-WindowsUpdate {
    Log-Out "`n[+] WINDOWS UPDATE ONARIMI BASLATILIYOR..." "Yellow"
    
    Log-Out " -> Update servisleri durduruluyor..." "Gray"
    Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
    Stop-Service -Name bits -Force -ErrorAction SilentlyContinue
    Stop-Service -Name cryptsvc -Force -ErrorAction SilentlyContinue

    $softDist = "$env:windir\SoftwareDistribution"
    if (Test-Path $softDist) {
        Log-Out " -> Yazilim dagitim klasoru (SoftwareDistribution) temizleniyor..." "Gray"
        Get-ChildItem $softDist -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }

    Log-Out " -> Servisler tekrar baslatiliyor..." "Gray"
    Start-Service -Name wuauserv -ErrorAction SilentlyContinue
    Start-Service -Name bits -ErrorAction SilentlyContinue
    Start-Service -Name cryptsvc -ErrorAction SilentlyContinue
    
    Log-Out " [OK] Windows Update onarimi tamamlandi." "Green"
}

function Onar-DNS {
    Log-Out "`n[+] DNS ONBELLEGI VE IP YAPILANDIRMASI..." "Yellow"
    Clear-DnsClientCache
    Log-Out " [OK] DNS Cache temizlendi." "Green"
}

function Onar-DISM {
    Log-Out "`n[+] DISM SISTEM GORUNTUSU ONARIMI (Uzun Surebilir)..." "Yellow"
    Log-Out " -> RestoreHealth islemi baslatildi, lutfen bekleyin." "Cyan"
    
    $proc = Start-Process -FilePath "dism.exe" -ArgumentList "/Online /Cleanup-Image /RestoreHealth" -Wait -NoNewWindow -PassThru
    
    if ($proc.ExitCode -eq 0) {
        Log-Out " [OK] DISM onarimi basariyla tamamlandi." "Green"
    } else {
        Log-Out " [!] DISM islemi bir hata ile bitti veya onarim gerekmedi." "Red"
    }
}

function Onar-SFC {
    Log-Out "`n[+] SFC (SYSTEM FILE CHECKER) TARAMASI..." "Yellow"
    Log-Out " -> Sistem dosyalari dogrulaniyor..." "Cyan"
    
    $proc = Start-Process -FilePath "sfc.exe" -ArgumentList "/scannow" -Wait -NoNewWindow -PassThru
    
    Log-Out " [OK] SFC Taramasi tamamlandi." "Green"
}

function Onar-Disk {
    Log-Out "`n[+] DISK HATA DENETIMI (CHKDSK)..." "Yellow"
    Log-Out " -> C: Surucusu icin disk kontrolu planlaniyor." "Cyan"
    Log-Out " -> Bilgisayariniz bir sonraki acilista disk kontrolu yapacak." "Cyan"
    
    $cmd = "echo y | chkdsk C: /f"
    Invoke-Expression -Command "cmd /c $cmd" | Out-Null
    
    Log-Out " [OK] Disk kontrolu zamanlandi. Yeniden baslatinca devreye girecek." "Green"
}

# --- 3. MENU MANTIGI ---

while ($true) {
    Baslik-Yaz

    Write-Host " ISLEM SECENEKLERI:" -ForegroundColor Cyan
    Write-Host " 1. Hepsini Temizle ve Onar (FULL BAKIM - Onerilen)"
    Write-Host " 2. Sadece Gereksiz Dosyalari Temizle (Temp, Log, Cop, DNS)"
    Write-Host " 3. Sadece Sistem Onarimi Yap (Update, DISM, SFC)"
    Write-Host " 4. Listeden Secerek Islem Yap"
    Write-Host " 5. Cikis"
    Write-Host "$(Cizgi-Cek)" -ForegroundColor Cyan

    $secim = Read-Host " Seciminiz (1-5)"

    switch ($secim) {
        "1" {
            Temizle-TempPrefetch
            Temizle-CopKutusu
            Temizle-EventLogs
            Onar-DNS
            Onar-WindowsUpdate
            Onar-DISM
            Onar-SFC
            Onar-Disk
            break # Donguden cikip rapora gitmek icin switch'i kiriyoruz ama while dongusu icin asagiya bakacagiz
        }
        "2" {
            Temizle-TempPrefetch
            Temizle-CopKutusu
            Temizle-EventLogs
            Onar-DNS
        }
        "3" {
            Onar-WindowsUpdate
            Onar-DISM
            Onar-SFC
        }
        "4" {
            Write-Host "`n [ LISTEDEN SECIM YAPIN ]" -ForegroundColor Yellow
            Write-Host " 1. Temp ve Prefetch Dosyalari"
            Write-Host " 2. Cop Kutusu (Recycle Bin)"
            Write-Host " 3. Olay Gunlukleri (Event Logs)"
            Write-Host " 4. DNS Onbellegi"
            Write-Host " 5. Windows Update Onarimi"
            Write-Host " 6. DISM Onarimi"
            Write-Host " 7. SFC Taramasi"
            Write-Host " 8. Disk Kontrolu (Chkdsk - Restart Gerekir)"
            
            $altSecim = Read-Host " Yapilacak islemleri virgulle girin (Orn: 1,3,5)"
            $nums = $altSecim -split ","
            
            foreach ($n in $nums) {
                switch ($n.Trim()) {
                    "1" { Temizle-TempPrefetch }
                    "2" { Temizle-CopKutusu }
                    "3" { Temizle-EventLogs }
                    "4" { Onar-DNS }
                    "5" { Onar-WindowsUpdate }
                    "6" { Onar-DISM }
                    "7" { Onar-SFC }
                    "8" { Onar-Disk }
                    Default { Write-Host " ! Gecersiz numara: $n" -ForegroundColor Red }
                }
            }
        }
        "5" {
            Write-Host " Cikis yapiliyor..."
            Exit
        }
        Default { 
            Write-Host " Gecersiz secim! Lutfen tekrar deneyin." -ForegroundColor Red 
            Start-Sleep -Seconds 2
            continue # While dongusunun basina don
        }
    }
    
    # Islem bittikten sonra donguden tamamen cikip rapora gidelim
    break
}

# --- 4. RAPORLAMA ---
Write-Host "`n$(Cizgi-Cek)" -ForegroundColor Cyan
Write-Host " ISLEMLER TAMAMLANDI." -ForegroundColor Green
$raporSor = Read-Host " Rapor masaustune kaydedilsin mi? (e/h)"

if ($raporSor -eq "e" -or $raporSor -eq "E") {
    $fileName = "PixClean_Rapor_$(Get-Date -Format 'yyyyMMdd_HHmm').txt"
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $fullPath = Join-Path $desktopPath $fileName
    
    $finalReport = @()
    $finalReport += "#################################################"
    $finalReport += "#            PIXTOOL TEMIZLIK RAPORU            #"
    $finalReport += "#################################################"
    $finalReport += "Tarih    : $(Get-Date -Format 'dd.MM.yyyy HH:mm')"
    $finalReport += "Kullanici: $env:USERNAME"
    $finalReport += "--- GELISTIRICI ---"
    $finalReport += "Ad       : $DevName"
    $finalReport += "Web      : $DevWeb"
    $finalReport += "-" * 50
    $finalReport += $Global:LogBuffer
    
    $finalReport | Out-File -FilePath $fullPath -Encoding UTF8
    Write-Host " [OK] Rapor masaustune kaydedildi: $fileName" -ForegroundColor Green
} else {
    Write-Host " Rapor olusturulmadi." -ForegroundColor Gray
}

Write-Host "`n PixTool gule gule kullanin. Cikmak icin Enter'a basin." -ForegroundColor Gray
Read-Host