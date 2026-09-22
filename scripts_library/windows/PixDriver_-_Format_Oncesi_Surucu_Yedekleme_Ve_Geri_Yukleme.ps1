<#
.SYNOPSIS
    PixDriver v5.0 - TITAN DRIVER MANAGER (REBORN)
    Developer: Omer Cataloglu
.DESCRIPTION
    The Ultimate Device and Driver Management Suite.
    Architecture: Tab-based Modern GUI (Like PixSoft), Safe ASCII.
    Features: Backup/Restore Engine, Device Inventory, Ghost Detection.
#>

# --- 0. SISTEM HAZIRLIK ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# Gerekli Kutuphaneler
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# --- 1. AYARLAR VE TEMA ---
$AppName       = "PixDriver v5.0 | TITAN DRIVER MANAGER"
$CopyrightTxt  = "Omer Cataloglu (c) 2026 - All Rights Reserved"
$DefaultBackup = "$([Environment]::GetFolderPath('Desktop'))\PixDriver_Backup"

# Renk Paleti (Modern Dark)
$Color_BG      = [System.Drawing.Color]::FromArgb(30, 30, 30)
$Color_Panel   = [System.Drawing.Color]::FromArgb(45, 45, 48)
$Color_Grid    = [System.Drawing.Color]::FromArgb(35, 35, 35)
$Color_Text    = [System.Drawing.Color]::WhiteSmoke
$Color_Accent  = [System.Drawing.Color]::FromArgb(0, 120, 215)
$Color_Success = [System.Drawing.Color]::FromArgb(40, 160, 40)
$Color_Danger  = [System.Drawing.Color]::FromArgb(200, 50, 50)
$Color_Warning = [System.Drawing.Color]::FromArgb(255, 140, 0)

$Font_UI       = New-Object System.Drawing.Font("Segoe UI", 9)
$Font_Bold     = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$Font_Header   = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

# --- 2. FONKSIYON MOTORU ---

function Get-Devices {
    param($Filter="All")
    if ($Filter -eq "All") { return Get-PnpDevice -ErrorAction SilentlyContinue }
    elseif ($Filter -eq "Error") { return Get-PnpDevice -Status Error -ErrorAction SilentlyContinue }
    elseif ($Filter -eq "Ghost") { return Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.Present -eq $false } }
}

# --- 3. GUI MODU ---

function Start-GUI {
    # Ana Form
    $Form = New-Object System.Windows.Forms.Form
    $Form.Text = $AppName
    $Form.Size = New-Object System.Drawing.Size(1200, 800)
    $Form.StartPosition = "CenterScreen"
    $Form.BackColor = $Color_BG
    $Form.ForeColor = $Color_Text
    $Form.Font = $Font_UI

    # --- SEKMELI YAPI (TAB CONTROL) ---
    $TabControl = New-Object System.Windows.Forms.TabControl
    $TabControl.Dock = "Fill"
    $TabControl.Appearance = "FlatButtons"
    $TabControl.SizeMode = "Fixed"
    $TabControl.ItemSize = New-Object System.Drawing.Size(200, 40)
    $TabControl.Font = $Font_Header
    $Form.Controls.Add($TabControl)

    # --- SEKME 1: YEDEKLEME & GERI YUKLEME ---
    $TabBackup = New-Object System.Windows.Forms.TabPage
    $TabBackup.Text = "YEDEKLEME / GERI YUKLE"
    $TabBackup.BackColor = $Color_BG
    $TabControl.Controls.Add($TabBackup)

    # Yedekleme Kutusu
    $GrpBackup = New-Object System.Windows.Forms.GroupBox
    $GrpBackup.Text = " SURUCU YEDEKLEME (BACKUP) "
    $GrpBackup.ForeColor = "Cyan"
    $GrpBackup.Font = $Font_Header
    $GrpBackup.Size = New-Object System.Drawing.Size(1100, 250)
    $GrpBackup.Location = New-Object System.Drawing.Point(40, 30)
    $TabBackup.Controls.Add($GrpBackup)

    $LblBackupInfo = New-Object System.Windows.Forms.Label
    $LblBackupInfo.Text = "Sistemdeki tum 3. parti suruculeri (Ekran Karti, Ses, Wi-Fi vb.) orijinal klasor yapisiyla yedekler. Format sonrasi surucu arama derdine son verir."
    $LblBackupInfo.Location = New-Object System.Drawing.Point(30, 50)
    $LblBackupInfo.Size = New-Object System.Drawing.Size(1000, 60)
    $LblBackupInfo.ForeColor = "White"
    $LblBackupInfo.Font = $Font_UI
    $GrpBackup.Controls.Add($LblBackupInfo)

    $BtnBackup = New-Object System.Windows.Forms.Button
    $BtnBackup.Text = "YEDEKLEMEYI BASLAT"
    $BtnBackup.Location = New-Object System.Drawing.Point(30, 130)
    $BtnBackup.Size = New-Object System.Drawing.Size(300, 60)
    $BtnBackup.BackColor = $Color_Success
    $BtnBackup.ForeColor = "White"
    $BtnBackup.FlatStyle = "Flat"
    $GrpBackup.Controls.Add($BtnBackup)

    # Geri Yukleme Kutusu
    $GrpRestore = New-Object System.Windows.Forms.GroupBox
    $GrpRestore.Text = " SURUCU GERI YUKLEME (RESTORE) "
    $GrpRestore.ForeColor = "Orange"
    $GrpRestore.Font = $Font_Header
    $GrpRestore.Size = New-Object System.Drawing.Size(1100, 250)
    $GrpRestore.Location = New-Object System.Drawing.Point(40, 320)
    $TabBackup.Controls.Add($GrpRestore)

    $LblRestoreInfo = New-Object System.Windows.Forms.Label
    $LblRestoreInfo.Text = "Daha once aldiginiz yedek klasorunu gosterin. Sistem klasordeki tum .INF dosyalarini tarar ve eksik olan suruculeri otomatik olarak yukler."
    $LblRestoreInfo.Location = New-Object System.Drawing.Point(30, 50)
    $LblRestoreInfo.Size = New-Object System.Drawing.Size(1000, 60)
    $LblRestoreInfo.ForeColor = "White"
    $LblRestoreInfo.Font = $Font_UI
    $GrpRestore.Controls.Add($LblRestoreInfo)

    $BtnRestore = New-Object System.Windows.Forms.Button
    $BtnRestore.Text = "YEDEKTEN GERI YUKLE"
    $BtnRestore.Location = New-Object System.Drawing.Point(30, 130)
    $BtnRestore.Size = New-Object System.Drawing.Size(300, 60)
    $BtnRestore.BackColor = $Color_Warning
    $BtnRestore.ForeColor = "White"
    $BtnRestore.FlatStyle = "Flat"
    $GrpRestore.Controls.Add($BtnRestore)

    # --- SEKME 2: AYGIT LISTESI ---
    $TabDevices = New-Object System.Windows.Forms.TabPage
    $TabDevices.Text = "AYGIT YONETICISI"
    $TabDevices.BackColor = $Color_BG
    $TabControl.Controls.Add($TabDevices)

    # Ust Panel (Filtreleme)
    $PanelTop = New-Object System.Windows.Forms.Panel
    $PanelTop.Dock = "Top"
    $PanelTop.Height = 70
    $PanelTop.BackColor = $Color_Panel
    $TabDevices.Controls.Add($PanelTop)

    $CmbFilter = New-Object System.Windows.Forms.ComboBox
    $CmbFilter.Items.Add("TUM AYGITLAR") | Out-Null
    $CmbFilter.Items.Add("SORUNLU (ERROR)") | Out-Null
    $CmbFilter.Items.Add("HAYALET (GHOST)") | Out-Null
    $CmbFilter.SelectedIndex = 0
    $CmbFilter.Location = New-Object System.Drawing.Point(20, 20)
    $CmbFilter.Size = New-Object System.Drawing.Size(250, 30)
    $CmbFilter.Font = $Font_UI
    $CmbFilter.DropDownStyle = "DropDownList"
    $PanelTop.Controls.Add($CmbFilter)

    $TxtSearch = New-Object System.Windows.Forms.TextBox
    $TxtSearch.Location = New-Object System.Drawing.Point(300, 20)
    $TxtSearch.Size = New-Object System.Drawing.Size(400, 30)
    $TxtSearch.Font = $Font_UI
    $PanelTop.Controls.Add($TxtSearch)

    $BtnSearch = New-Object System.Windows.Forms.Button
    $BtnSearch.Text = "ARA"
    $BtnSearch.Location = New-Object System.Drawing.Point(720, 19)
    $BtnSearch.Size = New-Object System.Drawing.Size(100, 32)
    $BtnSearch.BackColor = $Color_Accent
    $BtnSearch.ForeColor = "White"
    $BtnSearch.FlatStyle = "Flat"
    $PanelTop.Controls.Add($BtnSearch)

    # Grid
    $Grid = New-Object System.Windows.Forms.DataGridView
    $Grid.Dock = "Fill"
    $Grid.BackgroundColor = $Color_Grid
    $Grid.ForeColor = [System.Drawing.Color]::Black
    $Grid.RowHeadersVisible = $false
    $Grid.AllowUserToAddRows = $false
    $Grid.SelectionMode = "FullRowSelect"
    $Grid.MultiSelect = $true
    $Grid.AutoSizeColumnsMode = "Fill"
    $Grid.ColumnHeadersHeight = 35
    $TabDevices.Controls.Add($Grid)

    $Grid.Columns.Add("Name", "Aygit Adi") | Out-Null
    $Grid.Columns.Add("Status", "Durum") | Out-Null
    $Grid.Columns.Add("Class", "Sinif") | Out-Null
    $Grid.Columns.Add("ID", "Instance ID") | Out-Null

    # --- ALT PANEL (FOOTER) ---
    $PanelBottom = New-Object System.Windows.Forms.Panel
    $PanelBottom.Dock = "Bottom"
    $PanelBottom.Height = 40
    $PanelBottom.BackColor = $Color_Panel
    $Form.Controls.Add($PanelBottom)

    $LblStatus = New-Object System.Windows.Forms.Label
    $LblStatus.Text = "Hazir."
    $LblStatus.Location = New-Object System.Drawing.Point(20, 10)
    $LblStatus.Size = New-Object System.Drawing.Size(600, 20)
    $LblStatus.ForeColor = "Cyan"
    $PanelBottom.Controls.Add($LblStatus)

    $LblCopy = New-Object System.Windows.Forms.Label
    $LblCopy.Text = $CopyrightTxt
    $LblCopy.Dock = "Right"
    $LblCopy.Width = 300
    $LblCopy.TextAlign = "MiddleCenter"
    $LblCopy.ForeColor = "Gray"
    $PanelBottom.Controls.Add($LblCopy)

    # --- MANTIK ---

    $Script:CurrentData = @()

    function Load-Grid {
        param($List)
        $Grid.Rows.Clear()
        $Script:CurrentData = $List
        foreach ($dev in $List) {
            $Grid.Rows.Add($dev.FriendlyName, $dev.Status, $dev.Class, $dev.InstanceId) | Out-Null
        }
        $LblStatus.Text = "Listelenen Aygit Sayisi: $($List.Count)"
    }

    # Filtre Degisimi
    $CmbFilter.Add_SelectedIndexChanged({
        $sel = $CmbFilter.SelectedItem.ToString()
        $Form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
        $LblStatus.Text = "Veriler cekiliyor..."
        $Form.Refresh()
        
        $data = @()
        if ($sel -match "TUM AYGITLAR") { $data = Get-Devices "All" }
        elseif ($sel -match "SORUNLU") { $data = Get-Devices "Error" }
        elseif ($sel -match "HAYALET") { $data = Get-Devices "Ghost" }
        
        Load-Grid $data
        $Form.Cursor = [System.Windows.Forms.Cursors]::Default
    })

    # Arama
    $BtnSearch.Add_Click({
        $q = $TxtSearch.Text
        if ([string]::IsNullOrWhiteSpace($q)) { return }
        $filtered = $Script:CurrentData | Where-Object { $_.FriendlyName -like "*$q*" -or $_.InstanceId -like "*$q*" }
        Load-Grid $filtered
    })

    # Yedekleme
    $BtnBackup.Add_Click({
        $fbd = New-Object System.Windows.Forms.FolderBrowserDialog
        $fbd.SelectedPath = $DefaultBackup
        if ($fbd.ShowDialog() -eq "OK") {
            $path = $fbd.SelectedPath; $Form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor; $LblStatus.Text = "Yedekleniyor..."
            $Form.Refresh()
            try {
                Start-Process "dism" -ArgumentList "/online /export-driver /destination:`"$path`"" -Wait -NoNewWindow
                [System.Windows.Forms.MessageBox]::Show("Yedekleme Basarili!", "Bilgi"); Start-Process $path
            } catch { [System.Windows.Forms.MessageBox]::Show("Hata olustu.", "Hata") }
            finally { $Form.Cursor = [System.Windows.Forms.Cursors]::Default; $LblStatus.Text = "Tamamlandi." }
        }
    })

    # Geri Yukleme
    $BtnRestore.Add_Click({
        $fbd = New-Object System.Windows.Forms.FolderBrowserDialog
        if ($fbd.ShowDialog() -eq "OK") {
            $path = $fbd.SelectedPath
            if ([System.Windows.Forms.MessageBox]::Show("Suruculer yuklenecek. Devam?", "Onay", "YesNo") -eq "Yes") {
                $Form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor; $LblStatus.Text = "Yukleniyor..."
                $Form.Refresh()
                Start-Process "pnputil" -ArgumentList "/add-driver `"$path\*.inf`" /subdirs /install" -Wait -NoNewWindow
                $Form.Cursor = [System.Windows.Forms.Cursors]::Default; $LblStatus.Text = "Tamamlandi."
                [System.Windows.Forms.MessageBox]::Show("Yukleme bitti.", "Bilgi")
            }
        }
    })

    # Baslat
    $CmbFilter.SelectedIndex = 0
    $Form.Add_Shown({ $Form.Activate() })
    [void]$Form.ShowDialog()
}

# --- 4. CLI MODU ---

function Start-CLI {
    while ($true) {
        Clear-Host
        Write-Host " PIXDRIVER v5.0 | CLI MODE" -ForegroundColor Cyan
        Write-Host " 1. [BACKUP]  Yedekle" -ForegroundColor Green
        Write-Host " 2. [RESTORE] Geri Yukle" -ForegroundColor Yellow
        Write-Host " 3. [LIST]    Listele" -ForegroundColor Cyan
        Write-Host " Q. CIKIS" -ForegroundColor Red
        $c = Read-Host " Secim"
        if ($c -eq 'Q') { return }
        if ($c -eq '1') { $p = Read-Host "Klasor"; if(-not(Test-Path $p)){New-Item $p -Type Directory|Out-Null}; dism /online /export-driver /destination:"$p"; Read-Host "Devam..." }
        if ($c -eq '2') { $p = Read-Host "Klasor"; pnputil /add-driver "$p\*.inf" /subdirs /install; Read-Host "Devam..." }
        if ($c -eq '3') { Get-PnpDevice -EA 0 | Select FriendlyName, Status | Format-Table; Read-Host "Devam..." }
    }
}

# --- 5. BASLATMA ---
Clear-Host; $m = Read-Host "1. GUI (Onerilen)`n2. CLI (Terminal)`nSECIM (1/2)"
if ($m -eq '2') { Start-CLI } else { Start-GUI }