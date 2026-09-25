/**
 * Giriş ekranı görsel doğrulaması.
 *
 * Ekran görüntüsü alır ve İngilizce ibare kalıp kalmadığını denetler.
 *
 * Kullanım:
 *   node tools/verify-login.mjs [--url https://...] [--theme lamp]
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const argOf = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};

const BASE = argOf("--url", "https://pixtool.omercataloglu.com").replace(/\/+$/, "");
const THEME = argOf("--theme", "lamp");
const SHOTS = join(process.cwd(), "screenshots", "login");
const PORT = 9777;

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => path && existsSync(path));

if (!chromePath) {
  console.error("Chrome bulunamadi");
  process.exit(1);
}

mkdirSync(SHOTS, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `px-login-${Date.now()}`)}`,
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

/** Yasaklı İngilizce ibareler (giriş ekranında görünmemeli). */
const FORBIDDEN = [
  "Welcome",
  "Username",
  "Password",
  "Enter name",
  "Enter Password",
  "Sign In",
  "Sign in",
  "Login",
  "Forgot Password",
  "Forgot password",
  "Sign up",
  "Signup",
  "Email",
];

(async () => {
  try {
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

    console.log("");
    console.log("=".repeat(64));
    console.log(`  GIRIS EKRANI DOGRULAMASI — ${THEME}`);
    console.log("=".repeat(64));
    console.log("");

    // Lamba formu kapalı başlar → formu açmak için lambaya tıkla
    await send(socket, "Page.navigate", { url: `${BASE}/?step=login&login=${THEME}` });
    await new Promise((r) => setTimeout(r, 7000));

    // Lambayı aç (form görünür olsun)
    await evaluate(`
      (() => {
        const cord = document.querySelector('.cord-hit');
        if (cord) {
          const r = cord.getBoundingClientRect();
          ['pointerdown','pointerup'].forEach(type => {
            cord.dispatchEvent(new PointerEvent(type, {
              bubbles: true, cancelable: true,
              clientX: r.x + r.width/2, clientY: r.y + r.height/2
            }));
          });
        }
        return true;
      })()
    `);
    // pointerdown/up pencerede dinleniyor — gerçek olay gönder
    const cx = await evaluate(`(() => { const c=document.querySelector('.cord-hit'); if(!c) return null; const r=c.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; })()`);
    if (cx) {
      await send(socket, "Input.dispatchMouseEvent", { type: "mousePressed", x: cx.x, y: cx.y, button: "left", clickCount: 1 });
      await send(socket, "Input.dispatchMouseEvent", { type: "mouseMoved", x: cx.x + 2, y: cx.y + 60, button: "left" });
      await send(socket, "Input.dispatchMouseEvent", { type: "mouseReleased", x: cx.x + 2, y: cx.y + 60, button: "left", clickCount: 1 });
    }
    await new Promise((r) => setTimeout(r, 1800));

    // --- Denetimler ---
    const bodyText = String(await evaluate(`document.body.innerText`) || "");

    const found = FORBIDDEN.filter((word) => bodyText.includes(word));
    console.log("  --- INGILIZCE IBARE DENETIMI ---");
    if (found.length === 0) {
      console.log("    ✔ yasakli ibare yok");
    } else {
      found.forEach((word) => console.log(`    ✘ BULUNDU: "${word}"`));
    }

    console.log("");
    console.log("  --- TURKCE IBARE VARLIGI ---");
    for (const [label, needle] of [
      ["Hoş Geldiniz", "Hoş Geldiniz"],
      ["Kullanıcı Adı", "Kullanıcı Adı"],
      ["Parola", "Parola"],
      ["Giriş Yap", "Giriş Yap"],
      ["Parolamı unuttum", "Parolamı unuttum"],
      ["Yeni kullanıcı kaydı", "Yeni kullanıcı kaydı"],
    ]) {
      const ok = bodyText.includes(needle);
      console.log(`    ${ok ? "✔" : "✘"} ${label}`);
    }

    console.log("");
    console.log("  --- OVERLAY BILESENLERI ---");
    for (const [label, selector] of [
      ["kayan şerit", ".login-marquee"],
      ["şerit öğesi", ".login-marquee__item"],
      ["telif kutusu", ".login-copyright__inner"],
      ["canlı nokta", ".login-copyright__beacon"],
      ["kayıt/parola bağlantısı", ".lf-links"],
    ]) {
      const count = Number(await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`)) || 0;
      console.log(`    ${count > 0 ? "✔" : "✘"} ${label.padEnd(24)} ${count} adet`);
    }

    const marqueeText = String(await evaluate(`(document.querySelector('.login-marquee__item')||{}).textContent || ""`)).trim();
    const copyright = String(await evaluate(`(document.querySelector('.login-copyright__inner')||{}).innerText || ""`)).trim();
    console.log("");
    console.log(`    şerit metni : "${marqueeText}"`);
    console.log(`    telif       : "${copyright}"`);

    // --- Animasyon kontrolü ---
    const anim = await evaluate(`
      (() => {
        const track = document.querySelector('.login-marquee__track');
        const cp = document.querySelector('.login-copyright__inner');
        const st = track ? getComputedStyle(track) : null;
        const st2 = cp ? getComputedStyle(cp) : null;
        return {
          marqueeAnim: st ? st.animationName : null,
          marqueeDur: st ? st.animationDuration : null,
          copyrightAnim: st2 ? st2.animationName : null,
        };
      })()
    `);
    console.log("");
    console.log("  --- ANIMASYONLAR ---");
    console.log(`    şerit     : ${anim.marqueeAnim} (${anim.marqueeDur})  ${anim.marqueeAnim && anim.marqueeAnim !== "none" ? "✔" : "✘"}`);
    console.log(`    telif     : ${anim.copyrightAnim}  ${anim.copyrightAnim && anim.copyrightAnim !== "none" ? "✔" : "✘"}`);

    // --- Video dosyası ---
    const videoOk = await evaluate(`
      fetch('/vendor/pixtool.mp4', { method: 'HEAD' })
        .then(r => ({ ok: r.ok, size: r.headers.get('content-length'), type: r.headers.get('content-type') }))
        .catch(e => ({ ok: false, error: String(e) }))
    `);
    console.log("");
    console.log("  --- TANITIM VIDEOSU ---");
    console.log(`    /vendor/pixtool.mp4 → ${videoOk.ok ? "✔" : "✘"}  ${videoOk.size || ""} bayt  ${videoOk.type || ""}`);

    // --- Ekran görüntüsü ---
    const shot = join(SHOTS, `${THEME}.png`);
    try {
      const data = await send(socket, "Page.captureScreenshot", { format: "png" });
      if (data?.data) writeFileSync(shot, Buffer.from(data.data, "base64"));
      console.log("");
      console.log(`    ekran goruntusu: ${shot}`);
    } catch {
      /* isteğe bağlı */
    }

    socket.close();
    console.log("");
  } catch (error) {
    console.error(`  HATA: ${error.message}`);
  } finally {
    chrome.kill();
  }
  process.exit(0);
})();
