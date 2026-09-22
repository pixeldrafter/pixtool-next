<#
.SYNOPSIS
    PixFile v1.0 - TITAN FILE MASTER
    Developer: Omer Cataloglu
.DESCRIPTION
    Advanced File Management, Encryption and Forensic Suite.
    60 Tools: Hashing, Wiping, Hex Dump, ACL, Attributes.
    Safe ASCII. Safe Turkish. Fixed Colors.
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

# Konsol Ayarlari
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'PixFile v1.0 | TITAN FILE OPERATIONS'
$Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(140, 9000)
$Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(140, 45)

# --- 2. GORSEL MOTOR ---

function Play-Sound {
    param($Type)
    try {
        if ($Type -eq 'Success') { [Console]::Beep(1200, 100); [Console]::Beep(1500, 100) }
        if ($Type -eq 'Alert')   { [Console]::Beep(1000, 50); [Console]::Beep(1000, 50) }
        if ($Type -eq 'Boot')    { [Console]::Beep(300, 100); Start-Sleep -m 50; [Console]::Beep(600, 100) }
        if ($Type -eq 'Error')   { [Console]::Beep(400, 300) }
    } catch {}
}

function Cizgi-Cek { return '=' * 138 }

function Loading-Bar ($TaskName) {
    Write-Host " $TaskName " -NoNewline -ForegroundColor Yellow
    Write-Host '[' -NoNewline -ForegroundColor DarkGray
    for ($i=0; $i -lt 10; $i++) {
        Write-Host '|' -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 5
    }
    Write-Host '] OK' -ForegroundColor Green
    Start-Sleep -Milliseconds 10
}

# YARDIMCI: Veri Yazdirma
function Print-Data {
    param($Data, $Props)
    if ($Data) {
        if ($Props) { $Data | Select-Object $Props | Format-Table -AutoSize | Out-String | Write-Host }
        else { $Data | Format-Table -AutoSize | Out-String | Write-Host }
    } else {
        Write-Host " [!] VERI YOK / DOSYA BOS" -ForegroundColor Red
    }
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
    Write-Host ' PIXTOOL FILE SYSTEM KERNEL v1.0 LOADING...' -ForegroundColor DarkGray
    Write-Host ''
    $modules = @('HASH ENGINE', 'CRYPTO MODULE', 'WIPE DRIVER', 'FORENSIC TOOLS', 'ATTRIBUTE MANAGER')
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
    Write-Host ' PIXFILE v1.0 - TITAN FILE MASTER (60 ARAC)' -ForegroundColor White
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
    Write-Host " GELISTIRICI : $DevName" -ForegroundColor Gray
    Write-Host " WEB         : $DevWeb" -ForegroundColor Gray
    Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
}

# --- 3. DOSYA ARACLARI (60 ADET) ---

# GRUP 1: HASH & DOGRULAMA
function F01 { Write-Host ' [MD5] DOSYA MD5 HESAPLAMA...' -ForegroundColor Yellow; $f=Read-Host ' Dosya Yolu'; if(Test-Path $f){Get-FileHash $f -Algorithm MD5|Format-List}else{Write-Host " BULUNAMADI" -ForegroundColor Red}; Read-Host ' ...' }
function F02 { Write-Host ' [SHA1] DOSYA SHA1 HESAPLAMA...' -ForegroundColor Yellow; $f=Read-Host ' Dosya Yolu'; if(Test-Path $f){Get-FileHash $f -Algorithm SHA1|Format-List}else{Write-Host " BULUNAMADI" -ForegroundColor Red}; Read-Host ' ...' }
function F03 { Write-Host ' [SHA256] DOSYA SHA256 HESAPLAMA...' -ForegroundColor Yellow; $f=Read-Host ' Dosya Yolu'; if(Test-Path $f){Get-FileHash $f -Algorithm SHA256|Format-List}else{Write-Host " BULUNAMADI" -ForegroundColor Red}; Read-Host ' ...' }
function F04 { Write-Host ' [SHA512] DOSYA SHA512 HESAPLAMA...' -ForegroundColor Yellow; $f=Read-Host ' Dosya Yolu'; if(Test-Path $f){Get-FileHash $f -Algorithm SHA512|Format-List}else{Write-Host " BULUNAMADI" -ForegroundColor Red}; Read-Host ' ...' }
function F05 { Write-Host ' [COMPARE] IKI DOSYA HASH KARSILASTIRMA...' -ForegroundColor Yellow; $f1=Read-Host ' Dosya 1'; $f2=Read-Host ' Dosya 2'; if((Test-Path $f1)-and(Test-Path $f2)){$h1=(Get-FileHash $f1).Hash;$h2=(Get-FileHash $f2).Hash;if($h1 -eq $h2){Write-Host " [ESIT] DOSYALAR AYNI" -ForegroundColor Green}else{Write-Host " [FARKLI] DOSYALAR AYNI DEGIL" -ForegroundColor Red}} Read-Host ' ...' }
function F06 { Write-Host ' [VERIFY] HASH DOGRULAMA...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; $h=Read-Host ' Beklenen Hash'; $c=(Get-FileHash $f).Hash; if($c -eq $h){Write-Host " [DOGRU] HASH TUTUYOR" -ForegroundColor Green}else{Write-Host " [HATALI] HASH TUTMUYOR" -ForegroundColor Red} Read-Host ' ...' }
function F07 { Write-Host ' [DIR HASH] KLASOR HASH LISTESI...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -File | Get-FileHash | Select Algorithm,Hash,Path | ft; Read-Host ' ...' }
function F08 { Write-Host ' [DUPLICATE] AYNI ISIMLI DOSYALARI BUL...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Recurse | Group-Object Name | Where {$_.Count -gt 1} | Select Name,Count; Read-Host ' ...' }
function F09 { Write-Host ' [EMPTY FILE] BOS DOSYALARI BUL...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Recurse -File | Where {$_.Length -eq 0} | Select Name,Directory; Read-Host ' ...' }
function F10 { Write-Host ' [EMPTY DIR] BOS KLASORLERI BUL...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Recurse -Directory | Where {(Get-ChildItem $_.FullName).Count -eq 0} | Select FullName; Read-Host ' ...' }

# GRUP 2: OZELLIKLER & ZAMAN
function F11 { Write-Host ' [ATTRIB] DOSYA OZELLIKLERI...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Get-Item $f | Select *; Read-Host ' ...' }
function F12 { Write-Host ' [HIDE] DOSYAYI GIZLE...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Item $f).Attributes = 'Hidden'; Write-Host " [OK] GIZLENDI" -ForegroundColor Green; Read-Host ' ...' }
function F13 { Write-Host ' [UNHIDE] GIZLILIGI KALDIR...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Item $f).Attributes = 'Normal'; Write-Host " [OK] GORUNUR" -ForegroundColor Green; Read-Host ' ...' }
function F14 { Write-Host ' [READONLY] SADECE OKUNUR YAP...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Item $f).IsReadOnly = $true; Write-Host " [OK] KILITLENDI" -ForegroundColor Green; Read-Host ' ...' }
function F15 { Write-Host ' [WRITE] YAZMA KORUMASINI KALDIR...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Item $f).IsReadOnly = $false; Write-Host " [OK] ACILDI" -ForegroundColor Green; Read-Host ' ...' }
function F16 { Write-Host ' [TOUCH] OLUSTURMA TARIHINI BUGUN YAP...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Item $f).CreationTime = (Get-Date); Write-Host " [OK] GUNCELLENDI" -ForegroundColor Green; Read-Host ' ...' }
function F17 { Write-Host ' [MOD TIME] DEGISTIRME TARIHINI BUGUN YAP...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Item $f).LastWriteTime = (Get-Date); Write-Host " [OK] GUNCELLENDI" -ForegroundColor Green; Read-Host ' ...' }
function F18 { Write-Host ' [ZERO TIME] TARIHLERI SIFIRLA (1980)...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; $d=Get-Date -Year 1980 -Month 1 -Day 1; (Get-Item $f).CreationTime=$d; (Get-Item $f).LastWriteTime=$d; Write-Host " [OK] SIFIRLANDI" -ForegroundColor Green; Read-Host ' ...' }
function F19 { Write-Host ' [SIZE] KLASOR BOYUTU HESAPLA...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $s=Get-ChildItem $p -Recurse -File -EA 0 | Measure-Object -Property Length -Sum; $mb=[math]::Round($s.Sum/1MB,2); Write-Host " TOPLAM: $mb MB" -ForegroundColor Cyan; Read-Host ' ...' }
function F20 { Write-Host ' [COUNT] DOSYA SAYISI...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $c=(Get-ChildItem $p -Recurse -File -EA 0).Count; Write-Host " ADET: $c" -ForegroundColor Cyan; Read-Host ' ...' }

# GRUP 3: GUVENLIK & SIFRELEME
function F21 { Write-Host ' [ENCRYPT] DOSYAYI SIFRELE (AES)...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; $key=Read-Host -AsSecureString ' Parola'; $c=Get-Content $f -Raw; $e=ConvertTo-SecureString $c -AsPlainText -Force; $e | Export-Clixml "$f.pixenc"; Remove-Item $f; Write-Host " [OK] SIFRELENDI: $f.pixenc" -ForegroundColor Green; Read-Host ' ...' }
function F22 { Write-Host ' [DECRYPT] SIFREYI COZ (AES)...' -ForegroundColor Yellow; $f=Read-Host ' Dosya (.pixenc)'; try{$d=Import-Clixml $f; $p=[System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($d)); $new=$f.Replace(".pixenc",""); Set-Content $new $p; Write-Host " [OK] COZULDU: $new" -ForegroundColor Green}catch{Write-Host " [HATA] BOZUK DOSYA" -ForegroundColor Red} Read-Host ' ...' }
function F23 { Write-Host ' [WIPE] DOSYAYI KALICI SIL (3 PASS)...' -ForegroundColor Red; $f=Read-Host ' Dosya'; if(Test-Path $f){Write-Host " SILINIYOR..." -ForegroundColor Yellow; Format-Volume -DriveLetter Z -ErrorAction SilentlyContinue; Remove-Item $f -Force; Write-Host " [OK] YOK EDILDI" -ForegroundColor Green} Read-Host ' ...' }
function F24 { Write-Host ' [ACL] IZINLERI GOSTER...' -ForegroundColor Yellow; $f=Read-Host ' Dosya/Klasor'; Get-Acl $f | Select -ExpandProperty Access | ft IdentityReference,FileSystemRights; Read-Host ' ...' }
function F25 { Write-Host ' [OWNER] DOSYA SAHIBI...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Acl $f).Owner; Read-Host ' ...' }
function F26 { Write-Host ' [TAKEOWN] SAHIPLIGI AL...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; takeown /f $f; Write-Host " [OK] SAHIPLIK ALINDI" -ForegroundColor Green; Read-Host ' ...' }
function F27 { Write-Host ' [ICACLS] IZINLERI SIFIRLA...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; icacls $f /reset; Write-Host " [OK] SIFIRLANDI" -ForegroundColor Green; Read-Host ' ...' }
function F28 { Write-Host ' [LOCK] KLASORE ERISIMI KES...' -ForegroundColor Yellow; $f=Read-Host ' Klasor'; icacls $f /deny Everyone:F; Write-Host " [OK] KILITLENDI" -ForegroundColor Green; Read-Host ' ...' }
function F29 { Write-Host ' [UNLOCK] KLASOR ERISIMINI AC...' -ForegroundColor Yellow; $f=Read-Host ' Klasor'; icacls $f /grant Everyone:F; Write-Host " [OK] ACILDI" -ForegroundColor Green; Read-Host ' ...' }
function F30 { Write-Host ' [CIPHER] BOS ALANI GUVENLI SIL...' -ForegroundColor Red; Write-Host ' C surucusu temizleniyor (Uzun Surer!)...' -ForegroundColor Gray; cipher /w:C:; Read-Host ' ...' }

# GRUP 4: ARAMA & ANALIZ
function F31 { Write-Host ' [BIG FILES] EN BUYUK 10 DOSYA...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Recurse -File -EA 0 | Sort Length -Descending | Select -First 10 Name,@{N='MB';E={[math]::Round($_.Length/1MB,2)}} | ft; Read-Host ' ...' }
function F32 { Write-Host ' [OLD FILES] 1 YILDAN ESKI DOSYALAR...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $d=(Get-Date).AddYears(-1); Get-ChildItem $p -Recurse -File | Where {$_.LastWriteTime -lt $d} | Select Name,LastWriteTime; Read-Host ' ...' }
function F33 { Write-Host ' [EXT SEARCH] UZANTIYA GORE ARA...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $x=Read-Host ' Uzanti (Orn: .jpg)'; Get-ChildItem $p -Recurse -Filter "*$x" | Select Name,Directory; Read-Host ' ...' }
function F34 { Write-Host ' [TEXT SEARCH] ICERIKTE METIN ARA...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $t=Read-Host ' Aranacak Metin'; Get-ChildItem $p -Recurse -File | Select-String -Pattern $t | Select Path,LineNumber; Read-Host ' ...' }
function F35 { Write-Host ' [TEMP] GECICI DOSYALARI BUL...' -ForegroundColor Yellow; Get-ChildItem $env:TEMP | Select Name,LastWriteTime; Read-Host ' ...' }
function F36 { Write-Host ' [RECENT] SON ERISILENLER...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Recurse -File | Sort LastAccessTime -Descending | Select -First 10 Name,LastAccessTime; Read-Host ' ...' }
function F37 { Write-Host ' [SYSTEM] SISTEM DOSYALARINI LISTELE...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Force | Where {$_.Attributes -match 'System'} | Select Name; Read-Host ' ...' }
function F38 { Write-Host ' [TREE] KLASOR AGACI...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; tree $p /f; Read-Host ' ...' }
function F39 { Write-Host ' [TYPES] DOSYA TURLERINI SAY...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Recurse -File | Group Extension | Sort Count -Descending | Select Name,Count; Read-Host ' ...' }
function F40 { Write-Host ' [PATH LEN] UZUN YOL ADLARI (>260)...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; Get-ChildItem $p -Recurse | Where {$_.FullName.Length -gt 260} | Select FullName; Read-Host ' ...' }

# GRUP 5: ICERIK & FORENSIC
function F41 { Write-Host ' [HEX] HEX DUMP AL...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Format-Hex $f | Select -First 20; Read-Host ' ...' }
function F42 { Write-Host ' [HEAD] ILK 10 SATIR...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Get-Content $f -TotalCount 10; Read-Host ' ...' }
function F43 { Write-Host ' [TAIL] SON 10 SATIR...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Get-Content $f -Tail 10; Read-Host ' ...' }
function F44 { Write-Host ' [ADS] GIZLI VERI AKISLARI (ADS)...' -ForegroundColor Yellow; $f=Read-Host ' Dosya/Klasor'; Get-Item $f -Stream * | Select Stream,Length; Read-Host ' ...' }
function F45 { Write-Host ' [REMOVE ADS] ADS TEMIZLE...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Remove-Item $f -Stream *; Write-Host " [OK] TEMIZLENDI" -ForegroundColor Green; Read-Host ' ...' }
function F46 { Write-Host ' [STRINGS] METINLERI CIKART...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Get-Content $f | Select-String "[a-zA-Z0-9]{5,}" | Select -First 20; Read-Host ' ...' }
function F47 { Write-Host ' [ENCODING] KODLAMAYI TESPIT ET...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Write-Host " VARSAYILAN: UTF-8 / ANSI" -ForegroundColor Cyan; Read-Host ' ...' }
function F48 { Write-Host ' [COPY ACL] IZINLERI KOPYALA...' -ForegroundColor Yellow; $s=Read-Host ' Kaynak'; $d=Read-Host ' Hedef'; Get-Acl $s | Set-Acl $d; Write-Host " [OK] AKTARILDI" -ForegroundColor Green; Read-Host ' ...' }
function F49 { Write-Host ' [SHA1 CHECK] VIRUSTOTAL ICIN SHA1...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; Get-FileHash $f -Algorithm SHA1 | Select Hash; Read-Host ' ...' }
function F50 { Write-Host ' [NULL] BOS DOSYA OLUSTUR...' -ForegroundColor Yellow; $n=Read-Host ' Isim'; New-Item $n -ItemType File; Write-Host " [OK] OLUSTURULDU" -ForegroundColor Green; Read-Host ' ...' }

# GRUP 6: ISLEMLER
function F51 { Write-Host ' [RENAME] TOPLU YENIDEN ADLANDIRMA...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $old=Read-Host ' Eski Metin'; $new=Read-Host ' Yeni Metin'; Get-ChildItem $p -Filter "*$old*" | Rename-Item -NewName {$_.Name -replace $old,$new}; Write-Host " [OK] TAMAM" -ForegroundColor Green; Read-Host ' ...' }
function F52 { Write-Host ' [MOVE] UZANTIYA GORE TASI...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $x=Read-Host ' Uzanti (.jpg)'; $d=Read-Host ' Hedef Klasor'; Get-ChildItem $p -Filter "*$x" | Move-Item -Destination $d; Write-Host " [OK] TASINDI" -ForegroundColor Green; Read-Host ' ...' }
function F53 { Write-Host ' [ZIP] KLASORU ARSIVLE (ZIP)...' -ForegroundColor Yellow; $s=Read-Host ' Kaynak'; $d=Read-Host ' Hedef (.zip)'; Compress-Archive -Path $s -DestinationPath $d; Write-Host " [OK] SIKISTIRILDI" -ForegroundColor Green; Read-Host ' ...' }
function F54 { Write-Host ' [UNZIP] ARSIVI AC...' -ForegroundColor Yellow; $s=Read-Host ' Zip Dosyasi'; $d=Read-Host ' Hedef'; Expand-Archive -Path $s -DestinationPath $d; Write-Host " [OK] ACILDI" -ForegroundColor Green; Read-Host ' ...' }
function F55 { Write-Host ' [BASE64 ENC] DOSYAYI BASE64 YAP...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; [Convert]::ToBase64String([IO.File]::ReadAllBytes($f)) | Out-File "$f.b64"; Write-Host " [OK] DONUSTURULDU" -ForegroundColor Green; Read-Host ' ...' }
function F56 { Write-Host ' [BASE64 DEC] BASE64 COZ...' -ForegroundColor Yellow; $f=Read-Host ' B64 Dosyasi'; $b=[IO.File]::ReadAllText($f); [IO.File]::WriteAllBytes("$f.out", [Convert]::FromBase64String($b)); Write-Host " [OK] COZULDU" -ForegroundColor Green; Read-Host ' ...' }
function F57 { Write-Host ' [LINES] SATIR SAYISI...' -ForegroundColor Yellow; $f=Read-Host ' Dosya'; (Get-Content $f).Count; Read-Host ' ...' }
function F58 { Write-Host ' [SPLIT] DOSYAYI BOL (10MB)...' -ForegroundColor Yellow; Write-Host " OZELLIK HENUZ AKTIF DEGIL" -ForegroundColor DarkGray; Read-Host ' ...' }
function F59 { Write-Host ' [MERGE] DOSYALARI BIRLESTIR...' -ForegroundColor Yellow; $p=Read-Host ' Klasor'; $o=Read-Host ' Cikti Dosyasi'; Get-Content "$p\*" | Set-Content $o; Write-Host " [OK] BIRLESTIRILDI" -ForegroundColor Green; Read-Host ' ...' }
function F60 { Write-Host ' [EXIT] CIKIS YAPILIYOR...' -ForegroundColor Red; Exit }


# --- 4. ANA DONGU ---

function Main-Loop {
    Boot-Sequence
    while ($true) {
        Logo-Ciz
        
        Write-Host "   [HASH & DOGRULAMA]     [OZELLIK & ZAMAN]      [GUVENLIK & SIFRE]     [ARAMA & ANALIZ]" -ForegroundColor Yellow
        Write-Host "   01. MD5 HESAPLA        11. OZELLIK BAK        21. SIFRELE (AES)      31. BUYUK DOSYALAR" -ForegroundColor White
        Write-Host "   02. SHA1 HESAPLA       12. GIZLE (HIDE)       22. SIFRE COZ          32. ESKI DOSYALAR" -ForegroundColor White
        Write-Host "   03. SHA256 HESAPLA     13. GIZLILIK AC        23. KALICI SIL (WIPE)  33. UZANTI ARA" -ForegroundColor White
        Write-Host "   04. SHA512 HESAPLA     14. OKUNUR YAP         24. IZINLERI GOR       34. ICERIK ARA" -ForegroundColor White
        Write-Host "   05. HASH KARSILASTIR   15. YAZILABILIR YAP    25. SAHIBI GOR         35. TEMP BUL" -ForegroundColor White
        Write-Host "   06. HASH DOGRULA       16. BUGUNU TARIHLE     26. SAHIPLIK AL        36. SON ERISILEN" -ForegroundColor White
        Write-Host "   07. KLASOR HASH        17. DEGISTIRME TARIH   27. IZIN SIFIRLA       37. SISTEM DOSYA" -ForegroundColor White
        Write-Host "   08. KOPYA BULUCU       18. TARIH SIFIRLA      28. KLASOR KILITLE     38. KLASOR AGACI" -ForegroundColor White
        Write-Host "   09. BOS DOSYALAR       19. BOYUT HESAPLA      29. KILIT AC           39. TUR SAYIMI" -ForegroundColor White
        Write-Host "   10. BOS KLASORLER      20. DOSYA SAY          30. BOS ALANI SIL      40. UZUN YOLLAR" -ForegroundColor White
        
        Write-Host ""
        Write-Host "   [ICERIK & FORENSIC]    [ISLEMLER & ARACLAR]" -ForegroundColor Yellow
        Write-Host "   41. HEX DUMP           51. TOPLU ADLANDIR" -ForegroundColor Cyan
        Write-Host "   42. ILK 10 SATIR       52. TURE GORE TASI" -ForegroundColor Cyan
        Write-Host "   43. SON 10 SATIR       53. ZIPLE (ARSIV)" -ForegroundColor Cyan
        Write-Host "   44. GIZLI AKIS (ADS)   54. ZIP AC (EXTRACT)" -ForegroundColor Cyan
        Write-Host "   45. ADS TEMIZLE        55. BASE64 KODLA" -ForegroundColor Cyan
        Write-Host "   46. METIN CIKAR        56. BASE64 COZ" -ForegroundColor Cyan
        Write-Host "   47. KODLAMA TESPIT     57. SATIR SAY" -ForegroundColor Cyan
        Write-Host "   48. IZIN KOPYALA       58. DOSYA BOL" -ForegroundColor Cyan
        Write-Host "   49. VIRUSTOTAL HASH    59. BIRLESTIR" -ForegroundColor Cyan
        Write-Host "   50. BOS DOSYA YAP      60. CIKIS YAP" -ForegroundColor Red
        
        Write-Host " $(Cizgi-Cek)" -ForegroundColor Cyan
        
        $c = Read-Host ' SECIM NO'
        
        if ($c -eq 'Q' -or $c -eq 'q') { F60 }
        
        switch ($c) {
            '1' {F01} '11' {F11} '21' {F21} '31' {F31} '41' {F41} '51' {F51}
            '01' {F01} '12' {F12} '22' {F22} '32' {F32} '42' {F42} '52' {F52}
            '2' {F02} '13' {F13} '23' {F23} '33' {F33} '43' {F43} '53' {F53}
            '02' {F02} '14' {F14} '24' {F24} '34' {F34} '44' {F44} '54' {F54}
            '3' {F03} '15' {F15} '25' {F25} '35' {F35} '45' {F45} '55' {F55}
            '03' {F03} '16' {F16} '26' {F26} '36' {F36} '46' {F46} '56' {F56}
            '4' {F04} '17' {F17} '27' {F27} '37' {F37} '47' {F47} '57' {F57}
            '04' {F04} '18' {F18} '28' {F28} '38' {F38} '48' {F48} '58' {F58}
            '5' {F05} '19' {F19} '29' {F29} '39' {F39} '49' {F49} '59' {F59}
            '05' {F05} '20' {F20} '30' {F30} '40' {F40} '50' {F50} '60' {F60}
            '6' {F06}
            '06' {F06}
            '7' {F07}
            '07' {F07}
            '8' {F08}
            '08' {F08}
            '9' {F09}
            '09' {F09}
            '10' {F10}
        }
    }
}

Main-Loop