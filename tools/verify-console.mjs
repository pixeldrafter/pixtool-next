/**
 * Konsol ekranı görsel doğrulaması.
 *
 * Yerel köprüyü arka planda başlatır, konsol akışını sonuna kadar bekler ve
 * ekran görüntüsü alır; ayrıca **yasaklı iskelet ibarelerini** ("FAZ 1",
 * "köprü bekleniyor") tarayıp gerçek envanter alanlarının dolduğunu doğrular.
 *
 * Kullanım:
 *   node tools/verify-console.mjs [--url https://...] [--token ...]
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";

const argOf = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};

const ARG_BASE = argOf("--url", "");
const BRIDGE_URL = argOf("--bridge", "http://127.0.0.1:8765");
const TOKEN = argOf("--token", "verify-token");
const SHOTS = join(process.cwd(), "screenshots", "console");
const PORT = 9888;
const LOCAL_PORT = 5199;

/**
 * Sayfa nereden sunulacak?
 *
 * ⚠️ Tarayıcılar **genel HTTPS** sayfadan `127.0.0.1`'e erişimi engeller
 * (Local Network Access). Bu yüzden konsol doğrulaması için derlemeyi
 * **yerel** bir HTTP sunucusundan servis ederiz — köprü orada çalışır.
 * `--url` verilirse o adres kullanılır.
 */
const DIST = join(process.cwd(), "apps", "web", "dist");
const USE_LOCAL = !ARG_BASE;
const BASE = USE_LOCAL ? `http://localhost:${LOCAL_PORT}` : ARG_BASE.replace(/\/+$/, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

/** Derlemeyi yerel olarak servis eden basit statik sunucu. */
function startLocalServer() {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`Derleme bulunamadi: ${DIST} (once \`pnpm build\`)`);
  }

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

  return new Promise((resolve) => {
    server.listen(LOCAL_PORT, "127.0.0.1", () => resolve(server));
  });
}

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => path && existsSync(path));

if (!chromePath) {
  console.error("Chrome bulunamadi");
  process.exit(1);
}

const bridgeExe = join(
  process.cwd(),
  "services",
  "bridge",
  "dist",
  "pixtool-bridge.exe",
);
if (!existsSync(bridgeExe)) {
  console.error(`Kopru exe bulunamadi: ${bridgeExe}`);
  process.exit(1);
}

mkdirSync(SHOTS, { recursive: true });

// --- Köprüyü başlat ---
const bridgePort = Number(new URL(BRIDGE_URL).port || 8765);
const bridge = spawn(bridgeExe, ["--port", String(bridgePort), "--token", TOKEN], {
  stdio: "ignore",
});

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `px-console-${Date.now()}`)}`,
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    "--window-size=1500,1200",
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

/** Konsolda GÖRÜNMEMESİ gereken iskelet artıkları. */
const FORBIDDEN = [
  "FAZ 1",
  "FAZ 2",
  "FAZ 3",
  "FAZ 4",
  "FAZ 5",
  "FAZ 6",
  "FAZ 7",
  "Faz 3",
  "köprü bekleniyor",
  "KÖPRÜ BEKLENİYOR",
];

/** Dolu olması gereken envanter alanları. */
const EXPECTED = [
  ["anakart", /ANAKART/],
  ["BIOS", /BIOS/],
  ["RAM slotları", /SLOT YERLEŞİMİ|Slot sayısı/],
  ["ısı/fan", /ISI & FAN|Sıcaklık/],
  ["port taraması", /PORT TARAMASI/],
  ["risk puanı", /Risk puanı/],
  ["işlemci", /İŞLEMCİ/],
  ["depolama", /DEPOLAMA|Disk/],
];

(async () => {
  let server = null;
  try {
    if (USE_LOCAL) {
      server = await startLocalServer();
      console.log(`  yerel sunucu: ${BASE} (derleme servis ediliyor)`);
    }
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

    // Köprü tokenını localStorage'a yaz (konsol oradan okuyor)
    console.log("");
    console.log("=".repeat(66));
    console.log("  KONSOL EKRANI DOGRULAMASI");
    console.log("=".repeat(66));
    console.log("");

    await send(socket, "Page.navigate", { url: `${BASE}/?step=login` });
    await new Promise((r) => setTimeout(r, 4000));

    // Köprü ayarlarını yaz ve konsola geç
    const patched = await evaluate(`
      (() => {
        const KEY = 'pixtool.settings';
        const raw = localStorage.getItem(KEY);
        const bridge = {
          enabled: true,
          url: ${JSON.stringify(BRIDGE_URL)},
          token: ${JSON.stringify(TOKEN)},
          autoProbe: true,
          allowRun: false
        };

        if (!raw) {
          // Depo ilk yuklemede yazmamis olabilir — sifirdan olustur.
          // Zustand persist bicimi: { state: {...}, version: N }
          localStorage.setItem(KEY, JSON.stringify({
            state: { settings: { bridge }, migrated: true },
            version: 2
          }));
        } else {
          const state = JSON.parse(raw);
          if (!state.state) state.state = {};
          if (!state.state.settings) state.state.settings = {};
          state.state.settings.bridge = bridge;
          localStorage.setItem(KEY, JSON.stringify(state));
        }

        const check = JSON.parse(localStorage.getItem(KEY));
        return check.state.settings.bridge.url;
      })()
    `);
    console.log(`  köprü ayarı yazıldı: ${patched}`);

    await send(socket, "Page.navigate", { url: `${BASE}/?step=console` });

    // Konsol akışını bekle (toplama ~6 sn + satır satır yazım)
    console.log("  Konsol akışı bekleniyor (en fazla 90 sn)…");
    let text = "";
    let done = false;
    for (let attempt = 0; attempt < 45 && !done; attempt += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      text = String((await evaluate(`document.body.innerText`)) || "");
      // Özet altbilgisi geldiyse akış bitmiştir
      if (/Dinlenen port\s*:/.test(text) || /Bu bilgileri veritabanına/.test(text)) {
        done = true;
      }
    }

    console.log(`  Akış durumu: ${done ? "TAMAMLANDI ✔" : "zaman aşımı (kısmi)"}`);
    console.log(`  Metin uzunluğu: ${text.length} karakter`);
    console.log("");

    console.log("  --- ISKELEt ARTIGI DENETIMI ---");
    const found = FORBIDDEN.filter((needle) => text.includes(needle));
    if (found.length === 0) {
      console.log("    ✔ yasakli ibare yok (FAZ/köprü bekleniyor temiz)");
    } else {
      found.forEach((needle) => console.log(`    ✘ BULUNDU: "${needle}"`));
    }

    console.log("");
    console.log("  --- ENVANTER ALANLARI ---");
    for (const [label, pattern] of EXPECTED) {
      const ok = pattern.test(text);
      console.log(`    ${ok ? "✔" : "✘"} ${label}`);
    }

    console.log("");
    console.log("  --- GERCEK DEGERLER (ornek) ---");
    const lines = text.split("\n").map((line) => line.trim());
    const pick = (pattern, limit = 2) =>
      lines.filter((line) => pattern.test(line)).slice(0, limit);

    for (const [label, pattern] of [
      ["anakart", /^(Ürün|Üretici)\s*:/],
      ["bios sürüm", /^(Sürüm|Yayın tarihi|Yaş)\s*:/],
      ["ram", /DIMM[A-Z]\d?\s|Slot sayısı/],
      ["sıcaklık", /°C|Risk puanı/],
      ["port", /\/tcp|\/udp/],
    ]) {
      const items = pick(pattern, 3);
      console.log(`    ${label}:`);
      if (items.length === 0) console.log("      (bulunamadi)");
      else items.forEach((item) => console.log(`      ${item.slice(0, 84)}`));
    }

    // Ekran görüntüsü
    const shot = join(SHOTS, "envanter.png");
    const data = await send(socket, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    if (data?.data) writeFileSync(shot, Buffer.from(data.data, "base64"));
    console.log("");
    console.log(`    ekran goruntusu: ${shot}`);

    // Tam metni de kaydet (inceleme için)
    writeFileSync(join(SHOTS, "envanter.txt"), text, "utf8");
    console.log(`    tam metin      : ${join(SHOTS, "envanter.txt")}`);

    socket.close();
    console.log("");
  } catch (error) {
    console.error(`  HATA: ${error.message}`);
  } finally {
    chrome.kill();
    bridge.kill();
    if (server) server.close();
  }
  process.exit(0);
})();
