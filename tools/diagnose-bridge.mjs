/**
 * Köprü erişim teşhisi — canlı sayfadan 127.0.0.1'e istek atıp
 * tarayıcının verdiği **tam hata mesajını** ve konsol kayıtlarını toplar.
 *
 * Kullanım:
 *   node tools/diagnose-bridge.mjs [--url https://...] [--port 8765]
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const argOf = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};

const BASE = argOf("--url", "https://pixtool.omercataloglu.com").replace(/\/+$/, "");
const BRIDGE_PORT = Number(argOf("--port", "8765"));
const PORT = 9555;

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => path && existsSync(path));

if (!chromePath) {
  console.error("Chrome bulunamadi");
  process.exit(1);
}

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `px-diag-${Date.now()}`)}`,
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let messageId = 0;
const pending = new Map();
const consoleLogs = [];

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
    // Hedefi bul
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
        return;
      }
      if (payload.method === "Runtime.consoleAPICalled") {
        const text = (payload.params.args ?? [])
          .map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ");
        consoleLogs.push(`[${payload.params.type}] ${text.slice(0, 220)}`);
      }
      if (payload.method === "Log.entryAdded") {
        consoleLogs.push(`[${payload.params.entry.level}] ${payload.params.entry.text.slice(0, 220)}`);
      }
    });

    await send(socket, "Page.enable");
    await send(socket, "Runtime.enable");
    await send(socket, "Log.enable");

    console.log("");
    console.log("=".repeat(64));
    console.log(`  KOPRU ERISIM TESHISI`);
    console.log("=".repeat(64));
    console.log(`  sayfa : ${BASE}`);
    console.log(`  kopru : http://127.0.0.1:${BRIDGE_PORT}`);
    console.log("");

    await send(socket, "Page.navigate", { url: `${BASE}/?step=desktop` });
    await new Promise((r) => setTimeout(r, 6000));

    const evaluate = async (expression) => {
      const result = await send(socket, "Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return result.result?.value;
    };

    const origin = await evaluate("location.origin");
    console.log(`  sayfa origin: ${origin}`);

    // 1) Basit istek
    console.log("\n  --- 1) BASIT ISTEK (/health, basliksiz) ---");
    console.log(
      "  " +
        JSON.stringify(
          await evaluate(`(async () => {
            try {
              const r = await fetch("http://127.0.0.1:${BRIDGE_PORT}/health");
              const j = await r.json();
              return { ok: true, status: r.status, service: j.service };
            } catch (e) { return { ok: false, name: e.name, message: String(e.message) }; }
          })()`),
        ),
    );

    // 2) Ozel baslikli istek
    console.log("\n  --- 2) OZEL BASLIKLI ISTEK (X-Pixtool-Client) ---");
    console.log(
      "  " +
        JSON.stringify(
          await evaluate(`(async () => {
            try {
              const r = await fetch("http://127.0.0.1:${BRIDGE_PORT}/health", {
                headers: { "X-Pixtool-Client": "web" }
              });
              const j = await r.json();
              return { ok: true, status: r.status, service: j.service };
            } catch (e) { return { ok: false, name: e.name, message: String(e.message) }; }
          })()`),
        ),
    );

    // 3) POST istegi
    console.log("\n  --- 3) POST ISTEGI (/run) ---");
    console.log(
      "  " +
        JSON.stringify(
          await evaluate(`(async () => {
            try {
              const r = await fetch("http://127.0.0.1:${BRIDGE_PORT}/run", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Pixtool-Client": "web" },
                body: JSON.stringify({ script: "echo merhaba", executor: "powershell" })
              });
              const j = await r.json();
              return { ok: true, status: r.status, stdout: String(j.stdout||"").trim().slice(0,40) };
            } catch (e) { return { ok: false, name: e.name, message: String(e.message) }; }
          })()`),
        ),
    );

    console.log("\n  --- KONSOL KAYITLARI ---");
    const relevant = consoleLogs.filter((line) =>
      /private network|CORS|blocked|fetch|Permission|127\.0\.0\.1|Access-Control/i.test(line),
    );
    if (relevant.length === 0) {
      console.log("  (ilgili kayit yok)");
    } else {
      relevant.slice(-12).forEach((line) => console.log(`  ${line}`));
    }

    socket.close();
  } catch (error) {
    console.error(`  HATA: ${error.message}`);
  } finally {
    chrome.kill();
  }
  process.exit(0);
})();
