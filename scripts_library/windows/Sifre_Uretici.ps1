<#
.SYNOPSIS
    PixPass v6.0 - Ultimate Stable Edition
    Developer: Omer Cataloglu
.DESCRIPTION
    Fixed ASCII art syntax errors using literal strings.
    Enhanced visual stability and "Hollywood" effects.
#>

# --- 0. SISTEM HAZIRLIK ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# --- 1. AYARLAR ---
$Global:CfgLength     = 16
$Global:CfgSpecial    = $true
$Global:CfgNumbers    = $true
$Global:CfgUpper      = $true
$Global:CfgReadable   = $false 

# --- 2. KIMLIK ---
$DevName  = "Omer Cataloglu"
$DevWeb   = "omercataloglu.com"
$DevMail  = "pixeldrafter@omercataloglu.com"
$DevPhone = "0533 701 00 89"

# Konsol Ayarlari
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "PixPass v6.0 | SYSTEM SECURE SHELL"
Add-Type -AssemblyName System.Windows.Forms

# --- 3. GORSEL EFEKTLER ---

function Play-Sound {
    param($Type)
    # Hata durumunda ses cikar ama scripti durdurmaz
    try {
        if ($Type -eq "Success") { [Console]::Beep(1000, 150) }
        if ($Type -eq "Error")   { [Console]::Beep(500, 300) }
        if ($Type -eq "Boot")    { [Console]::Beep(400, 100); Start-Sleep -m 50; [Console]::Beep(600, 100) }
    } catch {}
}

function Cizgi-Cek { return "-" * 78 }

function Boot-Animation {
    Clear-Host
    Play-Sound "Boot"
    Write-Host " BIOS DATE 01/27/26 15:22:00 VER 6.0" -ForegroundColor DarkGray
    Write-Host " CPU: PixTool Quantum Core @ 9.9GHz" -ForegroundColor DarkGray
    Write-Host ""
    $checks = @("Memory Test", "Crypto Engine", "Entropy Pool", "GUI Interface")
    
    foreach ($c in $checks) {
        Write-Host " CHECKING $c " -NoNewline -ForegroundColor Gray
        Start-Sleep -Milliseconds 100
        for ($i=0; $i -lt 5; $i++) { Write-Host "." -NoNewline -ForegroundColor DarkGray; Start-Sleep -Milliseconds 50 }
        Write-Host " OK" -ForegroundColor Green
    }
    Start-Sleep -Milliseconds 400
    Clear-Host
}

function Logo-Ciz {
    Clear-Host
    # -- HEADER --
    # ASCII karakterlerini hatasiz basmak icin Tek Tirnak ' kullaniyoruz
    Write-Host ' ╔════════════════════════════════════════════════════════════════════════════╗' -ForegroundColor Green
    Write-Host ' ║  ACCESS GRANTED : ADMIN LEVEL 5                                            ║' -ForegroundColor Green
    Write-Host ' ╚════════════════════════════════════════════════════════════════════════════╝' -ForegroundColor Green
    Write-Host ""
    
    # -- GULUCUK VE ANAHTAR (Tek Tirnak Onemli!) --
    Write-Host '      .---.  ' -ForegroundColor Yellow -NoNewline
    Write-Host '      ( ^ _ ^ ) ' -ForegroundColor Cyan -NoNewline
    Write-Host ' < SYSTEM READY.' -ForegroundColor DarkGray
    Write-Host '     /     \ ' -ForegroundColor Yellow
    Write-Host '     | (_) | ' -ForegroundColor Yellow
    Write-Host '     |     | ' -ForegroundColor Yellow
    
    # -- PIXPASS LOGO --
    Write-Host '  _______  __  __   __  _______  _______  _______  _______ ' -ForegroundColor Magenta
    Write-Host ' |   _   ||  ||  |_|  ||       ||   _   ||       ||       |' -ForegroundColor Magenta
    Write-Host ' |  |_|  ||  ||       ||    _  ||  |_|  ||  _____||  _____|' -ForegroundColor Magenta
    Write-Host ' |   ____||  ||       ||   |_| ||       || |_____ | |_____ ' -ForegroundColor Magenta
    Write-Host ' |  |     |  ||   _   ||    ___||       ||_____  ||_____  |' -ForegroundColor Magenta
    Write-Host ' |__|     |__||__| |__||___|    |___|___| _____| | _____| |' -ForegroundColor Magenta
    Write-Host '                                         |_______||_______|' -ForegroundColor Magenta

    Write-Host ""
    Write-Host " v6.0 ULTIMATE EDITION" -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " Gelistirici: $DevName" -ForegroundColor Gray
    Write-Host " Web        : $DevWeb" -ForegroundColor Gray
    Write-Host " Iletisim   : $DevPhone" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

function Loading-Spinner ($Msg) {
    Write-Host " $Msg " -NoNewline -ForegroundColor Yellow
    $spin = @("-", "\", "|", "/")
    for ($i=0; $i -lt 12; $i++) {
        foreach ($s in $spin) {
            Write-Host "`b$s" -NoNewline -ForegroundColor Cyan
            Start-Sleep -Milliseconds 40
        }
    }
    Write-Host "`b " -NoNewline
    Write-Host "[OK]" -ForegroundColor Green
}

function Guc-Gorsel ($entropy) {
    $score = [math]::Min(10, [math]::Round($entropy / 10))
    Write-Host " GUVENLIK SEVIYESI: " -NoNewline -ForegroundColor Gray
    Write-Host "[" -NoNewline -ForegroundColor White
    for ($i=1; $i -le 10; $i++) {
        if ($i -le $score) {
            $col = "Red"; if ($score -gt 4) {$col="Yellow"}; if ($score -gt 7) {$col="Green"}
            Write-Host "█" -NoNewline -ForegroundColor $col
        } else {
            Write-Host "░" -NoNewline -ForegroundColor DarkGray
        }
    }
    Write-Host "]" -NoNewline -ForegroundColor White
}

function Renkli-Yazdir ($pass) {
    # Arka plani siyah yaparak vurgula
    Write-Host " " -NoNewline -BackgroundColor Black
    $chars = $pass.ToCharArray()
    foreach ($c in $chars) {
        if ($c -match "[0-9]") { Write-Host "$c" -NoNewline -ForegroundColor Yellow -BackgroundColor Black }
        elseif ($c -match "[^a-zA-Z0-9]") { Write-Host "$c" -NoNewline -ForegroundColor Magenta -BackgroundColor Black }
        else { Write-Host "$c" -NoNewline -ForegroundColor White -BackgroundColor Black }
    }
    Write-Host " " -BackgroundColor Black
}

# --- 4. KRIPTOGRAFI ---

function Generate-Core {
    param ($Len, $Spec, $Num, $Upp, $Read)
    $lower = "abcdefghijklmnopqrstuvwxyz"
    $upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    $nums  = "0123456789"
    $syms  = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    
    if ($Read) {
        $lower = $lower -replace "[lo]", ""; $upper = $upper -replace "[IO]", ""; $nums = $nums -replace "[10]", ""; $syms = "!@#$%&*?+-" 
    }

    $pool = $lower
    if ($Upp) { $pool += $upper }
    if ($Num) { $pool += $nums }
    if ($Spec) { $pool += $syms }

    if ($pool.Length -eq 0) { return "ERROR" }

    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $b = New-Object byte[]($Len)
    $rng.GetBytes($b)

    $res = ""
    foreach ($x in $b) {
        $res += $pool[$x % $pool.Length]
    }
    return $res
}

function Analyze-Core ($pw) {
    $pS = 0
    if ($pw -match "[a-z]"){$pS+=26}
    if ($pw -match "[A-Z]"){$pS+=26}
    if ($pw -match "[0-9]"){$pS+=10}
    if ($pw -match "[^a-zA-Z0-9]"){$pS+=32}
    
    $ent = [math]::Log($pS)/[math]::Log(2)*$pw.Length
    $sec = [math]::Pow(2, $ent)/100000000000
    
    $t="Aninda"
    if($sec -gt 1){$t="Saniyeler"}
    if($sec -gt 60){$t="Dakikalar"}
    if($sec -gt 3600){$t="Saatler"}
    if($sec -gt 86400){$t="$([math]::Round($sec/86400)) Gun"}
    if($sec -gt 31536000){ 
        $y=[math]::Round($sec/31536000)
        if($y -gt 1000000){$t="SONSUZLUK"}else{$t="$y Yil"} 
    }
    return @{Ent=[math]::Round($ent); Time=$t}
}

# --- 5. ARAYUZ ---

function Settings-GUI {
    while ($true) {
        Logo-Ciz
        Write-Host " [ KONFIGURASYON TERMINALI ]" -ForegroundColor Yellow; Write-Host ""
        
        $st = @{ $true="[ACIK]"; $false="[KAPALI]" }
        Write-Host " [1] UZUNLUK AYARI      : $Global:CfgLength Karakter" -ForegroundColor Gray
        Write-Host " [2] OZEL KARAKTERLER   : $($st[$Global:CfgSpecial])" -ForegroundColor Gray
        Write-Host " [3] RAKAMLAR (0-9)     : $($st[$Global:CfgNumbers])" -ForegroundColor Gray
        Write-Host " [4] BUYUK HARFLER      : $($st[$Global:CfgUpper])" -ForegroundColor Gray
        Write-Host " [5] OKUNABILIRLIK MODU : $($st[$Global:CfgReadable])" -ForegroundColor Gray
        Write-Host " [6] GERI DON" -ForegroundColor White
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host " KOMUT"
        switch ($c) {
            "1" { $i=Read-Host " YENI DEGER (6-128)"; if($i -match "^\d+$" -and $i -ge 6){$Global:CfgLength=[int]$i} }
            "2" { $Global:CfgSpecial = -not $Global:CfgSpecial }
            "3" { $Global:CfgNumbers = -not $Global:CfgNumbers }
            "4" { $Global:CfgUpper   = -not $Global:CfgUpper }
            "5" { $Global:CfgReadable = -not $Global:CfgReadable }
            "6" { return }
        }
    }
}

function Main-Loop {
    Boot-Animation
    while ($true) {
        Logo-Ciz
        Write-Host " SISTEM DURUMU: " -NoNewline -ForegroundColor DarkGray
        Write-Host "$Global:CfgLength BIT" -NoNewline -ForegroundColor Cyan
        if ($Global:CfgSpecial) { Write-Host " +SEMBOL" -NoNewline -ForegroundColor Magenta }
        if ($Global:CfgNumbers) { Write-Host " +RAKAM" -NoNewline -ForegroundColor Yellow }
        Write-Host ""; Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        Write-Host " [1] TEKLI URETIM (HIZLI + PANO)" -ForegroundColor White
        Write-Host " [2] COKLU URETIM (MATRIX SHOW)" -ForegroundColor White
        Write-Host " [3] AYARLAR" -ForegroundColor Gray
        Write-Host " [4] SISTEMI KAPAT" -ForegroundColor Gray
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $cmd = Read-Host " GIRIS"
        
        if ($cmd -eq "1") {
            $pass = Generate-Core $Global:CfgLength $Global:CfgSpecial $Global:CfgNumbers $Global:CfgUpper $Global:CfgReadable
            $inf = Analyze-Core $pass
            Play-Sound "Success"
            
            Write-Host "`n [ OLUSTURULAN PAROLA ]" -ForegroundColor Yellow
            Renkli-Yazdir $pass
            Write-Host ""
            Guc-Gorsel $inf.Ent
            Write-Host " KIRILMA: $($inf.Time)" -ForegroundColor Gray
            
            try { [System.Windows.Forms.Clipboard]::SetText($pass)
                  Write-Host "`n [OK] PANOYA KOPYALANDI." -ForegroundColor Green } catch {}
            Read-Host " [ENTER] DEVAM..."
        }
        elseif ($cmd -eq "2") {
            Write-Host "`n MATRIX MOTORU BASLATILIYOR..." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 500
            
            $batchList = @()
            for ($i=1; $i -le 25; $i++) {
                $p = Generate-Core $Global:CfgLength $Global:CfgSpecial $Global:CfgNumbers $Global:CfgUpper $Global:CfgReadable
                $batchList += $p
                
                # Show Effect
                Write-Host " DATA_STREAM_0x$($i.ToString('X')) > " -NoNewline -ForegroundColor DarkGray
                Start-Sleep -Milliseconds 25
                Renkli-Yazdir $p
            }
            Play-Sound "Success"
            Write-Host "`n [TAMAM] 25 ADET SIFRELENMIS VERI URETILDI." -ForegroundColor Yellow
            
            $s = Read-Host " MASAUSTUNE KAYDEDILSIN MI? (E/H)"
            if ($s -eq "e" -or $s -eq "E") {
                $f = "$([Environment]::GetFolderPath('Desktop'))\PixPass_List_$(Get-Date -Format 'HHmm').txt"
                $o = @()
                $o += "--- PIXPASS v6.0 LIST ---"
                $o += "DATE: $(Get-Date)"
                $o += ""
                
                $counter = 1
                foreach ($item in $batchList) {
                    $line = "[$($counter.ToString('00'))] $item"
                    $o += $line
                    $counter++
                }
                
                $o | Out-File $f -Encoding UTF8
                Write-Host " [OK] DOSYA KAYDEDILDI: $f" -ForegroundColor Green
                Play-Sound "Success"
            }
            Read-Host " [ENTER] DEVAM..."
        }
        elseif ($cmd -eq "3") { Settings-GUI }
        elseif ($cmd -eq "4") { 
            Write-Host " SISTEM KAPATILIYOR..." -ForegroundColor Red
            Play-Sound "Boot"
            Exit 
        }
    }
}

Main-Loop