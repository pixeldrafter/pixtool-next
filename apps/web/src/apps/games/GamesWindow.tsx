/**
 * Oyunlar — Araçlar'dan ayrılmış oyun merkezi.
 *
 * Araçlar penceresi artık iş araçlarına ayrıldı; eğlence burada toplanır.
 * Seçim `localStorage`'da saklanır.
 */

import { useEffect, useState } from "react";

import { Minesweeper } from "../tools/Minesweeper";
import { Snake } from "../tools/Snake";
import { TicTacToe } from "../tools/TicTacToe";
import "../apps.css";
import "./games-window.css";

type GameId = "minesweeper" | "snake" | "xox";

const GAMES: { id: GameId; label: string; icon: string; hint: string }[] = [
  { id: "minesweeper", label: "Mayın Tarlası", icon: "💣", hint: "3 zorluk · ilk tıklama güvenli · en iyi süre" },
  { id: "snake", label: "Yılan", icon: "🐍", hint: "3 hız · duvarlardan geçme · en iyi skor" },
  { id: "xox", label: "XOX", icon: "⭕", hint: "Minimax yapay zekâ — yenilmez · 2 oyunculu" },
];

const STORAGE_KEY = "pixtool.games.active";

function loadActive(): GameId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && GAMES.some((game) => game.id === raw)) return raw as GameId;
  } catch {
    /* yoksay */
  }
  return "minesweeper";
}

export function GamesWindow() {
  const [active, setActive] = useState<GameId>(loadActive);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, active);
    } catch {
      /* yoksay */
    }
  }, [active]);

  const meta = GAMES.find((game) => game.id === active) ?? GAMES[0];

  return (
    <div className="app">
      <div className="app__toolbar">
        <h2 className="app__title">Oyunlar</h2>
        <span className="app__subtitle">{meta.hint}</span>
        <span className="app__spacer" />
      </div>

      <div className="tools__tabs" role="tablist">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            role="tab"
            aria-selected={active === game.id}
            className={`tools__tab${active === game.id ? " is-active" : ""}`}
            onClick={() => setActive(game.id)}
          >
            <span className="tools__tab-icon">{game.icon}</span>
            <span className="tools__tab-label">{game.label}</span>
          </button>
        ))}
      </div>

      <div className="tools__body games__body">
        {active === "minesweeper" && <Minesweeper />}
        {active === "snake" && <Snake />}
        {active === "xox" && <TicTacToe />}
      </div>
    </div>
  );
}
