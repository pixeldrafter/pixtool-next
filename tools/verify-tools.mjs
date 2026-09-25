/**
 * #6/#8 doğrulaması — tarayıcı, araçlar, oyunlar.
 *
 * Yerel sunucudan derlemeyi açar, pencereleri tek tek ziyaret eder:
 *   • Tarayıcı   → adres çubuğu, çıkış IP göstergesi, proxy çalışıyor mu
 *   • Araçlar    → 26 araç sayısı, TR/EN dil seçimi, bir araç işliyor mu
 *   • Oyunlar    → 3 oyun sekmesi
 *   • ekran görüntüleri
 *
 * Kullanım: node tools/verify-tools.mjs
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";

const SHOTS = join(process.cwd(), "screenshots", "verify");
const CDP = 9931;
const LOCAL = 5244;
const DIST = join(process.cwd(), "apps", "web", "dist");

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => path && existsSync(path));

if (!chromePath) {
  console.error("Chrome bulunamadi");
  process.exit(1);
}

mkdirSync(SHOTS, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

const REMOTE_API = "https://pixtool.omercataloglu.com";

/** `/api/*` isteklerini gerçek API'ye yönlendirir (tarayıcı testi anlamlı olsun). */
async function proxyApi(request, response) {
  try {
    const upstream = await fetch(`${REMOTE_API}${request.url}`, {
      method: request.method,
      headers: { Accept: request.headers.accept ?? "*/*" },
    });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Content-Length": buffer.length,
    });
    response.end(buffer);
  } catch (error) {
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail: `proxy hatasi: ${error.message}` }));
  }
}

const server = createServer((request, response) => {
  const raw = request.url ?? "/";

  // API çağrıları → gerçek sunucu
  if (raw.startsWith("/api/")) {
    void proxyApi(request, response);
    return;
  }

  let path = decodeURIComponent(raw.split("?")[0]);
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

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${CDP}`,
    `--user-data-dir=${join(tmpdir(), `px-tools-${Date.now()}`)}`,
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    "--window-size=1440,940",
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

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`    ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`    ✘ ${label}${detail ? `  (${detail})` : ""}`);
  }
}

/** Pencereyi açar, metni döndürür. */
async function open(socket, evaluate, targetWindow, waitMs = 4200) {
  await send(socket, "Page.navigate", { url: `http://localhost:${LOCAL}/?step=desktop&window=${targetWindow}` });
  await new Promise((r) => setTimeout(r, waitMs));
  return String((await evaluate(`document.body.innerText`)) || "");
}

async function shot(socket, name) {
  try {
    const data = await send(socket, "Page.captureScreenshot", { format: "png" });
    if (data?.data) writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data.data, "base64"));
  } catch {
    /* isteğe bağlı */
  }
}

(async () => {
  try {
    await new Promise((r) => server.listen(LOCAL, "127.0.0.1", r));

    let target = null;
    for (let i = 0; i < 60 && !target; i += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${CDP}/json/list`);
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

    const count = async (selector) =>
      Number(await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`)) || 0;

    console.log("");
    console.log("=".repeat(66));
    console.log("  #6 TARAYICI  ·  #8 ARACLAR  ·  OYUNLAR");
    console.log("=".repeat(66));
    console.log("");

    // ---------- Araçlar ----------
    console.log("  --- ARACLAR (#8) ---");
    let text = await open(socket, evaluate, "tools");
    check("pencere açıldı", /Araçlar/.test(text));
    const toolCount = await count(".tools__item");
    check("araç kataloğu dolu (≥20)", toolCount >= 20, `${toolCount} araç`);
    check("dil seçici var", (await count(".tools__lang-btn")) === 2);
    check("TR varsayılan", text.includes("Hash üretici"));
    check("araç listesi dolu", (await count(".tools__item")) >= 20, `${await count(".tools__item")} araç`);

    // Hash aracı gerçekten çalışıyor mu
    await evaluate(`
      (() => {
        const area = document.querySelector('.tool__area');
        if (!area) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(area, 'pixtool');
        area.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));
    const hashText = String((await evaluate(`document.body.innerText`)) || "");
    check("hash hesaplandı (SHA-256)", /[0-9a-f]{64}/.test(hashText), hashText.match(/[0-9a-f]{32,}/)?.[0]?.slice(0, 24) ?? "yok");

    await shot(socket, "tools-hash");

    // İngilizceye geç
    await evaluate(`document.querySelectorAll('.tools__lang-btn')[1].click()`);
    await new Promise((r) => setTimeout(r, 900));
    const englishText = String((await evaluate(`document.body.innerText`)) || "");
    check("İngilizceye geçti", englishText.includes("Hash generator") && !englishText.includes("Hash üretici"));
    await shot(socket, "tools-en");

    // JSON aracına geç
    await evaluate(`
      (() => {
        const items = [...document.querySelectorAll('.tools__item')];
        const target = items.find((item) => /JSON/i.test(item.textContent));
        target?.click();
        return Boolean(target);
      })()
    `);
    await new Promise((r) => setTimeout(r, 900));
    check("JSON aracı açıldı", /Prettify|prettify/i.test(String(await evaluate(`document.body.innerText`))));
    await shot(socket, "tools-json");

    // ---------- Oyunlar ----------
    console.log("");
    console.log("  --- OYUNLAR ---");
    text = await open(socket, evaluate, "games");
    check("pencere açıldı", /Oyunlar/.test(text));
    check("3 oyun sekmesi", (await count(".tools__tab")) === 3, `${await count(".tools__tab")} sekme`);
    check("Mayın Tarlası varsayılan", /Mayın Tarlası|Kalan mayın/.test(text));
    check("oyun tahtası çizildi", (await count(".ms__cell")) === 81, `${await count(".ms__cell")} hücre`);
    await shot(socket, "games-minesweeper");

    // Yılan'a geç
    await evaluate(`document.querySelectorAll('.tools__tab')[1].click()`);
    await new Promise((r) => setTimeout(r, 1000));
    check("Yılan açıldı", (await count(".snake__board")) === 1);
    check("yılan ızgarası 400 hücre", (await count(".snake__cell")) === 400, `${await count(".snake__cell")} hücre`);
    await shot(socket, "games-snake");

    // XOX
    await evaluate(`document.querySelectorAll('.tools__tab')[2].click()`);
    await new Promise((r) => setTimeout(r, 1000));
    check("XOX açıldı", (await count(".xox__board")) === 1);
    check("XOX 9 hücre", (await count(".xox__cell")) === 9);
    await shot(socket, "games-xox");

    // ---------- Tarayıcı ----------
    console.log("");
    console.log("  --- TARAYICI (#6) ---");
    text = await open(socket, evaluate, "browser", 9000);
    check("pencere açıldı", /Tarayıcı/.test(text));
    check("çıkış IP göstergesi var", (await count(".browser__exit")) === 1);
    check("adres çubuğu var", (await count(".browser__address")) === 1);
    check("yer imleri listelendi", (await count(".browser__bookmark")) >= 4, `${await count(".browser__bookmark")} yer imi`);
    check("proxy iframe var", (await count(".browser__frame")) === 1);

    // IP öğrenilmesini bekle (API proxy üzerinden)
    let ipText = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      ipText = String(await evaluate(`(document.querySelector('.browser__exit')||{}).innerText || ""`));
      if (/\d+\.\d+\.\d+\.\d+/.test(ipText)) break;
      await new Promise((r) => setTimeout(r, 1200));
    }
    check("çıkış IP öğrenildi", /\d+\.\d+\.\d+\.\d+/.test(ipText), ipText.trim().slice(0, 60));

    const address = String(await evaluate(`(document.querySelector('.browser__address')||{}).value || ""`));
    check("ana sayfa omercataloglu.com", address.includes("omercataloglu.com"), address);
    await shot(socket, "browser");

    // Kitaplık testi: iframe gerçekten proxy'den yüklendi mi?
    // Proxy içeriğinin yüklenmesini bekle
    await new Promise((r) => setTimeout(r, 6000));
    const frameLoaded = await evaluate(`
      (() => {
        const frame = document.querySelector('.browser__frame');
        if (!frame) return { ok: false, reason: 'iframe yok' };
        try {
          const doc = frame.contentDocument;
          if (!doc) return { ok: false, reason: 'cross-origin' };
          return { ok: true, title: doc.title || '', length: doc.body ? doc.body.innerHTML.length : 0 };
        } catch (e) {
          return { ok: false, reason: String(e.message || e) };
        }
      })()
    `);
    check(
      "iframe proxy içeriği yükledi",
      frameLoaded?.ok === true && (frameLoaded.length ?? 0) > 200,
      JSON.stringify(frameLoaded).slice(0, 90),
    );

    socket.close();
    console.log("");
    console.log(`  SONUC: ${passed} geçti, ${failed} başarısız`);
    console.log(`  Ekran göruntuleri: ${SHOTS}`);
    console.log("");
  } catch (error) {
    console.error(`  HATA: ${error.message}`);
  } finally {
    chrome.kill();
    server.close();
  }
  process.exit(failed === 0 ? 0 : 1);
})();
