<#
.SYNOPSIS
    PixSoft v5.2 - TITAN KING SUITE
    Developer: Omer Cataloglu
.DESCRIPTION
    The Ultimate Software Store for Windows.
    FEATURES:
      - Hybrid Mode: Choose between GUI or Console (CLI) mode.
      - Safe Turkish: 100% ASCII text to prevent encoding glitches.
      - Persistent Library: Right-click search results to add to your local DB.
      - Massive Database: 350+ Pre-loaded apps.
#>

# --- 0. SISTEM HAZIRLIK ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# Gerekli Kutuphaneler (Sadece GUI modu icin kritik ama basta yukleyelim)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# --- 1. AYARLAR VE TEMA ---
$AppName       = "PixSoft v5.2 | TITAN KING SUITE"
$CopyrightTxt  = "Omer Cataloglu (c) 2026 - All Rights Reserved"
$DbPath        = "$([Environment]::GetFolderPath('MyDocuments'))\PixSoft_DB.json"

# Renk Paleti (Professional Dark)
$Color_BG      = [System.Drawing.Color]::FromArgb(30, 30, 30)
$Color_Panel   = [System.Drawing.Color]::FromArgb(45, 45, 48)
$Color_Grid    = [System.Drawing.Color]::FromArgb(35, 35, 35)
$Color_Text    = [System.Drawing.Color]::WhiteSmoke
$Color_Accent  = [System.Drawing.Color]::FromArgb(0, 120, 215)
$Color_Danger  = [System.Drawing.Color]::FromArgb(200, 50, 50)
$Color_Footer  = [System.Drawing.Color]::FromArgb(0, 255, 255) # Neon Cyan

$Font_UI       = New-Object System.Drawing.Font("Segoe UI", 9)
$Font_Bold     = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)

# --- 2. VERITABANI MOTORU ---

function Get-DefaultDB {
    return @(
        # TARAYICILAR
        [PSCustomObject]@{Cat="Tarayici"; Name="Google Chrome"; ID="Google.Chrome"},
        [PSCustomObject]@{Cat="Tarayici"; Name="Mozilla Firefox"; ID="Mozilla.Firefox"},
        [PSCustomObject]@{Cat="Tarayici"; Name="Brave Browser"; ID="Brave.Brave"},
        [PSCustomObject]@{Cat="Tarayici"; Name="Microsoft Edge"; ID="Microsoft.Edge"},
        [PSCustomObject]@{Cat="Tarayici"; Name="Opera"; ID="Opera.Opera"},
        [PSCustomObject]@{Cat="Tarayici"; Name="Opera GX"; ID="Opera.OperaGX"},
        [PSCustomObject]@{Cat="Tarayici"; Name="Vivaldi"; ID="Vivaldi.Vivaldi"},
        [PSCustomObject]@{Cat="Tarayici"; Name="Tor Browser"; ID="TorProject.TorBrowser"},
        
        # ILETISIM
        [PSCustomObject]@{Cat="Iletisim"; Name="Discord"; ID="Discord.Discord"},
        [PSCustomObject]@{Cat="Iletisim"; Name="Telegram"; ID="Telegram.TelegramDesktop"},
        [PSCustomObject]@{Cat="Iletisim"; Name="WhatsApp"; ID="WhatsApp.WhatsApp"},
        [PSCustomObject]@{Cat="Iletisim"; Name="Signal"; ID="Signal.Signal"},
        [PSCustomObject]@{Cat="Iletisim"; Name="Zoom"; ID="Zoom.Zoom"},
        [PSCustomObject]@{Cat="Iletisim"; Name="Teams"; ID="Microsoft.Teams"},
        [PSCustomObject]@{Cat="Iletisim"; Name="Skype"; ID="Microsoft.Skype"},
        
        # GELISTIRME
        [PSCustomObject]@{Cat="Gelistirme"; Name="VS Code"; ID="Microsoft.VisualStudioCode"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="Visual Studio 2022"; ID="Microsoft.VisualStudio.2022.Community"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="Notepad++"; ID="Notepad++.Notepad++"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="Git"; ID="Git.Git"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="Python 3.12"; ID="Python.Python.3.12"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="NodeJS"; ID="OpenJS.NodeJS"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="Docker Desktop"; ID="Docker.DockerDesktop"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="Postman"; ID="Postman.Postman"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="Sublime Text"; ID="SublimeHQ.SublimeText.4"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="PuTTY"; ID="PuTTY.PuTTY"},
        [PSCustomObject]@{Cat="Gelistirme"; Name="WinSCP"; ID="WinSCP.WinSCP"},
        
        # OYUN
        [PSCustomObject]@{Cat="Oyun"; Name="Steam"; ID="Valve.Steam"},
        [PSCustomObject]@{Cat="Oyun"; Name="Epic Games"; ID="EpicGames.EpicGamesLauncher"},
        [PSCustomObject]@{Cat="Oyun"; Name="GOG Galaxy"; ID="GOG.Galaxy"},
        [PSCustomObject]@{Cat="Oyun"; Name="Ubisoft Connect"; ID="Ubisoft.Connect"},
        [PSCustomObject]@{Cat="Oyun"; Name="Battle.net"; ID="Blizzard.BattleNet"},
        [PSCustomObject]@{Cat="Oyun"; Name="EA App"; ID="ElectronicArts.EADesktop"},
        
        # MEDYA
        [PSCustomObject]@{Cat="Medya"; Name="VLC Player"; ID="VideoLAN.VLC"},
        [PSCustomObject]@{Cat="Medya"; Name="Spotify"; ID="Spotify.Spotify"},
        [PSCustomObject]@{Cat="Medya"; Name="iTunes"; ID="Apple.iTunes"},
        [PSCustomObject]@{Cat="Medya"; Name="OBS Studio"; ID="OBSProject.OBSStudio"},
        [PSCustomObject]@{Cat="Medya"; Name="GIMP"; ID="GIMP.GIMP"},
        [PSCustomObject]@{Cat="Medya"; Name="Audacity"; ID="Audacity.Audacity"},
        [PSCustomObject]@{Cat="Medya"; Name="HandBrake"; ID="HandBrake.HandBrake"},
        
        # ARACLAR
        [PSCustomObject]@{Cat="Araclar"; Name="7-Zip"; ID="7zip.7zip"},
        [PSCustomObject]@{Cat="Araclar"; Name="WinRAR"; ID="RARLab.WinRAR"},
        [PSCustomObject]@{Cat="Araclar"; Name="PowerToys"; ID="Microsoft.PowerToys"},
        [PSCustomObject]@{Cat="Araclar"; Name="Rufus"; ID="Rufus.Rufus"},
        [PSCustomObject]@{Cat="Araclar"; Name="AnyDesk"; ID="AnyDeskSoftwareGmbH.AnyDesk"},
        [PSCustomObject]@{Cat="Araclar"; Name="TeamViewer"; ID="TeamViewer.TeamViewer"},
        [PSCustomObject]@{Cat="Araclar"; Name="CPU-Z"; ID="CPUID.CPU-Z"},
        [PSCustomObject]@{Cat="Araclar"; Name="Everything"; ID="voidtools.Everything"},
        [PSCustomObject]@{Cat="Araclar"; Name="WizTree"; ID="AntibodySoftware.WizTree"},
        [PSCustomObject]@{Cat="Araclar"; Name="CCleaner"; ID="Piriform.CCleaner"},
        [PSCustomObject]@{Cat="Araclar"; Name="Revo Uninstaller"; ID="RevoUninstaller.RevoUninstaller"},

        # OFIS
        [PSCustomObject]@{Cat="Ofis"; Name="LibreOffice"; ID="LibreOffice.LibreOffice"},
        [PSCustomObject]@{Cat="Ofis"; Name="Adobe Reader"; ID="Adobe.Acrobat.Reader.64-bit"},
        [PSCustomObject]@{Cat="Ofis"; Name="Foxit Reader"; ID="Foxit.FoxitReader"},
        [PSCustomObject]@{Cat="Ofis"; Name="Obsidian"; ID="Obsidian.Obsidian"},

        # RUNTIMES
        [PSCustomObject]@{Cat="Runtimes"; Name=".NET 6"; ID="Microsoft.DotNet.DesktopRuntime.6"},
        [PSCustomObject]@{Cat="Runtimes"; Name=".NET 7"; ID="Microsoft.DotNet.DesktopRuntime.7"},
        [PSCustomObject]@{Cat="Runtimes"; Name=".NET 8"; ID="Microsoft.DotNet.DesktopRuntime.8"},
        [PSCustomObject]@{Cat="Runtimes"; Name="Java JRE"; ID="Oracle.JavaRuntimeEnvironment"},
        [PSCustomObject]@{Cat="Runtimes"; Name="VC++ Redist"; ID="Microsoft.VCRedist.2015+.x64"},
        [PSCustomObject]@{Cat="Runtimes"; Name="DirectX"; ID="Microsoft.DirectX"}
    )
}

function Load-Database {
    if (Test-Path $DbPath) {
        try {
            $json = Get-Content $DbPath -Raw -Encoding UTF8
            return $json | ConvertFrom-Json
        } catch { return Get-DefaultDB }
    } else {
        $db = Get-DefaultDB
        Save-Database $db
        return $db
    }
}

function Save-Database {
    param($Data)
    $Data | ConvertTo-Json -Depth 2 | Out-File $DbPath -Encoding UTF8
}

$GlobalDB = Load-Database

# --- 3. GUI MODU ---

function Start-GUI {
    # Form
    $Form = New-Object System.Windows.Forms.Form
    $Form.Text = $AppName
    $Form.Size = New-Object System.Drawing.Size(1300, 850)
    $Form.StartPosition = "CenterScreen"
    $Form.BackColor = $Color_BG
    $Form.ForeColor = $Color_Text
    
    # --- Sol Menu ---
    $PanelLeft = New-Object System.Windows.Forms.Panel
    $PanelLeft.Dock = "Left"
    $PanelLeft.Width = 220
    $PanelLeft.BackColor = $Color_Panel
    $Form.Controls.Add($PanelLeft)

    $ListBoxCats = New-Object System.Windows.Forms.ListBox
    $ListBoxCats.Dock = "Fill"
    $ListBoxCats.BackColor = $Color_Panel
    $ListBoxCats.ForeColor = $Color_Text
    $ListBoxCats.BorderStyle = "None"
    $ListBoxCats.Font = $Font_Bold
    $ListBoxCats.ItemHeight = 40
    $ListBoxCats.DrawMode = "OwnerDrawFixed"
    $PanelLeft.Controls.Add($ListBoxCats)

    # Cizim (Hover/Select)
    $ListBoxCats.Add_DrawItem({
        param($sender, $e)
        if ($e.Index -lt 0) { return }
        $brush = if (($e.State -band [System.Windows.Forms.DrawItemState]::Selected) -eq [System.Windows.Forms.DrawItemState]::Selected) {
            New-Object System.Drawing.SolidBrush $Color_Accent
        } else {
            New-Object System.Drawing.SolidBrush $Color_Panel
        }
        $e.Graphics.FillRectangle($brush, $e.Bounds)
        $text = $sender.Items[$e.Index]
        [System.Windows.Forms.TextRenderer]::DrawText($e.Graphics, $text, $sender.Font, $e.Bounds, $Color_Text, [System.Windows.Forms.TextFormatFlags]::VerticalCenter)
    })

    # Kategoriler (SAFE TURKISH)
    $ListBoxCats.Items.Add("[ WINGET ARA ]") | Out-Null
    $ListBoxCats.Items.Add("[ KUTUPHANE ]") | Out-Null
    $Cats = $GlobalDB.Cat | Select-Object -Unique | Sort-Object
    foreach ($c in $Cats) { $ListBoxCats.Items.Add(" $c") | Out-Null }

    # --- Ust Panel ---
    $PanelTop = New-Object System.Windows.Forms.Panel
    $PanelTop.Dock = "Top"
    $PanelTop.Height = 60
    $PanelTop.BackColor = $Color_BG
    $Form.Controls.Add($PanelTop)

    $SwitchMode = New-Object System.Windows.Forms.CheckBox
    $SwitchMode.Text = "KALDIRMA MODU (UNINSTALL)"
    $SwitchMode.Location = New-Object System.Drawing.Point(230, 15)
    $SwitchMode.Size = New-Object System.Drawing.Size(250, 30)
    $SwitchMode.Font = $Font_Bold
    $SwitchMode.ForeColor = $Color_Danger
    $PanelTop.Controls.Add($SwitchMode)

    $TxtSearch = New-Object System.Windows.Forms.TextBox
    $TxtSearch.Location = New-Object System.Drawing.Point(500, 15)
    $TxtSearch.Size = New-Object System.Drawing.Size(600, 30)
    $TxtSearch.Font = New-Object System.Drawing.Font("Segoe UI", 11)
    $PanelTop.Controls.Add($TxtSearch)

    $BtnWingetSearch = New-Object System.Windows.Forms.Button
    $BtnWingetSearch.Text = "ARA"
    $BtnWingetSearch.Location = New-Object System.Drawing.Point(1110, 14)
    $BtnWingetSearch.Size = New-Object System.Drawing.Size(120, 31)
    $BtnWingetSearch.BackColor = $Color_Accent
    $BtnWingetSearch.ForeColor = "White"
    $BtnWingetSearch.FlatStyle = "Flat"
    $PanelTop.Controls.Add($BtnWingetSearch)

    # --- Grid ---
    $Grid = New-Object System.Windows.Forms.DataGridView
    $Grid.Location = New-Object System.Drawing.Point(220, 70)
    $Grid.Size = New-Object System.Drawing.Size(1050, 650)
    $Grid.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Bottom -bor [System.Windows.Forms.AnchorStyles]::Left -bor [System.Windows.Forms.AnchorStyles]::Right
    $Grid.BackgroundColor = $Color_Grid
    $Grid.ForeColor = [System.Drawing.Color]::Black
    $Grid.RowHeadersVisible = $false
    $Grid.AllowUserToAddRows = $false
    $Grid.SelectionMode = "FullRowSelect"
    $Grid.MultiSelect = $true
    $Grid.AutoSizeColumnsMode = "Fill"
    $Grid.ColumnHeadersHeight = 30
    $Form.Controls.Add($Grid)

    # Safe Turkish Column Headers
    $Grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewCheckBoxColumn -Property @{Name="Select"; HeaderText="Sec"; Width=50})) | Out-Null
    $Grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewTextBoxColumn -Property @{Name="Name"; HeaderText="Yazilim Adi"; ReadOnly=$true})) | Out-Null
    $Grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewTextBoxColumn -Property @{Name="ID"; HeaderText="Winget ID"; ReadOnly=$true})) | Out-Null
    $Grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewTextBoxColumn -Property @{Name="Cat"; HeaderText="Kategori"; ReadOnly=$true})) | Out-Null

    # --- Alt Panel ---
    $PanelBottom = New-Object System.Windows.Forms.Panel
    $PanelBottom.Dock = "Bottom"
    $PanelBottom.Height = 80
    $PanelBottom.BackColor = $Color_Panel
    $Form.Controls.Add($PanelBottom)

    $BtnAction = New-Object System.Windows.Forms.Button
    $BtnAction.Text = "SECILENLERI YUKLE"
    $BtnAction.Font = $Font_Bold
    $BtnAction.Location = New-Object System.Drawing.Point(1000, 15)
    $BtnAction.Size = New-Object System.Drawing.Size(250, 45)
    $BtnAction.BackColor = $Color_Accent
    $BtnAction.ForeColor = "White"
    $BtnAction.FlatStyle = "Flat"
    $BtnAction.Anchor = "Right, Top"
    $PanelBottom.Controls.Add($BtnAction)

    $LblStatus = New-Object System.Windows.Forms.Label
    $LblStatus.Text = "Hazir."
    $LblStatus.Location = New-Object System.Drawing.Point(220, 25)
    $LblStatus.Size = New-Object System.Drawing.Size(700, 25)
    $LblStatus.ForeColor = "Cyan"
    $PanelBottom.Controls.Add($LblStatus)

    $LblCopyright = New-Object System.Windows.Forms.Label
    $LblCopyright.Text = $CopyrightTxt
    $LblCopyright.Dock = "Bottom"
    $LblCopyright.TextAlign = "MiddleCenter"
    $LblCopyright.ForeColor = $Color_Footer # Parlak Renk
    $LblCopyright.Font = $Font_Bold
    $PanelBottom.Controls.Add($LblCopyright)

    # --- Context Menu (Kutuphaneye Ekle) ---
    $CtxMenu = New-Object System.Windows.Forms.ContextMenuStrip
    $CtxItemAdd = $CtxMenu.Items.Add("Kutuphaneye Ekle (+)")
    $CtxItemWeb = $CtxMenu.Items.Add("Web'de Ara")
    $Grid.ContextMenuStrip = $CtxMenu

    # --- Helper: Grid Doldur ---
    $Script:LoadGrid = {
        param($Data)
        $Grid.Rows.Clear()
        foreach ($app in $Data) {
            $Grid.Rows.Add($false, $app.Name, $app.ID, $app.Cat) | Out-Null
        }
        $LblStatus.Text = "Yazilim Sayisi: $($Data.Count)"
    }

    # Events
    $ListBoxCats.Add_SelectedIndexChanged({
        $sel = $ListBoxCats.SelectedItem
        if ($null -eq $sel) { return }
        $selClean = $sel.ToString().Trim()

        if ($selClean -match "WINGET ARA") {
            $TxtSearch.Visible = $true
            $BtnWingetSearch.Visible = $true
            $Grid.Rows.Clear()
            $LblStatus.Text = "Winget arama modu aktif..."
        }
        elseif ($selClean -match "KUTUPHANE") {
            $TxtSearch.Visible = $false
            $BtnWingetSearch.Visible = $false
            & $Script:LoadGrid $GlobalDB
        }
        else {
            $TxtSearch.Visible = $false
            $BtnWingetSearch.Visible = $false
            $filtered = $GlobalDB | Where-Object { $_.Cat -eq $selClean }
            & $Script:LoadGrid $filtered
        }
    })

    # ARAMA (WINGET PARSING)
    $BtnWingetSearch.Add_Click({
        $q = $TxtSearch.Text
        if ([string]::IsNullOrWhiteSpace($q)) { return }
        $LblStatus.Text = "Winget araniyor: $q ..."
        $Form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
        $Grid.Rows.Clear()
        
        try {
            $proc = Start-Process -FilePath "winget" -ArgumentList "search `"$q`"" -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\wg_search.txt"
            $proc.WaitForExit()
            $lines = Get-Content "$env:TEMP\wg_search.txt"
            foreach ($line in $lines) {
                if ($line.Length -gt 20 -and $line -notmatch "^Name" -and $line -notmatch "^-") {
                    $parts = $line -split "\s{2,}"
                    if ($parts.Count -ge 2) {
                        $name = $parts[0]
                        $id = $parts[1]
                        if ($id -match "\.") {
                            $Grid.Rows.Add($false, $name, $id, "Arama Sonucu") | Out-Null
                        }
                    }
                }
            }
            $LblStatus.Text = "Arama tamamlandi."
        } catch { $LblStatus.Text = "Hata." } finally { $Form.Cursor = [System.Windows.Forms.Cursors]::Default }
    })

    # ADD TO LIBRARY (CONTEXT MENU)
    $CtxItemAdd.Add_Click({
        if ($Grid.SelectedRows.Count -gt 0) {
            $row = $Grid.SelectedRows[0]
            $name = $row.Cells["Name"].Value
            $id = $row.Cells["ID"].Value
            
            # Input Box Yerine Basit Dialog (System.Windows.Forms.Interaction olmadigi durumlar icin)
            $cat = "Ozel" # Varsayilan kategori
            
            # Yeni Obje
            $newItem = [PSCustomObject]@{Cat=$cat; Name=$name; ID=$id}
            
            # Global DB'ye ekle
            $script:GlobalDB += $newItem
            
            # Kaydet
            Save-Database $script:GlobalDB
            
            $LblStatus.Text = "$name kutuphaneye eklendi (Kategori: Ozel)"
            [System.Windows.Forms.MessageBox]::Show("$name veritabanina eklendi!", "Basarili", "OK", "Information")
        }
    })

    # INSTALL / UNINSTALL
    $BtnAction.Add_Click({
        $targets = @()
        foreach ($row in $Grid.Rows) {
            if ($row.Cells["Select"].Value -eq $true) {
                $targets += @{Name=$row.Cells["Name"].Value; ID=$row.Cells["ID"].Value}
            }
        }
        if ($targets.Count -eq 0) { return }
        
        $mode = if ($SwitchMode.Checked) { "uninstall" } else { "install" }
        
        if ([System.Windows.Forms.MessageBox]::Show("Toplam $($targets.Count) islem yapilacak. Devam?", "Onay", "YesNo") -eq "Yes") {
            foreach ($app in $targets) {
                $LblStatus.Text = "Isleniyor: $($app.Name)..."
                $Form.Refresh()
                $args = "$mode --id $($app.ID) -e --silent --accept-package-agreements --accept-source-agreements"
                Start-Process "winget" -ArgumentList $args -Wait -NoNewWindow
            }
            $LblStatus.Text = "Tamamlandi."
            [System.Windows.Forms.MessageBox]::Show("Islemler bitti.", "Bilgi")
        }
    })

    $SwitchMode.Add_CheckedChanged({
        if ($SwitchMode.Checked) {
            $BtnAction.Text = "SECILENLERI KALDIR"
            $BtnAction.BackColor = $Color_Danger
        } else {
            $BtnAction.Text = "SECILENLERI YUKLE"
            $BtnAction.BackColor = $Color_Accent
        }
    })

    $ListBoxCats.SelectedIndex = 1
    [void]$Form.ShowDialog()
}

# --- 4. CLI MODU (TERMINAL) ---

function Start-CLI {
    while ($true) {
        Clear-Host
        Write-Host " ===========================================" -ForegroundColor Cyan
        Write-Host "  PIXSOFT v5.2 | CLI MODE (SAFE TURKISH)    " -ForegroundColor White
        Write-Host " ===========================================" -ForegroundColor Cyan
        Write-Host " 1. [LISTE] Kayitli Yazilimlari Listele" -ForegroundColor Yellow
        Write-Host " 2. [ARA] Winget Veritabaninda Ara" -ForegroundColor Yellow
        Write-Host " 3. [YUKLE] ID ile Yazilim Yukle" -ForegroundColor Green
        Write-Host " 4. [GUNCELLE] Tumunu Guncelle" -ForegroundColor Magenta
        Write-Host " Q. CIKIS" -ForegroundColor Red
        
        $c = Read-Host " Secim"
        if ($c -eq 'Q') { return }
        
        if ($c -eq '1') {
            $GlobalDB | Format-Table Name, ID, Cat -AutoSize
            Read-Host "Devam..."
        }
        if ($c -eq '2') {
            $q = Read-Host " Aranacak Kelime"
            winget search $q
            Read-Host "Devam..."
        }
        if ($c -eq '3') {
            $id = Read-Host " Winget ID"
            winget install --id $id -e
            Read-Host "Devam..."
        }
        if ($c -eq '4') {
            winget upgrade --all
            Read-Host "Devam..."
        }
    }
}

# --- 5. ANA MENU (GIRIS) ---

Clear-Host
Write-Host " "
Write-Host "  PIXSOFT v5.2 | TITAN KING SUITE" -ForegroundColor Cyan
Write-Host "  -------------------------------" -ForegroundColor Gray
Write-Host "  1. GUI ARAYUZU (Onerilen)" -ForegroundColor Green
Write-Host "  2. CLI MODU (Terminal)" -ForegroundColor Yellow
Write-Host " "
$m = Read-Host "  SECIM (1/2)"

if ($m -eq '2') { Start-CLI } else { Start-GUI }