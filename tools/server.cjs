/**
 * Sunucu işlemleri için yardımcı (deployment aracı).
 *
 * Kimlik bilgilerini `~/.ssh/pixtool-server.env` dosyasından okur — proje
 * deposuna ASLA yazılmaz.
 *
 * Kullanım (ctx_execute içinden):
 *   const { sh, sudo, upload } = require('.../tools/server.cjs');
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PLINK = "C:\\Program Files\\PuTTY\\plink.exe";
const PSFTP = "C:\\Program Files\\PuTTY\\psftp.exe";
const SECRET_FILE = path.join(os.homedir(), ".ssh", "pixtool-server.env");
const HOST = "213.142.148.38";
const USER = "omercataloglu";

function loadPassword() {
  const raw = fs.readFileSync(SECRET_FILE, "utf8");
  const match = raw.match(/SSH_PASS_OMERCATALOGLU=(\S+)/);
  if (!match) throw new Error("Parola bulunamadı: " + SECRET_FILE);
  return match[1];
}

const PASSWORD = loadPassword();

/** Uzak komut çalıştırır (sudo yok). */
function sh(command, timeoutMs = 120000) {
  const result = spawnSync(PLINK, ["-ssh", "-batch", "-pw", PASSWORD, `${USER}@${HOST}`, command], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    out: ((result.stdout || "") + (result.stderr || "")).replace(/\r/g, "").trim(),
  };
}

/** Root yetkisiyle script çalıştırır (parola stdin'den). */
function sudo(script, timeoutMs = 300000) {
  const result = spawnSync(
    PLINK,
    ["-ssh", "-batch", "-pw", PASSWORD, `${USER}@${HOST}`, 'sudo -S -p "" bash -s'],
    {
      input: PASSWORD + "\n" + script + "\n",
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  // sudo parola istemi çıktıya karışabilir — temizle
  const raw = ((result.stdout || "") + (result.stderr || "")).replace(/\r/g, "");
  const out = raw
    .split("\n")
    .filter((line) => !/^\[sudo\]/.test(line) && line !== PASSWORD)
    .join("\n")
    .trim();
  return { ok: result.status === 0, status: result.status, out };
}

/**
 * Yerel dosyayı uzak sunucuya yükler (psftp).
 * @param {string} localPath
 * @param {string} remotePath
 */
function upload(localPath, remotePath, timeoutMs = 600000) {
  const script = `put "${localPath}" ${remotePath}\nbye\n`;
  const result = spawnSync(PSFTP, ["-batch", "-pw", PASSWORD, `${USER}@${HOST}`], {
    input: script,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    out: ((result.stdout || "") + (result.stderr || "")).replace(/\r/g, "").trim(),
  };
}

/**
 * Küçük metin içeriğini uzak dosyaya yazar (base64 ile — kaçış sorunu yok).
 */
function writeRemote(remotePath, content, timeoutMs = 120000) {
  const base64 = Buffer.from(content, "utf8").toString("base64");
  return sudo(
    `mkdir -p "$(dirname '${remotePath}')"\n` +
      `printf '%s' '${base64}' | base64 -d > '${remotePath}'\n` +
      `echo "YAZILDI: ${remotePath} ($(wc -c < '${remotePath}') bayt)"`,
    timeoutMs,
  );
}

module.exports = { sh, sudo, upload, writeRemote, loadPassword, HOST, USER, PLINK, PSFTP };
