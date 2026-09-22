<#
.SYNOPSIS
    PixTool OEM Branding Manager (Auto-Open Edition)
    Developer: Omer Cataloglu
.DESCRIPTION
    Sets OEM Registry keys, installs logo, and automatically opens the 'About' page.
#>

# --- 1. OTOMATIK YONETICI IZNI ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Yonetici izni aliniyor..." -ForegroundColor Yellow
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# --- 2. AYARLAR ---
$DevBrand    = "Omer Cataloglu Tech Services"
$DevModel    = "PixTool Pro Workstation"
$DevWeb      = "https://omercataloglu.com"
$DevSupport  = "0533 701 00 89"
$DevHours    = "09:00 - 18:00"
$LogoUrl     = "https://omercataloglu.com/wp-content/uploads/2025/04/Basliksiz-2-1-300x560.png"
$RegPath     = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation"
$LogoDest    = "C:\Windows\System32\oemlogo.bmp"

# .NET Grafik Kutuphanesini Yukle
Add-Type -AssemblyName System.Drawing

# Konsol Temizligi
Clear-Host
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "      PIXTOOL OEM BRANDING MANAGER (AUTO-OPEN)" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

# --- 3. LOGO ISLEMLERI ---
function Install-Logo {
    Write-Host "`n[ISLEM] Logo indiriliyor ve ayarlaniyor..." -ForegroundColor Cyan
    $TempFile = "$env:TEMP\temp_logo_download.png"

    try {
        # TLS 1.2 Destegi
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $LogoUrl -OutFile $TempFile -UseBasicParsing

        # Resmi Isle (120x120 BMP)
        $OriginalImage = [System.Drawing.Image]::FromFile($TempFile)
        $NewImage = New-Object System.Drawing.Bitmap(120, 120)
        $Graphics = [System.Drawing.Graphics]::FromImage($NewImage)
        
        $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        $Graphics.DrawImage($OriginalImage, 0, 0, 120, 120)
        $NewImage.Save($LogoDest, [System.Drawing.Imaging.ImageFormat]::Bmp)
        
        $Graphics.Dispose()
        $NewImage.Dispose()
        $OriginalImage.Dispose()
        Remove-Item $TempFile -Force -ErrorAction SilentlyContinue

        Write-Host " [OK] Logo sisteme islendi." -ForegroundColor Green
        return $true
    } catch {
        Write-Host " [HATA] Logo islenirken hata olustu: $_" -ForegroundColor Red
        return $false
    }
}

# --- 4. KAYIT DEFTERI ISLEMLERI ---
Write-Host "`n[ISLEM] OEM Bilgileri Yaziliyor..." -ForegroundColor Cyan

if (!(Test-Path $RegPath)) { New-Item -Path $RegPath -Force | Out-Null }

function Set-RegValue {
    param($Name, $Value)
    try {
        Set-ItemProperty -Path $RegPath -Name $Name -Value $Value -Type String -Force
        Write-Host " [OK] $($Name): $Value" -ForegroundColor Green
    } catch {
        Write-Host " [HATA] $Name yazilamadi!" -ForegroundColor Red
    }
}

Set-RegValue -Name "Manufacturer" -Value $DevBrand
Set-RegValue -Name "Model"        -Value $DevModel
Set-RegValue -Name "SupportURL"   -Value $DevWeb
Set-RegValue -Name "SupportPhone" -Value $DevSupport
Set-RegValue -Name "SupportHours" -Value $DevHours

$LogoSuccess = Install-Logo
if ($LogoSuccess) { Set-RegValue -Name "Logo" -Value $LogoDest }

Write-Host "`n------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "[BASARILI] Islemler bitti. Pencere aciliyor..." -ForegroundColor Green
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan

# --- 5. HEDEF PENCEREYI ACMA ---
# Windows 10/11 'Hakkinda' sayfasini acar
Start-Process "ms-settings:about"

Start-Sleep -Seconds 2