/**
 * Uçtan uca (E2E) test aracı — gerçek tarayıcı otomasyonu.
 *
 * Chrome DevTools Protocol (CDP) kullanır; ek bağımlılık YOKTUR
 * (Node 22+ yerleşik `WebSocket` ve `fetch`).
 *
 * Önemli: girdiler **gerçek klavye olaylarıyla** (`Input.insertText`,
 * `Input.dispatchKeyEvent`) yapılır. DOM'a doğrudan değer yazmak React'in
 * kontrollü bileşenlerini tetiklemez — bu yüzden önceki test yanıltıcıydı.
 *
 * Kullanım:
 *   node tools/e2e-test.mjs [--url http://localhost:5173] [--keep]
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\//, "");
const PROFILE = join(ROOT, ".chrome-e2e");
const SHOTS = join(ROOT, "screenshots");
const PORT = 9222;

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const BASE = argOf("--url", "http://localhost:5173");

/**
 * Giriş bilgileri ortam değişkeninden okunur (sunucu kurulumunda farklıdır).
 *   PX_DEMO_USER / PX_DEMO_PASSWORD
 */
const LOGIN_USER = process.env.PX_DEMO_USER || "admin";
const LOGIN_PASS = process.env.PX_DEMO_PASSWORD || "pixtool";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------------
//  Minimal CDP istemcisi
// ----------------------------------------------------------------------
class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.console = [];
    this.exceptions = [];

    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", (e) => reject(new Error(String(e.message ?? e))));
    });

    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);

      // Olayları topla
      if (msg.method === "Runtime.consoleAPICalled") {
        const text = (msg.params.args ?? [])
          .map((a) => a.value ?? a.description ?? "")
          .join(" ");
        this.console.push(`${msg.params.type}: ${text}`);
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        this.exceptions.push(d.exception?.description ?? d.text);
      }

      const slot = this.pending.get(msg.id);
      if (!slot) return;
      this.pending.delete(msg.id);
      if (msg.error) slot.reject(new Error(msg.error.message));
      else slot.resolve(msg.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP zaman aşımı: ${method}`));
        }
      }, 20000);
    });
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `Sayfa hatası: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
      );
    }
    return result.result.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* yoksay */
    }
  }
}

// ----------------------------------------------------------------------
//  Sayfa tarafı yardımcıları
// ----------------------------------------------------------------------
const SNAPSHOT = `
(() => {
  const q = (s) => document.querySelector(s);
  const otpYeti = q(".otp-yeti");
  const otpClassic = q(".otp");
  const box = q(".otp-yeti__box") || q(".otp__input");
  const btn = q("form button[type=submit]") || q(".otp__submit");
  const cls = otpYeti?.className ?? otpClassic?.className ?? "";
  return {
    step: q(".lf--lamp") ? "lamp login"
        : otpYeti ? "OTP (yeti)"
        : otpClassic ? "OTP (classic)"
        : q(".punishment") ? "CEZA ekrani"
        : q(".console-screen") ? "konsol (envanter)"
        : q(".boot") ? "boot animasyonu"
        : q(".desktop") ? "masaustu"
        : q(".lf--") ? "baska login formu"
        : "bilinmiyor",
    otpState: (cls.match(/otp-yeti--(\\w+)/) ?? cls.match(/otp--state-(\\w+)/))?.[1] ?? null,
    boxes: document.querySelectorAll(".otp-yeti__box, .otp__input").length,
    boxValues: [...document.querySelectorAll(".otp-yeti__box, .otp__input")].map(i => i.value || "_").join("|"),
    domFilled: [...document.querySelectorAll(".otp-yeti__box, .otp__input")].filter(i => i.value).length,
    btnDisabled: btn?.disabled ?? null,
    btnText: btn?.textContent?.trim().slice(0, 30) ?? null,
    errText: q(".otp-yeti__error, .otp__error")?.textContent?.trim().slice(0, 80) ?? null,
    devCode: (q(".otp-yeti__dev, .otp__dev-hint")?.textContent ?? "").replace(/\\D/g, "") || null,
  };
})()`;

const FOCUS = (selector) => `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return "YOK";
  el.focus();
  el.click();
  return document.activeElement === el ? "ODAKLANDI" : "ODAKLANAMADI";
})()`;

const CLICK = (selector) => `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return "YOK";
  if (el.disabled) return "DEVRE_DISI";
  el.click();
  return "TIKLANDI";
})()`;

// ----------------------------------------------------------------------
//  Test
// ----------------------------------------------------------------------
async function main() {
  const chrome = CHROME_CANDIDATES.find((c) => existsSync(c));
  if (!chrome) {
    console.error("Chrome bulunamadı.");
    process.exit(1);
  }
  if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true });
  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1400,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let target = null;
  for (let i = 0; i < 40 && !target; i += 1) {
    await sleep(400);
    try {
      const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      /* henüz hazır değil */
    }
  }
  if (!target) {
    console.error("Chrome hedefi bulunamadı.");
    child.kill();
    process.exit(1);
  }

  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const shots = [];
  const snap = () => cdp.eval(SNAPSHOT);
  const log = (a, b) => console.log(`  ${String(a).padEnd(24)} ${b}`);

  /**
   * Gerçek tuş basımı — karakter karakter.
   *
   * `Input.insertText` React'in kontrollü girdilerini tetiklemez; bu yüzden
   * `keyDown` + `char` + `keyUp` üçlüsü kullanılır (gerçek kullanıcı yolu).
   */
  async function type(text) {
    for (const ch of text) {
      const code = /\d/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`;
      const vk = ch.charCodeAt(0);

      // `keyDown` + `text` karakteri YERLEŞTİRİR. Ayrıca `char` göndermek
      // karakteri İKİ KEZ ekler — bu yüzden yalnızca keyDown/keyUp kullanılır.
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: ch,
        code,
        text: ch,
        unmodifiedText: ch,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      });
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: ch,
        code,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      });
      await sleep(110);
    }
  }

  /** Gerçek Backspace. */
  async function pressBackspace() {
    for (const type of ["keyDown", "keyUp"]) {
      await cdp.send("Input.dispatchKeyEvent", {
        type,
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8,
        nativeVirtualKeyCode: 8,
      });
    }
    await sleep(80);
  }

  /** Gerçek Enter tuşu. */
  async function pressEnter() {
    for (const type of ["keyDown", "keyUp"]) {
      await cdp.send("Input.dispatchKeyEvent", {
        type,
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      });
    }
    await sleep(200);
  }

  async function shot(name) {
    const result = await cdp.send("Page.captureScreenshot", {});
    const file = join(SHOTS, `${name}.png`);
    writeFileSync(file, Buffer.from(result.data, "base64"));
    shots.push(name);
  }

  try {
    console.log("\n" + "=".repeat(60));
    console.log("  E2E TEST — giriş + OTP akışı");
    console.log("=".repeat(60));

    console.log("\n[1] SAYFA YÜKLEME");
    await cdp.send("Page.navigate", { url: BASE });
    await sleep(4000);
    let s = await snap();
    log("görünen adım", s.step);
    await shot("e2e-1-login");

    console.log("\n[2] GİRİŞ FORMU");
    // Lambayı aç (form görünür olsun) — gerçek kullanıcı ipi çeker
    await cdp.eval(`
      (() => {
        const card = document.querySelector(".lf--lamp .login-form");
        if (card) card.classList.add("active");
        return true;
      })()`);
    await sleep(400);

    await cdp.eval(FOCUS("#lamp-username"));
    await type(LOGIN_USER);
    await cdp.eval(FOCUS("#lamp-password"));
    await type(LOGIN_PASS);
    await sleep(200);

    s = await snap();
    log("buton", `${s.btnText} (disabled=${s.btnDisabled})`);

    const clicked = await cdp.eval(CLICK(".lf--lamp .login-btn"));
    log("giriş tıklandı", clicked);

    // Alanların gerçekten dolduğunu doğrula
    const values = await cdp.eval(`
      (() => ({
        u: document.querySelector("#lamp-username")?.value ?? null,
        p: (document.querySelector("#lamp-password")?.value ?? "").length,
      }))()`);
    log("kullanıcı adı değeri", JSON.stringify(values.u));
    log("parola uzunluğu", values.p);

    console.log("\n[3] OTP EKRANI BEKLENİYOR");
    let otp = null;
    for (let i = 0; i < 25; i += 1) {
      await sleep(400);
      s = await snap();
      if (s.step.startsWith("OTP")) {
        otp = s;
        break;
      }
    }

    if (!otp) {
      s = await snap();
      log("SON DURUM", s.step);
      log("hata", s.errText ?? "—");
      console.log("\n  ⚠ Konsol:");
      cdp.console.slice(-8).forEach((c) => console.log("     " + c));
      cdp.exceptions.slice(-5).forEach((e) => console.log("     ⛔ " + e.split("\n")[0]));
      throw new Error("OTP ekranı açılmadı");
    }

    log("OTP ekranı", otp.step);
    log("durum", otp.otpState ?? "—");
    log("kutu sayısı", otp.boxes);
    log("buton", `${otp.btnText} (disabled=${otp.btnDisabled})`);
    log("dev kodu", otp.devCode ?? "—");
    await shot("e2e-2-otp");

    // ---- YANLIŞ KOD ----
    console.log("\n[4] YANLIŞ KOD (gerçek tuşlarla)");
    await cdp.eval(FOCUS(".otp-yeti__box, .otp__input"));
    await type("000000");

    // Hata animasyonu 1.4 sn sonra kutuları TEMİZLER — bu yüzden erken bakılır
    await sleep(450);
    s = await snap();
    log("kutu değerleri", s.boxValues);
    log("DOM'da dolu kutu", s.domFilled);
    log("OTP durumu", s.otpState ?? "—");
    log("buton", `${s.btnText} (disabled=${s.btnDisabled})`);
    log("hata metni", s.errText ?? "—");
    await shot("e2e-3-yanlis");

    // Animasyon sonrası normale dönüş
    await sleep(1300);
    s = await snap();
    log("animasyon sonrası", `${s.otpState} · ${s.domFilled} dolu kutu`);
    log("kutular kilitli mi", s.btnDisabled === null ? "—" : "hayır (yeniden denenebilir) ✔");

    // ---- DOĞRU KOD ----
    console.log("\n[5] DOĞRU KOD (gerçek tuşlarla)");
    if (!otp.devCode) {
      console.log("  ⚠ Geliştirme kodu okunamadı");
    } else {
      // Kutuları temizle (Backspace ile)
      await cdp.eval(FOCUS(".otp-yeti__box, .otp__input"));
      for (let i = 0; i < 10; i += 1) await pressBackspace();
      await sleep(500);

      await cdp.eval(FOCUS(".otp-yeti__box, .otp__input"));
      await type(otp.devCode);
      await sleep(900);

      s = await snap();
      log("DOM'da dolu kutu", s.domFilled);
      log("OTP durumu", s.otpState ?? "—");
      log("buton", `${s.btnText} (disabled=${s.btnDisabled})`);
      await shot("e2e-4-dogru");

      // Sonuç: masaüstü/konsol geldi mi?
      await sleep(2500);
      s = await snap();
      log("son adım", s.step);
    }

    console.log("\n[6] KONSOL / HATA");
    const errs = cdp.console.filter((c) => /error|Error/.test(c));
    log("konsol hatası", errs.length ? errs.length + " adet" : "yok ✔");
    errs.slice(0, 5).forEach((c) => console.log("     " + c.slice(0, 160)));
    log("yakalanan istisna", cdp.exceptions.length ? cdp.exceptions.length + " adet" : "yok ✔");
    cdp.exceptions.slice(0, 3).forEach((e) => console.log("     ⛔ " + e.split("\n")[0]));

    console.log("\n  ekran görüntüleri: " + shots.join(", "));
  } catch (error) {
    console.error("\n❌ TEST HATASI:", error.message);
  } finally {
    cdp.close();
    if (!process.argv.includes("--keep")) {
      child.kill();
      await sleep(600);
      rmSync(PROFILE, { recursive: true, force: true });
    }
  }
}

main();
