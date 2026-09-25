/**
 * Yılan — klasik.
 *
 * Ok tuşları / WASD ile yön, boşluk ile duraklat, hız seviyesi, en iyi skor
 * `localStorage`'da saklanır. Oyun döngüsü `requestAnimationFrame` yerine
 * sabit aralıklı `setInterval` kullanır (kararlı adım).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GRID = 20;
const SPEEDS = { slow: 180, normal: 120, fast: 78 } as const;
type Speed = keyof typeof SPEEDS;

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Rastgele boş yem konumu. */
function nextFood(snake: Point[]): Point {
  const busy = new Set(snake.map((part) => `${part.x},${part.y}`));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!busy.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

export function Snake() {
  const [speed, setSpeed] = useState<Speed>("normal");
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 15, y: 10 });
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(0);
  const [wrapping, setWrapping] = useState(false);

  const direction = useRef<Direction>("right");
  const queued = useRef<Direction | null>(null);

  // En iyi skor
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pixtool.snake.best");
      if (raw) setBest(Number(raw) || 0);
    } catch {
      /* yoksay */
    }
  }, []);

  const reset = useCallback(() => {
    setSnake([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
    setFood(nextFood([{ x: 10, y: 10 }]));
    setScore(0);
    setOver(false);
    setPaused(false);
    setRunning(false);
    direction.current = "right";
    queued.current = null;
  }, []);

  /** Yönü kuyruğa alır (tek adımda iki dönüşü engeller). */
  const turn = useCallback((next: Direction) => {
    const opposite: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    const basis = queued.current ?? direction.current;
    if (opposite[next] === basis || next === basis) return;
    queued.current = next;
  }, []);

  // Klavye
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") { event.preventDefault(); turn("up"); }
      else if (key === "arrowdown" || key === "s") { event.preventDefault(); turn("down"); }
      else if (key === "arrowleft" || key === "a") { event.preventDefault(); turn("left"); }
      else if (key === "arrowright" || key === "d") { event.preventDefault(); turn("right"); }
      else if (key === " " || key === "p") {
        event.preventDefault();
        if (!running) {
          setRunning(true);
          setPaused(false);
          setOver(false);
        } else {
          setPaused((value) => !value);
        }
      } else if (key === "escape" || key === "r") {
        reset();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset, running, turn]);

  // Oyun döngüsü
  useEffect(() => {
    if (!running || paused || over) return undefined;

    const id = window.setInterval(() => {
      setSnake((current) => {
        const next = queued.current ?? direction.current;
        direction.current = next;
        queued.current = null;

        const vector = VECTORS[next];
        const head = current[0];
        let x = head.x + vector.x;
        let y = head.y + vector.y;

        if (wrapping) {
          x = (x + GRID) % GRID;
          y = (y + GRID) % GRID;
        } else if (x < 0 || y < 0 || x >= GRID || y >= GRID) {
          setOver(true);
          setRunning(false);
          return current;
        }

        // Kendine çarpma (kuyruk ucu serbest)
        const hitsSelf = current.some((part, index) => index < current.length - 1 && part.x === x && part.y === y);
        if (hitsSelf) {
          setOver(true);
          setRunning(false);
          return current;
        }

        const body = [{ x, y }, ...current];

        if (food.x === x && food.y === y) {
          setScore((value) => {
            const updated = value + 1;
            setBest((previousBest) => {
              if (updated <= previousBest) return previousBest;
              try {
                localStorage.setItem("pixtool.snake.best", String(updated));
              } catch {
                /* yoksay */
              }
              return updated;
            });
            return updated;
          });
          setFood(nextFood(body));
        } else {
          body.pop();
        }

        return body;
      });
    }, SPEEDS[speed]);

    return () => window.clearInterval(id);
  }, [food, over, paused, running, speed, wrapping]);

  const occupied = useMemo(() => {
    const map = new Map<string, number>();
    snake.forEach((part, index) => map.set(`${part.x},${part.y}`, index));
    return map;
  }, [snake]);

  const cells = useMemo(() => {
    const list: React.ReactNode[] = [];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const index = occupied.get(`${x},${y}`);
        const isHead = index === 0;
        const isBody = index !== undefined && index > 0;
        const isFood = food.x === x && food.y === y;
        list.push(
          <div
            key={`${x},${y}`}
            className={`snake__cell${isHead ? " is-head" : ""}${isBody ? " is-body" : ""}${
              isFood ? " is-food" : ""
            }`}
            style={isBody ? { opacity: Math.max(0.35, 1 - index * 0.028) } : undefined}
          />,
        );
      }
    }
    return list;
  }, [food, occupied]);

  const touch = useCallback(
    (next: Direction) => {
      if (!running) {
        setRunning(true);
        setOver(false);
      }
      turn(next);
    },
    [running, turn],
  );

  return (
    <div className="snake">
      <div className="snake__bar">
        <div className="snake__speeds">
          {(Object.keys(SPEEDS) as Speed[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`snake__speed${speed === key ? " is-active" : ""}`}
              onClick={() => setSpeed(key)}
            >
              {key === "slow" ? "Yavaş" : key === "normal" ? "Normal" : "Hızlı"}
            </button>
          ))}
        </div>
        <label className="snake__wrap-toggle">
          <input type="checkbox" checked={wrapping} onChange={(event) => setWrapping(event.target.checked)} />
          Duvarlardan geç
        </label>
      </div>

      <div className="snake__stats">
        <span>🍎 Skor: <strong>{score}</strong></span>
        <span>🏆 En iyi: <strong>{best}</strong></span>
        <span>📏 Uzunluk: <strong>{snake.length}</strong></span>
      </div>

      <div className="snake__stage">
        <div className="snake__board" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}>
          {cells}
        </div>

        {(!running || paused || over) && (
          <div className="snake__overlay">
            {over ? (
              <>
                <div className="snake__overlay-title">Oyun bitti</div>
                <div className="snake__overlay-sub">Skor: {score}</div>
                <button type="button" className="app-btn app-btn--primary" onClick={reset}>
                  Tekrar oyna
                </button>
              </>
            ) : paused ? (
              <>
                <div className="snake__overlay-title">Duraklatıldı</div>
                <button type="button" className="app-btn app-btn--primary" onClick={() => setPaused(false)}>
                  Devam
                </button>
              </>
            ) : (
              <>
                <div className="snake__overlay-title">🐍 Yılan</div>
                <div className="snake__overlay-sub">Ok tuşları / WASD · Boşluk duraklat</div>
                <button
                  type="button"
                  className="app-btn app-btn--primary"
                  onClick={() => {
                    setRunning(true);
                    setOver(false);
                  }}
                >
                  Başla
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dokunmatik yön tuşları */}
      <div className="snake__dpad">
        <button type="button" className="snake__dbtn" onClick={() => touch("up")}>▲</button>
        <div className="snake__drow">
          <button type="button" className="snake__dbtn" onClick={() => touch("left")}>◀</button>
          <button type="button" className="snake__dbtn" onClick={() => touch("down")}>▼</button>
          <button type="button" className="snake__dbtn" onClick={() => touch("right")}>▶</button>
        </div>
      </div>
    </div>
  );
}
