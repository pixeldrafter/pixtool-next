/**
 * Araçlar — it-tools tarzı geliştirici araç seti.
 *
 * • 26 araç, 5 kategori (Kripto · Dönüştürücü · Metin · Ağ · Geliştirici)
 * • Her araç **TR/EN** — dil tepesinden seçilir, seçim saklanır
 * • Arama ile hızlı bulma
 * • Son kullanılan araç ve dil `localStorage`'da kalıcı
 */

import { useEffect, useMemo, useState } from "react";

import { Base64Tool, HashTool, JsonTool, JsonYamlTool, JwtTool, UuidTool, UrlTool } from "./ToolParts";
import {
  CaseConvertTool,
  ColorTool,
  CronTool,
  HtpasswdTool,
  PasswordTool,
  PercentageTool,
  RadixTool,
  RegexTool,
  SubnetTool,
  TextStatsTool,
  TimestampTool,
} from "./ToolParts2";
import { HttpStatusTool, LoremTool, MimeTool, QrcodeTool } from "./ToolParts3";
import { pick, TOOLS, UI, type ToolId, type ToolLang } from "./tools";
import "../apps.css";
import "./tools-window.css";
import "./tool-parts.css";

const STORAGE_KEY = "pixtool.tools.active";
const LANG_KEY = "pixtool.tools.lang";

function loadActive(): ToolId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && TOOLS.some((tool) => tool.id === raw)) return raw as ToolId;
  } catch {
    /* yoksay */
  }
  return "hash";
}

function loadLang(): ToolLang {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    if (raw === "tr" || raw === "en") return raw;
  } catch {
    /* yoksay */
  }
  return "tr";
}

/** Araç kimliği → bileşen. */
function renderTool(id: ToolId, lang: ToolLang): React.ReactElement {
  switch (id) {
    case "hash":
      return <HashTool lang={lang} />;
    case "uuid":
      return <UuidTool lang={lang} />;
    case "base64":
      return <Base64Tool lang={lang} />;
    case "url":
      return <UrlTool lang={lang} />;
    case "jwt":
      return <JwtTool lang={lang} />;
    case "json":
      return <JsonTool lang={lang} />;
    case "jsonYaml":
      return <JsonYamlTool lang={lang} />;
    case "color":
      return <ColorTool lang={lang} />;
    case "textStats":
      return <TextStatsTool lang={lang} />;
    case "caseConvert":
      return <CaseConvertTool lang={lang} />;
    case "password":
      return <PasswordTool lang={lang} />;
    case "regex":
      return <RegexTool lang={lang} />;
    case "cron":
      return <CronTool lang={lang} />;
    case "subnet":
      return <SubnetTool lang={lang} />;
    case "timestamp":
      return <TimestampTool lang={lang} />;
    case "radix":
      return <RadixTool lang={lang} />;
    case "percentage":
      return <PercentageTool lang={lang} />;
    case "qrcode":
      return <QrcodeTool lang={lang} />;
    case "lorem":
      return <LoremTool lang={lang} />;
    case "mime":
      return <MimeTool lang={lang} />;
    case "httpStatus":
      return <HttpStatusTool lang={lang} />;
    case "htpasswd":
      return <HtpasswdTool lang={lang} />;
    default:
      return <HashTool lang={lang} />;
  }
}

export function ToolsWindow() {
  const [active, setActive] = useState<ToolId>(loadActive);
  const [lang, setLang] = useState<ToolLang>(loadLang);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, active);
    } catch {
      /* yoksay */
    }
  }, [active]);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* yoksay */
    }
  }, [lang]);

  /** Kategoriye göre gruplanmış, aramaya uyan araçlar. */
  const grouped = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    const matching = needle
      ? TOOLS.filter(
          (tool) =>
            pick(tool.name, lang).toLocaleLowerCase("tr").includes(needle) ||
            pick(tool.group, lang).toLocaleLowerCase("tr").includes(needle) ||
            tool.id.includes(needle),
        )
      : TOOLS;

    const map = new Map<string, typeof TOOLS>();
    for (const tool of matching) {
      const group = pick(tool.group, lang);
      const list = map.get(group) ?? [];
      list.push(tool);
      map.set(group, list);
    }
    return [...map.entries()];
  }, [query, lang]);

  const current = TOOLS.find((tool) => tool.id === active) ?? TOOLS[0];

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Araçlar</h2>
        <span className="app__subtitle">
          {TOOLS.length} {lang === "en" ? "tools" : "araç"} · {pick(current.group, lang)}
        </span>

        <span className="app__spacer" />

        <input
          className="app-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={lang === "en" ? UI.search.en : UI.search.tr}
        />

        {/* Dil seçimi */}
        <div className="tools__lang" role="group" aria-label="Araç dili">
          <button
            type="button"
            className={`tools__lang-btn${lang === "tr" ? " is-active" : ""}`}
            onClick={() => setLang("tr")}
            title="Türkçe"
          >
            🇹🇷 TR
          </button>
          <button
            type="button"
            className={`tools__lang-btn${lang === "en" ? " is-active" : ""}`}
            onClick={() => setLang("en")}
            title="English"
          >
            🇬🇧 EN
          </button>
        </div>
      </div>

      <div className="tools__layout">
        {/* --- Araç listesi (kategorili) --- */}
        <aside className="tools__sidebar">
          {grouped.length === 0 && <div className="tools__empty">{UI.search[lang]}…</div>}
          {grouped.map(([group, items]) => (
            <div key={group} className="tools__group">
              <div className="tools__group-title">{group}</div>
              {items.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={`tools__item${active === tool.id ? " is-active" : ""}`}
                  onClick={() => setActive(tool.id)}
                  title={pick(tool.name, lang)}
                >
                  <span className="tools__item-icon">{tool.icon}</span>
                  <span className="tools__item-label">{pick(tool.name, lang)}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* --- Araç içeriği --- */}
        <section className="tools__content">
          <div className="tools__head">
            <span className="tools__head-icon">{current.icon}</span>
            <span className="tools__head-name">{pick(current.name, lang)}</span>
            <span className="app__spacer" />
            <span className="tools__head-group">{pick(current.group, lang)}</span>
          </div>
          <div className="tools__body">{renderTool(active, lang)}</div>
        </section>
      </div>
    </div>
  );
}
