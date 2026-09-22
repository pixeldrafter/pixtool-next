/**
 * Ekran görüntüsü aracı — geliştirme sırasında tasarımı doğrulamak için.
 *
 * Kullanım:
 *   node tools/screenshot.mjs                       # tüm login formları
 *   node tools/screenshot.mjs --only lamp           # tek form
 *   node tools/screenshot.mjs --url "/?theme=kde"   # serbest URL
 *
 * Çıktı: `screenshots/<ad>.png`
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\//, "");
const OUT_DIR = join(ROOT, "screenshots");
const PROFILE_DIR = join(ROOT, ".chrome-profile");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const BASE_URL = "http://localhost:5173";

/** Çekilecek sayfalar. */
const PAGES = [
  { name: "01-login-lamp", url: "/?login=lamp" },
  { name: "02-login-animated", url: "/?login=animated" },
  { name: "03-login-border", url: "/?login=animatedBorder" },
  { name: "04-login-panda", url: "/?login=panda" },
  { name: "05-login-panda-page", url: "/?login=pandaPage" },
  { name: "06-login-yeti", url: "/?login=yeti" },
  { name: "07-theme-kde-lamp", url: "/?login=lamp&theme=kde" },
  { name: "08-theme-neon-lamp", url: "/?login=lamp&theme=neon" },
];

function findChrome() {
  return CHROME_CANDIDATES.find((path) => existsSync(path)) ?? null;
}

function screenshot(chrome, url, output, size = "1600,900") {
  return new Promise((resolve) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${PROFILE_DIR}`,
      "--virtual-time-budget=6000",
      `--window-size=${size}`,
      `--screenshot=${output}`,
      url,
    ];

    const child = spawn(chrome, args, { stdio: "ignore" });
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(-1));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
  const urlIndex = args.indexOf("--url");
  const customUrl = urlIndex >= 0 ? args[urlIndex + 1] : null;

  const chrome = findChrome();
  if (!chrome) {
    console.error("Chrome bulunamadı.");
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(PROFILE_DIR)) rmSync(PROFILE_DIR, { recursive: true, force: true });

  const pages = customUrl
    ? [{ name: "custom", url: customUrl }]
    : only
      ? PAGES.filter((page) => page.name.includes(only) || page.url.includes(only))
      : PAGES;

  console.log(`Chrome: ${chrome}`);
  console.log(`Çıktı : ${OUT_DIR}\n`);

  for (const page of pages) {
    const output = join(OUT_DIR, `${page.name}.png`);
    const started = Date.now();
    const code = await screenshot(chrome, BASE_URL + page.url, output);
    const ok = existsSync(output);
    console.log(
      `${ok ? "✔" : "✘"} ${page.name.padEnd(24)} ${ok ? `${Date.now() - started} ms` : `kod=${code}`}`,
    );
  }

  rmSync(PROFILE_DIR, { recursive: true, force: true });
}

main();
