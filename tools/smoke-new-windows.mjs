/**
 * Duman testi — yeni pencerelerin canlıda çizildiğini doğrular.
 *
 * Doğrudan Chrome DevTools Protocol kullanır (ek bağımlılık yok).
 * OTP'yi atlamak için `?step=desktop&window=<ad>` geliştirme parametresi
 * kullanılır; bu parametreler üretim derlemesinde de çalışır.
 *
 * Kullanım:
 *   node tools/smoke-new-windows.mjs [--url https://...] [--keep]
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
const SHOTS = join(process.cwd(), "screenshots", "smoke");
const PORT = 9333;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const chromePath = CHROME_CANDIDATES.find((path) => path && existsSync(path));
if (!chromePath) {
  console.error("Chrome bulunamadi. CHROME_PATH ortam degiskenini ayarlayin.");
  process.exit(1);
}

mkdirSync(SHOTS, { recursive: true });

const profile = join(tmpdir(), `pixtool-smoke-${Date.now()}`);

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);

/* ------------------------------------------------------------------ */
/*  CDP yardımcıları                                                   */
/* ------------------------------------------------------------------ */

let messageId = 0;
const pending = new Map();

async function waitForTarget(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* henüz hazır değil */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Chrome hedefi bulunamadi");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket));
    socket.addEventListener("error", (event) => reject(new Error(String(event))));
  });
}

function send(socket, method, params = {}) {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Zaman asimi: ${method}`));
      }
    }, 30000);
  });
}

/** Sayfada ifade çalıştırır ve değeri döndürür. */
async function evaluate(socket, expression) {
  const result = await send(socket, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Degerlendirme hatasi");
  }
  return result.result?.value;
}

/* ------------------------------------------------------------------ */
/*  Testler                                                            */
/* ------------------------------------------------------------------ */

const CASES = [
  {
    window: "overview",
    label: "Genel Bakış",
    // Yerel makine bölümü köprüden gelir
    probes: [
      [".app__title", "baslik"],
      [".ov__gauge", "olcer"],
      [".ov__facts", "kunye"],
    ],
  },
  {
    window: "files",
    label: "Dosya Yöneticisi",
    probes: [
      [".files__nav", "adres cubugu"],
      [".files__sidebar", "kenar cubugu"],
      [".files__list", "liste alani"],
      [".files__status", "durum cubugu"],
    ],
  },
  {
    window: "database",
    label: "Veritabanı",
    probes: [
      [".app__split", "bolunmus panel"],
      [".app-list", "tablo listesi"],
    ],
  },
  {
    window: "users",
    label: "Kullanıcılar",
    probes: [
      [".users__tabs", "kaynak sekmeleri"],
      [".users__tab", "sekme"],
    ],
  },
  {
    window: "tools",
    label: "Araçlar",
    probes: [
      [".tools__tabs", "arac sekmeleri"],
      [".tools__tab", "sekme"],
      [".calc", "hesap makinesi"],
      [".calc__btn", "tus"],
    ],
  },
  {
    window: "notes",
    label: "Yapışkan Notlar",
    probes: [
      [".notes__defaults", "varsayilan ayari"],
      [".notes__swatch", "renk"],
      [".notes__theme", "tema"],
    ],
  },
];

const results = [];

async function runCase(socket, testCase) {
  const url = `${BASE}/?step=desktop&window=${testCase.window}`;
  await send(socket, "Page.navigate", { url });
  // Kabuk + pencere kurulumu için bekle
  await new Promise((resolve) => setTimeout(resolve, 5200));

  const probeResults = [];
  for (const [selector, name] of testCase.probes) {
    const count = await evaluate(
      socket,
      `document.querySelectorAll(${JSON.stringify(selector)}).length`,
    );
    probeResults.push({ name, selector, count: Number(count) || 0 });
  }

  const title = await evaluate(
    socket,
    `(document.querySelector(".app__title")||{}).textContent || ""`,
  );
  const bodyText = await evaluate(socket, `document.body.innerText.slice(0, 300)`);
  const problems = await evaluate(
    socket,
    `Array.from(document.querySelectorAll(".app-msg--error, .app-msg--warn, .error-boundary"))
       .map((node) => node.innerText.replace(/\\s+/g, " ").trim().slice(0, 150))`,
  );
  const hasError = await evaluate(
    socket,
    `document.querySelectorAll(".app-msg--error, .error-boundary").length`,
  );

  // Basit PNG ekran görüntüsü
  let shot = null;
  try {
    const data = await send(socket, "Page.captureScreenshot", { format: "png" });
    if (data?.data) {
      shot = join(SHOTS, `${testCase.window}.png`);
      writeFileSync(shot, Buffer.from(data.data, "base64"));
    }
  } catch {
    /* ekran görüntüsü isteğe bağlı */
  }

  const total = probeResults.reduce((sum, probe) => sum + probe.count, 0);
  // Geçme ölçütü: bileşenler çizildi mi? Köprü/SSH uyarıları beklenen durumdur
  // (headless tarayıcıda yerel köprü çalışmıyor olabilir) — başarısızlık sayılmaz.
  const rendered = total > 0 && probeResults.every((probe) => probe.count > 0);
  const crashed = Number(hasError) > 0;

  results.push({
    ...testCase,
    probeResults,
    title,
    passed: rendered && !crashed,
    rendered,
    crashed,
    shot,
    bodyText,
    hasError,
    problems,
  });
  return rendered && !crashed;
}

/* ------------------------------------------------------------------ */

(async () => {
  console.log("");
  console.log("=".repeat(64));
  console.log(`  DUMAN TESTI — yeni pencereler @ ${BASE}`);
  console.log("=".repeat(64));

  try {
    const page = await waitForTarget();
    const socket = await connect(page.webSocketDebuggerUrl);

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

    for (const testCase of CASES) {
      await runCase(socket, testCase);
    }

    socket.close();
  } catch (error) {
    console.error(`  TEST HATASI: ${error.message}`);
  } finally {
    chrome.kill();
  }

  // Rapor
  console.log("");
  let passedCount = 0;
  for (const result of results) {
    const mark = result.passed ? "✔" : "✘";
    if (result.passed) passedCount += 1;

    console.log(
      `  ${mark} ${result.label.padEnd(20)} "${String(result.title).trim().slice(0, 30)}"`,
    );
    for (const probe of result.probeResults) {
      const detail = probe.count > 0 ? `${probe.count} adet` : "BULUNAMADI";
      console.log(`      ${probe.name.padEnd(16)} ${detail}`);
    }
    if (result.crashed) {
      console.log(`      ⚠ ${result.hasError} HATA mesaji gorunur`);
    }
    for (const problem of result.problems ?? []) {
      console.log(`      · ${problem}`);
    }
  }

  console.log("");
  console.log(`  SONUC: ${passedCount}/${results.length} pencere gecti`);
  console.log(`  Ekran goruntuleri: ${SHOTS}`);
  console.log("");

  process.exit(passedCount === results.length ? 0 : 1);
})();
