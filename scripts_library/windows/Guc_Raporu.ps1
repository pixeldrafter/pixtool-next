<#
.SYNOPSIS
    PixTool Power & Battery Report Generator (ASCII Edition)
    Developer: Omer Cataloglu
.DESCRIPTION
    Generates a custom, readable HTML power report.
    Detects Desktop vs Laptop automatically.
#>

# --- 1. OTOMATIK YONETICI IZNI ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# --- 2. AYARLAR ---
$DevName  = "Omer Cataloglu"
$DevTitle = "Gelistirici (Developer)"
$DevWeb   = "www.omercataloglu.com"
$ReportFile = "$([Environment]::GetFolderPath('Desktop'))\PixTool_Guc_Raporu.html"

# --- 3. VERI TOPLAMA ---
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "     PIXTOOL GUC RAPORLAYICI (POWER TOOL)" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host " Veriler toplaniyor..." -ForegroundColor Yellow

# Sistem Bilgisi
$sysInfo = Get-CimInstance Win32_ComputerSystem
$pcName = $sysInfo.Name
$model = $sysInfo.Model

# Guc Plani
$powerPlan = Get-CimInstance Win32_PowerPlan -Namespace "root\cimv2\power" | Where-Object { $_.IsActive }
$planName = $powerPlan.ElementName

# Batarya Kontrolu
$batteries = Get-CimInstance Win32_Battery
$hasBattery = $null
$batHtml = ""
$statusText = "Masaustu Modu (Priz)"

if ($batteries) {
    $hasBattery = $true
    $statusText = "Mobil Mod (Batarya)"
    
    foreach ($bat in $batteries) {
        # Batarya Sagligi Hesabi (Tahmini)
        # Windows bazi driverlarda DesignCapacity vermeyebilir, kontrol edelim.
        $designCap = if ($bat.DesignCapacity) { $bat.DesignCapacity } else { 0 }
        $fullCap = if ($bat.FullChargeCapacity) { $bat.FullChargeCapacity } else { 0 }
        
        $health = 0
        if ($designCap -gt 0) {
            $health = [math]::Round(($fullCap / $designCap) * 100, 1)
        }

        $batHtml += @"
        <div class='card'>
            <h2>Batarya: $($bat.Name)</h2>
            <table class='info-table'>
                <tr><td>Durum</td><td>$($bat.Status)</td></tr>
                <tr><td>Sarj Seviyesi</td><td>% $($bat.EstimatedChargeRemaining)</td></tr>
                <tr><td>Sarj Suresi</td><td>$($bat.EstimatedRunTime) Dakika</td></tr>
                <tr><td>Saglik Durumu</td><td>% $health</td></tr>
                <tr><td>Voltaj</td><td>$($bat.DesignVoltage) mV</td></tr>
            </table>
        </div>
"@
    }
} else {
    $hasBattery = $false
    $batHtml = @"
    <div class='card warning'>
        <h2>BATARYA BULUNAMADI</h2>
        <p>Bu sistem bir <strong>Masaustu Bilgisayar</strong> veya bataryasiz bir sistemdir.</p>
        <p>Windows'un standart batarya raporu bu yuzden bos cikmaktadir. 
           Sistem dogrudan AC Guc kaynagina (Priz) baglidir.</p>
    </div>
"@
}

# Uyku Modu Destekleri (Powercfg parsing)
$sleepStates = powercfg /a | Out-String
# Basitlestirilmis ozet
$s0 = if ($sleepStates -match "Standby \(S0 Low Power Idle\)") { "Destekleniyor" } else { "Yok" }
$hiber = if ($sleepStates -match "Hibernate" -or $sleepStates -match "Hazirda Beklet") { "Acik" } else { "Kapali" }
$fast = if ($sleepStates -match "Fast Startup" -or $sleepStates -match "Hizli Baslatma") { "Aktif" } else { "Pasif" }

# --- 4. HTML RAPOR OLUSTURMA (MODERN TASARIM) ---
# ASCII script icinde Turkce HTML olusturuyoruz (Encoding UTF8 olacak)

$htmlContent = @"
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>PixTool Guc Raporu</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        header { border-bottom: 2px solid #00E676; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        h1 { margin: 0; color: #00E676; text-transform: uppercase; letter-spacing: 2px; }
        .dev-info { font-size: 0.9em; color: #888; text-align: right; }
        .card { background-color: #1e1e1e; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border-left: 5px solid #03DAC6; }
        .card.warning { border-left-color: #CF6679; }
        h2 { margin-top: 0; color: #03DAC6; font-size: 1.2em; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .warning h2 { color: #CF6679; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { padding: 10px; border-bottom: 1px solid #333; }
        .info-table tr:last-child td { border-bottom: none; }
        .info-table td:first-child { font-weight: bold; color: #bbb; width: 40%; }
        .highlight { color: #00E676; font-weight: bold; }
        .footer { text-align: center; margin-top: 40px; font-size: 0.8em; color: #555; }
        a { color: #03DAC6; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>PIXTOOL GUC RAPORU</h1>
                <small>Power Diagnostics Report</small>
            </div>
            <div class="dev-info">
                <strong>$DevName</strong><br>
                $DevTitle<br>
                <a href="https://$DevWeb">$DevWeb</a>
            </div>
        </header>

        <div class="card">
            <h2>Sistem Durumu</h2>
            <table class="info-table">
                <tr><td>Bilgisayar Adi</td><td>$pcName</td></tr>
                <tr><td>Model</td><td>$model</td></tr>
                <tr><td>Guc Kaynagi Tipi</td><td class="highlight">$statusText</td></tr>
                <tr><td>Aktif Guc Plani</td><td>$planName</td></tr>
            </table>
        </div>

        $batHtml

        <div class="card">
            <h2>Uyku ve Hazirda Bekletme</h2>
            <table class="info-table">
                <tr><td>Modern Bekleme (S0)</td><td>$s0</td></tr>
                <tr><td>Hazirda Bekletme (Hibernate)</td><td>$hiber</td></tr>
                <tr><td>Hizli Baslatma (Fast Boot)</td><td>$fast</td></tr>
            </table>
        </div>

        <div class="footer">
            Rapor Olusturma Tarihi: $(Get-Date -Format 'dd.MM.yyyy HH:mm') <br>
            PixTool Automation Scripts
        </div>
    </div>
</body>
</html>
"@

# Dosyayi UTF8 olarak kaydet (Turkce karakterler bozulmasin diye)
$htmlContent | Out-File -FilePath $ReportFile -Encoding UTF8

Write-Host " [OK] Rapor olusturuldu: $ReportFile" -ForegroundColor Green
Write-Host " Rapor aciliyor..." -ForegroundColor Gray

# Raporu Ac
Start-Process $ReportFile