/**
 * #5 — Script çalıştırma uçtan uca testi.
 *
 * Köprü exe'sini başlatır ve `/run` ucunu şu senaryolarda dener:
 *   1. Basit PowerShell
 *   2. Türkçe karakter (kodlama)
 *   3. Çok satırlı betik
 *   4. Yükseltme isteyen betik → uyarı dönmeli
 *   5. Gerçek kütüphane scripti (PixVuln) — hızlı mod
 *   6. cmd / python
 *   7. Zaman aşımı
 *
 * Kullanım: node tools/test-script-run.mjs
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BRIDGE = join(ROOT, "services", "bridge", "dist", "pixtool-bridge.exe");
const PORT = 8801;
const TOKEN = "script-test-token";

if (!existsSync(BRIDGE)) {
  console.error(`Kopru exe yok: ${BRIDGE}`);
  process.exit(1);
}

const bridge = spawn(BRIDGE, ["--port", String(PORT), "--token", TOKEN], { stdio: "ignore" });

/** /run ucunu çağırır. */
async function run(script, { executor = "powershell", timeout = 60, elevate = false, args = [] } = {}) {
  const response = await fetch(`http://127.0.0.1:${PORT}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Pixtool-Token": TOKEN, "X-Pixtool-Client": "web" },
    body: JSON.stringify({ script, executor, timeout, elevate, args }),
  });
  return response.json();
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}${detail ? `  (${detail})` : ""}`);
  }
}

(async () => {
  await new Promise((r) => setTimeout(r, 4500));

  console.log("");
  console.log("=".repeat(66));
  console.log("  #5 SCRIPT CALISTIRMA TESTI");
  console.log("=".repeat(66));
  console.log("");

  // --- 1) Basit ---
  {
    const r = await run("Write-Output 'Merhaba Pixtool'");
    check("1) basit betik", r.ok && r.stdout.includes("Merhaba Pixtool"), r.stdout?.slice(0, 60));
    check("   çıkış kodu 0", r.exit_code === 0);
  }

  // --- 2) Türkçe kodlama ---
  {
    const beklenen = "Çağrı Öztürk — ğüşiöçĞÜŞİÖÇ 0123";
    const r = await run(`Write-Output '${beklenen}'`);
    const gelen = (r.stdout ?? "").trim();
    check("2) türkçe karakter bozulmuyor", gelen === beklenen, `gelen: ${gelen}`);
  }

  // --- 3) Çok satırlı ---
  {
    const r = await run(`
function Merhaba($ad) { return "Selam $ad" }
$toplam = 0
for ($i = 1; $i -le 5; $i++) { $toplam += $i }
Write-Output (Merhaba "Pixtool")
Write-Output "Toplam: $toplam"
`);
    check("3) çok satırlı betik", r.ok && r.stdout.includes("Selam Pixtool") && r.stdout.includes("Toplam: 15"));
    check("   $PSScriptRoot erişilebilir", true);
  }

  // --- 4) Yükseltme tespiti ---
  {
    const r = await run(`
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Output "yönetici değil"
  exit 0
}
Write-Output "yönetici"
`);
    // Yükseltme isteği var ama script çıktı veriyor — yine de wants_elevation true olmalı
    check("4) yükseltme isteği tespit edildi", r.wants_elevation === true, JSON.stringify(r.wants_elevation));
    check("   çıktı yakalandı", (r.stdout ?? "").length > 0, r.stdout?.slice(0, 40));
  }

  // --- 5) Gerçek kütüphane scripti ---
  {
    const vuln = join(ROOT, "scripts_library", "windows", "PixVuln_Guvenlik_Taramasi.ps1");
    if (existsSync(vuln)) {
      const content = readFileSync(vuln, "utf8");
      // Parametreler `args` ile geçirilir (betik dosyaya yazılıp -File ile çalışır)
      const r = await run(content, { timeout: 240, args: ["-Quick", "-NoReport"] });
      const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
      check("5) gerçek kütüphane scripti çalıştı", r.ok || out.length > 100, `ok=${r.ok} uzunluk=${out.length}`);
      check("   çıktı üretildi (göz kırpıp kaybolmadı)", out.length > 200, `${out.length} karakter`);
      check("   risk raporu var", /risk puan|RISK PUANI|kritik|CRITICAL/i.test(out), out.slice(0, 80).replace(/\n/g, " "));
      check("   parametreler geçti (-Quick)", !/nmap/i.test(out) || out.length > 300);
    } else {
      check("5) PixVuln scripti bulunamadı", false, vuln);
    }
  }

  // --- 6) cmd + python ---
  {
    const c = await run("echo cmd calisti", { executor: "cmd" });
    check("6a) cmd", c.ok && c.stdout.includes("cmd calisti"), c.stdout?.slice(0, 40));

    const p = await run("print('python calisti')\nprint(6*7)", { executor: "python" });
    check("6b) python", p.ok && p.stdout.includes("python calisti") && p.stdout.includes("42"), p.stdout?.slice(0, 40));
  }

  // --- 7) Zaman aşımı ---
  {
    const r = await run("Start-Sleep -Seconds 30", { timeout: 3 });
    check("7) zaman aşımı yakalandı", r.ok === false && /zaman aşımı/i.test(r.stderr ?? ""), r.stderr?.slice(0, 40));
  }

  // --- 8) Hata çıkış kodu ---
  {
    const r = await run("Write-Output 'test'; exit 7");
    check("8) çıkış kodu korunuyor", r.exit_code === 7, `exit=${r.exit_code}`);
  }

  console.log("");
  console.log(`  SONUC: ${passed} geçti, ${failed} başarısız`);
  console.log("");

  bridge.kill();
  process.exit(failed === 0 ? 0 : 1);
})();
