<#
.SYNOPSIS
    Gelistirilmis Sistem Yoneticisi (ASCII Turkce Surum)
    Developer: Omer Cataloglu
.DESCRIPTION
    Kodlama hatasi olmamasi icin Ingilizce karakterlerle (ASCII) yazilmis
    Turkce sistem analiz ve guncelleme araci.
#>

# --- 0. OTOMATIK YONETICI IZNI (AUTO-ADMIN) ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Yonetici izni isteniyor..." -ForegroundColor Yellow
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# --- 1. GELISTIRICI BILGILERI ---
$DevName  = "Omer Cataloglu"
$DevTitle = "Gelistirici (Developer)"
$DevWeb   = "www.omercataloglu.com"
$DevMail  = "pixeldrafter@omercataloglu.com"
$DevPhone = "0533 701 00 89"

# Konsol cikti ayari (Guvenlik icin UTF8, ama biz ASCII yazacagiz)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Rapor ve Eylem Kayitlari
$Global:ReportBody = @()
$Global:ActionsTaken = @()

# --- YARDIMCI FONKSIYONLAR ---
function Log-Out {
    param ([string]$Msg, [string]$Color="White", [bool]$AddToReport=$true)
    Write-Host $Msg -ForegroundColor $Color
    if ($AddToReport) { $Global:ReportBody += $Msg }
}

function Cizgi-Cek { return "-" * 75 }

function Goster-Header {
    Clear-Host
    Write-Host "$(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host "      GELISTIRICI BILGILERI (DEVELOPER INFO)" -ForegroundColor Cyan
    Write-Host "$(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " Ad Soyad : $DevName" -ForegroundColor White
    Write-Host " Unvan    : $DevTitle" -ForegroundColor White
    Write-Host " Web      : $DevWeb" -ForegroundColor White
    Write-Host " E-Posta  : $DevMail" -ForegroundColor White
    Write-Host " Telefon  : $DevPhone" -ForegroundColor White
    Write-Host "$(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host ""
    
    # Raporun en basina da ekleyelim
    $Global:ReportBody += "$(Cizgi-Cek)"
    $Global:ReportBody += " GELISTIRICI BILGILERI"
    $Global:ReportBody += " Ad: $DevName | Web: $DevWeb | Tel: $DevPhone"
    $Global:ReportBody += "$(Cizgi-Cek)"
}

# --- 2. DETAYLI SISTEM ANALIZI ---
function Get-SistemBilgisi {
    Log-Out "`n$(Cizgi-Cek)" "Cyan"
    Log-Out " DETAYLI SISTEM RAPORU - $(Get-Date -Format 'dd.MM.yyyy HH:mm')" "Cyan"
    Log-Out "$(Cizgi-Cek)" "Cyan"

    # A. ANAKART VE BIOS
    try {
        $mb = Get-CimInstance Win32_BaseBoard
        $bios = Get-CimInstance Win32_BIOS
        $sys = Get-CimInstance Win32_ComputerSystem
        $os = Get-CimInstance Win32_OperatingSystem
        
        # Uptime Hesabi
        $boot = $os.LastBootUpTime
        $uptime = (Get-Date) - $boot
        $uptimeStr = "{0} Gun, {1} Saat, {2} Dakika" -f $uptime.Days, $uptime.Hours, $uptime.Minutes

        Log-Out "`n[+] ANAKART VE SISTEM OZETI" "Green"
        Log-Out " Bilgisayar Adi : $($sys.Name)"
        Log-Out " Uretici        : $($mb.Manufacturer)"
        Log-Out " Urun/Model     : $($mb.Product)"
        Log-Out " Seri No        : $($mb.SerialNumber)"
        Log-Out " BIOS Surumu    : $($bios.SMBIOSBIOSVersion) (Tarih: $($bios.ReleaseDate))"
        Log-Out " Calisma Suresi : $uptimeStr"
    } catch { Log-Out " ! Anakart bilgisi alinamadi." "Red" }

    # B. ISLEMCI (CPU)
    try {
        $cpu = Get-CimInstance Win32_Processor
        Log-Out "`n[+] ISLEMCI (CPU)" "Green"
        Log-Out " Model          : $($cpu.Name)"
        Log-Out " Cekirdek/Izlek : $($cpu.NumberOfCores) Cekirdek / $($cpu.NumberOfLogicalProcessors) Izlek"
        Log-Out " Mevcut Hiz     : $($cpu.CurrentClockSpeed) MHz"
    } catch { Log-Out " ! Islemci bilgisi alinamadi." "Red" }

    # C. BELLEK (RAM) - DETAYLI
    try {
        $rams = Get-CimInstance Win32_PhysicalMemory
        Log-Out "`n[+] BELLEK (RAM) DURUMU" "Green"
        $totalRAM = [math]::Round(($rams | Measure-Object -Property Capacity -Sum).Sum / 1GB, 2)
        Log-Out " Toplam Kapasite: $totalRAM GB"
        foreach ($r in $rams) {
            $rSize = [math]::Round($r.Capacity / 1GB, 0)
            $rSpeed = if ($r.Speed) { $r.Speed } else { "Bilinmiyor" }
            $rMan = if ($r.Manufacturer) { $r.Manufacturer } else { "Bilinmiyor" }
            $rSer = if ($r.SerialNumber) { $r.SerialNumber } else { "Yok" }
            $rLoc = $r.BankLabel + " " + $r.DeviceLocator
            Log-Out "  -> Slot [$rLoc]: ${rSize}GB | ${rSpeed}MHz | Marka: $rMan | Seri: $rSer"
        }
    } catch { Log-Out " ! RAM bilgisi alinamadi." "Red" }

    # D. EKRAN KARTI (GPU)
    try {
        $gpus = Get-CimInstance Win32_VideoController
        Log-Out "`n[+] EKRAN KARTI (GPU)" "Green"
        foreach ($g in $gpus) {
            Log-Out " Model          : $($g.Name)"
            Log-Out " Surucu Surumu  : $($g.DriverVersion)"
            Log-Out " Durum          : $($g.Status)"
        }
    } catch { Log-Out " ! GPU bilgisi alinamadi." "Red" }

    # E. DEPOLAMA (HDD/SSD)
    try {
        Log-Out "`n[+] DISK VE DEPOLAMA" "Green"
        $disks = Get-CimInstance Win32_DiskDrive
        foreach ($d in $disks) {
            $dSize = [math]::Round($d.Size / 1GB, 2)
            Log-Out " Fiziksel Disk  : $($d.Model) | $dSize GB | Durum: $($d.Status)"
        }
        $parts = Get-CimInstance Win32_LogicalDisk | Where-Object DriveType -eq 3
        foreach ($p in $parts) {
            $pSize = [math]::Round($p.Size / 1GB, 2)
            $pFree = [math]::Round($p.FreeSpace / 1GB, 2)
            $pUsed = [math]::Round((($pSize - $pFree) / $pSize) * 100, 1)
            Log-Out "  -> Surucu $($p.DeviceID) Toplam: $pSize GB | Bos: $pFree GB | Doluluk: %$pUsed"
        }
    } catch { Log-Out " ! Disk bilgisi alinamadi." "Red" }

    # F. AG BILGILERI (YENI - MUST HAVE)
    try {
        Log-Out "`n[+] AG BAGLANTILARI (NETWORK)" "Green"
        $netConfigs = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true }
        foreach ($net in $netConfigs) {
             Log-Out "  Adaptor       : $($net.Description)"
             Log-Out "  MAC Adresi    : $($net.MACAddress)"
             Log-Out "  IP Adresi (v4): $($net.IPAddress[0])"
        }
    } catch { Log-Out " ! Ag bilgisi alinamadi." "Red" }

    # G. OLAY GUNLUGU (SON 5 KRITIK HATA)
    try {
        Log-Out "`n[+] SISTEM OLAY GUNLUGU (Son 5 Kritik Hata)" "Green"
        $errors = Get-EventLog -LogName System -EntryType Error,Warning -Newest 5 -ErrorAction SilentlyContinue
        if ($errors) {
            foreach ($e in $errors) {
                Log-Out "  Zaman : $($e.TimeGenerated.ToString('yyyy-MM-dd HH:mm')) | Kaynak: $($e.Source) | ID: $($e.EventID)"
                Log-Out "  Mesaj : $($e.Message.Substring(0, [math]::Min(80, $e.Message.Length)))..."
            }
        } else {
            Log-Out "  Son kayitlarda kritik bir hata bulunamadi. Sistem saglikli gorunuyor."
        }
    } catch { Log-Out " ! Olay gunlugune erisilemedi." "Red" }
}

# --- 3. WINDOWS UPDATE YONETICISI ---
function Kontrol-WindowsUpdate {
    Log-Out "`n[+] WINDOWS GUNCELLEMELERI KONTROL EDILIYOR..." "Yellow" $false
    try {
        $Session = New-Object -ComObject "Microsoft.Update.Session"
        $Searcher = $Session.CreateUpdateSearcher()
        $Criteria = "IsInstalled=0"
        $Result = $Searcher.Search($Criteria)
        
        if ($Result.Updates.Count -eq 0) {
            Log-Out " Windows tamamen guncel." "Green"
            return $null
        } else {
            Log-Out " $($Result.Updates.Count) adet Windows guncellemesi bekliyor." "Cyan"
            return $Result.Updates
        }
    } catch {
        Log-Out " Windows Update servisine erisilemedi." "Red"
        return $null
    }
}

function Yukle-WindowsUpdate {
    param($Updates)
    if (-not $Updates) { return }
    
    Log-Out " Windows Guncellemeleri baslatiliyor..." "Cyan"
    # Guvenli yontem: Windows'un kendi arayuzunu veya servisini tetiklemek
    Start-Process "usoclient" -ArgumentList "StartInstall"
    $Global:ActionsTaken += "Windows Guncellemeleri Tetiklendi (Arkaplan)"
    Log-Out " Guncellemeler arkaplanda baslatildi. Islem bitince yeniden baslatma gerekebilir." "Green"
}

# --- 4. UYGULAMA GUNCELLEME (WINGET) ---
function Kontrol-UygulamaGuncelleme {
    Log-Out "`n[+] UYGULAMA GUNCELLEMELERI TARANIYOR (WINGET)..." "Yellow" $false
    
    $raw = winget upgrade --include-unknown --accept-source-agreements | Out-String
    $lines = $raw -split "`r`n"
    
    $pkgList = @()
    $startCapture = $false

    foreach ($line in $lines) {
        if ($line -match "^Name|^Ad\s") { $startCapture = $true; continue }
        if ($line -match "^----") { continue }
        
        if ($startCapture -and $line.Trim().Length -gt 2) {
            # Bosluklara gore ayir
            $parts = $line -split "\s{2,}"
            
            if ($parts.Count -ge 2) {
                # ID Genelde 2. sutundadir (Ad - Id - Surum)
                $idCandidate = $parts[1]
                
                $pkgObj = [PSCustomObject]@{
                    Index = $pkgList.Count + 1
                    FullLine = $line
                    Id = $idCandidate
                }
                $pkgList += $pkgObj
            }
        }
    }
    return $pkgList
}

# --- ANA PROGRAM AKISI ---
Goster-Header # Iletisim bilgileri en basta

# 1. Donanim Analizi
Get-SistemBilgisi

# 2. Guncelleme Kontrolu
$winUpdates = Kontrol-WindowsUpdate
$appUpdates = Kontrol-UygulamaGuncelleme

# Uygulama Listesini Goster
if ($appUpdates.Count -gt 0) {
    Log-Out "`n Bulunan Uygulama Guncellemeleri ($($appUpdates.Count) Adet):" "Cyan" $false
    foreach ($pkg in $appUpdates) {
        Write-Host " [$($pkg.Index)] $($pkg.FullLine)"
    }
} else {
    Log-Out "`n Tum uygulamalar guncel." "Green"
}

# 3. MENU
Write-Host "`n$(Cizgi-Cek)" -ForegroundColor Cyan
Write-Host " GUNCELLEME VE ISLEM MENUSU" -ForegroundColor Cyan
Write-Host "$(Cizgi-Cek)" -ForegroundColor Cyan
Write-Host " 1. Herseyi Guncelle (Windows + Programlar) [ONERILEN]"
Write-Host " 2. Sadece Windows'u Guncelle"
Write-Host " 3. Sadece Programlari Guncelle"
Write-Host " 4. Sadece Secili Programi Guncelle (Numara ile)"
Write-Host " 5. Sadece Raporu Al ve Cik"
Write-Host "$(Cizgi-Cek)" -ForegroundColor Cyan

$choice = Read-Host " Seciminiz (1-5)"

# 4. ISLEM UYGULAMA
switch ($choice) {
    "1" {
        # Windows
        if ($winUpdates) { Yukle-WindowsUpdate -Updates $winUpdates }
        # Uygulamalar
        if ($appUpdates.Count -gt 0) {
            Log-Out " Tum uygulamalar guncelleniyor..." "Cyan"
            winget upgrade --all --accept-package-agreements --accept-source-agreements
            $Global:ActionsTaken += "Tum Uygulamalar Guncellendi"
        }
    }
    "2" {
        if ($winUpdates) { Yukle-WindowsUpdate -Updates $winUpdates }
        else { Log-Out " Yapilacak Windows guncellemesi yok." "Yellow" }
    }
    "3" {
        if ($appUpdates.Count -gt 0) {
            Log-Out " Tum uygulamalar guncelleniyor..." "Cyan"
            winget upgrade --all --accept-package-agreements --accept-source-agreements
            $Global:ActionsTaken += "Tum Uygulamalar Guncellendi"
        } else { Log-Out " Guncellenecek uygulama yok." "Yellow" }
    }
    "4" {
        if ($appUpdates.Count -gt 0) {
            $selection = Read-Host " Guncellenecek numaralari girin (Orn: 1 veya 1,3)"
            $nums = $selection -split ","
            foreach ($n in $nums) {
                try {
                    $idx = [int]$n - 1
                    if ($idx -ge 0 -and $idx -lt $appUpdates.Count) {
                        $target = $appUpdates[$idx]
                        Log-Out " Guncelleniyor [$($target.Index)] ID: $($target.Id) ..." "Cyan"
                        
                        # Guncelleme Komutu
                        winget upgrade --id $target.Id --accept-package-agreements --accept-source-agreements
                        
                        if ($?) { 
                            $Global:ActionsTaken += "Guncellendi: $($target.Id)" 
                            Log-Out " Basarili: $($target.Id)" "Green"
                        } else {
                            $Global:ActionsTaken += "Hata Olustu: $($target.Id)"
                            Log-Out " Basarisiz: $($target.Id)" "Red"
                        }
                    } else {
                        Log-Out " Gecersiz numara: $n" "Red"
                    }
                } catch {
                    Log-Out " Hatali giris: $n" "Red"
                }
            }
        } else { Log-Out " Guncellenecek bir sey yok." }
    }
    "5" {
        Log-Out " Guncelleme yapilmadan cikiliyor." "Green"
        $Global:ActionsTaken += "Sadece Rapor Olusturuldu"
    }
    Default { Log-Out " Gecersiz Secim." "Red" }
}

# --- 5. RAPOR OLUSTURMA ---
$fileName = "SistemRaporu_$(Get-Date -Format 'yyyyMMdd_HHmm').txt"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$fullPath = Join-Path $desktopPath $fileName

$finalContent = @()
$finalContent += "######################################################################"
$finalContent += "#                    SISTEM BAKIM VE DURUM RAPORU                    #"
$finalContent += "######################################################################"
$finalContent += "Tarih    : $(Get-Date -Format 'dd.MM.yyyy HH:mm')"
$finalContent += ""
$finalContent += "--- GELISTIRICI BILGILERI ---"
$finalContent += "Ad Soyad : $DevName"
$finalContent += "Unvan    : $DevTitle"
$finalContent += "Web      : $DevWeb"
$finalContent += "E-Posta  : $DevMail"
$finalContent += "Telefon  : $DevPhone"
$finalContent += "-" * 75
$finalContent += ""
$finalContent += $Global:ReportBody
$finalContent += ""
$finalContent += "======================================================================"
$finalContent += " ISLEM OZETI (ACTION SUMMARY)"
$finalContent += "======================================================================"
if ($Global:ActionsTaken.Count -gt 0) {
    foreach ($act in $Global:ActionsTaken) { $finalContent += " [YAPILDI] $act" }
} else {
    $finalContent += " Herhangi bir degisiklik yapilmadi."
}

$finalContent | Out-File -FilePath $fullPath -Encoding UTF8

Write-Host "`n[BASARILI] Rapor Masaustune kaydedildi: $fileName" -ForegroundColor Green
Write-Host "Gelistirici: $DevName - Islem Tamamlandi." -ForegroundColor Gray
Read-Host "Cikmak icin Enter'a basin..."