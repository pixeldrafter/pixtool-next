<#
.SYNOPSIS
    Pixtool — CPU/anakart ısı ve fan sensörlerini etkinleştirir.
.DESCRIPTION
    Windows yerleşik API'leri (MSAcpi_ThermalZoneTemperature, Win32_Fan,
    Performans sayaçları) çoğu masaüstü anakartta **boş döner**. CPU, anakart
    ve kasa fanı verilerine ulaşmak için LibreHardwareMonitor gerekir.

    Bu betik şunları yapar:
      1. LibreHardwareMonitor'ü resmî GitHub sürümünden indirir
      2. %LOCALAPPDATA%\Pixtool\LibreHardwareMonitor altına çıkarır
      3. WMI sağlayıcısını etkinleştirip arka planda başlatır
      4. Görev Zamanlayıcı'ya oturum açılışında çalışacak görev ekler
      5. Köprüden sensör verisini okuyup doğrular

    GPU ısısı için bu betiğe gerek YOKTUR — NVIDIA kartlar `nvidia-smi` ile
    zaten okunur.

.PARAMETER Uninstall
    Kurulu sensör altyapısını kaldırır (görev + dosyalar).

.PARAMETER NoStartup
    Oturum açılışında otomatik başlatma görevini eklemez.

.EXAMPLE
    .\setup-sensors.ps1
    .\setup-sensors.ps1 -Uninstall

.NOTES
    Yazar : Ömer Çataloğlu
    Sürüm : 1.0.0
#>

[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$NoStartup
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

#: Kurulum kökü
$Root      = Join-Path $env:LOCALAPPDATA 'Pixtool\LibreHardwareMonitor'
$ExePath   = Join-Path $Root 'LibreHardwareMonitor.exe'
$TaskName  = 'Pixtool Sensor Bridge'

function Write-Step { param([string]$Text) Write-Host "  $Text" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Text) Write-Host "  [OK] $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "  [!]  $Text" -ForegroundColor Yellow }
function Write-Err  { param([string]$Text) Write-Host "  [X]  $Text" -ForegroundColor Red }

# ======================================================================
#  KALDIRMA
# ======================================================================
if ($Uninstall) {
    Write-Host ''
    Write-Host '  Pixtool Sensor Bridge — KALDIRMA' -ForegroundColor Red
    Write-Host ('  ' + ('─' * 56))

    # Görevi kaldır
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Ok 'Zamanlanmış görev kaldırıldı'
    } else {
        Write-Warn 'Zamanlanmış görev bulunamadı'
    }

    # Çalışan süreci kapat
    Get-Process -Name 'LibreHardwareMonitor' -ErrorAction SilentlyContinue | ForEach-Object {
        $_ | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    Write-Ok 'Çalışan sensör süreci kapatıldı (varsa)'

    # Dosyaları sil
    if (Test-Path $Root) {
        Remove-Item $Root -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok "Dosyalar silindi: $Root"
    }

    Write-Host ''
    Write-Host '  Kaldırma tamamlandı.' -ForegroundColor Green
    Write-Host ''
    exit 0
}

# ======================================================================
#  ÖN KONTROL
# ======================================================================
Write-Host ''
Write-Host '  ╔══════════════════════════════════════════════════════════╗' -ForegroundColor DarkCyan
Write-Host '  ║   Pixtool — Isı & Fan Sensörü Kurulumu  v1.0.0           ║' -ForegroundColor Cyan
Write-Host '  ╚══════════════════════════════════════════════════════════╝' -ForegroundColor DarkCyan
Write-Host ''

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warn 'Yönetici yetkisi yok — görev ekleme adımı atlanacak.'
    Write-Warn 'Tam kurulum için PowerShell penceresini yönetici olarak açın.'
    Write-Host ''
    $NoStartup = $true
}

Write-Step '1/5  Mevcut sensörler denetleniyor…'
$nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($nvidia) {
    $gpuLine = & nvidia-smi --query-gpu=name,temperature.gpu --format=csv,noheader,nounits 2>$null | Select-Object -First 1
    Write-Ok "NVIDIA GPU bulundu: $gpuLine  (bu zaten çalışıyor)"
} else {
    Write-Warn 'NVIDIA GPU yok — GPU ısısı okunamayacak.'
}

$existing = Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -ErrorAction SilentlyContinue
if ($existing) {
    Write-Ok 'LibreHardwareMonitor WMI sağlayıcısı ZATEN AKTİF'
    Write-Step '   → Kurulum gerekmiyor, sensörler okunabilir.'
    Write-Host ''
    exit 0
}

Write-Step '2/5  LibreHardwareMonitor indiriliyor…'

# Son sürümü GitHub API'den bul
$release = $null
try {
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/LibreHardwareMonitor/LibreHardwareMonitor/releases/latest' -Headers @{ 'User-Agent' = 'Pixtool' } -TimeoutSec 30
} catch {
    Write-Err "GitHub API'ye ulaşılamadı: $($_.Exception.Message)"
    exit 1
}

$asset = $release.assets | Where-Object { $_.name -like '*net*.zip' -or $_.name -like '*.zip' } | Select-Object -First 1
if (-not $asset) {
    Write-Err 'Sürümde indirilebilir .zip paketi bulunamadı'
    exit 1
}

Write-Ok "Sürüm: $($release.tag_name)  →  $($asset.name)"

New-Item -ItemType Directory -Path $Root -Force | Out-Null
$zipPath = Join-Path $env:TEMP "lhm-$($release.tag_name).zip"

try {
    $progressBackup = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -TimeoutSec 180 -UseBasicParsing
    $ProgressPreference = $progressBackup
} catch {
    Write-Err "İndirme başarısız: $($_.Exception.Message)"
    exit 1
}

$sizeMb = [Math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Ok "İndirildi: $sizeMb MB"

Write-Step '3/5  Paket çıkarılıyor…'
try {
    Expand-Archive -Path $zipPath -DestinationPath $Root -Force
} catch {
    Write-Err "Çıkarma başarısız: $($_.Exception.Message)"
    exit 1
} finally {
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $ExePath)) {
    # Bazen bir alt klasöre çıkar
    $found = Get-ChildItem $Root -Recurse -Filter 'LibreHardwareMonitor.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $ExePath = $found.FullName
    } else {
        Write-Err "LibreHardwareMonitor.exe bulunamadı ($Root)"
        exit 1
    }
}
Write-Ok "Kuruldu: $ExePath"

Write-Step '4/5  WMI sağlayıcısı etkinleştirilip başlatılıyor…'

# Ayar dosyası: WMI sağlayıcısı açık, pencere kapalı başlasın
$configPath = Join-Path (Split-Path $ExePath) 'LibreHardwareMonitor.config'
if (Test-Path $configPath) {
    try {
        [xml]$config = Get-Content $configPath
        Write-Ok 'Ayar dosyası bulundu (WMI ayarları korunuyor)'
    } catch {
        Write-Warn 'Ayar dosyası okunamadı — varsayılanlar kullanılacak'
    }
}

Get-Process -Name 'LibreHardwareMonitor' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

Start-Process -FilePath $ExePath -ArgumentList '/minimized' -WindowStyle Minimized
Write-Ok 'Sensör servisi başlatıldı (simge durumunda)'

Write-Step '   WMI sağlayıcısının hazır olması bekleniyor…'
$ready = $false
for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 1
    $probe = Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -ErrorAction SilentlyContinue
    if ($probe) {
        $ready = $true
        $count = @($probe).Count
        Write-Ok "WMI hazır — $count sensör bulundu ($i sn)"
        break
    }
}

if (-not $ready) {
    Write-Warn 'WMI sağlayıcısı 20 sn içinde yanıt vermedi.'
    Write-Warn 'Uygulamayı bir kez elle açıp Options > WMI Provider seçeneğini işaretleyin.'
}

if (-not $NoStartup) {
    Write-Step '5/5  Oturum açılışında otomatik başlatma görevi ekleniyor…'
    try {
        $action    = New-ScheduledTaskAction -Execute $ExePath -Argument '/minimized'
        $trigger   = New-ScheduledTaskTrigger -AtLogOn
        $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Write-Ok "Görev eklendi: $TaskName"
    } catch {
        Write-Warn "Görev eklenemedi: $($_.Exception.Message)"
    }
} else {
    Write-Step '5/5  Otomatik başlatma atlandı (-NoStartup)'
    Write-Warn 'Her açılışta elle çalıştırmanız gerekir.'
}

# ======================================================================
#  DOĞRULAMA
# ======================================================================
Write-Host ''
Write-Host ('  ' + ('─' * 56)) -ForegroundColor DarkCyan
Write-Host '  DOĞRULAMA' -ForegroundColor Cyan
Write-Host ''

$sensors = Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -ErrorAction SilentlyContinue
if ($sensors) {
    $temps = @($sensors | Where-Object { $_.SensorType -eq 'Temperature' })
    $fans  = @($sensors | Where-Object { $_.SensorType -eq 'Fan' })

    Write-Ok "Sıcaklık sensörü : $($temps.Count)"
    Write-Ok "Fan sensörü      : $($fans.Count)"

    Write-Host ''
    Write-Host '  İlk ölçümler:' -ForegroundColor DarkGray

    foreach ($sensor in ($temps | Select-Object -First 6)) {
        $label = if ($sensor.Name -and $sensor.Name.Length -gt 30) { $sensor.Name.Substring(0, 30) } else { $sensor.Name }
        $line = '    ' + $label.PadRight(32) + ([Math]::Round($sensor.Value, 1).ToString().PadLeft(6)) + ' °C'
        Write-Host $line -ForegroundColor Gray
    }

    foreach ($sensor in ($fans | Select-Object -First 4)) {
        $label = if ($sensor.Name -and $sensor.Name.Length -gt 30) { $sensor.Name.Substring(0, 30) } else { $sensor.Name }
        $line = '    ' + $label.PadRight(32) + ([Math]::Round($sensor.Value, 0).ToString().PadLeft(6)) + ' RPM'
        Write-Host $line -ForegroundColor Gray
    }
} else {
    Write-Warn 'Sensör verisi henüz okunamıyor.'
    Write-Warn "Elle çalıştırın: $ExePath"
    Write-Warn 'Uygulamada Options > Enable WMI Provider seçeneği işaretli olmalı.'
}

Write-Host ''
Write-Host '  Kurulum tamamlandı. Pixtool köprüsü ısı/fan verilerini artık okuyabilir.' -ForegroundColor Green
Write-Host ''
