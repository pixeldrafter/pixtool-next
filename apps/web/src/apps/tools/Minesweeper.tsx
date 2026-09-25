/**
 * Mayın Tarlası — klasik.
 *
 * Zorluk seviyeleri, ilk tıklamada güvenli açılış, sağ tık bayrak,
 * orta tık (veya çift tık) ile akıllı açma, kronometre, mayın sayacı.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Level = "easy" | "medium" | "hard";

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
}

const LEVELS: Record<Level, { label: string; rows: number; cols: number; mines: number }> = {
  easy: { label: "Kolay · 9×9 · 10", rows: 9, cols: 9, mines: 10 },
  medium: { label: "Orta · 16×16 · 40", rows: 16, cols: 16, mines: 40 },
  hard: { label: "Zor · 16×30 · 99", rows: 16, cols: 30, mines: 99 },
};

const NUMBER_COLORS = [
  "",
  "#4aa3ff",
  "#4ad97a",
  "#ff6b6b",
  "#b48cff",
  "#ffb347",
  "#3ddbd9",
  "#e0e0e0",
  "#b0b7c3",
];

/** Boş tahta üretir. */
function emptyBoard(rows: number, cols: number): Cell[] {
  return Array.from({ length: rows * cols }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adjacent: 0,
  }));
}

/** Mayınları yerleştirir (ilk tıklanan hücre ve komşuları hariç). */
function plantMines(board: Cell[], rows: number, cols: number, mines: number, safeIndex: number): Cell[] {
  const next = board.map((cell) => ({ ...cell, mine: false, adjacent: 0 }));
  const excluded = new Set<number>();

  const safeRow = Math.floor(safeIndex / cols);
  const safeCol = safeIndex % cols;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const row = safeRow + dr;
      const col = safeCol + dc;
      if (row >= 0 && row < rows && col >= 0 && col < cols) excluded.add(row * cols + col);
    }
  }

  const candidates = next.map((_, index) => index).filter((index) => !excluded.has(index));
  for (let placed = 0; placed < mines && candidates.length; placed += 1) {
    const pick = Math.floor(Math.random() * candidates.length);
    const index = candidates.splice(pick, 1)[0];
    if (index !== undefined) next[index].mine = true;
  }

  // Komşu mayın sayıları
  for (let index = 0; index < next.length; index += 1) {
    if (next[index].mine) continue;
    const row = Math.floor(index / cols);
    const col = index % cols;
    let count = 0;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        if (next[r * cols + c].mine) count += 1;
      }
    }
    next[index].adjacent = count;
  }

  return next;
}

export function Minesweeper() {
  const [level, setLevel] = useState<Level>("easy");
  const config = LEVELS[level];

  const [board, setBoard] = useState<Cell[]>(() => emptyBoard(config.rows, config.cols));
  const [started, setStarted] = useState(false);
  const [dead, setDead] = useState(false);
  const [won, setWon] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState<Record<string, number>>({});

  const timerRef = useRef<number | null>(null);

  const flags = useMemo(() => board.filter((cell) => cell.flagged).length, [board]);
  const revealedCount = useMemo(() => board.filter((cell) => cell.revealed).length, [board]);

  /** Yeni oyun. */
  const reset = useCallback(
    (nextLevel: Level = level) => {
      const target = LEVELS[nextLevel];
      setBoard(emptyBoard(target.rows, target.cols));
      setStarted(false);
      setDead(false);
      setWon(false);
      setSeconds(0);
    },
    [level],
  );

  // Seviye değişince sıfırla
  useEffect(() => {
    reset(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Kronometre
  useEffect(() => {
    if (!started || dead || won) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [started, dead, won]);

  // En iyi süreler
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pixtool.minesweeper.best");
      if (raw) setBest(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* yoksay */
    }
  }, []);

  /** Komşu zincirini açar (iteratif — yığın taşması yok). */
  const floodReveal = useCallback((source: Cell[], index: number, rows: number, cols: number): Cell[] => {
    const next = source.map((cell) => ({ ...cell }));
    const queue = [index];
    const seen = new Set<number>();

    while (queue.length) {
      const current = queue.pop();
      if (current === undefined || seen.has(current)) continue;
      seen.add(current);

      const cell = next[current];
      if (!cell || cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;

      if (cell.adjacent === 0) {
        const row = Math.floor(current / cols);
        const col = current % cols;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (!dr && !dc) continue;
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
            queue.push(r * cols + c);
          }
        }
      }
    }

    return next;
  }, []);

  /** Kazandı mı kontrolü. */
  const checkWin = useCallback(
    (next: Cell[], rows: number, cols: number, mines: number): boolean =>
      next.filter((cell) => !cell.mine && cell.revealed).length === rows * cols - mines,
    [],
  );

  /** Sol tık — aç. */
  const reveal = useCallback(
    (index: number) => {
      if (dead || won) return;

      setBoard((current) => {
        let source = current;
        let wasStarted = started;

        if (!wasStarted) {
          source = plantMines(current, config.rows, config.cols, config.mines, index);
          setStarted(true);
          wasStarted = true;
        }

        const target = source[index];
        if (!target || target.revealed || target.flagged) return current;

        if (target.mine) {
          const shown = source.map((cell) => (cell.mine ? { ...cell, revealed: true } : { ...cell }));
          setDead(true);
          return shown;
        }

        const next = floodReveal(source, index, config.rows, config.cols);

        if (checkWin(next, config.rows, config.cols, config.mines)) {
          setWon(true);
          setBest((previous) => {
            const value = previous[level];
            if (value !== undefined && value <= seconds) return previous;
            const updated = { ...previous, [level]: seconds };
            try {
              localStorage.setItem("pixtool.minesweeper.best", JSON.stringify(updated));
            } catch {
              /* yoksay */
            }
            return updated;
          });
        }

        return next;
      });
    },
    [checkWin, config, dead, floodReveal, level, seconds, started, won],
  );

  /** Sağ tık — bayrak. */
  const flag = useCallback(
    (index: number) => {
      if (dead || won) return;
      setBoard((current) =>
        current.map((cell, position) =>
          position === index && !cell.revealed ? { ...cell, flagged: !cell.flagged } : cell,
        ),
      );
    },
    [dead, won],
  );

  /** Orta tık / çift tık — akıllı açma (komşu bayrak sayısı eşitse aç). */
  const chord = useCallback(
    (index: number) => {
      if (dead || won) return;
      const cell = board[index];
      if (!cell || !cell.revealed || cell.adjacent === 0) return;

      const row = Math.floor(index / config.cols);
      const col = index % config.cols;
      const neighbours: number[] = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || r >= config.rows || c < 0 || c >= config.cols) continue;
          neighbours.push(r * config.cols + c);
        }
      }

      const flagged = neighbours.filter((position) => board[position]?.flagged).length;
      if (flagged !== cell.adjacent) return;

      neighbours.forEach((position) => {
        const neighbour = board[position];
        if (neighbour && !neighbour.flagged && !neighbour.revealed) reveal(position);
      });
    },
    [board, config, dead, reveal, won],
  );

  const remaining = config.mines - flags;
  const face = dead ? "😵" : won ? "😎" : "🙂";

  return (
    <div className="ms">
      <div className="ms__bar">
        <div className="ms__level">
          {(Object.keys(LEVELS) as Level[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`ms__level-btn${level === key ? " is-active" : ""}`}
              onClick={() => setLevel(key)}
            >
              {LEVELS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="ms__head">
        <span className="ms__counter" title="Kalan mayın">
          💣 {String(Math.max(remaining, 0)).padStart(3, "0")}
        </span>
        <button type="button" className="ms__face" onClick={() => reset()} title="Yeni oyun">
          {face}
        </button>
        <span className="ms__counter" title="Süre">
          ⏱ {String(Math.min(seconds, 999)).padStart(3, "0")}
        </span>
      </div>

      <div
        className="ms__board"
        style={{ gridTemplateColumns: `repeat(${config.cols}, 1fr)` }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {board.map((cell, index) => {
          const revealed = cell.revealed;
          return (
            <button
              key={index}
              type="button"
              className={`ms__cell${revealed ? " is-open" : ""}${cell.flagged ? " is-flag" : ""}${
                revealed && cell.mine ? " is-mine" : ""
              }`}
              style={
                revealed && !cell.mine && cell.adjacent
                  ? { color: NUMBER_COLORS[cell.adjacent] }
                  : undefined
              }
              onClick={() => reveal(index)}
              onDoubleClick={() => chord(index)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  chord(index);
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                flag(index);
              }}
            >
              {revealed
                ? cell.mine
                  ? "💥"
                  : cell.adjacent || ""
                : cell.flagged
                  ? "🚩"
                  : ""}
            </button>
          );
        })}
      </div>

      <div className="ms__foot">
        {won && <span className="ms__win">🎉 Kazandın! {seconds} saniye</span>}
        {dead && <span className="ms__lose">💥 Mayına bastın — tekrar dene</span>}
        {!won && !dead && (
          <span className="ms__hint">
            Sol tık aç · Sağ tık bayrak · Çift tık akıllı aç · Açılan: {revealedCount}
          </span>
        )}
        <span className="app__spacer" />
        {best[level] !== undefined && <span className="ms__best">En iyi: {best[level]} sn</span>}
      </div>
    </div>
  );
}
