/**
 * Ayar deposu teşhisi.
 *
 * Konsol/boot ekranlarının köprü ayarını okuyup okumadığını denetler.
 *
 * Kullanım: node tools/diagnose-settings.mjs
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";

const LOCAL_PORT = 5222;
const CDP_PORT = 9911;
const DIST = join(process.cwd(), "apps", "web", "dist");

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => path && existsSync(path));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".json": "application/json",
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

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${join(tmpdir(), `px-diag-${Date.now()}`)}`,
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let messageId = 0;
const pending = new Map();
const logs = [];

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
    }, 30000);
  });
};

(async () => {
  try {
    await new Promise((r) => server.listen(LOCAL_PORT, "127.0.0.1", r));

    let target = null;
    for (let i = 0; i < 60 && !target; i += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const list = await response.json();
        target = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      } catch {
        /* bekle */
      }
      if (!target) await new Promise((r) => setTimeout(r, 250));
    }

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
        return;
      }
      if (payload.method === "Runtime.consoleAPICalled") {
        logs.push(
          "[js] " + (payload.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "),
        );
      }
      if (payload.method === "Log.entryAdded") {
        logs.push(`[${payload.params.entry.level}] ${payload.params.entry.text.slice(0, 160)}`);
      }
    });

    await send(socket, "Page.enable");
    await send(socket, "Runtime.enable");
    await send(socket, "Log.enable");

    const evaluate = async (expression) => {
      const result = await send(socket, "Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) return `HATA: ${result.exceptionDetails.text}`;
      return result.result?.value;
    };

    console.log("");
    console.log("=".repeat(64));
    console.log("  AYAR DEPOSU TESHISI");
    console.log("=".repeat(64));
    console.log("");

    // 1) İlk yükleme — depo şekli nasıl?
    await send(socket, "Page.navigate", { url: `http://localhost:${LOCAL_PORT}/?step=login` });
    await new Promise((r) => setTimeout(r, 4000));

    console.log("  1) BASLANGIC");
    console.log("     anahtarlar: " + JSON.stringify(await evaluate(`Object.keys(localStorage)`)));
    const raw = await evaluate(`localStorage.getItem('pixtool.settings')`);
    console.log("     pixtool.settings uzunluk: " + (raw ? String(raw).length : "YOK"));
    if (raw) {
      const parsed = JSON.parse(String(raw));
      console.log("     üst anahtarlar: " + JSON.stringify(Object.keys(parsed)));
      console.log("     state anahtarları: " + JSON.stringify(Object.keys(parsed.state ?? {})));
      const bridge = parsed.state?.settings?.bridge;
      console.log("     bridge: " + JSON.stringify(bridge));
    }

    // 2) Yaz ve geri oku
    console.log("");
    console.log("  2) YAZMA TESTI");
    const writeResult = await evaluate(`
      (() => {
        const KEY = 'pixtool.settings';
        const raw = localStorage.getItem(KEY);
        if (!raw) return 'anahtar yok';
        const state = JSON.parse(raw);
        state.state.settings.bridge = {
          enabled: true,
          url: 'http://127.0.0.1:8765',
          token: 'diag-token',
          autoProbe: true,
          allowRun: false
        };
        localStorage.setItem(KEY, JSON.stringify(state));
        const back = JSON.parse(localStorage.getItem(KEY));
        return JSON.stringify(back.state.settings.bridge);
      })()
    `);
    console.log("     geri okunan: " + writeResult);

    // 3) Yeniden yükle ve store'un ne gördüğünü kontrol et
    console.log("");
    console.log("  3) YENIDEN YUKLEME SONRASI");
    await send(socket, "Page.navigate", { url: `http://localhost:${LOCAL_PORT}/?step=console` });
    await new Promise((r) => setTimeout(r, 8000));

    const after = await evaluate(`localStorage.getItem('pixtool.settings')`);
    if (after) {
      const parsed = JSON.parse(String(after));
      console.log("     bridge: " + JSON.stringify(parsed.state?.settings?.bridge));
    }

    console.log("");
    console.log("     konsol metni (ilk 400):");
    const text = String(await evaluate(`document.body.innerText`) || "");
    console.log(
      text
        .slice(0, 400)
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 12)
        .map((l) => "       " + l.trim().slice(0, 74))
        .join("\n"),
    );

    console.log("");
    console.log("  KONSOL KAYITLARI:");
    logs
      .filter((line) => /error|warn|kopr|bridge|fetch|CORS|blocked/i.test(line))
      .slice(-10)
      .forEach((line) => console.log("    " + line.slice(0, 150)));

    socket.close();
    console.log("");
  } catch (error) {
    console.error("  HATA: " + error.message);
  } finally {
    chrome.kill();
    server.close();
  }
  process.exit(0);
})();
