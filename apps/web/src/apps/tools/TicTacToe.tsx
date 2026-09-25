/**
 * XOX (Tic-Tac-Toe) — bilgisayara karşı veya iki oyuncu.
 *
 * Bilgisayar: minimax (tam oyun ağacı) → asla kaybetmez.
 * Skor tablosu oturum boyunca tutulur; başlangıç oyuncusu dönüşümlü.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

type Mark = "X" | "O";
type Square = Mark | null;
type Mode = "cpu" | "human";

const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Kazananı bulur. */
function winnerOf(board: Square[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line as [number, number, number];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a] as Mark, line };
    }
  }
  return null;
}

/** Minimax — bilgisayarın hamlesini seçer. */
function minimax(board: Square[], me: Mark, turn: Mark, depth: number): { score: number; move: number } {
  const result = winnerOf(board);
  if (result) {
    if (result.mark === me) return { score: 10 - depth, move: -1 };
    return { score: depth - 10, move: -1 };
  }
  if (board.every(Boolean)) return { score: 0, move: -1 };

  const other: Mark = turn === "X" ? "O" : "X";
  let best: { score: number; move: number } =
    turn === me ? { score: Number.NEGATIVE_INFINITY, move: -1 } : { score: Number.POSITIVE_INFINITY, move: -1 };

  for (let index = 0; index < 9; index += 1) {
    if (board[index]) continue;
    board[index] = turn;
    const { score } = minimax(board, me, other, depth + 1);
    board[index] = null;

    if (turn === me) {
      if (score > best.score) best = { score, move: index };
    } else if (score < best.score) {
      best = { score, move: index };
    }
  }

  return best;
}

export function TicTacToe() {
  const [board, setBoard] = useState<Square[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  const [mode, setMode] = useState<Mode>("cpu");
  const [scores, setScores] = useState({ X: 0, O: 0, draw: 0 });
  const [startingMark, setStartingMark] = useState<Mark>("X");
  const [thinking, setThinking] = useState(false);

  const result = useMemo(() => winnerOf(board), [board]);
  const full = useMemo(() => board.every(Boolean), [board]);
  const finished = Boolean(result) || full;

  /** Oyunu sıfırlar. */
  const reset = useCallback(
    (nextStart: Mark = startingMark) => {
      setBoard(Array(9).fill(null));
      setTurn(nextStart);
      setStartingMark(nextStart);
      setThinking(false);
    },
    [startingMark],
  );

  /** Skoru günceller. */
  const bumpScore = useCallback((mark: Mark | "draw") => {
    setScores((current) => ({ ...current, [mark]: current[mark] + 1 }));
  }, []);

  /** Oyun bittiğinde skoru bir kez yaz. */
  useEffect(() => {
    if (result) bumpScore(result.mark);
    else if (full) bumpScore("draw");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, full]);

  /** Hamle uygular. */
  const play = useCallback(
    (index: number, mark: Mark) => {
      setBoard((current) => {
        if (current[index] || winnerOf(current)) return current;
        const next = [...current];
        next[index] = mark;
        setTurn(mark === "X" ? "O" : "X");
        return next;
      });
    },
    [],
  );

  // Bilgisayar hamlesi
  useEffect(() => {
    if (mode !== "cpu" || turn !== "O" || finished) return undefined;

    setThinking(true);
    const id = window.setTimeout(() => {
      setBoard((current) => {
        if (winnerOf(current) || current.every(Boolean)) return current;
        const { move } = minimax([...current], "O", "O", 0);
        if (move < 0) return current;
        const next = [...current];
        next[move] = "O";
        setTurn("X");
        return next;
      });
      setThinking(false);
    }, 280);

    return () => {
      window.clearTimeout(id);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, finished, mode, turn]);

  /** Skor tablosunu sıfırla. */
  const resetScores = useCallback(() => setScores({ X: 0, O: 0, draw: 0 }), []);

  const winners = new Set(result?.line ?? []);

  return (
    <div className="xox">
      <div className="xox__bar">
        <div className="xox__modes">
          <button
            type="button"
            className={`xox__mode${mode === "cpu" ? " is-active" : ""}`}
            onClick={() => {
              setMode("cpu");
              reset("X");
            }}
          >
            🤖 Bilgisayara karşı
          </button>
          <button
            type="button"
            className={`xox__mode${mode === "human" ? " is-active" : ""}`}
            onClick={() => {
              setMode("human");
              reset("X");
            }}
          >
            👥 İki oyuncu
          </button>
        </div>
        <span className="app__spacer" />
        <button type="button" className="xox__reset" onClick={resetScores} title="Skoru sıfırla">
          ↺ Skor
        </button>
      </div>

      <div className="xox__scoreboard">
        <div className={`xox__score is-x${turn === "X" && !finished ? " is-active" : ""}`}>
          <span className="xox__score-mark">✕</span>
          <span className="xox__score-value">{scores.X}</span>
          <span className="xox__score-label">{mode === "cpu" ? "Sen" : "1. oyuncu"}</span>
        </div>
        <div className="xox__score is-draw">
          <span className="xox__score-mark">–</span>
          <span className="xox__score-value">{scores.draw}</span>
          <span className="xox__score-label">Berabere</span>
        </div>
        <div className={`xox__score is-o${turn === "O" && !finished ? " is-active" : ""}`}>
          <span className="xox__score-mark">◯</span>
          <span className="xox__score-value">{scores.O}</span>
          <span className="xox__score-label">{mode === "cpu" ? "Bilgisayar" : "2. oyuncu"}</span>
        </div>
      </div>

      <div className="xox__board">
        {board.map((mark, index) => (
          <button
            key={index}
            type="button"
            className={`xox__cell${mark ? ` is-${mark.toLowerCase()}` : ""}${
              winners.has(index) ? " is-win" : ""
            }`}
            disabled={Boolean(mark) || finished || thinking || (mode === "cpu" && turn === "O")}
            onClick={() => play(index, mode === "cpu" ? "X" : turn)}
          >
            {mark === "X" ? "✕" : mark === "O" ? "◯" : ""}
          </button>
        ))}
      </div>

      <div className="xox__status">
        {result && (
          <span className="xox__result">
            🎉 {result.mark === "X" ? (mode === "cpu" ? "Kazandın!" : "1. oyuncu kazandı") : mode === "cpu" ? "Bilgisayar kazandı" : "2. oyuncu kazandı"}
          </span>
        )}
        {!result && full && <span className="xox__result">🤝 Berabere</span>}
        {!finished && (
          <span>
            Sıra: <strong>{turn === "X" ? "✕" : "◯"}</strong>
            {thinking && " · bilgisayar düşünüyor…"}
          </span>
        )}
        <span className="app__spacer" />
        {finished && (
          <button type="button" className="app-btn app-btn--primary" onClick={() => reset(turn)}>
            Yeni oyun
          </button>
        )}
      </div>
    </div>
  );
}
