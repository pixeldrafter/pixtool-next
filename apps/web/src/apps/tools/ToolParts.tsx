/**
 * Araç uygulamaları — it-tools tarzı yardımcılar.
 *
 * Her araç bağımsız bir bileşendir; `ToolsWindow` seçime göre birini çizer.
 * Tümü tarayıcıda çalışır, sunucuya istek atmaz (QR ve renk hariç hepsi saf).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "../../notifications";
import { t, UI, type ToolLang } from "./tools";
import "./tool-parts.css";

// ======================================================================
//  Ortak parçalar
// ======================================================================

interface ToolShellProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** Sol taraf: girdi, sağ taraf: çıktı */
  split?: boolean;
}

export function ToolShell({ children, actions, split = true }: ToolShellProps) {
  return (
    <div className={`tool${split ? " tool--split" : ""}`}>
      {actions && <div className="tool__actions">{actions}</div>}
      {children}
    </div>
  );
}

/** Kopyalama düğmesi. */
function CopyButton({ value, lang }: { value: string; lang: ToolLang }) {
  return (
    <button
      type="button"
      className="tool__btn"
      disabled={!value}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => toast.ok(t(UI.copied, lang), `${value.length} karakter`, "Araçlar"))
          .catch(() => toast.error("Kopyalanamadı", "", "Araçlar"));
      }}
    >
      ⧉ {t(UI.copy, lang)}
    </button>
  );
}

/** Metin alanı. */
function Area({
  value,
  onChange,
  placeholder,
  rows = 8,
  mono = true,
  readOnly = false,
}: {
  value: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  readOnly?: boolean;
}) {
  return (
    <textarea
      className={`tool__area${mono ? " is-mono" : ""}`}
      value={value}
      rows={rows}
      spellCheck={false}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

// ======================================================================
//  1) Hash üretici
// ======================================================================

const HASH_ALGOS = ["SHA-256", "SHA-512", "SHA-1", "MD5"] as const;

export function HashTool({ lang }: { lang: ToolLang }) {
  const [text, setText] = useState("");
  const [algos, setAlgos] = useState<string[]>(["SHA-256"]);
  const [results, setResults] = useState<{ algo: string; value: string }[]>([]);

  const compute = useCallback(async () => {
    if (!text) {
      setResults([]);
      return;
    }
    const data = new TextEncoder().encode(text);
    const out: { algo: string; value: string }[] = [];

    for (const algo of algos) {
      try {
        const digest = await crypto.subtle.digest(algo, data);
        out.push({
          algo,
          value: Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
        });
      } catch {
        out.push({ algo, value: t({ tr: "desteklenmiyor", en: "unsupported" }, lang) });
      }
    }
    setResults(out);
  }, [algos, lang, text]);

  useEffect(() => {
    void compute();
  }, [compute]);

  return (
    <ToolShell
      actions={
        <>
          {HASH_ALGOS.map((algo) => (
            <label key={algo} className="tool__check">
              <input
                type="checkbox"
                checked={algos.includes(algo)}
                onChange={(event) =>
                  setAlgos((list) =>
                    event.target.checked
                      ? [...list, algo]
                      : list.filter((item) => item !== algo),
                  )
                }
              />
              {algo}
            </label>
          ))}
          <span className="tool__spacer" />
          <button type="button" className="tool__btn" onClick={() => setText("")} disabled={!text}>
            {t(UI.clear, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <Area value={text} onChange={setText} placeholder={t({ tr: "Metni yazın…", en: "Type text…" }, lang)} />
      </div>

      <div className="tool__pane">
        <div className="tool__label">{t(UI.output, lang)}</div>
        {results.length === 0 && <div className="tool__empty">{t(UI.input, lang)}…</div>}
        {results.map((item) => (
          <div key={item.algo} className="tool__result">
            <span className="tool__result-key">{item.algo}</span>
            <code className="tool__result-value">{item.value}</code>
            <CopyButton value={item.value} lang={lang} />
          </div>
        ))}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  2) UUID / ULID
// ======================================================================

function makeUuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** ULID üretir (Crockford base32, zaman sıralı). */
function makeUlid(): string {
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let time = Date.now();
  let timePart = "";
  for (let index = 0; index < 10; index += 1) {
    timePart = ALPHABET[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  const random = crypto.getRandomValues(new Uint8Array(16));
  let randomPart = "";
  for (let index = 0; index < 16; index += 1) {
    randomPart += ALPHABET[random[index] % 32];
  }
  return timePart + randomPart;
}

export function UuidTool({ lang }: { lang: ToolLang }) {
  const [count, setCount] = useState(5);
  const [kind, setKind] = useState<"uuid" | "ulid">("uuid");
  const [list, setList] = useState<string[]>([]);

  const generate = useCallback(() => {
    setList(
      Array.from({ length: count }, () => (kind === "uuid" ? makeUuid() : makeUlid())),
    );
  }, [count, kind]);

  useEffect(generate, [generate]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Tür", en: "Kind" }, lang)}
            <select value={kind} onChange={(event) => setKind(event.target.value as "uuid" | "ulid")}>
              <option value="uuid">UUID v4</option>
              <option value="ulid">ULID</option>
            </select>
          </label>
          <label className="tool__field">
            {t({ tr: "Adet", en: "Count" }, lang)}
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(event) => setCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
            />
          </label>
          <button type="button" className="tool__btn is-primary" onClick={generate}>
            ⟳ {t(UI.generate, lang)}
          </button>
          <span className="tool__spacer" />
          <CopyButton value={list.join("\n")} lang={lang} />
        </>
      }
    >
      <div className="tool__pane tool__pane--wide">
        <div className="tool__list">
          {list.map((value, index) => (
            <div key={index} className="tool__list-row">
              <code>{value}</code>
              <CopyButton value={value} lang={lang} />
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  3) Base64
// ======================================================================

export function Base64Tool({ lang }: { lang: ToolLang }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [urlSafe, setUrlSafe] = useState(false);

  const { output, error } = useMemo(() => {
    if (!input) return { output: "", error: "" };

    try {
      if (mode === "encode") {
        // UTF-8 güvenli
        const bytes = new TextEncoder().encode(input);
        let binary = "";
        bytes.forEach((byte) => {
          binary += String.fromCharCode(byte);
        });
        let encoded = btoa(binary);
        if (urlSafe) encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        return { output: encoded, error: "" };
      }

      let normalized = input.trim().replace(/-/g, "+").replace(/_/g, "/");
      while (normalized.length % 4) normalized += "=";
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return { output: new TextDecoder().decode(bytes), error: "" };
    } catch (caught) {
      return {
        output: "",
        error: caught instanceof Error ? caught.message : String(caught),
      };
    }
  }, [input, mode, urlSafe]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Yön", en: "Direction" }, lang)}
            <select value={mode} onChange={(event) => setMode(event.target.value as "encode" | "decode")}>
              <option value="encode">{t({ tr: "Kodla", en: "Encode" }, lang)}</option>
              <option value="decode">{t({ tr: "Çöz", en: "Decode" }, lang)}</option>
            </select>
          </label>
          <label className="tool__check">
            <input type="checkbox" checked={urlSafe} onChange={(event) => setUrlSafe(event.target.checked)} />
            URL-safe
          </label>
          <span className="tool__spacer" />
          <CopyButton value={output} lang={lang} />
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <Area value={input} onChange={setInput} />
      </div>
      <div className="tool__pane">
        <div className="tool__label">{t(UI.output, lang)}</div>
        {error ? <div className="tool__error">{error}</div> : <Area value={output} readOnly />}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  4) URL kodla/çöz
// ======================================================================

export function UrlTool({ lang }: { lang: ToolLang }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [component, setComponent] = useState(true);

  const { output, error, parts } = useMemo(() => {
    if (!input) return { output: "", error: "", parts: [] as { key: string; value: string }[] };

    try {
      if (mode === "encode") {
        const encoded = component ? encodeURIComponent(input) : encodeURI(input);
        return { output: encoded, error: "", parts: [] };
      }
      const decoded = component ? decodeURIComponent(input) : decodeURI(input);

      // Çözülen adresin parçaları
      const found: { key: string; value: string }[] = [];
      try {
        const url = new URL(decoded);
        found.push({ key: "protocol", value: url.protocol });
        found.push({ key: "host", value: url.host });
        found.push({ key: "path", value: url.pathname });
        found.push({ key: "hash", value: url.hash || "—" });
        url.searchParams.forEach((value, key) => {
          found.push({ key: `?${key}`, value });
        });
      } catch {
        /* adres değil */
      }

      return { output: decoded, error: "", parts: found };
    } catch (caught) {
      return { output: "", error: caught instanceof Error ? caught.message : String(caught), parts: [] };
    }
  }, [input, mode, component]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Yön", en: "Direction" }, lang)}
            <select value={mode} onChange={(event) => setMode(event.target.value as "encode" | "decode")}>
              <option value="encode">{t({ tr: "Kodla", en: "Encode" }, lang)}</option>
              <option value="decode">{t({ tr: "Çöz", en: "Decode" }, lang)}</option>
            </select>
          </label>
          <label className="tool__check">
            <input type="checkbox" checked={component} onChange={(event) => setComponent(event.target.checked)} />
            {t({ tr: "Bileşen modu", en: "Component mode" }, lang)}
          </label>
          <span className="tool__spacer" />
          <CopyButton value={output} lang={lang} />
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <Area value={input} onChange={setInput} />
      </div>
      <div className="tool__pane">
        <div className="tool__label">{t(UI.output, lang)}</div>
        {error ? <div className="tool__error">{error}</div> : <Area value={output} readOnly />}
        {parts.length > 0 && (
          <div className="tool__table">
            {parts.map((part, index) => (
              <div key={index} className="tool__table-row">
                <span>{part.key}</span>
                <code>{part.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  5) JWT çözümleyici
// ======================================================================

export function JwtTool({ lang }: { lang: ToolLang }) {
  const [token, setToken] = useState("");

  const parsed = useMemo(() => {
    const text = token.trim();
    if (!text) return null;

    const parts = text.split(".");
    if (parts.length < 2) {
      return {
        error: t({ tr: "Geçersiz JWT — en az 2 parça olmalı.", en: "Invalid JWT — need 2+ parts." }, lang),
        claims: [] as { key: string; value: string }[],
      };
    }

    const decode = (segment: string) => {
      let normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
      while (normalized.length % 4) normalized += "=";
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return JSON.parse(new TextDecoder().decode(bytes));
    };

    try {
      const header = decode(parts[0]);
      const payload = decode(parts[1]);

      const claims: { key: string; value: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      if (typeof payload.exp === "number") {
        claims.push({
          key: "exp",
          value: `${new Date(payload.exp * 1000).toLocaleString("tr-TR")}${
            payload.exp * 1000 < Date.now() ? " ⚠ SÜRESİ GEÇMİŞ" : " ✔ geçerli"
          }`,
        });
      }
      if (typeof payload.iat === "number") {
        claims.push({ key: "iat", value: new Date(payload.iat * 1000).toLocaleString("tr-TR") });
      }
      if (typeof payload.nbf === "number") {
        claims.push({ key: "nbf", value: new Date(payload.nbf * 1000).toLocaleString("tr-TR") });
      }

      return { header, payload, claims, signature: parts[2] ?? "", error: "" };
    } catch (caught) {
      return { error: caught instanceof Error ? caught.message : String(caught), claims: [] as { key: string; value: string }[] };
    }
  }, [token, lang]);

  return (
    <ToolShell
      actions={
        <>
          <span className="tool__hint">
            {t(
              { tr: "İmza doğrulanmaz — yalnızca çözümlenir.", en: "Signature is not verified — decode only." },
              lang,
            )}
          </span>
          <span className="tool__spacer" />
          <button type="button" className="tool__btn" onClick={() => setToken("")} disabled={!token}>
            {t(UI.clear, lang)}
          </button>
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">JWT</div>
        <Area value={token} onChange={setToken} placeholder="eyJhbGciOi…" />
      </div>
      <div className="tool__pane">
        <div className="tool__label">{t(UI.result, lang)}</div>
        {!parsed && <div className="tool__empty">JWT…</div>}
        {parsed && "error" in parsed && <div className="tool__error">{parsed.error}</div>}
        {parsed && "header" in parsed && (
          <>
            {parsed.claims.length > 0 && (
              <div className="tool__table">
                {parsed.claims.map((claim, index) => (
                  <div key={index} className="tool__table-row">
                    <span>{claim.key}</span>
                    <code>{claim.value}</code>
                  </div>
                ))}
              </div>
            )}
            <div className="tool__label" style={{ marginTop: 8 }}>Header</div>
            <Area value={JSON.stringify(parsed.header, null, 2)} rows={5} readOnly />
            <div className="tool__label" style={{ marginTop: 8 }}>Payload</div>
            <Area value={JSON.stringify(parsed.payload, null, 2)} rows={9} readOnly />
          </>
        )}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  6) JSON biçimlendir
// ======================================================================

export function JsonTool({ lang }: { lang: ToolLang }) {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState(2);
  const [mode, setMode] = useState<"pretty" | "minify" | "sort">("pretty");

  const { output, error, stats } = useMemo(() => {
    if (!input.trim()) return { output: "", error: "", stats: "" };

    try {
      const parsed = JSON.parse(input);

      const sortKeys = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(sortKeys);
        if (value && typeof value === "object") {
          return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, item]) => [key, sortKeys(item)]),
          );
        }
        return value;
      };

      const target = mode === "sort" ? sortKeys(parsed) : parsed;
      const text =
        mode === "minify" ? JSON.stringify(target) : JSON.stringify(target, null, indent);

      const count = (value: unknown): { keys: number; arrays: number } => {
        if (Array.isArray(value)) {
          return value.reduce<{ keys: number; arrays: number }>(
            (acc, item) => {
              const inner = count(item);
              return { keys: acc.keys + inner.keys, arrays: acc.arrays + inner.arrays + 1 };
            },
            { keys: 0, arrays: 0 },
          );
        }
        if (value && typeof value === "object") {
          return Object.values(value as Record<string, unknown>).reduce<{ keys: number; arrays: number }>(
            (acc, item) => {
              const inner = count(item);
              return { keys: acc.keys + inner.keys + 1, arrays: acc.arrays + inner.arrays };
            },
            { keys: 0, arrays: 0 },
          );
        }
        return { keys: 0, arrays: 0 };
      };

      const totals = count(parsed);
      return {
        output: text,
        error: "",
        stats: t(
          {
            tr: `${totals.keys} anahtar · ${totals.arrays} dizi · ${text.length} karakter`,
            en: `${totals.keys} keys · ${totals.arrays} arrays · ${text.length} chars`,
          },
          lang,
        ),
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      return { output: "", error: message, stats: "" };
    }
  }, [input, indent, mode, lang]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Mod", en: "Mode" }, lang)}
            <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="pretty">{t({ tr: "Biçimlendir", en: "Prettify" }, lang)}</option>
              <option value="minify">{t({ tr: "Küçült", en: "Minify" }, lang)}</option>
              <option value="sort">{t({ tr: "Anahtarları sırala", en: "Sort keys" }, lang)}</option>
            </select>
          </label>
          <label className="tool__field">
            {t({ tr: "Girinti", en: "Indent" }, lang)}
            <select value={indent} onChange={(event) => setIndent(Number(event.target.value))}>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </label>
          <span className="tool__spacer" />
          <CopyButton value={output} lang={lang} />
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <Area value={input} onChange={setInput} placeholder='{"ornek": 1}' />
      </div>
      <div className="tool__pane">
        <div className="tool__label">
          {t(UI.output, lang)} {stats && <span className="tool__hint">· {stats}</span>}
        </div>
        {error ? <div className="tool__error">{error}</div> : <Area value={output} readOnly rows={14} />}
      </div>
    </ToolShell>
  );
}

// ======================================================================
//  7) JSON ↔ YAML
// ======================================================================

/** Basit YAML üretici (iç içe nesne/dizi). */
function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (value === null) return "null";
  if (typeof value === "string") {
    return /[:#\-{}[\],&*?|<>=!%@`"']/.test(value) || value.trim() !== value
      ? JSON.stringify(value)
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        const rendered = toYaml(item, indent + 1);
        if (rendered.includes("\n")) {
          return `${pad}-${rendered.replace(/^\s*/, " ")}`.replace(/\n\s*$/, "");
        }
        return `${pad}- ${rendered}`;
      })
      .join("\n");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, item]) => {
        const rendered = toYaml(item, indent + 1);
        if (rendered.includes("\n")) {
          return `${pad}${key}:\n${rendered}`;
        }
        return `${pad}${key}: ${rendered}`;
      })
      .join("\n");
  }

  return String(value);
}

/** Basit YAML okuyucu (girinti tabanlı, akış/yorum destekli). */
function fromYaml(text: string): unknown {
  type Line = { indent: number; content: string };
  const lines: Line[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const withoutComment = raw.replace(/\s+#.*$/, "");
    if (!withoutComment.trim()) continue;
    const indent = withoutComment.match(/^\s*/)?.[0].length ?? 0;
    lines.push({ indent, content: withoutComment.trim() });
  }

  let cursor = 0;

  const parseScalar = (raw: string): unknown => {
    const value = raw.trim();
    if (value === "" || value === "~" || value === "null") return null;
    if (value === "true" || value === "yes") return true;
    if (value === "false" || value === "no") return false;
    if (/^-?\d+$/.test(value)) return Number(value);
    if (/^-?\d*\.\d+$/.test(value)) return Number(value);
    if (/^["'].*["']$/.test(value)) return value.slice(1, -1);
    if (value === "[]") return [];
    if (value === "{}") return {};
    return value;
  };

  const parseBlock = (indent: number): unknown => {
    const container: unknown[] | Record<string, unknown> =
      lines[cursor]?.content.startsWith("- ") || lines[cursor]?.content === "-" ? [] : {};

    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.indent < indent) break;

      if (Array.isArray(container)) {
        if (!line.content.startsWith("-")) break;
        const rest = line.content.slice(1).trim();
        cursor += 1;

        if (!rest) {
          container.push(parseBlock(indent + 2));
        } else if (rest.includes(": ")) {
          const [key, ...valueParts] = rest.split(":");
          const item: Record<string, unknown> = {};
          const scalar = valueParts.join(":").trim();
          item[key.trim()] = scalar ? parseScalar(scalar) : parseBlock(indent + 2);
          container.push(item);
        } else {
          container.push(parseScalar(rest));
        }
        continue;
      }

      if (line.indent > indent) {
        cursor += 1;
        continue;
      }

      const match = line.content.match(/^([^:]+):\s*(.*)$/);
      if (!match) break;

      const key = match[1].trim().replace(/^["']|["']$/g, "");
      const rest = match[2];
      cursor += 1;

      (container as Record<string, unknown>)[key] = rest
        ? parseScalar(rest)
        : cursor < lines.length && lines[cursor].indent > indent
          ? parseBlock(lines[cursor].indent)
          : null;
    }

    return container;
  };

  return lines.length ? parseBlock(lines[0].indent) : null;
}

export function JsonYamlTool({ lang }: { lang: ToolLang }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"json2yaml" | "yaml2json">("json2yaml");

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: "", error: "" };

    try {
      if (mode === "json2yaml") {
        return { output: toYaml(JSON.parse(input)), error: "" };
      }
      return { output: JSON.stringify(fromYaml(input), null, 2), error: "" };
    } catch (caught) {
      return { output: "", error: caught instanceof Error ? caught.message : String(caught) };
    }
  }, [input, mode]);

  return (
    <ToolShell
      actions={
        <>
          <label className="tool__field">
            {t({ tr: "Yön", en: "Direction" }, lang)}
            <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="json2yaml">JSON → YAML</option>
              <option value="yaml2json">YAML → JSON</option>
            </select>
          </label>
          <button
            type="button"
            className="tool__btn"
            onClick={() => setInput(mode === "json2yaml" ? '{\n  "ad": "Pixtool",\n  "surum": 1,\n  "ozellikler": ["ssh", "dosya", "envanter"]\n}' : "ad: Pixtool\nsurum: 1\nozellikler:\n  - ssh\n  - dosya")}
          >
            {t(UI.sample, lang)}
          </button>
          <span className="tool__spacer" />
          <CopyButton value={output} lang={lang} />
        </>
      }
    >
      <div className="tool__pane">
        <div className="tool__label">{t(UI.input, lang)}</div>
        <Area value={input} onChange={setInput} rows={14} />
      </div>
      <div className="tool__pane">
        <div className="tool__label">{t(UI.output, lang)}</div>
        {error ? <div className="tool__error">{error}</div> : <Area value={output} readOnly rows={14} />}
      </div>
    </ToolShell>
  );
}
