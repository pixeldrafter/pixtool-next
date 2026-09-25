/**
 * Araç uygulamaları — ikinci grup.
 *
 * Renk, metin, ağ ve geliştirici araçları. Hepsi tarayıcıda çalışır.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "../../notifications";
import { t, UI, type ToolLang } from "./tools";
import { ToolShell } from "./ToolParts";
import "./tool-parts.css";

// ======================================================================
//  Renk dönüştürücü
// ======================================================================

/** HEX → RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, "").trim();
  const full =
    clean.length === 3
      ? clean.split("").map((ch) => ch + ch).join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** RGB → HEX */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

/** RGB → HSL */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return { h: Math.round(hue), s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

/** Göreli parlaklığa göre okunabilir metin rengi */
function readableInk(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#000";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55 ? "#111" : "#fff";
}

export function ColorTool({ lang }: { lang: ToolLang }) {
  const [hex, setHex] = useState("#4cc2ff");
  const [picker, setPicker] = useState("#4cc2ff");

  const rgb = useMemo(() => hexToRgb(hex), [hex]);
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null), [rgb]);

  const rows = useMemo(() => {
    if (!rgb) return [];
    const rgbText = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const hslText = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : "";
    const cmyk = (() => {
      const r = rgb.r / 255;
      const g = rgb.g / 255;
      const b = rgb.b / 255;
      const k = 1 - Math.max(r, g, b);
      if (k === 1) return "cmyk(0%, 0%, 0%, 100%)";
      const c = (1 - r - k) / (1 - k);
      const m = (1 - g - k) / (1 - k);
      const y = (1 - b - k) / (1 - k);
      return `cmyk(${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%)`;
    })();

    return [
      { key: "HEX", value: rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase() },
      { key: "RGB", value: rgbText },
      { key: "HSL", value: hslText },
      { key: "CMYK", value: cmyk },
      {
        key: t({ tr: "Parlaklık", en: "Luminance" }, lang),
        value: ((0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255).toFixed(3),
      },
      {
        key: t({ tr: "Önerilen metin", en: "Suggested ink" }, lang),
        value: readableInk(hex),
      },
    ];
  }, [hex, rgb, hsl, lang]);

  return (
    <ToolShell
      actions={
        <>
          <input
            type="color"
            className="tool__color"
            value={picker}
            onChange={(event) => {
              setPicker(event.target.value);
              setHex(event.target.value);
            }}
            title={t({ tr: "Renk seç", en: "Pick color" }, lang)}
          />
          <span className="tool__spacer" />
          <button
            type="button"
            className="tool__btn"
            onClick={() => {
              void navigator.clipboard.writeText(hex);
              toast.ok(t(UI.copied, lang), hex, "Araçlar");
            }}
          >
            ⧉ {t(UI.copy, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">HEX</div>
        <input
          className="tool__input is-mono"
          value={hex}
          spellCheck={false}
          onChange={(event) => setHex(event.target.value)}
          placeholder="#4cc2ff"
        />
        <div
          className="tool__swatch"
          style={{ background: rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : "transparent", color: readableInk(hex) }}
        >
          {rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : t({ tr: "geçersiz renk", en: "invalid color" }, lang)}
        </div>
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.result, lang)}</div>
        {!rgb && <div className="tool__error">{t({ tr: "Geçersiz HEX değeri", en: "Invalid HEX value" }, lang)}</div>}
        {rgb && (
          <div className="tool__table">
            {rows.map((row) => (
              <div key={row.key} className="tool__table-row">
                <span>{row.key}</span>
                <code>{row.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Metin istatistikleri
// ======================================================================

export function TextStatsTool({ lang }: { lang: ToolLang }) {
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const chars = text.length;
    const noSpaces = text.replace(/\s/g, "").length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentences = text.trim() ? text.split(/[.!?…]+/).filter((part) => part.trim()).length : 0;
    const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter((part) => part.trim()).length : 0;
    const lines = text ? text.split(/\r?\n/).length : 0;

    // En sık kelimeler (Türkçe uyumlu küçük harf)
    const freq = new Map<string, number>();
    for (const word of text.toLocaleLowerCase("tr").match(/[\p{L}\p{N}]+/gu) ?? []) {
      if (word.length < 3) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
    const top = [...freq.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);

    const readingMinutes = Math.max(1, Math.round(words / 200));

    return { chars, noSpaces, words, sentences, paragraphs, lines, top, readingMinutes };
  }, [text]);

  const rows = [
    { key: t({ tr: "Karakter", en: "Characters" }, lang), value: stats.chars },
    { key: t({ tr: "Boşluksuz", en: "Without spaces" }, lang), value: stats.noSpaces },
    { key: t({ tr: "Kelime", en: "Words" }, lang), value: stats.words },
    { key: t({ tr: "Cümle", en: "Sentences" }, lang), value: stats.sentences },
    { key: t({ tr: "Paragraf", en: "Paragraphs" }, lang), value: stats.paragraphs },
    { key: t({ tr: "Satır", en: "Lines" }, lang), value: stats.lines },
    {
      key: t({ tr: "Okuma süresi", en: "Reading time" }, lang),
      value: `${stats.readingMinutes} ${t({ tr: "dk", en: "min" }, lang)}`,
    },
  ];

  return (
    <ToolShell
      actions={
        <>
          <span className="tool__spacer" />
          <button type="button" className="tool__btn" onClick={() => setText("")} disabled={!text}>
            {t(UI.clear, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <textarea
          className="tool__area"
          rows={14}
          value={text}
          spellCheck={false}
          placeholder={t({ tr: "Metni buraya yapıştırın…", en: "Paste text here…" }, lang)}
          onChange={(event) => setText(event.target.value)}
        />
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.result, lang)}</div>
        <div className="tool__table">
          {rows.map((row) => (
            <div key={row.key} className="tool__table-row">
              <span>{row.key}</span>
              <code>{row.value}</code>
            </div>
          ))}
        </div>

        {stats.top.length > 0 && (
          <>
            <div className="tool__label" style={{ marginTop: 10 }}>
              {t({ tr: "En sık kelimeler", en: "Most frequent words" }, lang)}
            </div>
            <div className="tool__chips">
              {stats.top.map(([word, count]) => (
                <span key={word} className="tool__chip">
                  {word} <strong>{count}</strong>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Harf dönüştürücü
// ======================================================================

export function CaseConvertTool({ lang }: { lang: ToolLang }) {
  const [text, setText] = useState("");

  /** Türkçe uyumlu başlık biçimi */
  const toTitle = (value: string) =>
    value
      .split(/(\s+)/)
      .map((chunk) =>
        chunk.trim()
          ? chunk.charAt(0).toLocaleUpperCase("tr") + chunk.slice(1).toLocaleLowerCase("tr")
          : chunk,
      )
      .join("");

  const conversions = useMemo(
    () => [
      { key: t({ tr: "BÜYÜK", en: "UPPER" }, lang), value: text.toLocaleUpperCase("tr") },
      { key: t({ tr: "küçük", en: "lower" }, lang), value: text.toLocaleLowerCase("tr") },
      { key: t({ tr: "Başlık", en: "Title" }, lang), value: toTitle(text) },
      {
        key: t({ tr: "cümle", en: "sentence" }, lang),
        value: text
          .toLocaleLowerCase("tr")
          .replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toLocaleUpperCase("tr")),
      },
      { key: "kebab-case", value: text.trim().toLocaleLowerCase("tr").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "") },
      { key: "snake_case", value: text.trim().toLocaleLowerCase("tr").replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_]/gu, "") },
      {
        key: "camelCase",
        value: text
          .trim()
          .split(/\s+/)
          .map((word, index) =>
            index === 0
              ? word.toLocaleLowerCase("tr")
              : word.charAt(0).toLocaleUpperCase("tr") + word.slice(1).toLocaleLowerCase("tr"),
          )
          .join(""),
      },
      {
        key: "PascalCase",
        value: text
          .trim()
          .split(/\s+/)
          .map((word) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1).toLocaleLowerCase("tr"))
          .join(""),
      },
      { key: t({ tr: "Ters çevir", en: "Reverse" }, lang), value: [...text].reverse().join("") },
    ],
    [text, lang],
  );

  return (
    <ToolShell
      actions={
        <>
          <span className="tool__spacer" />
          <button type="button" className="tool__btn" onClick={() => setText("")} disabled={!text}>
            {t(UI.clear, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <textarea
          className="tool__area"
          rows={14}
          value={text}
          spellCheck={false}
          placeholder={t({ tr: "Metni yazın…", en: "Type text…" }, lang)}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="tool__pane">
        <div className="tool__label">{t(UI.output, lang)}</div>
        <div className="tool__table">
          {conversions.map((row) => (
            <div key={row.key} className="tool__table-row">
              <span>{row.key}</span>
              <code
                className="tool__copyable"
                title={t({ tr: "Kopyalamak için tıkla", en: "Click to copy" }, lang)}
                onClick={() => {
                  void navigator.clipboard.writeText(row.value);
                  toast.ok(t(UI.copied, lang), row.key, "Araçlar");
                }}
              >
                {row.value ? row.value.slice(0, 90) : "—"}
              </code>
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Şifre üretici
// ======================================================================

const SETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digits: "23456789",
  symbols: "!@#$%^&*-_=+?.",
};

/** Şifre gücünü 0-4 arası puanlar (entropi tabanlı). */
function strength(password: string): { score: number; bits: number; label: { tr: string; en: string } } {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 24;
  const bits = password.length ? Math.round(password.length * Math.log2(pool || 1)) : 0;

  if (bits >= 128) return { score: 4, bits, label: { tr: "Çok güçlü", en: "Very strong" } };
  if (bits >= 90) return { score: 3, bits, label: { tr: "Güçlü", en: "Strong" } };
  if (bits >= 60) return { score: 2, bits, label: { tr: "Orta", en: "Medium" } };
  if (bits >= 35) return { score: 1, bits, label: { tr: "Zayıf", en: "Weak" } };
  return { score: 0, bits, label: { tr: "Çok zayıf", en: "Very weak" } };
}

export function PasswordTool({ lang }: { lang: ToolLang }) {
  const [length, setLength] = useState(20);
  const [options, setOptions] = useState({ lower: true, upper: true, digits: true, symbols: true });
  const [password, setPassword] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const generate = useCallback(() => {
    const pool = (Object.keys(SETS) as (keyof typeof SETS)[])
      .filter((key) => options[key])
      .map((key) => SETS[key])
      .join("");

    if (!pool) {
      toast.warn(t({ tr: "En az bir karakter kümesi seçin", en: "Select at least one character set" }, lang), "", "Araçlar");
      return;
    }

    // Kriptografik rastgele seçim
    const bytes = crypto.getRandomValues(new Uint32Array(length));
    const value = Array.from(bytes)
      .map((byte) => pool[byte % pool.length])
      .join("");

    setPassword(value);
    setHistory((list) => [value, ...list].slice(0, 5));
  }, [length, options, lang]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, options]);

  const power = strength(password);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Uzunluk", en: "Length" }, lang)}
            <input
              type="number"
              min={4}
              max={128}
              value={length}
              onChange={(event) => setLength(Math.min(128, Math.max(4, Number(event.target.value) || 20)))}
            />
          </label>
          {(Object.keys(SETS) as (keyof typeof SETS)[]).map((key) => (
            <label key={key} className="tool__check">
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))}
              />
              {key === "lower" ? "a-z" : key === "upper" ? "A-Z" : key === "digits" ? "0-9" : "!@#"}
            </label>
          ))}
          <button type="button" className="tool__btn is-primary" onClick={generate}>
            ⟳ {t(UI.generate, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane tool__pane--wide">
        <div className="tool__label">{t(UI.result, lang)}</div>

        <div className="tool__password">
          <code>{password}</code>
          <button
            type="button"
            className="tool__btn"
            onClick={() => {
              void navigator.clipboard.writeText(password);
              toast.ok(t(UI.copied, lang), "", "Araçlar");
            }}
          >
            ⧉ {t(UI.copy, lang)}
          </button>
        </div>

        <div className={`tool__strength is-${power.score}`}>
          <div className="tool__strength-bar">
            <span style={{ width: `${((power.score + 1) / 5) * 100}%` }} />
          </div>
          <span>
            {t(power.label, lang)} · {power.bits} bit
          </span>
        </div>

        {history.length > 1 && (
          <>
            <div className="tool__label" style={{ marginTop: 12 }}>
              {t({ tr: "Önceki üretimler", en: "Previous outputs" }, lang)}
            </div>
            <div className="tool__list">
              {history.slice(1).map((value, index) => (
                <div key={index} className="tool__list-row">
                  <code>{value}</code>
                  <button
                    type="button"
                    className="tool__btn"
                    onClick={() => {
                      void navigator.clipboard.writeText(value);
                      toast.ok(t(UI.copied, lang), "", "Araçlar");
                    }}
                  >
                    ⧉
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Yüzde hesaplayıcı
// ======================================================================

export function PercentageTool({ lang }: { lang: ToolLang }) {
  const [a, setA] = useState("15");
  const [b, setB] = useState("200");
  const [from, setFrom] = useState("50");
  const [to, setTo] = useState("75");

  const numA = Number(a.replace(",", "."));
  const numB = Number(b.replace(",", "."));
  const numFrom = Number(from.replace(",", "."));
  const numTo = Number(to.replace(",", "."));

  const results = useMemo(() => {
    const out: { key: string; value: string }[] = [];

    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      out.push({
        key: `${numA}% × ${numB}`,
        value: ((numA / 100) * numB).toFixed(4).replace(/\.?0+$/, ""),
      });
      if (numB !== 0) {
        out.push({
          key: `${numA} / ${numB} (%)`,
          value: `${((numA / numB) * 100).toFixed(4).replace(/\.?0+$/, "")}%`,
        });
      }
      if (numA !== 0) {
        out.push({
          key: `${numB} / ${numA} (%)`,
          value: `${((numB / numA) * 100).toFixed(4).replace(/\.?0+$/, "")}%`,
        });
      }
    }

    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      out.push({
        key: `${numB} ${t({ tr: "artış", en: "plus" }, lang)} %${numA}`,
        value: (numB * (1 + numA / 100)).toFixed(4).replace(/\.?0+$/, ""),
      });
      out.push({
        key: `${numB} ${t({ tr: "azalış", en: "minus" }, lang)} %${numA}`,
        value: (numB * (1 - numA / 100)).toFixed(4).replace(/\.?0+$/, ""),
      });
    }

    if (!Number.isNaN(numFrom) && !Number.isNaN(numTo) && numFrom !== 0) {
      out.push({
        key: `${numFrom} → ${numTo} ${t({ tr: "değişim", en: "change" }, lang)}`,
        value: `${(((numTo - numFrom) / numFrom) * 100).toFixed(3).replace(/\.?0+$/, "")}%`,
      });
    }

    return out;
  }, [numA, numB, numFrom, numTo, lang]);

  return (
    <ToolShell
      actions={
        <span className="tool__hint">
          {t(
            { tr: "Ondalık için virgül veya nokta kullanabilirsiniz.", en: "Use comma or dot for decimals." },
            lang,
          )}
        </span>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>

        <div className="tool__grid">
          <label className="tool__field">
            %
            <input className="tool__input" value={a} onChange={(event) => setA(event.target.value)} />
          </label>
          <label className="tool__field">
            {t({ tr: "sayı", en: "number" }, lang)}
            <input className="tool__input" value={b} onChange={(event) => setB(event.target.value)} />
          </label>
          <label className="tool__field">
            {t({ tr: "ilk", en: "from" }, lang)}
            <input className="tool__input" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="tool__field">
            {t({ tr: "son", en: "to" }, lang)}
            <input className="tool__input" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.result, lang)}</div>
        <div className="tool__table">
          {results.map((row) => (
            <div key={row.key} className="tool__table-row">
              <span>{row.key}</span>
              <code>{row.value}</code>
            </div>
          ))}
          {results.length === 0 && <div className="tool__empty">{t(UI.input, lang)}…</div>}
        </div>
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Zaman damgası
// ======================================================================

export function TimestampTool({ lang }: { lang: ToolLang }) {
  const [value, setValue] = useState(String(Math.floor(Date.now() / 1000)));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const parsed = useMemo(() => {
    const text = value.trim();
    if (!text) return null;

    // Saniye mi milisaniye mi?
    const asNumber = Number(text);
    if (!Number.isNaN(asNumber) && text.split(".").length === 1) {
      const ms = text.length >= 13 ? asNumber : asNumber * 1000;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : { date, source: text.length >= 13 ? "ms" : "s" };
    }

    // Tarih metni olarak dene
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : { date, source: "metin" };
  }, [value]);

  const rows = useMemo(() => {
    if (!parsed) return [];
    const { date } = parsed;
    return [
      { key: "ISO 8601", value: date.toISOString() },
      { key: t({ tr: "Yerel", en: "Local" }, lang), value: date.toLocaleString("tr-TR") },
      { key: t({ tr: "UTC", en: "UTC" }, lang), value: date.toUTCString() },
      { key: "Unix (s)", value: String(Math.floor(date.getTime() / 1000)) },
      { key: "Unix (ms)", value: String(date.getTime()) },
      {
        key: t({ tr: "Geçen süre", en: "Relative" }, lang),
        value: (() => {
          const diff = Date.now() - date.getTime();
          const abs = Math.abs(diff);
          const units: [number, string, string][] = [
            [1000 * 60 * 60 * 24 * 365, "yıl", "year"],
            [1000 * 60 * 60 * 24 * 30, "ay", "month"],
            [1000 * 60 * 60 * 24, "gün", "day"],
            [1000 * 60 * 60, "saat", "hour"],
            [1000 * 60, "dakika", "minute"],
          ];
          for (const [ms, tr, en] of units) {
            if (abs >= ms) {
              const count = Math.floor(abs / ms);
              const label = lang === "en" ? en : tr;
              return diff > 0 ? `${count} ${label} ${lang === "en" ? "ago" : "önce"}` : `${count} ${label} ${lang === "en" ? "later" : "sonra"}`;
            }
          }
          return lang === "en" ? "just now" : "az önce";
        })(),
      },
    ];
  }, [parsed, lang]);

  return (
    <ToolShell
      actions={
        <>
          <button
            type="button"
            className="tool__btn is-primary"
            onClick={() => setValue(String(Math.floor(Date.now() / 1000)))}
          >
            {t({ tr: "Şimdi", en: "Now" }, lang)}
          </button>
          <span className="tool__spacer" />
          <span className="tool__hint">
            {t({ tr: "Şu an", en: "Current" }, lang)}: {Math.floor(now / 1000)}
          </span>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">
          {t({ tr: "Zaman damgası veya tarih", en: "Timestamp or date" }, lang)}
        </div>
        <input
          className="tool__input is-mono"
          value={value}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          placeholder="1790000000 / 2026-09-25T14:30:00Z"
        />
        {parsed && (
          <div className="tool__hint" style={{ marginTop: 6 }}>
            {t({ tr: "Algılanan tür", en: "Detected" }, lang)}: {parsed.source}
          </div>
        )}
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.result, lang)}</div>
        {!parsed && <div className="tool__error">{t({ tr: "Çözümlenemedi", en: "Could not parse" }, lang)}</div>}
        {rows.length > 0 && (
          <div className="tool__table">
            {rows.map((row) => (
              <div key={row.key} className="tool__table-row">
                <span>{row.key}</span>
                <code>{row.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  IPv4 subnet hesaplayıcı
// ======================================================================

export function SubnetTool({ lang }: { lang: ToolLang }) {
  const [cidr, setCidr] = useState("192.168.1.10/24");

  const info = useMemo(() => {
    const match = cidr.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/);
    if (!match) return null;

    const octets = [match[1], match[2], match[3], match[4]].map(Number);
    if (octets.some((value) => value > 255)) return null;

    const prefix = match[5] !== undefined ? Number(match[5]) : 24;
    if (prefix > 32) return null;

    const ip =
      ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - prefix);
    const usable = prefix >= 31 ? total : Math.max(0, total - 2);

    const toIp = (value: number) =>
      [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");

    const isPrivate =
      (octets[0] === 10) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);

    const classHint =
      octets[0] < 128 ? "A" : octets[0] < 192 ? "B" : octets[0] < 224 ? "C" : octets[0] < 240 ? "D (multicast)" : "E";

    return {
      ip: toIp(ip),
      prefix,
      mask: toIp(mask),
      network: toIp(network),
      broadcast: toIp(broadcast),
      first: prefix >= 31 ? toIp(network) : toIp(network + 1),
      last: prefix >= 31 ? toIp(broadcast) : toIp(broadcast - 1),
      total,
      usable,
      wildcard: toIp(~mask >>> 0),
      isPrivate,
      classHint,
      binary: octets.map((value) => value.toString(2).padStart(8, "0")).join("."),
    };
  }, [cidr]);

  const rows = info
    ? [
        { key: t({ tr: "Ağ adresi", en: "Network" }, lang), value: `${info.network}/${info.prefix}` },
        { key: t({ tr: "Alt ağ maskesi", en: "Netmask" }, lang), value: info.mask },
        { key: t({ tr: "Joker maskesi", en: "Wildcard" }, lang), value: info.wildcard },
        { key: t({ tr: "Yayın adresi", en: "Broadcast" }, lang), value: info.broadcast },
        { key: t({ tr: "İlk kullanılabilir", en: "First usable" }, lang), value: info.first },
        { key: t({ tr: "Son kullanılabilir", en: "Last usable" }, lang), value: info.last },
        { key: t({ tr: "Toplam adres", en: "Total addresses" }, lang), value: String(info.total) },
        { key: t({ tr: "Kullanılabilir", en: "Usable" }, lang), value: String(info.usable) },
        { key: t({ tr: "Sınıf", en: "Class" }, lang), value: info.classHint },
        {
          key: t({ tr: "Özel ağ", en: "Private" }, lang),
          value: info.isPrivate ? (lang === "en" ? "yes" : "evet") : lang === "en" ? "no" : "hayır",
        },
        { key: t({ tr: "İkili", en: "Binary" }, lang), value: info.binary },
      ]
    : [];

  return (
    <ToolShell
      actions={
        <>
          <button type="button" className="tool__btn" onClick={() => setCidr("10.0.0.0/8")}>
            10.0.0.0/8
          </button>
          <button type="button" className="tool__btn" onClick={() => setCidr("172.16.5.0/20")}>
            172.16.5.0/20
          </button>
          <button type="button" className="tool__btn" onClick={() => setCidr("192.168.1.10/24")}>
            192.168.1.10/24
          </button>
          <span className="tool__spacer" />
          <span className="tool__hint">CIDR</span>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <input
          className="tool__input is-mono"
          value={cidr}
          spellCheck={false}
          onChange={(event) => setCidr(event.target.value)}
          placeholder="192.168.1.10/24"
        />
        {!info && cidr.trim() && (
          <div className="tool__error" style={{ marginTop: 8 }}>
            {t({ tr: "Geçersiz IPv4 / önek", en: "Invalid IPv4 / prefix" }, lang)}
          </div>
        )}
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.result, lang)}</div>
        {rows.length > 0 ? (
          <div className="tool__table">
            {rows.map((row) => (
              <div key={row.key} className="tool__table-row">
                <span>{row.key}</span>
                <code>{row.value}</code>
              </div>
            ))}
          </div>
        ) : (
          <div className="tool__empty">{t(UI.input, lang)}…</div>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Sayı tabanı çevirici
// ======================================================================

export function RadixTool({ lang }: { lang: ToolLang }) {
  const [value, setValue] = useState("255");
  const [base, setBase] = useState(10);

  const parsed = useMemo(() => {
    const text = value.trim().replace(/\s/g, "");
    if (!text) return null;

    // Önek desteği: 0x, 0b, 0o
    let sourceBase = base;
    let digits = text;
    if (/^0x/i.test(text)) {
      sourceBase = 16;
      digits = text.slice(2);
    } else if (/^0b/i.test(text)) {
      sourceBase = 2;
      digits = text.slice(2);
    } else if (/^0o/i.test(text)) {
      sourceBase = 8;
      digits = text.slice(2);
    }

    const number = parseInt(digits, sourceBase);
    if (Number.isNaN(number) || number < 0) return null;

    return {
      decimal: number,
      binary: number.toString(2),
      octal: number.toString(8),
      hex: number.toString(16).toUpperCase(),
      base32: number.toString(32).toUpperCase(),
      base36: number.toString(36).toUpperCase(),
      bytes: (() => {
        const hex = number.toString(16).padStart(Math.ceil(number.toString(16).length / 2) * 2, "0");
        return hex.match(/.{2}/g)?.join(" ") ?? "";
      })(),
      ascii: number >= 32 && number <= 126 ? String.fromCharCode(number) : "—",
    };
  }, [value, base]);

  const rows = parsed
    ? [
        { key: t({ tr: "Onluk (10)", en: "Decimal (10)" }, lang), value: String(parsed.decimal) },
        { key: t({ tr: "İkilik (2)", en: "Binary (2)" }, lang), value: parsed.binary },
        { key: t({ tr: "Sekizlik (8)", en: "Octal (8)" }, lang), value: parsed.octal },
        { key: t({ tr: "Onaltılık (16)", en: "Hex (16)" }, lang), value: `0x${parsed.hex}` },
        { key: "Base32", value: parsed.base32 },
        { key: "Base36", value: parsed.base36 },
        { key: t({ tr: "Baytlar", en: "Bytes" }, lang), value: parsed.bytes },
        { key: "ASCII", value: parsed.ascii },
      ]
    : [];

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Girdi tabanı", en: "Input base" }, lang)}
            <select value={base} onChange={(event) => setBase(Number(event.target.value))}>
              {[2, 8, 10, 16].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <span className="tool__spacer" />
          <span className="tool__hint">0x · 0b · 0o</span>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <input
          className="tool__input is-mono"
          value={value}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          placeholder="255 / 0xFF / 0b11111111"
        />
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.output, lang)}</div>
        {rows.length > 0 ? (
          <div className="tool__table">
            {rows.map((row) => (
              <div key={row.key} className="tool__table-row">
                <span>{row.key}</span>
                <code>{row.value}</code>
              </div>
            ))}
          </div>
        ) : (
          <div className="tool__empty">{t(UI.input, lang)}…</div>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Regex test aracı
// ======================================================================

export function RegexTool({ lang }: { lang: ToolLang }) {
  const [pattern, setPattern] = useState("(\\w+)@(\\w+\\.\\w+)");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("iletisim@pixtool.com ve destek@omercataloglu.com");

  const result = useMemo(() => {
    if (!pattern.trim()) return { matches: [], error: "" };
    try {
      const regex = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
      const matches: { match: string; index: number; groups: string[] }[] = [];

      for (const found of text.matchAll(regex)) {
        matches.push({
          match: found[0],
          index: found.index ?? 0,
          groups: found.slice(1).map((group) => group ?? "—"),
        });
        if (matches.length >= 200) break;
      }

      return {
        matches,
        error: "",
        highlighted: text.replace(regex, (found) => `⟦${found}⟧`),
      };
    } catch (caught) {
      return { matches: [], error: caught instanceof Error ? caught.message : String(caught), highlighted: "" };
    }
  }, [pattern, flags, text]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Bayraklar", en: "Flags" }, lang)}
            <input
              className="tool__input"
              style={{ width: 80 }}
              value={flags}
              onChange={(event) => setFlags(event.target.value.replace(/[^gimsuy]/g, ""))}
              placeholder="gi"
            />
          </label>
          <span className="tool__spacer" />
          <span className="tool__hint">
            {result.matches.length} {t({ tr: "eşleşme", en: "matches" }, lang)}
          </span>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t({ tr: "Desen", en: "Pattern" }, lang)}</div>
        <input
          className="tool__input is-mono"
          value={pattern}
          spellCheck={false}
          onChange={(event) => setPattern(event.target.value)}
        />

        <div className="tool__label" style={{ marginTop: 10 }}>
          {t({ tr: "Test metni", en: "Test text" }, lang)}
        </div>
        <textarea
          className="tool__area"
          rows={9}
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
        />

        {result.error && <div className="tool__error">{result.error}</div>}

        {!result.error && result.highlighted && (
          <>
            <div className="tool__label" style={{ marginTop: 10 }}>
              {t({ tr: "İşaretli", en: "Highlighted" }, lang)}
            </div>
            <div className="tool__highlight">{result.highlighted}</div>
          </>
        )}
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t({ tr: "Eşleşmeler", en: "Matches" }, lang)}</div>
        {result.matches.length === 0 && <div className="tool__empty">{t({ tr: "Eşleşme yok", en: "No match" }, lang)}</div>}
        <div className="tool__list">
          {result.matches.map((item, index) => (
            <div key={index} className="tool__list-row">
              <span className="tool__list-index">#{index + 1}</span>
              <code>{item.match}</code>
              <span className="tool__hint">@{item.index}</span>
              {item.groups.length > 0 && (
                <span className="tool__hint">
                  ({item.groups.map((group) => group).join(", ")})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Cron açıklayıcı
// ======================================================================

const CRON_MONTHS = "Ocak Şubat Mart Nisan Mayıs Haziran Temmuz Ağustos Eylül Ekim Kasım Aralık".split(" ");
const CRON_DAYS = "Pazar Pazartesi Salı Çarşamba Perşembe Cuma Cumartesi".split(" ");

/** Cron alanını insan diline çevirir. */
function describeField(field: string, kind: "minute" | "hour" | "dom" | "month" | "dow", lang: ToolLang): string {
  const tr = lang !== "en";
  if (field === "*") return tr ? "her" : "every";
  if (field.startsWith("*/")) return tr ? `her ${field.slice(2)}` : `every ${field.slice(2)}`;
  if (field.includes("-")) {
    const [start, end] = field.split("-");
    return tr ? `${start}–${end} arası` : `${start}–${end}`;
  }
  if (field.includes(",")) return field.split(",").join(", ");
  if (kind === "month") {
    const index = Number(field) - 1;
    return CRON_MONTHS[index] ?? field;
  }
  if (kind === "dow") {
    return CRON_DAYS[Number(field) % 7] ?? field;
  }
  return field;
}

export function CronTool({ lang }: { lang: ToolLang }) {
  const [expression, setExpression] = useState("0 3 * * 1-5");

  const parsed = useMemo(() => {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return { error: t({ tr: "5 alan gerekli: dakika saat gün-ay ay gün-hafta", en: "5 fields required: min hour dom month dow" }, lang) };
    }

    const [minute, hour, dom, month, dow] = parts;
    const tr = lang !== "en";

    const pieces: string[] = [];
    pieces.push(
      tr
        ? `${describeField(minute, "minute", lang)} dakikada`
        : `${describeField(minute, "minute", lang)} minute`,
    );
    if (hour !== "*") pieces.push(tr ? `${describeField(hour, "hour", lang)} saatte` : `hour ${describeField(hour, "hour", lang)}`);
    if (dom !== "*") pieces.push(tr ? `ayın ${describeField(dom, "dom", lang)}. günü` : `day-of-month ${describeField(dom, "dom", lang)}`);
    if (month !== "*") pieces.push(tr ? `${describeField(month, "month", lang)} ayında` : `in ${describeField(month, "month", lang)}`);
    if (dow !== "*") pieces.push(tr ? `${describeField(dow, "dow", lang)} günü` : `on ${describeField(dow, "dow", lang)}`);

    // Sonraki çalışma zamanlarını kaba tahminle bul
    const next: string[] = [];
    const now = new Date();
    for (let minutes = 0; minutes < 60 * 24 * 8 && next.length < 5; minutes += 1) {
      const candidate = new Date(now.getTime() + minutes * 60 * 1000);
      candidate.setSeconds(0, 0);

      const matchPart = (field: string, value: number, max: number): boolean => {
        if (field === "*") return true;
        if (field.startsWith("*/")) {
          const step = Number(field.slice(2));
          return step > 0 && value % step === 0;
        }
        if (field.includes(",")) return field.split(",").some((piece) => matchPart(piece, value, max));
        if (field.includes("-")) {
          const [start, end] = field.split("-").map(Number);
          return value >= start && value <= end;
        }
        return Number(field) === value % (max + 1);
      };

      if (
        matchPart(minute, candidate.getMinutes(), 59) &&
        matchPart(hour, candidate.getHours(), 23) &&
        matchPart(dom, candidate.getDate(), 31) &&
        matchPart(month, candidate.getMonth() + 1, 12) &&
        matchPart(dow, candidate.getDay(), 6)
      ) {
        next.push(candidate.toLocaleString("tr-TR"));
        minutes += 59; // aynı saat içinde tekrar arama
      }
    }

    return { description: pieces.join(" · "), next };
  }, [expression, lang]);

  return (
    <ToolShell
      actions={
        <>
          {["*/5 * * * *", "0 3 * * *", "0 3 * * 1-5", "0 0 1 * *", "30 9 * * 1"].map((sample) => (
            <button key={sample} type="button" className="tool__btn" onClick={() => setExpression(sample)}>
              {sample}
            </button>
          ))}
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t({ tr: "Cron ifadesi", en: "Cron expression" }, lang)}</div>
        <input
          className="tool__input is-mono"
          value={expression}
          spellCheck={false}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="0 3 * * 1-5"
        />
        <div className="tool__hint" style={{ marginTop: 8 }}>
          {t(
            { tr: "dakika · saat · ayın günü · ay · haftanın günü", en: "minute · hour · day-of-month · month · day-of-week" },
            lang,
          )}
        </div>

        {parsed && "description" in parsed && (
          <div className="tool__description">{parsed.description}</div>
        )}
        {parsed && "error" in parsed && <div className="tool__error">{parsed.error}</div>}
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t({ tr: "Sonraki çalışmalar", en: "Next runs" }, lang)}</div>
        {parsed && "next" in parsed && parsed.next?.length ? (
          <div className="tool__list">
            {parsed.next.map((item, index) => (
              <div key={index} className="tool__list-row">
                <span className="tool__list-index">#{index + 1}</span>
                <code>{item}</code>
              </div>
            ))}
          </div>
        ) : (
          <div className="tool__empty">{t({ tr: "Hesaplanamadı", en: "Could not compute" }, lang)}</div>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  Temel kimlik başlığı
// ======================================================================

export function HtpasswdTool({ lang }: { lang: ToolLang }) {
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("pixtool123");

  const { header, decoded } = useMemo(() => {
    if (!user || !password) return { header: "", decoded: "" };
    const raw = `${user}:${password}`;
    const bytes = new TextEncoder().encode(raw);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const encoded = btoa(binary);
    return { header: `Basic ${encoded}`, decoded: `${encoded.slice(0, 24)}…` };
  }, [user, password]);

  return (
    <ToolShell
      actions={
        <>
          <span className="tool__hint">
            {t(
              { tr: "Yalnızca HTTPS üzerinden kullanın.", en: "Use over HTTPS only." },
              lang,
            )}
          </span>
          <span className="tool__spacer" />
          <button
            type="button"
            className="tool__btn"
            disabled={!header}
            onClick={() => {
              void navigator.clipboard.writeText(header);
              toast.ok(t(UI.copied, lang), "Authorization", "Araçlar");
            }}
          >
            ⧉ {t(UI.copy, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <label className="tool__field">
          {t({ tr: "Kullanıcı", en: "Username" }, lang)}
          <input className="tool__input" value={user} onChange={(event) => setUser(event.target.value)} />
        </label>
        <label className="tool__field" style={{ marginTop: 8 }}>
          {t({ tr: "Parola", en: "Password" }, lang)}
          <input
            className="tool__input"
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className="tool__hint" style={{ marginTop: 8 }}>
          {t(
            { tr: "Base64 kodlaması şifreleme değildir — yalnızca kimlik taşır.", en: "Base64 is not encryption — it only carries credentials." },
            lang,
          )}
        </div>
      </div>

      <div className="tool__pane">
        <div className="tool__label">Authorization</div>
        <div className="tool__password">
          <code>{header || "—"}</code>
        </div>
        {decoded && (
          <div className="tool__table" style={{ marginTop: 8 }}>
            <div className="tool__table-row">
              <span>Base64</span>
              <code>{decoded}</code>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
