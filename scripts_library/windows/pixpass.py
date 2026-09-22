import hashlib
import random
import string
import os
import sys
import time

# --- RENKLENDİRME (Windows CMD uyumlu) ---
os.system('color') 

class C
    CYAN = '033[96m'
    GREEN = '033[92m'
    YELLOW = '033[93m'
    RED = '033[91m'
    ENDC = '033[0m'
    BOLD = '033[1m'

def print_banner()
    print(f{C.CYAN})
    print(╔══════════════════════════════════════════════════════╗)
    print(║     PIXTOOL PASSWORD GENERATOR & HASHER (SHA-256)    ║)
    print(╚══════════════════════════════════════════════════════╝)
    print(f{C.ENDC})

def get_sha256(text)
    Metni SHA-256 formatına çevirir.
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def generate_strong_password(length=16)
    Rastgele güçlü parola üretir.
    chars = string.ascii_letters + string.digits + !@#$%^&()_+
    return ''.join(random.choice(chars) for _ in range(length))

def main()
    print_banner()
    
    while True
        print(fn{C.YELLOW}[] Lütfen parolayı girin (Rastgele üretim için ENTER'a basın){C.ENDC})
        user_input = input(f{C.BOLD} {C.ENDC}).strip()
        
        plain_password = 
        
        if not user_input
            print(fn{C.CYAN}[] Rastgele güçlü parola üretiliyor...{C.ENDC})
            time.sleep(0.5)
            plain_password = generate_strong_password()
            print(f{C.GREEN}[+] Üretilen Parola  {C.WHITE}{plain_password}{C.ENDC})
        else
            plain_password = user_input
            print(f{C.GREEN}[+] Girilen Parola   {C.WHITE}{plain_password}{C.ENDC})
            
        # HASH İŞLEMİ
        hashed_password = get_sha256(plain_password)
        
        print(f-  60)
        print(f{C.RED}[KEY] VERİTABANI FORMATI (SHA-256){C.ENDC})
        print(f{C.YELLOW}{hashed_password}{C.ENDC})
        print(f-  60)
        
        print(fn{C.CYAN}[1] Yeni Parola Üret)
        print(f[2] Çıkış{C.ENDC})
        
        choice = input( )
        if choice == '2'
            break
        
        os.system('cls' if os.name == 'nt' else 'clear')
        print_banner()

if __name__ == __main__
    try
        main()
    except KeyboardInterrupt
        print(nÇıkış yapıldı.)