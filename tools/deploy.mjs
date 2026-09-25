/**
 * Pixtool dağıtım aracı — katman katman.
 *
 * ## Neden?
 *
 * Pixtool iki katmandır ve **güncelleme sıklıkları çok farklıdır**:
 *
 * | Katman | Ne | Değişir | Komut |
 * |---|---|---|---|
 * | **web** | React arayüzü | Her değişiklikte | `node tools/deploy.mjs web` |
 * | **api** | FastAPI backend | Backend değişince | `node tools/deploy.mjs api` |
 * | **scripts** | Script kütüphanesi | Script eklenince | `node tools/deploy.mjs scripts` |
 * | **shell** | Tauri exe + köprü | Nadir | `node tools/deploy.mjs shell` |
 * | **bridge** | Köprü exe'si | Köprü değişince | `node tools/deploy.mjs bridge` |
 *
 * Arayüz sunucudan yüklendiği için **web dağıtımı anında etki eder** —
 * masaüstü uygulamasını yeniden derlemek gerekmez.
 *
 * ## Kullanım
 *
 *     node tools/deploy.mjs web            # sadece arayüz (~10 sn)
 *     node tools/deploy.mjs api web        # ikisi birden
 *     node tools/deploy.mjs all            # hepsi (shell hariç)
 *     node tools/deploy.mjs shell          # kurulum paketi üret + yayınla
 *     node tools/deploy.mjs --check        # sadece canlı durumu göster
 *
 * ## Ayarlar
 *
 * SSH bilgileri `~/.ssh/pixtool-server.env` dosyasından okunur.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ----------------------------------------------------------------------
//  Ayarlar
// ----------------------------------------------------------------------

const ROOT = process.cwd();
const ENV_FILE = join(process.env.USERPROFILE ?? "", ".ssh", "pixtool-server.env");

const PLINK = "C:\\Program Files\\PuTTY\\plink.exe";
const PSFTP = "C:\\Program Files\\PuTTY\\psftp.exe";
const TAR = "C:\\Windows\\System32\\tar.exe";

const HOST_KEY = "ssh-ed25519 255 SHA256:z/78So+o5j1UEIaTrCyk/FIr848bom46lrKUBAHtjgk";

/** Sunucu yolları */
const REMOTE = {
  root: "/opt/pixtool",
  web: "/opt/pixtool/web",
  api: "/opt/pixtool/api",
  scripts: "/opt/pixtool/scripts_library",
  releases: "/opt/pixtool/releases",
  base: "https://pixtool.omercataloglu.com",
};

/** Dağıtılabilir katmanlar */
const LAYERS = {
  web: { label: "Arayüz (React)", source: "apps/web/dist", target: REMOTE.web, owner: "www-data" },
  api: { label: "Backend (FastAPI)", source: "services/api/app", target: `${REMOTE.api}/app`, owner: "www-data" },
  scripts: { label: "Script kütüphanesi", source: "scripts_library", target: REMOTE.scripts, owner: "www-data" },
  releases: { label: "Kurulum arşivi", source: "releases", target: REMOTE.releases, owner: "www-data" },
};

// ----------------------------------------------------------------------
//  Yardımcılar
// ----------------------------------------------------------------------

const C = {
  reset: "\u001b[0m",
  dim: "\u001b[90m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  cyan: "\u001b[36m",
  bold: "\u001b[1m",
};

const log = {
  step: (text) => console.log(`${C.cyan}▸${C.reset} ${text}`),
  ok: (text) => console.log(`  ${C.green}✔${C.reset} ${text}`),
  warn: (text) => console.log(`  ${C.yellow}!${C.reset} ${text}`),
  err: (text) => console.log(`  ${C.red}✘${C.reset} ${text}`),
  dim: (text) => console.log(`  ${C.dim}${text}${C.reset}`),
  title: (text) => console.log(`\n${C.bold}${text}${C.reset}`),
};

/** SSH bilgilerini okur. */
function loadCredentials() {
  if (!existsSync(ENV_FILE)) {
    log.err(`Kimlik dosyası yok: ${ENV_FILE}`);
    process.exit(1);
  }

  const values = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }

  const password = values["SSH_PASS_OMERCATALOGLU"];
  if (!password) {
    log.err("SSH_PASS_OMERCATALOGLU bulunamadı");
    process.exit(1);
  }

  return { user: "omercataloglu", host: "213.142.148.38", password };
}

let creds = null;

/** Uzak komut çalıştırır. */
function ssh(command, { sudo = false, timeout = 600000 } = {}) {
  const target = `${creds.user}@${creds.host}`;
  const finalCommand = sudo ? `sudo -S -p "" bash -s` : command;

  const result = spawnSync(
    PLINK,
    ["-ssh", "-batch", "-hostkey", HOST_KEY, "-pw", creds.password, target, finalCommand],
    {
      encoding: "utf8",
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      input: sudo ? `${creds.password}\n${command}\n` : undefined,
    },
  );

  return ((result.stdout ?? "") + (result.stderr ?? "")).trim();
}

/** SFTP ile dosya yükler (tam hedef yolu ile). */
function upload(localPaths, remotePaths) {
  const locals = Array.isArray(localPaths) ? localPaths : [localPaths];
  const remotes = Array.isArray(remotePaths) ? remotePaths : [remotePaths];

  const commands = locals
    .map((local, index) => {
      const target = remotes[index] ?? remotes[0];
      // Windows yolunu psftp biçimine çevir (ileri eğik çizgi, boşluk yok)
      const posixLocal = local.replace(/\\/g, "/");
      return `put "${posixLocal}" ${target}`;
    })
    .join("\n");

  const result = spawnSync(
    PSFTP,
    ["-batch", "-hostkey", HOST_KEY, "-pw", creds.password, `${creds.user}@${creds.host}`],
    {
      encoding: "utf8",
      timeout: 900000,
      maxBuffer: 8 * 1024 * 1024,
      input: `${commands}\nbye\n`,
    },
  );

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  // psftp hata verirse yüzeye çıkar
  if (/error|denied|no such|cannot/i.test(output) && !/uploaded|=>|put/i.test(output)) {
    log.warn(`SFTP uyarısı: ${output.split("\n").slice(-3).join(" ")}`);
  }

  return output;
}

/** Dizinleri tar arşivine alır. */
function makeArchive(name, entries) {
  const archive = join(tmpdir(), `${name}.tar.gz`);
  rmSync(archive, { force: true });

  const stage = join(tmpdir(), `${name}-stage`);
  rmSync(stage, { recursive: true, force: true });

  for (const entry of entries) {
    copyTree(join(ROOT, entry.source), join(stage, entry.as), { skip: entry.skip });
  }

  spawnSync(TAR, ["-czf", archive, "-C", stage, "."], { timeout: 600000 });

  const size = existsSync(archive) ? statSync(archive).size : 0;
  return { archive, size, stage };
}

/** Dizini kopyalar (hariç tutma destekli). */
function copyTree(source, target, { skip = [] } = {}) {
  mkdirSync(target, { recursive: true });

  if (!existsSync(source)) return;

  for (const entry of readdirSync(source)) {
    if (skip.includes(entry)) continue;

    const from = join(source, entry);
    const to = join(target, entry);
    const stat = statSync(from);

    if (stat.isDirectory()) {
      copyTree(from, to, { skip });
    } else {
      writeFileSync(to, readFileSync(from));
    }
  }
}

/** `readdirSync` içe aktarımı (ESM uyumu). */
import { readdirSync } from "node:fs";

/** Katmanı dağıtır. */
function deployLayer(layerId) {
  const layer = LAYERS[layerId];

  if (!layer) {
    log.err(`Bilinmeyen katman: ${layerId}`);
    return false;
  }

  const sourcePath = join(ROOT, layer.source);
  if (!existsSync(sourcePath)) {
    log.err(`${layer.label}: kaynak yok — ${layer.source}`);
    return false;
  }

  log.step(`${layer.label} hazırlanıyor…`);

  const { archive, size } = makeArchive(`px-${layerId}`, [
    { source: layer.source, as: "payload" },
  ]);

  if (!size) {
    log.err(`${layer.label}: arşiv oluşturulamadı`);
    return false;
  }

  log.dim(`${(size / 1024 / 1024).toFixed(2)} MB yükleniyor…`);
  const remoteArchive = `/tmp/px-${layerId}.tar.gz`;
  upload([archive], [remoteArchive]);

  // Yükleme gerçekten oldu mu?
  const check = ssh(`test -s ${remoteArchive} && echo VAR || echo YOK`);
  if (!check.includes("VAR")) {
    log.err(`${layer.label}: yükleme başarısız (${remoteArchive})`);
    return false;
  }

  log.step(`${layer.label} sunucuya yerleştiriliyor…`);

  // Web için atomik devir; diğerleri doğrudan kopya
  const script =
    layerId === "web"
      ? `
set -e
cd /tmp && rm -rf px-${layerId} && mkdir px-${layerId} && cd px-${layerId}
tar -xzf /tmp/px-${layerId}.tar.gz
STAGE="${layer.target}.stage-$$"
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp -r /tmp/px-${layerId}/payload/. "$STAGE"/
chown -R ${layer.owner}:${layer.owner} "$STAGE"
chmod -R 755 "$STAGE"
PREV="${layer.target}.prev"
rm -rf "$PREV"
mv "${layer.target}" "$PREV" 2>/dev/null || true
mv "$STAGE" "${layer.target}"
echo "devir-tamam"
`
      : `
set -e
cd /tmp && rm -rf px-${layerId} && mkdir px-${layerId} && cd px-${layerId}
tar -xzf /tmp/px-${layerId}.tar.gz
mkdir -p "${layer.target}"
cp -r /tmp/px-${layerId}/payload/. "${layer.target}"/
chown -R ${layer.owner}:${layer.owner} "${layer.target}" 2>/dev/null || true
echo "devir-tamam"
`;

  const result = ssh(script, { sudo: true });
  const ok = result.includes("devir-tamam");

  if (!ok) {
    log.err(`${layer.label}: yerleştirme başarısız`);
    log.dim(result.split("\n").slice(-6).join("\n"));
    return false;
  }

  // API değiştiyse yeniden başlat
  if (layerId === "api") {
    log.step("Backend yeniden başlatılıyor…");
    const restart = ssh("systemctl restart pixtool-api; sleep 3; systemctl is-active pixtool-api", {
      sudo: true,
    });
    if (restart.includes("active")) {
      log.ok("pixtool-api aktif");
    } else {
      log.err("pixtool-api başlatılamadı");
      log.dim(ssh("journalctl -u pixtool-api -n 8 --no-pager", { sudo: true }));
      return false;
    }
  }

  log.ok(`${layer.label} dağıtıldı`);
  rmSync(archive, { force: true });
  return true;
}

/** Canlı durumu kontrol eder. */
function checkLive() {
  log.title("Canlı durum");

  const script = `
echo -n "web JS    : "; grep -o 'assets/index-[A-Za-z0-9_-]*\\.js' ${REMOTE.web}/index.html 2>/dev/null | head -1 || echo yok
echo -n "api       : "; systemctl is-active pixtool-api 2>/dev/null || echo yok
echo -n "surum ucu : "; curl -s -m 10 -o /dev/null -w "%{http_code}" ${REMOTE.base}/api/v1/app/version
echo ""
echo -n "http      : "; curl -s -m 15 -o /dev/null -w "%{http_code}" ${REMOTE.base}/
echo ""
echo -n "scriptler : "; find ${REMOTE.scripts} -type f -name '*.ps1' -o -name '*.sh' -o -name '*.py' 2>/dev/null | wc -l
echo -n "kurulumlar: "; ls -1 ${REMOTE.releases}/*.exe 2>/dev/null | wc -l
`;

  const output = ssh(script);
  output
    .split("\n")
    .filter((line) => line.trim())
    .forEach((line) => console.log(`  ${line}`));
}

/** Cargo kurulum dizinini bulur (PATH'te olmayabilir). */
function findCargoBin() {
  const candidates = [
    join(process.env.USERPROFILE ?? "", ".cargo", "bin"),
    join(process.env.HOME ?? "", ".cargo", "bin"),
    "C:\\Users\\DOGUS\\.cargo\\bin",
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, "cargo.exe"))) return candidate;
  }

  return null;
}

/**
 * Kurulum paketini seçer.
 *
 * ⚠️ `readdirSync` alfabetik sıralar: `…_1.0.0_…` < `…_1.1.0_…` ama
 * `…_1.10.0_…` < `…_1.9.0_…` olur. Bu yüzden **sürüme uyan** paket aranır,
 * bulunamazsa **en yeni** (mtime) paket seçilir.
 */
function pickInstaller(bundleDir, version) {
  if (!existsSync(bundleDir)) return null;

  const installers = readdirSync(bundleDir)
    .filter((name) => name.toLowerCase().endsWith(".exe"))
    .map((name) => ({ name, mtime: statSync(join(bundleDir, name)).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime);

  if (!installers.length) return null;

  // 1) Sürüme uyan (en yeni)
  const matching = installers.find((item) => item.name.includes(version));
  if (matching) return matching.name;

  // 2) En yeni paket
  return installers[0]?.name ?? null;
}

/** Kabuk (shell) paketi üretir ve yayınlar. */
function buildShell(notes = "") {
  log.title("Kabuk (Tauri) derleniyor");
  log.dim("Bu adım 2-3 dakika sürer ve yalnızca Rust/kabuk değişince gerekir.");

  // Köprü exe'sini yerleştir
  const bridge = join(ROOT, "services", "bridge", "dist", "pixtool-bridge.exe");
  const bridgeTarget = join(
    ROOT,
    "apps",
    "desktop",
    "src-tauri",
    "binaries",
    "pixtool-bridge-x86_64-pc-windows-msvc.exe",
  );

  if (existsSync(bridge)) {
    writeFileSync(bridgeTarget, readFileSync(bridge));
    log.ok("Köprü binary'si güncellendi");
  } else {
    log.warn("Köprü exe'si yok — mevcut binary kullanılacak");
  }

  const tauriCmd = join(ROOT, "apps", "desktop", "node_modules", ".bin", "tauri.cmd");
  const tauriApi = join(ROOT, "apps", "desktop", "node_modules", "@tauri-apps", "cli", "tauri.js");

  // Hangisi varsa onu kullan (pnpm sembolik bağlantılarına karşı dayanıklı)
  const useCmd = existsSync(tauriCmd);
  if (!useCmd && !existsSync(tauriApi)) {
    log.err("Tauri CLI bulunamadı — önce `pnpm install` çalıştırın");
    return false;
  }

  // Cargo PATH'te olmayabilir — mutlak yolu ekle
  const cargoBin = findCargoBin();
  if (!cargoBin) {
    log.err("Cargo bulunamadı — Rust kurulu mu? (winget install Rustlang.Rustup)");
    return false;
  }
  log.dim(`Cargo: ${cargoBin}`);

  // İmzalama anahtarı (otomatik güncelleme için zorunlu)
  //
  // Tauri, `createUpdaterArtifacts: true` ile derleme sırasında `.sig` üretir.
  // Anahtar yoksa imza üretilmez ve otomatik güncelleme çalışmaz.
  const keyPath = join(ROOT, ".tauri-keys", "pixtool.key");
  const hasKey = existsSync(keyPath);

  if (hasKey) {
    log.ok("İmzalama anahtarı bulundu (otomatik güncelleme aktif)");
  } else {
    log.warn("İmzalama anahtarı yok — otomatik güncelleme çalışmayacak");
    log.dim(`  Beklenen: ${keyPath}`);
    log.dim("  Üretmek için: pnpm tauri signer generate -w ../.tauri-keys/pixtool.key");
  }

  const cargoHome = cargoBin.replace(/[\\/]bin$/, "");
  const rustupHome = join(cargoHome, "..", ".rustup");

  // ⚠️ Windows'ta `spawnSync("node", …)` ile verilen `env.PATH` her zaman
  // alt süreçlere yansımaz (tauri CLI kendi `cargo` aramasını yapar).
  // `cmd /c` + PATH öneki güvenilir çözümdür.
  //
  // Not: `spawnSync("cmd", ["/c", komut])` dizi biçiminde tırnakları kaçırır
  // (`\"` olur) — bu yüzden yollar **tırnaksız** verilir. Depo yolu boşluk
  // içermiyorsa sorun olmaz; içeriyorsa kısa yol (8.3) kullanılır.
  const runner = useCmd ? tauriCmd : `node ${tauriApi}`;

  const command =
    `set "PATH=${cargoBin};%PATH%"` +
    ` && set "CARGO_HOME=${cargoHome}"` +
    ` && set "RUSTUP_HOME=${rustupHome}"` +
    ` && ${runner} build`;

  log.dim(`Tauri: ${useCmd ? "tauri.cmd" : "tauri.js"} · Cargo: ${cargoBin}`);

  // ⚠️ İmza anahtarı `set` ile verilmez — Tauri CLI alt süreçlere aktarırken
  // kaybolur. `env` ile doğrudan verilir.
  const signingEnv = hasKey
    ? {
        TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyPath, "utf8"),
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
      }
    : {};

  const result = spawnSync(command, {
    cwd: join(ROOT, "apps", "desktop"),
    encoding: "utf8",
    timeout: 2_100_000,
    maxBuffer: 32 * 1024 * 1024,
    shell: true,
    env: { ...process.env, ...signingEnv },
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    log.err("Derleme başarısız");
    log.dim(output.split("\n").slice(-12).join("\n"));
    return false;
  }

  log.ok("Derleme tamamlandı");

  // Kurulum paketini bul
  const releaseDir = join(ROOT, "apps", "desktop", "src-tauri", "target", "release");
  const bundleDir = join(releaseDir, "bundle", "nsis");

  if (!existsSync(bundleDir)) {
    log.err("Kurulum paketi bulunamadı");
    return false;
  }

  // Sürüm bilgisini oku — paket seçiminden ÖNCE gerekli
  const config = JSON.parse(
    readFileSync(join(ROOT, "apps", "desktop", "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const version = config.version ?? "1.0.0";

  const installer = pickInstaller(bundleDir, version);
  if (!installer) {
    log.err("NSIS kurulum dosyası yok");
    return false;
  }

  const installerPath = join(bundleDir, installer);
  const size = statSync(installerPath).size;
  log.dim(`Kurulum: ${installer} (${(size / 1024 / 1024).toFixed(1)} MB)`);

  const manifest = {
    version,
    released: new Date().toISOString(),
    notes,
    mandatory: false,
  };

  const manifestPath = join(tmpdir(), "shell.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  // Yerel releases klasörü
  const localReleases = join(ROOT, "releases");
  mkdirSync(localReleases, { recursive: true });
  writeFileSync(join(localReleases, "shell.json"), JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(join(localReleases, installer), readFileSync(installerPath));

  // İmza dosyası (Tauri üretir) — otomatik güncelleme için sunucuya da gider
  const signaturePath = `${installerPath}.sig`;
  const hasSignature = existsSync(signaturePath);

  if (hasSignature) {
    writeFileSync(join(localReleases, `${installer}.sig`), readFileSync(signaturePath));
    log.ok("İmza üretildi (.sig) — otomatik güncelleme hazır");
  } else {
    log.warn("İmza üretilmedi (.sig yok) — otomatik güncelleme çalışmaz");
  }

  // Sunucuya yükle
  log.step("Sunucuya yükleniyor…");
  ssh(`mkdir -p ${REMOTE.releases}`, { sudo: true });

  const remoteInstaller = `/tmp/${installer.replace(/[^A-Za-z0-9._-]/g, "_")}`;
  const uploads = [installerPath, manifestPath];
  const remotes = [remoteInstaller, "/tmp/shell.json"];

  if (hasSignature) {
    uploads.push(signaturePath);
    remotes.push("/tmp/shell.sig");
  }

  upload(uploads, remotes);

  const signLine = hasSignature
    ? `cp /tmp/shell.sig "${REMOTE.releases}/${installer}.sig"`
    : `rm -f "${REMOTE.releases}/${installer}.sig"`;

  const script = `
set -e
cp "${remoteInstaller}" "${REMOTE.releases}/${installer}"
cp /tmp/shell.json ${REMOTE.releases}/shell.json
${signLine}
chown -R www-data:www-data ${REMOTE.releases}
echo "yuklendi"
`;

  const uploadResult = ssh(script, { sudo: true });
  if (uploadResult.includes("yuklendi")) {
    log.ok(`Kurulum yayınlandı: ${REMOTE.base}/api/v1/app/download`);

    // Otomatik güncelleme ucunu doğrula
    const check = ssh(
      `curl -s -m 15 -o /dev/null -w "%{http_code}" ${REMOTE.base}/api/v1/app/latest.json`,
    );
    if (check.includes("200")) {
      log.ok("Otomatik güncelleme hazır — uygulama açılışta kendini güncelleyecek");
    } else if (hasSignature) {
      log.warn(`latest.json yanıtı: ${check} (nginx/api kontrol edin)`);
    }
  } else {
    log.err("Yükleme başarısız");
    log.dim(uploadResult.split("\n").slice(-6).join("\n"));
    return false;
  }

  return true;
}

// ----------------------------------------------------------------------
//  Ana akış
// ----------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);

  // Seçenekler ve değerlerini ayıkla
  const FLAGS = ["--check", "--notes"];
  const args = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index] ?? "";
    if (item === "--notes") {
      options.notes = argv[index + 1] ?? "";
      index += 1;
    } else if (item.startsWith("--")) {
      if (!FLAGS.includes(item)) log.warn(`Bilinmeyen seçenek: ${item}`);
      else options[item.slice(2)] = "true";
    } else {
      args.push(item);
    }
  }

  console.log(`\n${C.bold}${C.cyan}Pixtool Dağıtım${C.reset}`);

  creds = loadCredentials();

  if (options.check || args.length === 0) {
    checkLive();
    console.log("");
    log.dim("Katman dağıtmak için: node tools/deploy.mjs web | api | scripts | shell | all");
    console.log("");
    return;
  }

  const targets = args.includes("all")
    ? ["web", "api", "scripts"]
    : args.filter((item) => item !== "shell" && LAYERS[item]);

  const unknown = args.filter((item) => item !== "shell" && item !== "all" && !LAYERS[item]);
  for (const item of unknown) log.warn(`Bilinmeyen katman: ${item}`);

  let failed = 0;

  if (targets.length) {
    log.title("Dağıtım");
    for (const layer of targets) {
      if (!deployLayer(layer)) failed += 1;
    }
  }

  const wantShell = args.includes("shell") || args.includes("all");

  if (wantShell) {
    if (!buildShell(options.notes ?? "")) failed += 1;
  }

  console.log("");
  log.title("Özet");

  const total = targets.length + (wantShell ? 1 : 0);
  const ok = total - failed;

  if (failed === 0) {
    log.ok(`${ok} katman başarılı`);
  } else {
    log.err(`${ok} başarılı, ${failed} başarısız`);
  }

  checkLive();
  console.log("");

  process.exit(failed === 0 ? 0 : 1);
}

main();
