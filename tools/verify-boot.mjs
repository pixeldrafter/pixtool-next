/**
 * Boot (önyükleme) ekranı doğrulaması.
 *
 * Köprüyü başlatır, `?step=boot` ile açılış akışını sonuna kadar bekler ve:
 *   • yasaklı iskelet ibarelerini ("FAZ 1", "köprü bekleniyor", "Faz 1:")
 *   • gerçek donanım satırlarının doluluğunu
 *   • ekran görüntüsünü
 * denetler.
 *
 * Kullanım: node tools/verify-boot.mjs
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";

const SHOTS = join(process.cwd(), "screenshots", "boot");
const PORT = 9899;
const LOCAL_PORT = 5211;
const BRIDGE_PORT = 8765;
const TOKEN = "boot-verify-token";

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => path && existsSync(path));

const bridgeExe = join(process.cwd(), "services", "bridge", "dist", "pixtool-bridge.exe");
if (!chromePath || !existsSync(bridgeExe)) {
  console.error("Chrome veya kopru exe bulunamadi");
  process.exit(1);
}

mkdirSync(SHOTS, { recursive: true });

// --- Yerel statik sunucu ---
const DIST = join(process.cwd(), "apps", "web", "dist");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

const server = createServer((request, response) => {
  let path = decodeURIComponent((request.url ?? "/").split("?")[0]);
  if (path === "/") path = "/index.html";
  const file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end("yok");
    return;
  }
  response.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
  response.end(readFileSync(file));
});

const bridge = spawn(bridgeExe, ["--port", String(BRIDGE_PORT), "--token", TOKEN], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PIXTOOL_BRIDGE_VERBOSE: "1" },
});

/** Köprüye gelen istekler (günlükten). */
const bridgeHits = [];
bridge.stdout.on("data", (chunk) => bridgeHits.push(String(chunk)));
bridge.stderr.on("data", (chunk) => bridgeHits.push(String(chunk)));

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `px-boot-${Date.now()}`)}`,
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    "--window-size=1400,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let messageId = 0;
const pending = new Map();

const send = (socket, method, params = {}) => {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout ${method}`));
      }
    }, 40000);
  });
};

const FORBIDDEN = [
  "FAZ 1",
  "FAZ 2",
  "FAZ 3",
  "FAZ 4",
  "FAZ 5",
  "KÖPRÜ BEKLENİYOR",
  "köprü bekleniyor",
  "Faz 3",
  "Faz 1:",
  "eklenecek",
  "All systems operational",
];

const EXPECTED = [
  ["donanım fazı", /DONANIM/],
  ["anakart", /Anakart\s*:/],
  ["BIOS", /BIOS\s*:/],
  ["işlemci", /İşlemci\s*:/],
  ["bellek", /Bellek\s*:/],
  ["servisler", /SERVİSLER/],
  ["ısı", /ISI & GÜVENLİK|En sıcak sensör/],
  ["port", /PORT|Dinlenen port|Zafiyet riski/],
];

(async () => {
  try {
    await new Promise((resolve) => server.listen(LOCAL_PORT, "127.0.0.1", resolve));
    console.log("");
    console.log("=".repeat(66));
    console.log("  BOOT EKRANI DOGRULAMASI");
    console.log("=".repeat(66));
    console.log("");
    console.log(`  yerel sunucu : http://localhost:${LOCAL_PORT}`);
    console.log(`  köprü        : http://127.0.0.1:${BRIDGE_PORT}`);
    console.log("");

    let target = null;
    for (let attempt = 0; attempt < 60 && !target; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = await response.json();
        target = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      } catch {
        /* bekle */
      }
      if (!target) await new Promise((r) => setTimeout(r, 250));
    }
    if (!target) throw new Error("Chrome hedefi yok");

    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve);
      socket.addEventListener("error", reject);
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id && pending.has(payload.id)) {
        const { resolve, reject } = pending.get(payload.id);
        pending.delete(payload.id);
        if (payload.error) reject(new Error(payload.error.message));
        else resolve(payload.result);
      }
    });

    await send(socket, "Page.enable");
    await send(socket, "Runtime.enable");

    const evaluate = async (expression) => {
      const result = await send(socket, "Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return result.result?.value;
    };

    // Köprü ayarını yaz (konsol/boot aynı depoyu okur)
    await send(socket, "Page.navigate", { url: `http://localhost:${LOCAL_PORT}/?step=login` });
    await new Promise((r) => setTimeout(r, 3500));

    await evaluate(`
      (() => {
        const KEY = 'pixtool.settings';
        const raw = localStorage.getItem(KEY);
        if (!raw) {
          // Depo ilk yuklemede yazmamis olabilir — sifirdan olustur.
          // Zustand persist bicimi: { state: {...}, version: N }
          localStorage.setItem(KEY, JSON.stringify({
            state: {
              settings: {
                bridge: {
                  enabled: true,
                  url: ${JSON.stringify(`http://127.0.0.1:${BRIDGE_PORT}`)},
                  token: ${JSON.stringify(TOKEN)},
                  autoProbe: true,
                  allowRun: false
                }
              },
              migrated: true
            },
            version: 2
          }));
        } else {
          const state = JSON.parse(raw);
          if (!state.state) state.state = {};
          if (!state.state.settings) state.state.settings = {};
          state.state.settings.bridge = {
            enabled: true,
            url: 'http://127.0.0.1:${BRIDGE_PORT}',
            token: ${JSON.stringify(TOKEN)},
            autoProbe: true,
            allowRun: false
          };
          localStorage.setItem(KEY, JSON.stringify(state));
        }
        const back = JSON.parse(localStorage.getItem(KEY));
        return back.state.settings.bridge.url;
      })()
    `);

    // Boot adımına doğrudan git — BootScreen envanteri kendi toplar.
    // (Normal akışta konsol toplar ve state ile aktarır; burada
    //  derin bağlantı / sayfa yenileme senaryosunu test ediyoruz.)
    console.log("  1) Boot ekranına doğrudan gidiliyor (kendi kendine tarama)…");
    await send(socket, "Page.navigate", { url: `http://localhost:${LOCAL_PORT}/?step=boot` });

    // Boot akışını bekle
    let text = "";
    let done = false;
    for (let attempt = 0; attempt < 35 && !done; attempt += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      text = String((await evaluate(`document.body.innerText`)) || "");
      if (/Sistem hazır|exec \/desktop/.test(text)) done = true;
    }

    console.log(`     akış: ${done ? "TAMAMLANDI ✔" : "zaman aşımı (kısmi)"}`);
    console.log(`     metin: ${text.length} karakter`);
    console.log("");
    console.log("  --- KOPRU ISTEKLERI ---");
    const log = bridgeHits.join("");
    const hits = log.split(/\r?\n/).filter((line) => /info|health/i.test(line));
    if (hits.length === 0) {
      console.log("    ✘ kopruye hic istek gelmedi (probe calismadi)");
    } else {
      hits.slice(0, 6).forEach((line) => console.log(`    ${line.trim().slice(0, 90)}`));
    }
    console.log("");

    console.log("  --- ISKELEt ARTIGI ---");
    const found = FORBIDDEN.filter((needle) => text.includes(needle));
    if (found.length === 0) {
      console.log("    ✔ yasakli ibare yok");
    } else {
      found.forEach((needle) => console.log(`    ✘ BULUNDU: "${needle}"`));
    }

    console.log("");
    console.log("  --- FAZ / DONANIM SATIRLARI ---");
    for (const [label, pattern] of EXPECTED) {
      const ok = pattern.test(text);
      console.log(`    ${ok ? "✔" : "✘"} ${label}`);
    }

    console.log("");
    console.log("  --- ORNEK SATIRLAR ---");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    lines
      .filter((line) => /^(Makine|Anakart|BIOS|İşlemci|Çekirdek|Bellek|RAM yerleşimi|Disk|En sıcak|Dinlenen|Zafiyet)\s*:/.test(line))
      .slice(0, 12)
      .forEach((line) => console.log(`    ${line.slice(0, 82)}`));

    const shot = join(SHOTS, "boot.png");
    const data = await send(socket, "Page.captureScreenshot", { format: "png" });
    if (data?.data) writeFileSync(shot, Buffer.from(data.data, "base64"));
    writeFileSync(join(SHOTS, "boot.txt"), text, "utf8");
    console.log("");
    console.log(`    ekran goruntusu: ${shot}`);

    socket.close();
    console.log("");
  } catch (error) {
    console.error(`  HATA: ${error.message}`);
  } finally {
    chrome.kill();
    bridge.kill();
    server.close();
  }
  process.exit(0);
})();
