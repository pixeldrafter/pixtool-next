/**
 * Araçlar — sekmeli merkez.
 *
 * Hesap makinesi ve üç oyun tek pencerede. Sekme seçimi `localStorage`'da
 * saklanır, böylece pencere yeniden açıldığında aynı araç gelir.
 */

import { useEffect, useState } from "react";

import { Calculator } from "./Calculator";
import { Minesweeper } from "./Minesweeper";
import { Snake } from "./Snake";
import { TicTacToe } from "./TicTacToe";
import "../apps.css";
import "./tools-window.css";

type ToolId = "calculator" | "minesweeper" | "snake" | "xox";

const TOOLS: { id: ToolId; label: string; icon: string; hint: string }[] = [
  { id: "calculator", label: "Hesap Makinesi", icon: "🧮", hint: "Klavye destekli, geçmiş ve bellek" },
  { id: "minesweeper", label: "Mayın Tarlası", icon: "💣", hint: "3 zorluk · kronometre · en iyi süre" },
  { id: "snake", label: "Yılan", icon: "🐍", hint: "3 hız · duvar geçme · en iyi skor" },
  { id: "xox", label: "XOX", icon: "⭕", hint: "Minimax yapay zekâ · 2 oyunculu" },
];

const STORAGE_KEY = "pixtool.tools.active";

function loadActive(): ToolId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && TOOLS.some((tool) => tool.id === raw)) return raw as ToolId;
  } catch {
    /* yoksay */
  }
  return "calculator";
}

export function ToolsWindow() {
  const [active, setActive] = useState<ToolId>(loadActive);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, active);
    } catch {
      /* yoksay */
    }
  }, [active]);

  const meta = TOOLS.find((tool) => tool.id === active) ?? TOOLS[0];

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Araçlar</h2>
        <span className="app__subtitle">{meta.hint}</span>
        <span className="app__spacer" />
      </div>

      <div className="tools__tabs" role="tablist">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            role="tab"
            aria-selected={active === tool.id}
            className={`tools__tab${active === tool.id ? " is-active" : ""}`}
            onClick={() => setActive(tool.id)}
          >
            <span className="tools__tab-icon">{tool.icon}</span>
            <span className="tools__tab-label">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="tools__body">
        {active === "calculator" && <Calculator />}
        {active === "minesweeper" && <Minesweeper />}
        {active === "snake" && <Snake />}
        {active === "xox" && <TicTacToe />}
      </div>
    </div>
  );
}
