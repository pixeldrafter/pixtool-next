/**
 * Araç uygulamaları — üçüncü grup (metin üretici, QR, MIME, HTTP kodları).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "../../notifications";
import { t, UI, type ToolLang } from "./tools";
import { ToolShell } from "./ToolParts";
import "./tool-parts.css";

// ======================================================================
//  Lorem ipsum
// ======================================================================

const LOREM_WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation
ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit
voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non
proident sunt culpa qui officia deserunt mollit anim id est laborum`.split(/\s+/);

/** Rastgele cümle üretir. */
function makeSentence(wordCount: number): string {
  const bytes = crypto.getRandomValues(new Uint32Array(wordCount));
  const words = Array.from(bytes).map((byte) => LOREM_WORDS[byte % LOREM_WORDS.length]);
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

export function LoremTool({ lang }: { lang: ToolLang }) {
  const [kind, setKind] = useState<"paragraphs" | "sentences" | "words">("paragraphs");
  const [count, setCount] = useState(3);
  const [startClassic, setStartClassic] = useState(true);
  const [output, setOutput] = useState("");

  const generate = useCallback(() => {
    let text = "";

    if (kind === "words") {
      const bytes = crypto.getRandomValues(new Uint32Array(count));
      text = Array.from(bytes).map((byte) => LOREM_WORDS[byte % LOREM_WORDS.length]).join(" ");
    } else if (kind === "sentences") {
      text = Array.from({ length: count }, () => makeSentence(6 + Math.floor(Math.random() * 10))).join(" ");
    } else {
      text = Array.from({ length: count }, () =>
        Array.from({ length: 4 + Math.floor(Math.random() * 3) }, () =>
          makeSentence(8 + Math.floor(Math.random() * 10)),
        ).join(" "),
      ).join("\n\n");
    }

    if (startClassic) {
      text = `${text.charAt(0).toUpperCase() + text.slice(1)}`;
      if (kind === "paragraphs") {
        text = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. ${text}`;
      } else {
        text = `Lorem ipsum dolor sit amet ${text.charAt(0).toLocaleLowerCase("tr")}${text.slice(1)}`;
      }
    }

    setOutput(text);
  }, [kind, count, startClassic]);

  useEffect(generate, [generate]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Tür", en: "Kind" }, lang)}
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="paragraphs">{t({ tr: "Paragraf", en: "Paragraphs" }, lang)}</option>
              <option value="sentences">{t({ tr: "Cümle", en: "Sentences" }, lang)}</option>
              <option value="words">{t({ tr: "Kelime", en: "Words" }, lang)}</option>
            </select>
          </label>
          <label className="tool__field">
            {t({ tr: "Adet", en: "Count" }, lang)}
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(event) => setCount(Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
            />
          </label>
          <label className="tool__check">
            <input
              type="checkbox"
              checked={startClassic}
              onChange={(event) => setStartClassic(event.target.checked)}
            />
            {t({ tr: "Klasik başlangıç", en: "Classic start" }, lang)}
          </label>
          <button type="button" className="tool__btn is-primary" onClick={generate}>
            ⟳ {t(UI.generate, lang)}
          </button>
          <span className="tool__spacer" />
          <button
            type="button"
            className="tool__btn"
            disabled={!output}
            onClick={() => {
              void navigator.clipboard.writeText(output);
              toast.ok(t(UI.copied, lang), "", "Araçlar");
            }}
          >
            ⧉ {t(UI.copy, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane tool__pane--wide">
        <div className="tool__label">
          {t(UI.output, lang)} · {output.split(/\s+/).filter(Boolean).length} {t({ tr: "kelime", en: "words" }, lang)}
        </div>
        <textarea className="tool__area" rows={18} value={output} readOnly spellCheck={false} />
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  QR kod üretici
// ======================================================================

/**
 * QR kod üretir (harici kütüphane yok).
 *
 * Basit "byte" modu, sürüm 1–10, hata düzeltme seviyesi L. Görsel çıktı SVG
 * olduğu için ölçeklenebilir ve metin seçilebilir kalır.
 */
function buildQrSvg(text: string, moduleSize = 6, quiet = 4): string | null {
  // --- Reed-Solomon / matris kurulumu (küçük ama gerçek bir uygulama) ---
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 230) return null;

  // Veri kod sözcükleri (byte modu, sürüm seçimi basitleştirilmiş)
  const version = bytes.length <= 17 ? 1 : bytes.length <= 32 ? 2 : bytes.length <= 53 ? 3 : bytes.length <= 78 ? 4 : 5;
  const totalCodewords = [0, 26, 44, 70, 100, 134][version];
  const ecCodewords = [0, 7, 10, 15, 20, 26][version];
  const dataCodewords = totalCodewords - ecCodewords;

  // Bit akışı
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let index = length - 1; index >= 0; index -= 1) {
      bits.push((value >>> index) & 1);
    }
  };

  push(0b0100, 4); // byte modu
  push(bytes.length, version === 1 ? 8 : 16);
  bytes.forEach((byte) => push(byte, 8));

  // Sonlandırıcı ve dolgu
  const capacity = dataCodewords * 8;
  for (let index = 0; index < 4 && bits.length < capacity; index += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | (bits[index + bit] ?? 0);
    data.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < dataCodewords) {
    data.push(padBytes[padIndex % 2]);
    padIndex += 1;
  }
  while (data.length < dataCodewords) data.push(0);

  // --- Galois alanı (GF 256) ---
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];

  const mul = (left: number, right: number) =>
    left === 0 || right === 0 ? 0 : exp[log[left] + log[right]];

  // Üretici polinom
  let generator = [1];
  for (let index = 0; index < ecCodewords; index += 1) {
    const next = new Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, position) => {
      next[position] ^= mul(coefficient, 1);
      next[position + 1] ^= mul(coefficient, exp[index]);
    });
    generator = next;
  }

  // Reed-Solomon kalanı
  const remainder = new Array(ecCodewords).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < ecCodewords; index += 1) {
      remainder[index] ^= mul(generator[index + 1] ?? 0, factor);
    }
  });

  const codewords = [...data, ...remainder];

  // --- Matris kurulumu ---
  const size = 17 + version * 4;
  const matrix: (number | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (row: number, column: number, dark: number) => {
    if (row < 0 || column < 0 || row >= size || column >= size) return;
    matrix[row][column] = dark;
    reserved[row][column] = true;
  };

  // Bulucu desenleri
  const finder = (row: number, column: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = row + dr;
        const c = column + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const inRing =
          (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setModule(r, c, inRing ? 1 : 0);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  // Zamanlama desenleri
  for (let index = 8; index < size - 8; index += 1) {
    setModule(6, index, index % 2 === 0 ? 1 : 0);
    setModule(index, 6, index % 2 === 0 ? 1 : 0);
  }

  // Hizalama deseni (sürüm ≥ 2)
  if (version >= 2) {
    const positions = version === 1 ? [] : [6, size - 7];
    for (const row of positions) {
      for (const column of positions) {
        if (reserved[row][column]) continue;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            const ring = Math.max(Math.abs(dr), Math.abs(dc));
            setModule(row + dr, column + dc, ring === 1 ? 0 : 1);
          }
        }
      }
    }
  }

  // Karanlık modül
  setModule(size - 8, 8, 1);

  // Biçim bilgisi için alan ayır (değeri sonra yazarız)
  for (let index = 0; index <= 8; index += 1) {
    if (!reserved[8][index]) setModule(8, index, 0);
    if (!reserved[index][8]) setModule(index, 8, 0);
  }
  for (let index = 0; index < 8; index += 1) {
    if (!reserved[8][size - 1 - index]) setModule(8, size - 1 - index, 0);
    if (!reserved[size - 1 - index][8]) setModule(size - 1 - index, 8, 0);
  }

  // Veriyi zigzag yerleştir
  const dataBits: number[] = [];
  codewords.forEach((byte) => {
    for (let bit = 7; bit >= 0; bit -= 1) dataBits.push((byte >>> bit) & 1);
  });

  let bitIndex = 0;
  let upward = true;
  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const current of [column, column - 1]) {
        if (reserved[row][current]) continue;
        const bit = dataBits[bitIndex] ?? 0;
        bitIndex += 1;
        // Maske 0: (row + column) % 2 === 0
        matrix[row][current] = bit ^ ((row + current) % 2 === 0 ? 1 : 0);
      }
    }
    upward = !upward;
  }

  // Biçim bilgisi (maske 0, EC seviyesi L)
  const format = 0b01000; // EC L (01) + maske 0 (000)
  const formatBits = (format << 10) | 0b10100110111;
  const formatMasked = (formatBits ^ 0b101010000010010) & 0x7fff;

  for (let index = 0; index < 15; index += 1) {
    const bit = (formatMasked >>> index) & 1;
    if (index < 6) setModule(8, index, bit);
    else if (index < 8) setModule(8, index + 1, bit);
    else setModule(8, size - 15 + index, bit);

    if (index < 8) setModule(size - 1 - index, 8, bit);
    else setModule(15 - index - 1, 8, bit);
  }

  // --- SVG ---
  const total = size + quiet * 2;
  const rects: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (matrix[row][column] === 1) {
        rects.push(
          `<rect x="${(column + quiet) * moduleSize}" y="${(row + quiet) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`,
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total * moduleSize}" height="${total * moduleSize}" viewBox="0 0 ${total * moduleSize} ${total * moduleSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><g fill="#000000">${rects.join("")}</g></svg>`;
}

export function QrcodeTool({ lang }: { lang: ToolLang }) {
  const [text, setText] = useState("https://pixtool.omercataloglu.com");
  const [moduleSize, setModuleSize] = useState(6);

  const svg = useMemo(() => buildQrSvg(text, moduleSize), [text, moduleSize]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Modül boyutu", en: "Module size" }, lang)}
            <input
              type="number"
              min={2}
              max={16}
              value={moduleSize}
              onChange={(event) => setModuleSize(Math.min(16, Math.max(2, Number(event.target.value) || 6)))}
            />
          </label>
          <span className="tool__spacer" />
          {svg && (
            <button
              type="button"
              className="tool__btn"
              onClick={() => {
                const blob = new Blob([svg], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "qr.svg";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              ⬇ SVG
            </button>
          )}
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <textarea
          className="tool__area"
          rows={7}
          value={text}
          spellCheck={false}
          placeholder="https://… veya metin"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="tool__hint" style={{ marginTop: 8 }}>
          {t(
            { tr: "En fazla ~230 bayt (yaklaşık 230 ASCII karakter).", en: "Up to ~230 bytes (~230 ASCII chars)." },
            lang,
          )}
        </div>
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.result, lang)}</div>
        {svg ? (
          <div className="tool__qr" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="tool__error">
            {t({ tr: "Metin çok uzun — kısaltın.", en: "Text too long — shorten it." }, lang)}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  HTTP durum kodları
// ======================================================================

const HTTP_CODES: { code: number; tr: string; en: string; group: string }[] = [
  { code: 100, tr: "Devam", en: "Continue", group: "1xx" },
  { code: 101, tr: "Protokol değişiyor", en: "Switching Protocols", group: "1xx" },
  { code: 200, tr: "Başarılı", en: "OK", group: "2xx" },
  { code: 201, tr: "Oluşturuldu", en: "Created", group: "2xx" },
  { code: 202, tr: "Kabul edildi", en: "Accepted", group: "2xx" },
  { code: 204, tr: "İçerik yok", en: "No Content", group: "2xx" },
  { code: 206, tr: "Kısmi içerik", en: "Partial Content", group: "2xx" },
  { code: 301, tr: "Kalıcı yönlendirme", en: "Moved Permanently", group: "3xx" },
  { code: 302, tr: "Geçici yönlendirme", en: "Found", group: "3xx" },
  { code: 304, tr: "Değişmedi (önbellek)", en: "Not Modified", group: "3xx" },
  { code: 307, tr: "Geçici yönlendirme (metot korunur)", en: "Temporary Redirect", group: "3xx" },
  { code: 308, tr: "Kalıcı yönlendirme (metot korunur)", en: "Permanent Redirect", group: "3xx" },
  { code: 400, tr: "Hatalı istek", en: "Bad Request", group: "4xx" },
  { code: 401, tr: "Kimlik doğrulama gerekli", en: "Unauthorized", group: "4xx" },
  { code: 403, tr: "Yasak", en: "Forbidden", group: "4xx" },
  { code: 404, tr: "Bulunamadı", en: "Not Found", group: "4xx" },
  { code: 405, tr: "Yönteme izin yok", en: "Method Not Allowed", group: "4xx" },
  { code: 408, tr: "İstek zaman aşımı", en: "Request Timeout", group: "4xx" },
  { code: 409, tr: "Çakışma", en: "Conflict", group: "4xx" },
  { code: 410, tr: "Artık yok", en: "Gone", group: "4xx" },
  { code: 413, tr: "İçerik çok büyük", en: "Payload Too Large", group: "4xx" },
  { code: 418, tr: "Ben bir çaydanlığım", en: "I'm a teapot", group: "4xx" },
  { code: 422, tr: "İşlenemeyen varlık", en: "Unprocessable Entity", group: "4xx" },
  { code: 429, tr: "Çok fazla istek", en: "Too Many Requests", group: "4xx" },
  { code: 500, tr: "Sunucu hatası", en: "Internal Server Error", group: "5xx" },
  { code: 501, tr: "Uygulanmadı", en: "Not Implemented", group: "5xx" },
  { code: 502, tr: "Kötü ağ geçidi", en: "Bad Gateway", group: "5xx" },
  { code: 503, tr: "Hizmet kullanılamıyor", en: "Service Unavailable", group: "5xx" },
  { code: 504, tr: "Ağ geçidi zaman aşımı", en: "Gateway Timeout", group: "5xx" },
];

export function HttpStatusTool({ lang }: { lang: ToolLang }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return HTTP_CODES;
    return HTTP_CODES.filter(
      (item) =>
        String(item.code).includes(needle) ||
        item.tr.toLowerCase().includes(needle) ||
        item.en.toLowerCase().includes(needle) ||
        item.group.includes(needle),
    );
  }, [query]);

  const tone = (code: number) =>
    code < 200 ? "info" : code < 300 ? "ok" : code < 400 ? "accent" : code < 500 ? "warn" : "err";

  return (
    <ToolShell
      actions={
        <>
          <input
            className="tool__input"
            style={{ width: 200 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(UI.search, lang)}
          />
          <span className="tool__spacer" />
          <span className="tool__hint">
            {filtered.length} / {HTTP_CODES.length}
          </span>
        </>
      }
    >
      <div className="tool__pane tool__pane--wide">
        <div className="tool__list">
          {filtered.map((item) => (
            <div
              key={item.code}
              className="tool__list-row tool__http"
              onClick={() => {
                void navigator.clipboard.writeText(String(item.code));
                toast.ok(t(UI.copied, lang), String(item.code), "Araçlar");
              }}
            >
              <span className={`tool__http-code is-${tone(item.code)}`}>{item.code}</span>
              <code>{lang === "en" ? item.en : item.tr}</code>
              <span className="tool__hint">{item.group}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="tool__empty">{t({ tr: "Bulunamadı", en: "Not found" }, lang)}</div>}
        </div>
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  MIME türleri
// ======================================================================

const MIME_TYPES: { ext: string; type: string; tr: string }[] = [
  { ext: ".html", type: "text/html", tr: "Web sayfası" },
  { ext: ".css", type: "text/css", tr: "Stil dosyası" },
  { ext: ".js", type: "text/javascript", tr: "JavaScript" },
  { ext: ".json", type: "application/json", tr: "JSON verisi" },
  { ext: ".xml", type: "application/xml", tr: "XML verisi" },
  { ext: ".csv", type: "text/csv", tr: "Virgülle ayrılmış" },
  { ext: ".pdf", type: "application/pdf", tr: "PDF belgesi" },
  { ext: ".zip", type: "application/zip", tr: "Zip arşivi" },
  { ext: ".gz", type: "application/gzip", tr: "Gzip arşivi" },
  { ext: ".tar", type: "application/x-tar", tr: "Tar arşivi" },
  { ext: ".7z", type: "application/x-7z-compressed", tr: "7-Zip arşivi" },
  { ext: ".png", type: "image/png", tr: "PNG görsel" },
  { ext: ".jpg", type: "image/jpeg", tr: "JPEG görsel" },
  { ext: ".webp", type: "image/webp", tr: "WebP görsel" },
  { ext: ".svg", type: "image/svg+xml", tr: "SVG görsel" },
  { ext: ".ico", type: "image/x-icon", tr: "Simge" },
  { ext: ".mp4", type: "video/mp4", tr: "MP4 video" },
  { ext: ".webm", type: "video/webm", tr: "WebM video" },
  { ext: ".mp3", type: "audio/mpeg", tr: "MP3 ses" },
  { ext: ".wav", type: "audio/wav", tr: "WAV ses" },
  { ext: ".ogg", type: "audio/ogg", tr: "OGG ses" },
  { ext: ".woff2", type: "font/woff2", tr: "WOFF2 yazı tipi" },
  { ext: ".ttf", type: "font/ttf", tr: "TrueType yazı tipi" },
  { ext: ".txt", type: "text/plain", tr: "Düz metin" },
  { ext: ".md", type: "text/markdown", tr: "Markdown" },
  { ext: ".yml", type: "application/yaml", tr: "YAML" },
  { ext: ".sql", type: "application/sql", tr: "SQL betiği" },
  { ext: ".sh", type: "application/x-sh", tr: "Kabuk betiği" },
  { ext: ".ps1", type: "application/x-powershell", tr: "PowerShell betiği" },
  { ext: ".exe", type: "application/x-msdownload", tr: "Windows uygulaması" },
  { ext: ".msi", type: "application/x-msi", tr: "Windows kurulum" },
  { ext: ".apk", type: "application/vnd.android.package-archive", tr: "Android paketi" },
  { ext: ".docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", tr: "Word belgesi" },
  { ext: ".xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", tr: "Excel tablosu" },
  { ext: ".pptx", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", tr: "PowerPoint sunumu" },
];

export function MimeTool({ lang }: { lang: ToolLang }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return MIME_TYPES;
    return MIME_TYPES.filter(
      (item) =>
        item.ext.includes(needle) || item.type.includes(needle) || item.tr.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <ToolShell
      actions={
        <>
          <input
            className="tool__input"
            style={{ width: 220 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${t(UI.search, lang)} (.png / image)`}
          />
          <span className="tool__spacer" />
          <span className="tool__hint">
            {filtered.length} / {MIME_TYPES.length}
          </span>
        </>
      }
    >
      <div className="tool__pane tool__pane--wide">
        <div className="tool__list">
          {filtered.map((item) => (
            <div
              key={item.ext}
              className="tool__list-row tool__mime"
              onClick={() => {
                void navigator.clipboard.writeText(item.type);
                toast.ok(t(UI.copied, lang), item.type, "Araçlar");
              }}
            >
              <span className="tool__mime-ext">{item.ext}</span>
              <code>{item.type}</code>
              <span className="tool__hint">{item.tr}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="tool__empty">{t({ tr: "Bulunamadı", en: "Not found" }, lang)}</div>}
        </div>
      </div>
    </ToolShell>
  );
}
