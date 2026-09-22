<#
.SYNOPSIS
    PixNet v10.1 - CENTURION STABLE (100 TOOLS)
    Developer: Omer Cataloglu
.DESCRIPTION
    The absolute limit of a single script network suite.
    FIXED: Variable syntax errors ($var: -> $($var):).
    ALL MENUS TRANSLATED TO SAFE TURKISH.
#>

# --- 0. SISTEM HAZIRLIK ---
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$currentUser
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process PowerShell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

# --- 1. AYARLAR ---
$DevName  = 'Omer Cataloglu'
$DevWeb   = 'omercataloglu.com'
$DevMail  = 'pixeldrafter@omercataloglu.com'
$DevPhone = '0533 701 00 89'

# Konsol Ayarlari (100 Arac icin genis ekran)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'PixNet v10.1 | CENTURION NETWORK ARSENAL'
$Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(160, 9000)
$Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(160, 50)

# --- 2. CEKIRDEK FONKSIYONLAR ---

function Play-Sound {
    param($Type)
    try {
        if ($Type -eq 'Success') { [Console]::Beep(1200, 100); [Console]::Beep(1500, 100) }
        if ($Type -eq 'Error')   { [Console]::Beep(500, 400) }
        if ($Type -eq 'Ping')    { [Console]::Beep(800, 30) }
        if ($Type -eq 'Boot')    { [Console]::Beep(300, 100); Start-Sleep -m 50; [Console]::Beep(600, 100) }
    } catch {}
}

function Cizgi-Cek { return '=' * 158 }

function Loading-Bar ($TaskName) {
    Write-Host " $TaskName " -NoNewline -ForegroundColor Yellow
    Write-Host '[' -NoNewline -ForegroundColor DarkGray
    for ($i=0; $i -lt 8; $i++) {
        Write-Host '|' -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 2
    }
    Write-Host '] OK' -ForegroundColor Green
    Start-Sleep -Milliseconds 5
}

function Check-Exit-Key {
    if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq 'Q' -or $key.Key -eq 'Escape') { return $true }
    }
    return $false
}

function Boot-Sequence {
    Clear-Host
    Play-Sound 'Boot'
    Write-Host ' PIXTOOL CENTURION KERNEL v10.1 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('CORE', 'NET-STACK', 'SECURITY', 'GEO-DB', 'TOOLS-100', 'UI-LAYER')
    foreach ($m in $modules) { Loading-Bar "INIT: $m" }
    Start-Sleep -Milliseconds 200
    Clear-Host
}

function Logo-Ciz {
    Clear-Host
    # DEMIRBAS PIXTOOL LOGOSU
$ascii = @'
   ____  ___  __  __  _____  _____  _____  _     
  |  _ \|_ _|\ \/ / |_   _|/  _  \|  _  \| |    
  | |_) || |  \  /    | |  | | | || | | || |    
  |  __/ | |  /  \    | |  | | | || | | || |___ 
  |_|   |___|/_/\_\   |_|  \_____/|_____/|_____|
'@
    Write-Host $ascii -ForegroundColor Cyan
    
    Write-Host ''
    Write-Host ' PIXNET v10.1 - CENTURION EDITION (100 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# --- 3. ARAC KUTUPHANESI (1-100) ---

# --- GRUP 1: AG ANALIZI (1-10) ---
function T01 { Write-Host ' [01] LAN CIHAZ TARAMA' -Yellow; $b=(Get-NetIPAddress -AddressFamily IPv4|Where{$_.IPAddress -match '192|172|10'}).IPAddress|Select -First 1; if(!$b){return}; $n=$b.Substring(0,$b.LastIndexOf('.')); Write-Host " AG: $n.x (Durdur: Q)" -Gray; 1..254|%{if(Check-Exit-Key){return};$t="$n.$_";if(Test-Connection $t -Count 1 -Q -Buf 16){Write-Host " [BULUNDU] $t"-Green}} Read-Host '...' }
function T02 { Write-Host ' [02] CANLI TRAFIK AKISI (Cikis: Q)' -Yellow; $a=Get-NetAdapter|Where{$_.Status -eq 'Up'}|Select -First 1; if(!$a){return}; $l=Get-NetAdapterStatistics $a.Name; while($true){if(Check-Exit-Key){break};Start-Sleep 1;$c=Get-NetAdapterStatistics $a.Name;$r=[math]::Round(($c.ReceivedBytes-$l.ReceivedBytes)/1024,2);$t=[math]::Round(($c.SentBytes-$l.SentBytes)/1024,2);Write-Host "`r INDIRME: $r KB/s ".PadRight(25)-NoNewline -Green;Write-Host " YUKLEME: $t KB/s"-Cyan;[Console]::SetCursorPosition(0,[Console]::CursorTop-1);$l=$c} Write-Host "`n" }
function T03 { Write-Host ' [03] KURESEL ERISIM (Cikis: Q)' -Yellow; $k=@{'Google'='8.8.8.8';'TTNET'='195.175.39.39'}; while($true){if(Check-Exit-Key){break};foreach($x in $k.Keys){try{$m=(Test-Connection $k[$x] -Count 1 -EA Stop).ResponseTime;Write-Host "$($x):$($m) ms "-NoNewline -Green}catch{Write-Host "$($x):X "-NoNewline -Red}}Write-Host "`r"-NoNewline;Start-Sleep 2} Write-Host "`n" }
function T04 { Write-Host ' [04] ISLEM TAKIBI (PID) (Cikis: Q)' -Yellow; while($true){if(Check-Exit-Key){break};$c=Get-NetTCPConnection -State Est|Select -First 5;foreach($x in $c){try{$p=(Get-Process -Id $x.OwningProcess -EA 0).ProcessName}catch{$p='Sys'};Write-Host "$p -> $($x.RemoteAddress)"-Cyan};Start-Sleep 2;Clear-Host;Logo-Ciz} }
function T05 { try{$i=Invoke-RestMethod 'http://ipinfo.io/json';Write-Host " IP:$($i.ip) YER:$($i.city)/$($i.country) ISP:$($i.org)"-Green}catch{Write-Host 'Hata'} Read-Host '...' }
function T06 { $t=Read-Host ' Hedef IP'; $ps=@(21,22,23,80,443); foreach($p in $ps){if(Check-Exit-Key){break};try{$s=New-Object Net.Sockets.TcpClient;$s.Connect($t,$p);Write-Host " $p ACIK"-Green;$s.Close()}catch{Write-Host " $p KAPALI"-Gray}} Read-Host '...' }
function T07 { netsh wlan show profiles|Select-String 'All User'|ForEach{$n=($_ -split ':')[1].Trim();$k=(netsh wlan show profile name="$n" key=clear|Select-String 'Key Content');if($k){$p=($k -split ':')[1].Trim();Write-Host "$($n):$($p)" -ForegroundColor Green}else{Write-Host "$($n):YOK" -ForegroundColor Red}} Read-Host '...' }
function T08 { $m=Read-Host ' MAC'; $b=$m -split '[:-]'|ForEach{[byte]"0x$_"}; $p=[byte[]](,0xFF*6)+$b*16; $u=New-Object Net.Sockets.UdpClient; $u.Connect([Net.IPAddress]::Broadcast,9); $u.Send($p,$p.Length); Write-Host ' OK'-Green; Read-Host '...' }
function T09 { $s=Read-Host ' 1:Google 2:Oto'; $a=Get-NetAdapter|Where{$_.Status -eq 'Up'}|Select -First 1; if($s-eq '1'){Set-DnsClientServerAddress $a.InterfaceIndex -ServerAddresses '8.8.8.8'}else{Set-DnsClientServerAddress $a.InterfaceIndex -Reset}; Write-Host ' OK'; Read-Host '...' }
function T10 { ipconfig /flushdns; netsh winsock reset; Write-Host ' ONARILDI'-Green; Read-Host '...' }

# --- GRUP 2: SISTEM & DONANIM (11-20) ---
function T11 { Get-NetAdapter|Select Name,MacAddress,Status|ft -AutoSize; Read-Host '...' }
function T12 { Write-Host " DIS IP: $((Invoke-RestMethod 'https://api.ipify.org').Trim())" -Cyan; Read-Host '...' }
function T13 { $t=Read-Host ' Hedef'; tracert -d -h 10 $t; Read-Host '...' }
function T14 { $d=Read-Host ' Domain'; try{$i=Invoke-RestMethod "http://ip-api.com/json/$d";Write-Host "$d -> $($i.isp)/$($i.country)"-Yellow}catch{Write-Host 'Hata'} Read-Host '...' }
function T15 { $t=Read-Host ' Hedef'; while($true){if(Check-Exit-Key){break};Test-Connection $t -Count 1;Start-Sleep 1} }
function T16 { arp -a; Read-Host '...' }
function T17 { Get-NetRoute|Select DestinationPrefix,NextHop|ft -AutoSize; Read-Host '...' }
function T18 { $t='google.com'; if(Test-Connection $t -Buf 1472 -Count 1 -Quiet){Write-Host '1500 OK'-Green}else{Write-Host 'FRAG GEREK'-Red} Read-Host '...' }
function T19 { Get-NetAdapter|ft Name,LinkSpeed,Status; Read-Host '...' }
function T20 { Write-Host " TOPLAM BAGLANTI: $((Get-NetTCPConnection).Count)"-Yellow; Read-Host '...' }

# --- GRUP 3: KESIF & TARAMA (21-30) ---
function T21 { $i=Read-Host ' IP'; try{[Net.Dns]::GetHostEntry($i).HostName}catch{'YOK'}; Read-Host '...' }
function T22 { ipconfig /all; Read-Host '...' }
function T23 { Write-Host ' SMB (445) KONTROL...'; $t=Read-Host ' Hedef'; try{$s=New-Object Net.Sockets.TcpClient;$s.Connect($t,445);Write-Host 'SMB ACIK'-Green;$s.Close()}catch{Write-Host 'KAPALI'-Red} Read-Host '...' }
function T24 { $t=Read-Host ' Domain'; try{$c=New-Object Net.Sockets.TcpClient;$c.Connect($t,443);Write-Host 'SSL OK'-Green;$c.Close()}catch{Write-Host 'KAPALI'-Red} Read-Host '...' }
function T25 { $u=Read-Host ' URL'; try{$r=Invoke-WebRequest $u -Method Head; $r.Headers|Out-String|Write-Host -Fore Cyan}catch{Write-Host 'Hata'} Read-Host '...' }
function T26 { ipconfig /release; Read-Host '...' }
function T27 { ipconfig /renew; Read-Host '...' }
function T28 { ipconfig /flushdns; Write-Host ' OK'-Green; Read-Host '...' }
function T29 { notepad C:\Windows\System32\drivers\etc\hosts }
function T30 { systeminfo|Select-String 'OS Name','Boot Time','Memory'; Read-Host '...' }

# --- GRUP 4: ILERI DUZEY (31-40) ---
function T31 { $n=Read-Host ' Subnet (192.168.1)'; 1..20|%{if(Check-Exit-Key){return}; $t="$n.$_"; if(Test-Connection $t -Count 1 -Quiet){Write-Host "$t UP"-Green} } Read-Host '...' }
function T32 { $d=Read-Host ' Domain'; nslookup $d; Read-Host '...' }
function T33 { netstat -an | Select -First 20; Read-Host '...' }
function T34 { netsh winhttp show proxy; Read-Host '...' }
function T35 { Get-NetFirewallProfile | ft Name,Enabled; Read-Host '...' }
function T36 { Get-Service *net* | ft Name,Status; Read-Host '...' }
function T37 { Get-NetNeighbor | ft IPAddress,State; Read-Host '...' }
function T38 { Get-NetAdapterAdvancedProperty | Where DisplayName -Like '*Offload*' | ft DisplayValue; Read-Host '...' }
function T39 { Get-SmbShare | ft Name,Path; Read-Host '...' }
function T40 { w32tm /query /status; Read-Host '...' }

# --- GRUP 5: EKSTRA ARACLAR (41-50) ---
function T41 { Get-NetAdapterBinding -ComponentID ms_tcpip6 | ft Name,Enabled; Read-Host '...' }
function T42 { Get-NetAdapter | Select InterfaceDescription,DriverVersion | ft -AutoSize; Read-Host '...' }
function T43 { netsh wlan show networks mode=bssid; Read-Host '...' }
function T44 { netsh wlan show interfaces | Select-String 'Channel'; Read-Host '...' }
function T45 { powercfg /energy duration 5; Write-Host ' Rapor Olusturuldu'-Green; Read-Host '...' }
function T46 { Get-ChildItem Cert:\LocalMachine\Root | Select -First 10 Subject; Read-Host '...' }
function T47 { Get-ChildItem env: | Select -First 10; Read-Host '...' }
function T48 { $env:Path -split ';' | Write-Host; Read-Host '...' }
function T49 { Get-History | Select CommandLine; Read-Host '...' }
function T50 { ipconfig /release; Write-Host ' INTERNET KESILDI'-Red; Read-Host '...' }

# --- GRUP 6: GUVENLIK & PORT (51-60) ---
function T51 { $t=Read-Host ' Hedef'; try{$c=New-Object Net.Sockets.TcpClient;$c.Connect($t,3389);Write-Host 'RDP ACIK'-Green;$c.Close()}catch{Write-Host 'KAPALI'-Red} Read-Host '...' }
function T52 { $t=Read-Host ' Hedef'; try{$c=New-Object Net.Sockets.TcpClient;$c.Connect($t,22);Write-Host 'SSH ACIK'-Green;$c.Close()}catch{Write-Host 'KAPALI'-Red} Read-Host '...' }
function T53 { $t=Read-Host ' Hedef'; try{$c=New-Object Net.Sockets.TcpClient;$c.Connect($t,21);Write-Host 'FTP ACIK'-Green;$c.Close()}catch{Write-Host 'KAPALI'-Red} Read-Host '...' }
function T54 { $t=Read-Host ' Hedef'; try{$c=New-Object Net.Sockets.TcpClient;$c.Connect($t,1433);Write-Host 'SQL ACIK'-Green;$c.Close()}catch{Write-Host 'KAPALI'-Red} Read-Host '...' }
function T55 { $t=Read-Host ' Hedef'; try{$c=New-Object Net.Sockets.TcpClient;$c.Connect($t,25);Write-Host 'SMTP ACIK'-Green;$c.Close()}catch{Write-Host 'KAPALI'-Red} Read-Host '...' }
function T56 { Get-MpComputerStatus | Select AntivirusEnabled,RealTimeProtectionEnabled; Read-Host '...' }
function T57 { Get-NetFirewallRule | Where Enabled -eq True | Select -First 10 Name; Read-Host '...' }
function T58 { Get-SmbMapping; Read-Host '...' }
function T59 { net user; Read-Host '...' }
function T60 { Get-CimInstance Win32_OperatingSystem | Select LastBootUpTime; Read-Host '...' }

# --- GRUP 7: WEB & HTTP (61-70) ---
function T61 { $u=Read-Host ' URL'; try{(Invoke-WebRequest $u).StatusCode;Write-Host 'ERISILEBILIR'-Green}catch{Write-Host 'HATA'-Red} Read-Host '...' }
function T62 { $u=Read-Host ' URL'; try{$r=Invoke-WebRequest $u; $r.Links | Select href -First 10 | ft}catch{} Read-Host '...' }
function T63 { $u=Read-Host ' URL'; try{$r=Invoke-WebRequest $u; $r.Images | Select src -First 10 | ft}catch{} Read-Host '...' }
function T64 { Resolve-DnsName google.com -Type A; Read-Host '...' }
function T65 { Resolve-DnsName google.com -Type MX; Read-Host '...' }
function T66 { Resolve-DnsName google.com -Type TXT; Read-Host '...' }
function T67 { Resolve-DnsName google.com -Type NS; Read-Host '...' }
function T68 { Get-Content C:\Windows\System32\drivers\etc\hosts; Read-Host '...' }
function T69 { [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; Write-Host 'TLS 1.2 ZORLANDI'-Green; Read-Host '...' }
function T70 { Start-Process "chrome.exe" "omercataloglu.com" -ErrorAction SilentlyContinue; Read-Host '...' }

# --- GRUP 8: YEREL SISTEM (71-80) ---
function T71 { Get-Volume | ft DriveLetter,FileSystemLabel,SizeRemaining; Read-Host '...' }
function T72 { Get-WmiObject Win32_Processor | Select Name,LoadPercentage; Read-Host '...' }
function T73 { Get-WmiObject Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum | %{[math]::Round($_.Sum/1GB,2)}; Read-Host ' GB RAM' }
function T74 { Get-ComputerInfo | Select OsName,OsVersion; Read-Host '...' }
function T75 { Get-Clipboard; Read-Host '...' }
function T76 { Get-LocalUser | ft Name,Enabled; Read-Host '...' }
function T77 { Get-LocalGroup | ft Name; Read-Host '...' }
function T78 { Get-ScheduledTask | Select -First 10 TaskName; Read-Host '...' }
function T79 { Get-Process | Sort CPU -Descending | Select -First 5 Name,CPU; Read-Host '...' }
function T80 { Get-EventLog -LogName System -Newest 5 | ft EntryType,Message; Read-Host '...' }

# --- GRUP 9: ARACLAR & EGLENCE (81-90) ---
function T81 { $p=Read-Host ' Yazi'; [System.Windows.Forms.Clipboard]::SetText($p); Write-Host ' KOPYALANDI'-Green; Read-Host '...' }
function T82 { $n=Read-Host ' Sayi'; 1..$n | %{Write-Host "$_ " -NoNew}; Read-Host '...' }
function T83 { Get-Date -Format "dd.MM.yyyy HH:mm:ss"; Read-Host '...' }
function T84 { Write-Host " TERMINAL: $env:TERM_PROGRAM"; Read-Host '...' }
function T85 { $c=Get-Credential; Write-Host " USER: $($c.UserName)"-Yellow; Read-Host '...' }
function T86 { Read-Host -AsSecureString ' Sifre' | ConvertFrom-SecureString | Set-Clipboard; Write-Host ' HASH PANOYA ALINDI'-Green; Read-Host '...' }
function T87 { Write-Host ' 0-100 ARASI SAYI: ' -NoNew; Get-Random -Min 0 -Max 100; Read-Host '...' }
function T88 { Write-Host " UYARI SESI TESTI..."; [Console]::Beep(1000,500); Read-Host '...' }
function T89 { Clear-Host; Write-Host ' EKRAN TEMIZLENDI'-Green; Read-Host '...' }
function T90 { Write-Host ' MATRIX EFEKTI (Cikis: Q)'; while($true){if(Check-Exit-Key){break};$l="";1..80|%{$l+=[char](Get-Random -Min 65 -Max 90)};Write-Host $l -Fore Green;Start-Sleep -m 50} }

# --- GRUP 10: OPERASYON (91-100) ---
function T91 { Stop-Computer -Force; }
function T92 { Restart-Computer -Force; }
function T93 { rundll32.exe user32.dll,LockWorkStation; }
function T94 { taskkill /F /FI "STATUS eq NOT RESPONDING"; Read-Host '...' }
function T95 { gpupdate /force; Read-Host '...' }
function T96 { Get-ChildItem $env:TEMP -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue; Write-Host ' TEMP SILINDI'-Green; Read-Host '...' }
function T97 { Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Host ' COP BOSALTILDI'-Green; Read-Host '...' }
function T98 { checkpoint-computer -description "PixNet Point" -restorepointtype "MODIFY_SETTINGS"; Write-Host ' GERI YUKLEME NOKTASI ALINDI'-Green; Read-Host '...' }
function T99 { sfc /scannow; Read-Host '...' }
function T100 { Write-Host ' PIXTOOL KAPATILIYOR...'-Red; Exit }


# --- 4. ANA MENU (4 SUTUNLU GRID) ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [AG & ANALIZ]          [KESIF & SISTEM]       [GUVENLIK & WEB]       [SISTEM & ARACLAR]" -ForegroundColor Yellow
        Write-Host "   01. LAN TARAMA         26. IP BIRAK (RELEASE) 51. RDP KONTROL        76. YEREL KULLANICI" -ForegroundColor White
        Write-Host "   02. CANLI TRAFIK       27. IP YENILE (RENEW)  52. SSH KONTROL        77. YEREL GRUPLAR" -ForegroundColor White
        Write-Host "   03. KURESEL ERISIM     28. DNS TEMIZLE        53. FTP KONTROL        78. ZAMANLANMIS GOREV" -ForegroundColor White
        Write-Host "   04. ISLEM TAKIBI       29. HOSTS AC           54. SQL KONTROL        79. CPU CANAVARLARI" -ForegroundColor White
        Write-Host "   05. COGRAFI KONUM      30. SISTEM OZET        55. SMTP KONTROL       80. SISTEM LOGLARI" -ForegroundColor White
        Write-Host "   06. PORT TARAMA        31. SERI PING          56. VIRUS KORUMA       81. PANOYA KOPYALA" -ForegroundColor White
        Write-Host "   07. WIFI SIFRELER      32. AD COZUCU (NS)     57. GUVENLIK DUVARI    82. SAYI SAYDIR" -ForegroundColor White
        Write-Host "   08. UYANDIRMA (WOL)    33. AG BAGLANTILARI    58. DOSYA PAYLASIMI    83. TARIH SAAT" -ForegroundColor White
        Write-Host "   09. DNS DEGISTIR       34. VEKIL SUNUCU       59. KULLANICI BILGI    84. TERMINAL BILGI" -ForegroundColor White
        Write-Host "   10. AG ONARIMI         35. FW PROFILI         60. SON ACILIS         85. KIMLIK KONTROL" -ForegroundColor White
        Write-Host "   11. MAC ADRES          36. AG SERVISLER       61. SITE DURUMU        86. SIFRELEME" -ForegroundColor White
        Write-Host "   12. DIS IP OGREN       37. IP KOMSU           62. SAYFA LINKLERI     87. RASTGELE SAYI" -ForegroundColor White
        Write-Host "   13. IZ SURME           38. YUK BOSALTMA       63. SAYFA RESIMLERI    88. SES TESTI" -ForegroundColor White
        Write-Host "   14. ALAN ADI BILGI     39. PAYLASIMLAR        64. DNS KAYDI (A)      89. EKRAN TEMIZLE" -ForegroundColor White
        Write-Host "   15. SUREKLI PING       40. ZAMAN AYARI        65. DNS KAYDI (MX)     90. MATRIX EFEKTI" -ForegroundColor White
        Write-Host "   16. ARP TABLOSU        41. IPV6 DURUM         66. DNS KAYDI (TXT)    91. BILGISAYARI KAPAT" -ForegroundColor Red
        Write-Host "   17. ROTA TABLOSU       42. SURUCULER          67. DNS KAYDI (NS)     92. YENIDEN BASLAT" -ForegroundColor Red
        Write-Host "   18. MTU TESTI          43. WIFI BSSID         68. HOSTS OKU          93. EKRANI KILITLE" -ForegroundColor Magenta
        Write-Host "   19. ADAPTER DURUM      44. WIFI KANAL         69. TLS 1.2 ZORLA      94. DONANLARI KAPAT" -ForegroundColor Magenta
        Write-Host "   20. BAGLANTI SAYI      45. GUC RAPORU         70. SITE AC (CHROME)   95. POLITIKA GUNCELLE" -ForegroundColor Magenta
        Write-Host "   21. ISIM COZUCU        46. SERTIFIKA          71. DISK DURUMU        96. TEMP TEMIZLE" -ForegroundColor Cyan
        Write-Host "   22. IP YAPILANDIRMA    47. DEGISKENLER        72. ISLEMCI YUKU       97. COP BOSALT" -ForegroundColor Cyan
        Write-Host "   23. SMB TARA (445)     48. YOL TANIMLARI      73. BELLEK DURUMU      98. GERI YUKLEME NOK." -ForegroundColor Cyan
        Write-Host "   24. SSL TARA (443)     49. KOMUT GECMIS       74. WINDOWS SURUM      99. SISTEM ONAR (SFC)" -ForegroundColor Cyan
        Write-Host "   25. HTTP BASLIK        50. INTERNET KES       75. PANO OKU           00. CIKIS" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        # Switch blogu 100 secenek icin
        switch ($c) {
            '1' {T01} '2' {T02} '3' {T03} '4' {T04} '5' {T05} '6' {T06} '7' {T07} '8' {T08} '9' {T09} '10' {T10}
            '11' {T11} '12' {T12} '13' {T13} '14' {T14} '15' {T15} '16' {T16} '17' {T17} '18' {T18} '19' {T19} '20' {T20}
            '21' {T21} '22' {T22} '23' {T23} '24' {T24} '25' {T25} '26' {T26} '27' {T27} '28' {T28} '29' {T29} '30' {T30}
            '31' {T31} '32' {T32} '33' {T33} '34' {T34} '35' {T35} '36' {T36} '37' {T37} '38' {T38} '39' {T39} '40' {T40}
            '41' {T41} '42' {T42} '43' {T43} '44' {T44} '45' {T45} '46' {T46} '47' {T47} '48' {T48} '49' {T49} '50' {T50}
            '51' {T51} '52' {T52} '53' {T53} '54' {T54} '55' {T55} '56' {T56} '57' {T57} '58' {T58} '59' {T59} '60' {T60}
            '61' {T61} '62' {T62} '63' {T63} '64' {T64} '65' {T65} '66' {T66} '67' {T67} '68' {T68} '69' {T69} '70' {T70}
            '71' {T71} '72' {T72} '73' {T73} '74' {T74} '75' {T75} '76' {T76} '77' {T77} '78' {T78} '79' {T79} '80' {T80}
            '81' {T81} '82' {T82} '83' {T83} '84' {T84} '85' {T85} '86' {T86} '87' {T87} '88' {T88} '89' {T89} '90' {T90}
            '91' {T91} '92' {T92} '93' {T93} '94' {T94} '95' {T95} '96' {T96} '97' {T97} '98' {T98} '99' {T99} '00' {T100}
            'Q' {T100} 'q' {T100}
        }
    }
}

Main-Loop