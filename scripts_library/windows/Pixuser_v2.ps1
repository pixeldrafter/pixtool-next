<#
.SYNOPSIS
    PixUser v1.0 - TITAN USER MANAGER
    Developer: Omer Cataloglu
.DESCRIPTION
    Advanced Local User and Group Management Suite.
    Features: GUI/CLI Modes, Password Reset, Admin Privileges, Audit.
    Standards: ASCII Safe Mode, Out-Host, Modern UI.
#>

# --- 0. SISTEM HAZIRLIK ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# Gerekli Assembly'ler
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# --- 1. AYARLAR VE TEMA ---
$AppName       = "PixUser v1.0 | TITAN USER MANAGER"
$CopyrightTxt  = "Omer Cataloglu (c) 2026 - All Rights Reserved"

# Modern Dark Tema
$Color_BG      = [System.Drawing.Color]::FromArgb(30, 30, 30)
$Color_Panel   = [System.Drawing.Color]::FromArgb(45, 45, 48)
$Color_Grid    = [System.Drawing.Color]::FromArgb(35, 35, 35)
$Color_Text    = [System.Drawing.Color]::WhiteSmoke
$Color_Accent  = [System.Drawing.Color]::FromArgb(0, 120, 215)
$Color_Danger  = [System.Drawing.Color]::FromArgb(200, 50, 50)
$Color_Success = [System.Drawing.Color]::FromArgb(40, 160, 40)
$Color_Warning = [System.Drawing.Color]::FromArgb(255, 140, 0)

$Font_UI       = New-Object System.Drawing.Font("Segoe UI", 9)
$Font_Bold     = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$Font_Header   = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

# --- 2. FONKSIYON KUTUPHANESI (CORE) ---

function Get-AllUsers {
    # Get-LocalUser verisini PSCustomObject olarak donustur
    $users = Get-LocalUser
    $list = @()
    foreach ($u in $users) {
        # Admin mi kontrol et
        $isAdmin = $false
        $groups = Get-LocalGroupMember -Member $u.Name -ErrorAction SilentlyContinue
        if ($groups -match "Administrators" -or $groups -match "Yoneticiler") { $isAdmin = $true }
        
        $list += [PSCustomObject]@{
            Name        = $u.Name
            Enabled     = $u.Enabled
            Admin       = $isAdmin
            LastLogon   = if($u.LastLogon){ $u.LastLogon.ToString("yyyy-MM-dd HH:mm") } else { "Hic Giris Yapilmadi" }
            Description = $u.Description
            Status      = if($u.Enabled){ "Aktif" } else { "Devre Disi" }
        }
    }
    return $list
}

function Toggle-UserStatus {
    param($Name, $Enable)
    try {
        if ($Enable) { Enable-LocalUser -Name $Name; return "Kullanici AKTiF edildi." }
        else { Disable-LocalUser -Name $Name; return "Kullanici DEVRE DISI birakildi." }
    } catch { return "HATA: $($_.Exception.Message)" }
}

function Set-Password {
    param($Name, $Pass)
    try {
        $securePass = ConvertTo-SecureString $Pass -AsPlainText -Force
        Set-LocalUser -Name $Name -Password $securePass
        return "Sifre basariyla degistirildi."
    } catch { return "HATA: $($_.Exception.Message)" }
}

function Toggle-Admin {
    param($Name, $MakeAdmin)
    try {
        # 'Administrators' grubu yerel dilde farkli olabilir (SID S-1-5-32-544)
        $adminGroup = (Get-LocalGroup | Where-Object { $_.SID -like "S-1-5-32-544" }).Name
        
        if ($MakeAdmin) {
            Add-LocalGroupMember -Group $adminGroup -Member $Name
            return "$Name artik YONETICI (Admin)."
        } else {
            Remove-LocalGroupMember -Group $adminGroup -Member $Name
            return "$Name artik Standart Kullanici."
        }
    } catch { return "HATA: $($_.Exception.Message)" }
}

function Create-NewUser {
    param($Name, $Pass, $Desc)
    try {
        New-LocalUser -Name $Name -Password (ConvertTo-SecureString $Pass -AsPlainText -Force) -Description $Desc -FullName $Name
        return "Kullanici olusturuldu: $Name"
    } catch { return "HATA: $($_.Exception.Message)" }
}

function Delete-User {
    param($Name)
    try {
        Remove-LocalUser -Name $Name
        return "Kullanici SILINDI: $Name"
    } catch { return "HATA: $($_.Exception.Message)" }
}

# --- 3. GUI MODU ---

function Start-GUI {
    # Form
    $Form = New-Object System.Windows.Forms.Form
    $Form.Text = $AppName
    $Form.Size = New-Object System.Drawing.Size(1100, 700)
    $Form.StartPosition = "CenterScreen"
    $Form.BackColor = $Color_BG
    $Form.ForeColor = $Color_Text
    
    # --- Sol Panel (Islemler) ---
    $PanelLeft = New-Object System.Windows.Forms.Panel
    $PanelLeft.Dock = "Left"
    $PanelLeft.Width = 250
    $PanelLeft.BackColor = $Color_Panel
    $Form.Controls.Add($PanelLeft)

    # Buton Olusturucu
    function Add-Btn {
        param($Text, $Top, $Color, $Func)
        $btn = New-Object System.Windows.Forms.Button
        $btn.Text = $Text
        $btn.Top = $Top
        $btn.Left = 10
        $btn.Width = 230
        $btn.Height = 40
        $btn.FlatStyle = "Flat"
        $btn.BackColor = $Color
        $btn.ForeColor = "White"
        $btn.Font = $Font_Bold
        $btn.Add_Click($Func)
        $PanelLeft.Controls.Add($btn)
    }

    # --- Grid (Kullanici Listesi) ---
    $Grid = New-Object System.Windows.Forms.DataGridView
    $Grid.Location = New-Object System.Drawing.Point(260, 50)
    $Grid.Size = New-Object System.Drawing.Size(810, 500)
    $Grid.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Bottom -bor [System.Windows.Forms.AnchorStyles]::Left -bor [System.Windows.Forms.AnchorStyles]::Right
    $Grid.BackgroundColor = $Color_Grid
    $Grid.ForeColor = [System.Drawing.Color]::Black
    $Grid.RowHeadersVisible = $false
    $Grid.SelectionMode = "FullRowSelect"
    $Grid.MultiSelect = $false
    $Grid.AutoSizeColumnsMode = "Fill"
    $Grid.AllowUserToAddRows = $false
    $Form.Controls.Add($Grid)

    # Kolonlar
    $Grid.Columns.Add("Name", "Kullanici Adi") | Out-Null
    $Grid.Columns.Add("Status", "Durum") | Out-Null
    $Grid.Columns.Add("Admin", "Yonetici mi?") | Out-Null
    $Grid.Columns.Add("LastLogon", "Son Giris") | Out-Null
    $Grid.Columns.Add("Desc", "Aciklama") | Out-Null

    # Status Bar
    $LblStatus = New-Object System.Windows.Forms.Label
    $LblStatus.Text = "Sistem hazir."
    $LblStatus.Location = New-Object System.Drawing.Point(260, 20)
    $LblStatus.Size = New-Object System.Drawing.Size(800, 25)
    $LblStatus.ForeColor = "Cyan"
    $LblStatus.Font = $Font_Bold
    $Form.Controls.Add($LblStatus)

    # Footer
    $LblFooter = New-Object System.Windows.Forms.Label
    $LblFooter.Text = $CopyrightTxt
    $LblFooter.Dock = "Bottom"
    $LblFooter.Height = 30
    $LblFooter.TextAlign = "MiddleCenter"
    $LblFooter.ForeColor = [System.Drawing.Color]::Cyan
    $Form.Controls.Add($LblFooter)

    # --- Grid Doldur ---
    $Script:RefreshGrid = {
        $Grid.Rows.Clear()
        $users = Get-AllUsers
        foreach ($u in $users) {
            $Grid.Rows.Add($u.Name, $u.Status, $u.Admin, $u.LastLogon, $u.Description) | Out-Null
        }
        $LblStatus.Text = "Toplam Kullanici: $($users.Count)"
    }

    # --- Islem Butonlari ---
    
    # 1. Yenile
    Add-Btn "LİSTEYİ YENİLE" 20 $Color_Accent { & $Script:RefreshGrid }

    # 2. Yeni Kullanici
    Add-Btn "YENİ KULLANICI EKLE (+)" 70 $Color_Success {
        $uName = [Microsoft.VisualBasic.Interaction]::InputBox("Kullanici Adi:", "Yeni Hesap", "")
        if ($uName) {
            $uPass = [Microsoft.VisualBasic.Interaction]::InputBox("Sifre:", "Yeni Hesap", "")
            $res = Create-NewUser $uName $uPass "PixUser ile olusturuldu"
            [System.Windows.Forms.MessageBox]::Show($res)
            & $Script:RefreshGrid
        }
    }

    # 3. Sifre Sifirla
    Add-Btn "ŞİFRE SIFIRLA (RESET)" 120 $Color_Warning {
        if ($Grid.SelectedRows.Count -gt 0) {
            $name = $Grid.SelectedRows[0].Cells[0].Value
            $newPass = [Microsoft.VisualBasic.Interaction]::InputBox("$name icin YENI sifre girin:", "Sifre Sifirla", "")
            if ($newPass) {
                $res = Set-Password $name $newPass
                [System.Windows.Forms.MessageBox]::Show($res)
            }
        } else { [System.Windows.Forms.MessageBox]::Show("Lutfen bir kullanici secin.") }
    }

    # 4. Aktif/Pasif
    Add-Btn "AKTİF / PASİF YAP" 170 $Color_Panel {
        if ($Grid.SelectedRows.Count -gt 0) {
            $name = $Grid.SelectedRows[0].Cells[0].Value
            $status = $Grid.SelectedRows[0].Cells[1].Value
            if ($status -eq "Aktif") {
                $res = Toggle-UserStatus $name $false
            } else {
                $res = Toggle-UserStatus $name $true
            }
            $LblStatus.Text = $res
            & $Script:RefreshGrid
        }
    }

    # 5. Yonetici Yap/Al
    Add-Btn "YÖNETİCİ YAP / AL" 220 $Color_Panel {
        if ($Grid.SelectedRows.Count -gt 0) {
            $name = $Grid.SelectedRows[0].Cells[0].Value
            $isAdmin = $Grid.SelectedRows[0].Cells[2].Value
            
            if ($isAdmin -eq $true) {
                if ([System.Windows.Forms.MessageBox]::Show("$name kullanicisindan ADMIN yetkisini almak istiyor musunuz?", "Onay", "YesNo") -eq "Yes") {
                    $res = Toggle-Admin $name $false
                    [System.Windows.Forms.MessageBox]::Show($res)
                }
            } else {
                if ([System.Windows.Forms.MessageBox]::Show("$name kullanicisini ADMIN yapmak istiyor musunuz?", "Onay", "YesNo") -eq "Yes") {
                    $res = Toggle-Admin $name $true
                    [System.Windows.Forms.MessageBox]::Show($res)
                }
            }
            & $Script:RefreshGrid
        }
    }

    # 6. Sil
    Add-Btn "KULLANICIYI SİL (DELETE)" 270 $Color_Danger {
        if ($Grid.SelectedRows.Count -gt 0) {
            $name = $Grid.SelectedRows[0].Cells[0].Value
            if ([System.Windows.Forms.MessageBox]::Show("$name kullanicisi ve tum dosyalari SILINECEK! Emin misiniz?", "TEHLIKE", "YesNo", "Error") -eq "Yes") {
                $res = Delete-User $name
                [System.Windows.Forms.MessageBox]::Show($res)
                & $Script:RefreshGrid
            }
        }
    }

    # Baslat
    & $Script:RefreshGrid
    $Form.Add_Shown({ $Form.Activate() })
    [void]$Form.ShowDialog()
}

# --- 4. CLI MODU (TERMINAL) ---

function Start-CLI {
    while ($true) {
        Clear-Host
        Write-Host " ===========================================" -ForegroundColor Cyan
        Write-Host "  PIXUSER v1.0 | CLI MODE (SAFE TURKISH)    " -ForegroundColor White
        Write-Host " ===========================================" -ForegroundColor Cyan
        Write-Host " 1. [LISTE] Kullanicilari Listele" -ForegroundColor Yellow
        Write-Host " 2. [EKLE]  Yeni Kullanici Olustur" -ForegroundColor Green
        Write-Host " 3. [SIFRE] Sifre Sifirla" -ForegroundColor Magenta
        Write-Host " 4. [ADMIN] Yonetici Yap/Geri Al" -ForegroundColor Cyan
        Write-Host " 5. [DURUM] Aktif/Pasif Yap" -ForegroundColor Yellow
        Write-Host " 6. [SIL]   Kullanici Sil" -ForegroundColor Red
        Write-Host " Q. CIKIS" -ForegroundColor Red
        
        $c = Read-Host " Secim"
        if ($c -eq 'Q') { return }
        
        if ($c -eq '1') {
            Get-AllUsers | Format-Table -AutoSize
            Read-Host "Devam..."
        }
        if ($c -eq '2') {
            $u = Read-Host " Kullanici Adi"; $p = Read-Host " Sifre"; Create-NewUser $u $p "CLI"
            Read-Host "Devam..."
        }
        if ($c -eq '3') {
            $u = Read-Host " Kullanici Adi"; $p = Read-Host " Yeni Sifre"; Set-Password $u $p
            Read-Host "Devam..."
        }
        if ($c -eq '4') {
            $u = Read-Host " Kullanici Adi"; $opt = Read-Host " Yonetici Olsun mu? (E/H)"; 
            if($opt -eq "E"){Toggle-Admin $u $true}else{Toggle-Admin $u $false}
            Read-Host "Devam..."
        }
        if ($c -eq '6') {
            $u = Read-Host " SILINECEK Kullanici Adi"; Delete-User $u
            Read-Host "Devam..."
        }
    }
}

# --- 5. ANA MENU ---

Clear-Host
Write-Host " "
Write-Host "  PIXUSER v1.0 | TITAN USER MANAGER" -ForegroundColor Cyan
Write-Host "  ---------------------------------" -ForegroundColor Gray
Write-Host "  1. GUI ARAYUZU (Onerilen)" -ForegroundColor Green
Write-Host "  2. CLI MODU (Terminal)" -ForegroundColor Yellow
Write-Host " "
$m = Read-Host "  SECIM (1/2)"

if ($m -eq '2') { Start-CLI } else { Start-GUI }