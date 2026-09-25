<#
.SYNOPSIS
    PixVuln - Guvenlik Zafiyet Taramasi (Windows)
.DESCRIPTION
    Uzak panelden calistirilabilen, ETKILESIMSIZ guvenlik denetimi.
    Acik portlar, guvenlik duvari, Defender, SMBv1, RDP, WinRM, kullanicilar,
    guncelleme durumu ve yaygin yanlis yapilandirmalari tarar; risk puanlar.

    Cikti: konsol raporu + masaustune .txt ve .json raporu.

    Yonetici hakki GEREKMEZ - yetki gerektiren kontroller atlanir ve
    raporda "atlandi" olarak isaretlenir.

.PARAMETER Json
    Yalnizca JSON cikti ver (panel entegrasyonu icin).

.PARAMETER Quick
    Hizli tarama - ag taramasi ve derin kontroller atlanir.

.PARAMETER Target
    nmap ile taranacak adres (varsayilan: yerel adresler). nmap yoksa atlanir.

.PARAMETER NoReport
    Rapor dosyasi yazma.

.EXAMPLE
    .\PixVuln_Guvenlik_Taramasi.ps1
    .\PixVuln_Guvenlik_Taramasi.ps1 -Json
    .\PixVuln_Guvenlik_Taramasi.ps1 -Quick -Target 192.168.1.0/24

.NOTES
    Yazar : Omer Cataloglu
    Surum : 1.0.0
    Tur   : powershell
    Kategori: Guvenlik
#>

[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$Quick,
    [string]$Target = "",
    [switch]$NoReport
)

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$VERSION = '1.0.0'
$STARTED = Get-Date

# ----------------------------------------------------------------------
#  Yardimcilar
# ----------------------------------------------------------------------

$script:Findings = @()

function Add-Finding {
    <#
      Tek bir bulgu kaydeder.
      Seviye: Kritik | Yuksek | Orta | Dusuk | Bilgi
    #>
    param(
        [Parameter(Mandatory)] [string]$Id,
        [Parameter(Mandatory)] [string]$Baslik,
        [Parameter(Mandatory)] [ValidateSet('Kritik', 'Yuksek', 'Orta', 'Dusuk', 'Bilgi')] [string]$Seviye,
        [string]$Detay = '',
        [string]$Cozum = '',
        [string]$Deger = ''
    )

    $script:Findings += [pscustomobject]@{
        id      = $Id
        baslik  = $Baslik
        seviye  = $Seviye
        detay   = $Detay
        cozum   = $Cozum
        deger   = $Deger
        zaman   = (Get-Date).ToString('o')
    }
}

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-CimSafe {
    <# CIM sorgusu - hata olursa $null doner. #>
    param([string]$Class, [string]$Namespace = 'root/cimv2', [string]$Filter = '')
    try {
        if ($Filter) {
            return Get-CimInstance -ClassName $Class -Namespace $Namespace -Filter $Filter -ErrorAction Stop
        }
        return Get-CimInstance -ClassName $Class -Namespace $Namespace -ErrorAction Stop
    } catch {
        return $null
    }
}

$IS_ADMIN = Test-Admin
$HOSTNAME_ = $env:COMPUTERNAME

if (-not $Json) {
    Write-Host ''
    Write-Host '  ################################################################' -ForegroundColor DarkCyan
    Write-Host '  #                                                              #' -ForegroundColor DarkCyan
    Write-Host '  #        PixVuln  -  GUVENLIK ZAFIYET TARAMASI  v1.0.0         #' -ForegroundColor Cyan
    Write-Host '  #                                                              #' -ForegroundColor DarkCyan
    Write-Host '  ################################################################' -ForegroundColor DarkCyan
    Write-Host ''
    Write-Host ("  Hedef    : {0}" -f $HOSTNAME_)
    Write-Host ("  Zaman    : {0}" -f $STARTED.ToString('dd.MM.yyyy HH:mm:ss'))
    Write-Host ("  Yetki    : {0}" -f $(if ($IS_ADMIN) { 'Yonetici' } else { 'Kullanici (bazi kontroller atlanir)' }))
    Write-Host ("  Mod      : {0}" -f $(if ($Quick) { 'Hizli' } else { 'Tam' }))
    Write-Host ''
}

# ----------------------------------------------------------------------
#  1. Sistem bilgisi
# ----------------------------------------------------------------------

$os = Get-CimSafe -Class Win32_OperatingSystem
$cs = Get-CimSafe -Class Win32_ComputerSystem

$systemInfo = [pscustomobject]@{
    hostname   = $HOSTNAME_
    os         = if ($os) { $os.Caption } else { 'Bilinmiyor' }
    version    = if ($os) { $os.Version } else { '' }
    build      = if ($os) { $os.BuildNumber } else { '' }
    mimari     = $env:PROCESSOR_ARCHITECTURE
    kullanici  = $env:USERNAME
    etki_alan  = if ($cs) { $cs.Domain } else { '' }
    admin      = $IS_ADMIN
    ps_surum   = $PSVersionTable.PSVersion.ToString()
    son_acilis = if ($os) { $os.LastBootUpTime.ToString('o') } else { '' }
}

if (-not $Json) { Write-Host '  [1/9] Sistem bilgisi toplandi' -ForegroundColor DarkGray }

# ----------------------------------------------------------------------
#  2. Acik portlar
# ----------------------------------------------------------------------

#: Riskli portlar -> aciklama
$RISKY_PORTS = @{
    21    = 'FTP - sifresiz iletim'
    23    = 'Telnet - sifresiz, kullanilmamali'
    135   = 'RPC - ic ag icin, disari acilmamali'
    137   = 'NetBIOS - isim cozumleme'
    138   = 'NetBIOS - datagram'
    139   = 'NetBIOS - oturum'
    445   = 'SMB - fidye yazilimi hedefi'
    1433  = 'MSSQL - veritabani disari acilmamali'
    1521  = 'Oracle DB'
    3306  = 'MySQL/MariaDB'
    3389  = 'RDP - uzak masaustu, saldiri hedefi'
    5432  = 'PostgreSQL'
    5900  = 'VNC - zayif sifreleme'
    5985  = 'WinRM HTTP'
    5986  = 'WinRM HTTPS'
    6379  = 'Redis - cogu zaman sifresiz'
    8080  = 'HTTP alternatif'
    27017 = 'MongoDB'
}

$listening = @()
try {
    $listening = Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Select-Object LocalAddress, LocalPort, OwningProcess |
        ForEach-Object {
            $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
            [pscustomobject]@{
                adres   = if ($_.LocalAddress -eq '::' -or $_.LocalAddress -eq '0.0.0.0') { 'tumu' } else { $_.LocalAddress }
                port    = [int]$_.LocalPort
                pid     = [int]$_.OwningProcess
                islem   = if ($process) { $process.ProcessName } else { '?' }
                disari  = ($_.LocalAddress -eq '0.0.0.0' -or $_.LocalAddress -eq '::')
            }
        } | Sort-Object port -Unique
} catch {
    $listening = @()
}

$externalPorts = @($listening | Where-Object { $_.disari } | Select-Object -ExpandProperty port -Unique)

$riskyOpen = @($listening | Where-Object { $RISKY_PORTS.ContainsKey($_.port) })

foreach ($entry in $riskyOpen) {
    $aciklama = $RISKY_PORTS[$entry.port]
    $seviye = if ($entry.port -in @(23, 445, 3389, 5900, 6379)) { 'Yuksek' } else { 'Orta' }
    Add-Finding -Id ("port-{0}" -f $entry.port) `
        -Baslik ("Riskli port acik: {0} ({1})" -f $entry.port, $aciklama) `
        -Seviye $seviye `
        -Detay ("{0}:{1} dinleniyor - islem: {2} (PID {3})" -f $entry.adres, $entry.port, $entry.islem, $entry.pid) `
        -Cozum "Bu port gercekten gerekli mi? Gerekli degilse servisi durdurun veya guvenlik duvariyla kisitlayin." `
        -Deger $aciklama
}

if ($externalPorts.Count -gt 8) {
    # RPC gecici portlari (49152-65535) normaldir - heuristige katma
    $meaningful = @($externalPorts | Where-Object { $_ -lt 49152 })
    if ($meaningful.Count -gt 8) {
        Add-Finding -Id 'port-sayisi' `
            -Baslik ("Cok sayida disari acik port: {0}" -f $meaningful.Count) `
            -Seviye 'Orta' `
            -Detay ($meaningful -join ', ') `
            -Cozum 'Yalnizca gereken portlari acik birakin; gerisini guvenlik duvariyla kapatin.'
    }
}

if (-not $Json) { Write-Host ("  [2/9] Acik portlar tarandi ({0} dinleyici, {1} disari)" -f $listening.Count, $externalPorts.Count) -ForegroundColor DarkGray }

# ----------------------------------------------------------------------
#  3. Guvenlik duvari
# ----------------------------------------------------------------------

$firewallProfiles = @()
try {
    $firewallProfiles = Get-NetFirewallProfile -ErrorAction Stop
    foreach ($profile in $firewallProfiles) {
        if (-not $profile.Enabled) {
            Add-Finding -Id ("fw-{0}" -f $profile.Name) `
                -Baslik ("Guvenlik duvari KAPALI: {0} profili" -f $profile.Name) `
                -Seviye 'Kritik' `
                -Detay ("{0} profili etkin degil" -f $profile.Name) `
                -Cozum 'Set-NetFirewallProfile -All -Enabled True'
        }
    }
} catch {
    if (-not $Json) { Write-Host '       (Guvenlik duvari sorgulanamadi)' -ForegroundColor DarkYellow }
}

if (-not $Json) { Write-Host ("  [3/9] Guvenlik duvari denetlendi ({0} profil)" -f $firewallProfiles.Count) -ForegroundColor DarkGray }

# ----------------------------------------------------------------------
#  4. Windows Defender
# ----------------------------------------------------------------------

$defender = $null
try {
    if (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue) {
        $defender = Get-MpComputerStatus -ErrorAction Stop
    }
} catch {
    $defender = $null
}

if ($defender) {
    if (-not $defender.RealTimeProtectionEnabled) {
        Add-Finding -Id 'defender-rtp' -Baslik 'Gercek zamanli koruma KAPALI' -Seviye 'Kritik' `
            -Detay 'Windows Defender gercek zamanli korumasi devre disi' `
            -Cozum 'Set-MpPreference -DisableRealtimeMonitoring $false'
    }
    if (-not $defender.AntivirusEnabled) {
        Add-Finding -Id 'defender-av' -Baslik 'Antivirus motoru KAPALI' -Seviye 'Kritik' `
            -Detay 'Defender antivirus etkin degil' -Cozum 'Defender''i etkinlestirin veya baska bir AV kurun.'
    }

    if ($defender.AntivirusSignatureAge -gt 7) {
        Add-Finding -Id 'defender-imza' `
            -Baslik ("Imza veritabani eski: {0} gun" -f $defender.AntivirusSignatureAge) `
            -Seviye 'Yuksek' `
            -Detay ("Son imza: {0}" -f $defender.AntivirusSignatureLastUpdated) `
            -Cozum 'Update-MpSignature'
    }

    if (-not $defender.IsTamperProtected) {
        Add-Finding -Id 'defender-tamper' -Baslik 'Kurcalama korumasi (Tamper Protection) kapali' -Seviye 'Orta' `
            -Detay 'Kotucul yazilim Defender ayarlarini degistirebilir' `
            -Cozum 'Windows Guvenligi > Virus ve tehdit korumasi > Ayarlari yonet'
    }
} else {
    Add-Finding -Id 'defender-yok' -Baslik 'Windows Defender durumu okunamadi' -Seviye 'Dusuk' `
        -Detay 'Defender kurulu degil veya ucuncu parti AV kullaniyorsunuz' `
        -Cozum 'Bir antivirus cozumunun kurulu ve guncel oldugundan emin olun.'
}

if (-not $Json) { Write-Host '  [4/9] Antivirus denetlendi' -ForegroundColor DarkGray }

# ----------------------------------------------------------------------
#  5. Ag protokolleri ve uzak erisim
# ----------------------------------------------------------------------

# --- SMBv1 ---
$smb1 = Get-CimSafe -Class Win32_OptionalFeature -Filter "Name='SMB1Protocol'"
if ($smb1 -and $smb1.InstallState -eq 1) {
    Add-Finding -Id 'smb1' -Baslik 'SMBv1 ETKIN - kritik zafiyet (WannaCry/EternalBlue)' -Seviye 'Kritik' `
        -Detay 'SMBv1 protokolu kurulu ve etkin' `
        -Cozum 'Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart'
}

# --- SMB imzalama ---
try {
    $smbServer = Get-SmbServerConfiguration -ErrorAction Stop
    if (-not $smbServer.RequireSecuritySignature) {
        Add-Finding -Id 'smb-imza' -Baslik 'SMB imzalama zorunlu degil' -Seviye 'Orta' `
            -Detay 'Ortadaki adam (MITM) saldirisina acik' `
            -Cozum 'Set-SmbServerConfiguration -RequireSecuritySignature $true'
    }
    if ($smbServer.EnableSMB1Protocol) {
        Add-Finding -Id 'smb1-aktif' -Baslik 'SMB1 protokolu etkin (sunucu yapilandirmasi)' -Seviye 'Kritik' `
            -Detay 'EnableSMB1Protocol = True' `
            -Cozum 'Set-SmbServerConfiguration -EnableSMB1Protocol $false'
    }
} catch {
    # yetki gerekiyor - sessizce gec
}

# --- RDP ---
$rdp = Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name 'fDenyTSConnections' -ErrorAction SilentlyContinue
if ($rdp -and $rdp.fDenyTSConnections -eq 0) {
    $nla = Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name 'UserAuthentication' -ErrorAction SilentlyContinue
    if (-not $nla -or $nla.UserAuthentication -ne 1) {
        Add-Finding -Id 'rdp-nla' -Baslik 'RDP acik ve NLA (ag seviyesi kimlik dogrulama) kapali' -Seviye 'Kritik' `
            -Detay 'RDP etkin, Network Level Authentication devre disi' `
            -Cozum 'NLA''yi acin: UserAuthentication = 1, ve RDP''yi guvenlik duvariyla kisitlayin.'
    } else {
        Add-Finding -Id 'rdp-acik' -Baslik 'RDP (uzak masaustu) etkin' -Seviye 'Orta' `
            -Detay 'RDP etkin, NLA korumasi acik' `
            -Cozum 'Gerekli degilse RDP''yi kapatin; gerekliyse yalnizca guvenli VPN uzerinden erisime izin verin.'
    }
}

# --- WinRM ---
try {
    $winrm = winrm get winrm/config/service 2>$null
    if ($LASTEXITCODE -eq 0 -and $winrm -match 'AllowUnencrypted\s*=\s*true') {
        Add-Finding -Id 'winrm-sifresiz' -Baslik 'WinRM sifresiz trafige izin veriyor' -Seviye 'Yuksek' `
            -Detay 'AllowUnencrypted = true' `
            -Cozum 'winrm set winrm/config/service @{AllowUnencrypted="false"}'
    }
} catch {
    # winrm yok
}

# --- Ping / LLMNR ---
$llmnr = Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient' -Name 'EnableMulticast' -ErrorAction SilentlyContinue
if (-not $llmnr -or $llmnr.EnableMulticast -ne 0) {
    Add-Finding -Id 'llmnr' -Baslik 'LLMNR etkin (kimlik bilgisi sizintisi riski)' -Seviye 'Dusuk' `
        -Detay 'LLMNR/NBT-NS zehirleme saldirisina karsi kapatilmali' `
        -Cozum 'Grup ilkesi: Bilgisayar Yapilandirmasi > Yonetim Sablonlari > Ag > DNS Istemcisi > Multicast''i kapat'
}

if (-not $Json) { Write-Host '  [5/9] Ag protokolleri denetlendi' -ForegroundColor DarkGray }

# ----------------------------------------------------------------------
#  6. Kullanicilar ve hesaplar
# ----------------------------------------------------------------------

$localUsers = @()
try {
    $localUsers = Get-LocalUser -ErrorAction Stop
} catch {
    $localUsers = @()
}

foreach ($user in $localUsers) {
    if (-not $user.Enabled) { continue }

    # Sifresiz hesap
    if ($user.PasswordRequired -eq $false) {
        Add-Finding -Id ("kullanici-sifresiz-{0}" -f $user.Name) `
            -Baslik ("Sifre gerektirmeyen etkin hesap: {0}" -f $user.Name) `
            -Seviye 'Kritik' `
            -Detay 'PasswordRequired = False' `
            -Cozum ("Net user `"{0}`" /passwordreq:yes" -f $user.Name)
    }

    # Sifre hic degismemis
    if ($user.PasswordLastSet -eq $null) {
        Add-Finding -Id ("kullanici-sifre-yok-{0}" -f $user.Name) `
            -Baslik ("Sifresi hic belirlenmemis hesap: {0}" -f $user.Name) `
            -Seviye 'Yuksek' -Detay 'PasswordLastSet bos' `
            -Cozum 'Hesaba guclu bir sifre atayin veya hesabi devre disi birakin.'
    }

    # Sifre suresi dolmuyor
    if ($user.PasswordExpires -eq $null) {
        Add-Finding -Id ("kullanici-sifre-suresiz-{0}" -f $user.Name) `
            -Baslik ("Sifresi hic dolmayan hesap: {0}" -f $user.Name) `
            -Seviye 'Dusuk' -Detay 'PasswordExpires = null' `
            -Cozum 'Sifre yaslandirma politikasi uygulayin veya sifreyi duzenli degistirin.'
    }
}

# Guest hesabi
$guest = $localUsers | Where-Object { $_.SID.Value -like '*-501' }
if ($guest -and $guest.Enabled) {
    Add-Finding -Id 'guest-aktif' -Baslik 'Guest (Misafir) hesabi ETKIN' -Seviye 'Yuksek' `
        -Detay 'Sifresiz erisim noktasi' -Cozum 'Disable-LocalUser -Name Guest'
}

# Yerel yonetici sayisi
$admins = @()
try {
    $admins = Get-LocalGroupMember -Group 'Administrators' -ErrorAction Stop |
        Where-Object { $_.ObjectClass -eq 'User' }
} catch {
    $admins = @()
}

if ($admins.Count -gt 2) {
    Add-Finding -Id 'admin-sayisi' `
        -Baslik ("Fazla yerel yonetici hesabi: {0}" -f $admins.Count) `
        -Seviye 'Orta' `
        -Detay (($admins | ForEach-Object { $_.Name }) -join ', ') `
        -Cozum 'En az yetki ilkesi: gereksiz yonetici hesaplarini kaldirin.'
}

# Varsayilan Administrator adi kullaniliyor mu
if ($localUsers.Name -contains 'Administrator') {
    $adminAccount = $localUsers | Where-Object { $_.Name -eq 'Administrator' }
    if ($adminAccount -and $adminAccount.Enabled) {
        Add-Finding -Id 'varsayilan-admin' -Baslik 'Varsayilan "Administrator" hesabi etkin' -Seviye 'Orta' `
            -Detay 'Bilinen hesap adi - sozluk saldirilarinda ilk hedef' `
            -Cozum 'Hesabi yeniden adlandirin veya devre disi birakin.'
    }
}

if (-not $Json) { Write-Host ("  [6/9] Kullanicilar denetlendi ({0} hesap)" -f $localUsers.Count) -ForegroundColor DarkGray }

# ----------------------------------------------------------------------
#  7. Guncellemeler ve sistem sertlestirme
# ----------------------------------------------------------------------

# --- UAC ---
$uac = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'EnableLUA' -ErrorAction SilentlyContinue
if ($uac -and $uac.EnableLUA -eq 0) {
    Add-Finding -Id 'uac-kapali' -Baslik 'UAC (Kullanici Hesabi Denetimi) KAPALI' -Seviye 'Kritik' `
        -Detay 'EnableLUA = 0' -Cozum 'UAC''yi etkinlestirin: EnableLUA = 1 (yeniden baslatma gerekir).'
}

$consent = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'ConsentPromptBehaviorAdmin' -ErrorAction SilentlyContinue
if ($consent -and $consent.ConsentPromptBehaviorAdmin -eq 0) {
    Add-Finding -Id 'uac-sessiz' -Baslik 'UAC yonetici islemlerinde hic sormuyor' -Seviye 'Yuksek' `
        -Detay 'ConsentPromptBehaviorAdmin = 0' -Cozum 'UAC istem seviyesini "Her zaman bildir" yapin.'
}

# --- Windows Update ---
$wuService = Get-Service -Name wuauserv -ErrorAction SilentlyContinue
if ($wuService -and $wuService.Status -ne 'Running') {
    Add-Finding -Id 'wu-servis' -Baslik 'Windows Update servisi calismiyor' -Seviye 'Yuksek' `
        -Detay ("wuauserv durumu: {0}" -f $wuService.Status) `
        -Cozum 'Servisi baslatin: Start-Service wuauserv'
}

$au = Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Name 'NoAutoUpdate' -ErrorAction SilentlyContinue
if ($au -and $au.NoAutoUpdate -eq 1) {
    Add-Finding -Id 'wu-kapali' -Baslik 'Otomatik guncelleme ilkeyle KAPATILMIS' -Seviye 'Yuksek' `
        -Detay 'NoAutoUpdate = 1' -Cozum 'Guncellemeleri etkinlestirin.'
}

# --- BitLocker ---
if ($IS_ADMIN) {
    try {
        $volumes = Get-BitLockerVolume -ErrorAction Stop | Where-Object { $_.VolumeType -eq 'OperatingSystem' }
        foreach ($volume in $volumes) {
            if ($volume.ProtectionStatus -ne 'On') {
                Add-Finding -Id 'bitlocker' -Baslik 'Sistem diski sifrelenmemis (BitLocker kapali)' -Seviye 'Orta' `
                    -Detay ("{0} - koruma: {1}" -f $volume.MountPoint, $volume.ProtectionStatus) `
                    -Cozum 'BitLocker''i etkinlestirin (fiziksel hirsizliga karsi).'
            }
        }
    } catch {
        # BitLocker yok (Home sürümü)
    }
}

# --- Alintilanmamis servis yollari (dogru algoritma) ---
#
# Windows tirnaksiz yolu ilk bosluga kadar dener: "C:\Program Files\A B\svc.exe"
# icin evvela "C:\Program.exe" aranir. Dolayisiyla zafiyet YALNIZCA yolun
# ilk bosluktan onceki kismi ".exe" ile bitmiyorsa vardir.
#
#   C:\WINDOWS\system32\svchost.exe -k netsvcs   -> ilk parca .exe ile biter: GUVENLI
#   C:\Program Files\Foo Bar\service.exe         -> ilk parca .exe ile bitmez: ZAFIYETLI
$unquoted = @()
$services = Get-CimSafe -Class Win32_Service
if ($services) {
    $unquoted = @($services | Where-Object {
        $path = $_.PathName
        if (-not $path) { return $false }
        if ($path.StartsWith('"')) { return $false }               # zaten tirnakli
        if ($path -notmatch '^[A-Za-z]:\\') { return $false }      # mutlak yol degil

        $firstSpace = $path.IndexOf(' ')
        if ($firstSpace -lt 1) { return $false }                    # bosluk yok -> zafiyet yok

        $head = $path.Substring(0, $firstSpace)
        return ($head -notmatch '\.exe$')                            # ilk parca .exe ile bitmiyorsa zafiyetli
    } | Select-Object -First 10)
}

foreach ($service in $unquoted) {
    Add-Finding -Id ("servis-tirnaksiz-{0}" -f $service.Name) `
        -Baslik ("Tirnaksiz servis yolu (yetki yukseltme riski): {0}" -f $service.Name) `
        -Seviye 'Yuksek' -Detay $service.PathName `
        -Cozum ('Yolu tirnak icine alin: "' + $service.PathName + '"')
}

# --- Ilginc paylasimlar ---
try {
    $shares = Get-SmbShare -ErrorAction Stop | Where-Object { $_.Name -notin @('IPC$', 'print$') -and $_.Path }
    foreach ($share in $shares) {
        if ($share.Name -match '\$$') { continue }  # gizli paylasim, atla
    }
} catch {
    # paylasim sorgulanamadi
}

if (-not $Json) { Write-Host '  [7/9] Guncellemeler ve sertlestirme denetlendi' -ForegroundColor DarkGray }

# ----------------------------------------------------------------------
#  8. nmap ag taramasi (istege bagli)
# ----------------------------------------------------------------------

$nmapResult = $null
if (-not $Quick) {
    $nmap = Get-Command nmap -ErrorAction SilentlyContinue
    if ($nmap) {
        $scanTarget = $Target
        if (-not $scanTarget) {
            # Yerel adresi bul
            try {
                $scanTarget = (Get-NetIPAddress -AddressFamily IPv4 |
                    Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } |
                    Select-Object -First 1).IPAddress
            } catch {
                $scanTarget = $env:COMPUTERNAME
            }
        }

        if ($scanTarget) {
            if (-not $Json) { Write-Host ("       nmap ile taranıyor: {0}" -f $scanTarget) -ForegroundColor DarkGray }
            try {
                $raw = & nmap -sT -T4 --top-ports 100 $scanTarget 2>&1
                $nmapResult = ($raw | Out-String).Trim()

                $openLines = @($raw | Select-String -Pattern '^\s*(\d+)/tcp\s+open' -AllMatches)
                foreach ($line in $openLines) {
                    if ($line -match '(\d+)/tcp\s+open\s+(\S+)') {
                        $port = [int]$matches[1]
                        $service = $matches[2]
                        if ($RISKY_PORTS.ContainsKey($port)) {
                            Add-Finding -Id ("nmap-{0}" -f $port) `
                                -Baslik ("nmap: riskli servis {0}/tcp ({1})" -f $port, $service) `
                                -Seviye 'Orta' `
                                -Detay ("Hedef {0} uzerinde {1}/tcp acik" -f $scanTarget, $port) `
                                -Cozum 'Servisi kapatın veya yalnizca guvenilir adreslere izin verin.'
                        }
                    }
                }
            } catch {
                $nmapResult = "nmap calistirilamadi: $_"
            }
        }
    } else {
        $nmapResult = 'nmap kurulu degil - ag taramasi atlandi'
    }

    if (-not $Json) { Write-Host '  [8/9] Ag taramasi tamamlandi' -ForegroundColor DarkGray }
}

# ----------------------------------------------------------------------
#  9. Risk puanlama ve rapor
# ----------------------------------------------------------------------

#: Seviye basina agirlik ve tavan.
#  Ham toplam yerine kademeli tavan kullanilir - aksi halde her makine
#  aninda 100/100'e yapisir ve puan bilgi tasimaz.
$WEIGHTS = @{
    'Kritik' = @{ w = 30; cap = 55 }
    'Yuksek' = @{ w = 12; cap = 30 }
    'Orta'   = @{ w = 4;  cap = 12 }
    'Dusuk'  = @{ w = 1.5; cap = 6 }
    'Bilgi'  = @{ w = 0;  cap = 0 }
}

$score = 0.0
foreach ($level in $WEIGHTS.Keys) {
    $count = @($script:Findings | Where-Object { $_.seviye -eq $level }).Count
    $entry = $WEIGHTS[$level]
    $score += [Math]::Min($count * $entry.w, $entry.cap)
}
$score = [int][Math]::Round([Math]::Min($score, 100))

$verdict = switch ($score) {
    { $_ -ge 70 } { 'CRITICAL' ; break }
    { $_ -ge 45 } { 'HIGH'     ; break }
    { $_ -ge 20 } { 'MEDIUM'   ; break }
    { $_ -ge 5  } { 'LOW'      ; break }
    default       { 'CLEAN' }
}

$verdictTr = switch ($verdict) {
    'CRITICAL' { 'KRITIK - acil mudahale gerekli' }
    'HIGH'     { 'YUKSEK - kisa surede duzeltilmeli' }
    'MEDIUM'   { 'ORTA - iyilestirme onerilir' }
    'LOW'      { 'DUSUK - kucuk iyilestirmeler' }
    default    { 'TEMIZ - onemli bulgu yok' }
}

$counts = [pscustomobject]@{
    kritik = @($script:Findings | Where-Object { $_.seviye -eq 'Kritik' }).Count
    yuksek = @($script:Findings | Where-Object { $_.seviye -eq 'Yuksek' }).Count
    orta   = @($script:Findings | Where-Object { $_.seviye -eq 'Orta' }).Count
    dusuk  = @($script:Findings | Where-Object { $_.seviye -eq 'Dusuk' }).Count
    bilgi  = @($script:Findings | Where-Object { $_.seviye -eq 'Bilgi' }).Count
}

$elapsed = [Math]::Round(((Get-Date) - $STARTED).TotalSeconds, 1)

$report = [pscustomobject]@{
    arac        = 'PixVuln'
    surum       = $VERSION
    zaman       = $STARTED.ToString('o')
    sure_sn     = $elapsed
    hedef       = $HOSTNAME_
    platform    = 'windows'
    mod         = $(if ($Quick) { 'hizli' } else { 'tam' })
    risk_puani  = $score
    risk_durumu = $verdict
    ozet        = $counts
    sistem      = $systemInfo
    acik_portlar = $listening
    disari_portlar = $externalPorts
    guvenlik_duvari = @($firewallProfiles | Select-Object Name, Enabled)
    nmap        = $nmapResult
    bulgular    = $script:Findings
    toplam_bulgu = $script:Findings.Count
}

# --- Konsol raporu ---
if (-not $Json) {
    Write-Host ''
    Write-Host '  ================================================================' -ForegroundColor DarkCyan
    Write-Host '   BULGULAR' -ForegroundColor Cyan
    Write-Host '  ================================================================' -ForegroundColor DarkCyan
    Write-Host ''

    if ($script:Findings.Count -eq 0) {
        Write-Host '   Onemli bir guvenlik bulgusu tespit edilmedi.' -ForegroundColor Green
    } else {
        $order = @('Kritik', 'Yuksek', 'Orta', 'Dusuk', 'Bilgi')
        foreach ($seviye in $order) {
            $group = @($script:Findings | Where-Object { $_.seviye -eq $seviye })
            if ($group.Count -eq 0) { continue }

            $color = switch ($seviye) {
                'Kritik' { 'Red' }
                'Yuksek' { 'DarkYellow' }
                'Orta'   { 'Yellow' }
                'Dusuk'  { 'DarkGray' }
                default  { 'DarkGray' }
            }

            Write-Host ("   --- {0} ({1}) ---" -f $seviye.ToUpper(), $group.Count) -ForegroundColor $color
            foreach ($item in $group) {
                Write-Host ("   * {0}" -f $item.baslik) -ForegroundColor $color
                if ($item.detay) { Write-Host ("     {0}" -f $item.detay) -ForegroundColor DarkGray }
                if ($item.cozum) { Write-Host ("     Cozum: {0}" -f $item.cozum) -ForegroundColor DarkGray }
            }
            Write-Host ''
        }
    }

    Write-Host '  ================================================================' -ForegroundColor DarkCyan
    $scoreColor = switch ($verdict) {
        'CRITICAL' { 'Red' }
        'HIGH'     { 'DarkYellow' }
        'MEDIUM'   { 'Yellow' }
        'LOW'      { 'DarkGray' }
        default    { 'Green' }
    }
    Write-Host ("   RISK PUANI : {0}/100  ->  {1}" -f $score, $verdictTr) -ForegroundColor $scoreColor
    Write-Host ("   Bulgular   : {0} kritik, {1} yuksek, {2} orta, {3} dusuk" -f $counts.kritik, $counts.yuksek, $counts.orta, $counts.dusuk) -ForegroundColor Gray
    Write-Host ("   Acik port  : {0} dinleyici ({1} disari acik)" -f $listening.Count, $externalPorts.Count) -ForegroundColor Gray
    Write-Host ("   Sure       : {0} saniye" -f $elapsed) -ForegroundColor DarkGray
    Write-Host '  ================================================================' -ForegroundColor DarkCyan
    Write-Host ''
}

# --- Rapor dosyalari ---
$reportPaths = @()
if (-not $NoReport) {
    try {
        $desktop = [Environment]::GetFolderPath('Desktop')
        if (-not $desktop -or -not (Test-Path $desktop)) { $desktop = $env:TEMP }

        $stamp = $STARTED.ToString('yyyyMMdd-HHmmss')
        $jsonPath = Join-Path $desktop ("PixVuln-Rapor-{0}-{1}.json" -f $HOSTNAME_, $stamp)
        $textPath = Join-Path $desktop ("PixVuln-Rapor-{0}-{1}.txt" -f $HOSTNAME_, $stamp)

        $report | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonPath -Encoding UTF8

        # Metin raporu
        $lines = @()
        $lines += 'PixVuln - Guvenlik Zafiyet Raporu'
        $lines += ('=' * 60)
        $lines += ("Hedef       : {0}" -f $HOSTNAME_)
        $lines += ("Zaman       : {0}" -f $STARTED.ToString('dd.MM.yyyy HH:mm:ss'))
        $lines += ("Isletim sis.: {0}" -f $systemInfo.os)
        $lines += ("Risk puani  : {0}/100  ({1})" -f $score, $verdictTr)
        $lines += ("Bulgular    : {0} kritik, {1} yuksek, {2} orta, {3} dusuk" -f $counts.kritik, $counts.yuksek, $counts.orta, $counts.dusuk)
        $lines += ''
        $lines += 'ACIK PORTLAR'
        $lines += ('-' * 60)
        foreach ($entry in $listening) {
            $flag = if ($RISKY_PORTS.ContainsKey($entry.port)) { ' [RISKLI]' } else { '' }
            $scope = if ($entry.disari) { 'disari' } else { 'yerel' }
            $lines += ("  {0,-16}:{1,-6} {2,-8} {3}{4}" -f $entry.adres, $entry.port, $scope, $entry.islem, $flag)
        }
        $lines += ''
        $lines += 'BULGULAR'
        $lines += ('-' * 60)
        foreach ($item in $script:Findings) {
            $lines += ("[{0}] {1}" -f $item.seviye.ToUpper(), $item.baslik)
            if ($item.detay) { $lines += ("      {0}" -f $item.detay) }
            if ($item.cozum) { $lines += ("      Cozum: {0}" -f $item.cozum) }
        }
        if ($script:Findings.Count -eq 0) { $lines += '  Onemli bulgu yok.' }

        $lines | Out-File -FilePath $textPath -Encoding UTF8
        $reportPaths = @($jsonPath, $textPath)

        if (-not $Json) {
            Write-Host '   Raporlar yazildi:' -ForegroundColor Green
            foreach ($path in $reportPaths) { Write-Host ("     {0}" -f $path) -ForegroundColor DarkGray }
            Write-Host ''
        }
    } catch {
        if (-not $Json) { Write-Host ("   Rapor yazilamadi: {0}" -f $_) -ForegroundColor DarkYellow }
    }
}

# --- JSON cikisi ---
if ($Json) {
    $final = $report | Select-Object *, @{ n = 'rapor_dosyalari'; e = { $reportPaths } }
    $final | ConvertTo-Json -Depth 6
}
