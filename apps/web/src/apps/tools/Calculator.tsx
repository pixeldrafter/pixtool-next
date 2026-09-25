/**
 * Hesap Makinesi — Windows 11 tarzı.
 *
 * Klavye: 0-9, + - * / , Enter (=), Backspace, Escape (C), % , .
 */

import { useCallback, useEffect, useState } from "react";

/** Sayıyı ekranda gösterilecek biçime çevirir. */
function format(value: string): string {
  if (value === "Hata") return value;
  const [whole, fraction] = value.split(".");
  const sign = whole?.startsWith("-") ? "-" : "";
  const digits = (whole ?? "").replace("-", "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped}${fraction !== undefined ? `,${fraction}` : ""}`;
}

export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  /** Geçerli değeri sayıya çevirir. */
  const current = useCallback(() => Number(display.replace(",", ".")) || 0, [display]);

  /** Bir işlemi uygular. */
  const compute = useCallback(
    (left: number, right: number, op: string): number => {
      switch (op) {
        case "+":
          return left + right;
        case "−":
          return left - right;
        case "×":
          return left * right;
        case "÷":
          return right === 0 ? Number.NaN : left / right;
        default:
          return right;
      }
    },
    [],
  );

  const pushDigit = useCallback(
    (digit: string) => {
      setDisplay((value) => {
        if (fresh || value === "0" || value === "Hata") {
          setFresh(false);
          return digit === "." ? "0." : digit;
        }
        if (digit === "." && value.includes(".")) return value;
        if (value.replace("-", "").replace(".", "").length >= 15) return value;
        return value + digit;
      });
    },
    [fresh],
  );

  const applyOperator = useCallback(
    (next: string) => {
      const value = current();
      if (accumulator !== null && operator && !fresh) {
        const result = compute(accumulator, value, operator);
        if (Number.isNaN(result)) {
          setDisplay("Hata");
          setAccumulator(null);
          setOperator(null);
          setFresh(true);
          return;
        }
        setAccumulator(result);
        setDisplay(String(Number(result.toFixed(12))));
      } else {
        setAccumulator(value);
      }
      setOperator(next);
      setFresh(true);
    },
    [accumulator, compute, current, fresh, operator],
  );

  const equals = useCallback(() => {
    if (accumulator === null || !operator) return;
    const value = current();
    const result = compute(accumulator, value, operator);
    setHistory((list) => [...list.slice(-9), `${accumulator} ${operator} ${value} = ${Number(result.toFixed(12))}`]);
    setDisplay(Number.isNaN(result) ? "Hata" : String(Number(result.toFixed(12))));
    setAccumulator(null);
    setOperator(null);
    setFresh(true);
  }, [accumulator, compute, current, operator]);

  const clearAll = useCallback(() => {
    setDisplay("0");
    setAccumulator(null);
    setOperator(null);
    setFresh(true);
  }, []);

  const unary = useCallback(
    (kind: "sqrt" | "square" | "invert" | "negate" | "percent") => {
      const value = current();
      let result: number;
      switch (kind) {
        case "sqrt":
          result = value < 0 ? Number.NaN : Math.sqrt(value);
          break;
        case "square":
          result = value * value;
          break;
        case "invert":
          result = value === 0 ? Number.NaN : 1 / value;
          break;
        case "negate":
          result = -value;
          break;
        case "percent":
          result = accumulator !== null ? (accumulator * value) / 100 : value / 100;
          break;
      }
      setDisplay(Number.isNaN(result) ? "Hata" : String(Number(result.toFixed(12))));
      setFresh(true);
    },
    [accumulator, current],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const key = event.key;
      if (/^[0-9]$/.test(key)) {
        pushDigit(key);
      } else if (key === "." || key === ",") {
        pushDigit(".");
      } else if (key === "+" || key === "-" || key === "*" || key === "/") {
        applyOperator({ "+": "+", "-": "−", "*": "×", "/": "÷" }[key] as string);
      } else if (key === "Enter" || key === "=") {
        event.preventDefault();
        equals();
      } else if (key === "Backspace") {
        setDisplay((value) => (value.length <= 1 || value === "Hata" ? "0" : value.slice(0, -1)));
      } else if (key === "Escape") {
        clearAll();
      } else if (key === "%") {
        unary("percent");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyOperator, clearAll, equals, pushDigit, unary]);

  const buttons: { label: string; onClick: () => void; kind?: string }[] = [
    { label: "MC", onClick: () => setMemory(0), kind: "fn" },
    { label: "MR", onClick: () => { setDisplay(String(memory)); setFresh(true); }, kind: "fn" },
    { label: "M+", onClick: () => setMemory((value) => value + current()), kind: "fn" },
    { label: "M−", onClick: () => setMemory((value) => value - current()), kind: "fn" },
    { label: "%", onClick: () => unary("percent"), kind: "fn" },
    { label: "CE", onClick: () => { setDisplay("0"); setFresh(true); }, kind: "fn" },
    { label: "C", onClick: clearAll, kind: "fn" },
    { label: "⌫", onClick: () => setDisplay((value) => (value.length <= 1 || value === "Hata" ? "0" : value.slice(0, -1))), kind: "fn" },

    { label: "1/x", onClick: () => unary("invert"), kind: "fn" },
    { label: "x²", onClick: () => unary("square"), kind: "fn" },
    { label: "√x", onClick: () => unary("sqrt"), kind: "fn" },
    { label: "÷", onClick: () => applyOperator("÷"), kind: "op" },

    { label: "7", onClick: () => pushDigit("7") },
    { label: "8", onClick: () => pushDigit("8") },
    { label: "9", onClick: () => pushDigit("9") },
    { label: "×", onClick: () => applyOperator("×"), kind: "op" },

    { label: "4", onClick: () => pushDigit("4") },
    { label: "5", onClick: () => pushDigit("5") },
    { label: "6", onClick: () => pushDigit("6") },
    { label: "−", onClick: () => applyOperator("−"), kind: "op" },

    { label: "1", onClick: () => pushDigit("1") },
    { label: "2", onClick: () => pushDigit("2") },
    { label: "3", onClick: () => pushDigit("3") },
    { label: "+", onClick: () => applyOperator("+"), kind: "op" },

    { label: "±", onClick: () => unary("negate") },
    { label: "0", onClick: () => pushDigit("0") },
    { label: ",", onClick: () => pushDigit(".") },
    { label: "=", onClick: equals, kind: "eq" },
  ];

  return (
    <div className="calc">
      <div className="calc__screen">
        <div className="calc__expr">
          {accumulator !== null && operator ? `${format(String(accumulator))} ${operator}` : "\u00A0"}
        </div>
        <div className={`calc__value${display === "Hata" ? " is-error" : ""}`} title={display}>
          {format(display)}
        </div>
        <div className="calc__mem">{memory !== 0 ? `Bellek: ${format(String(memory))}` : "\u00A0"}</div>
      </div>

      <div className="calc__pad">
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            className={`calc__btn${button.kind ? ` is-${button.kind}` : ""}`}
            onClick={button.onClick}
          >
            {button.label}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="calc__history">
          <div className="calc__history-head">Geçmiş</div>
          {history.map((line, index) => (
            <div key={index} className="calc__history-row">
              {line}
            </div>
          ))}
          <button type="button" className="calc__history-clear" onClick={() => setHistory([])}>
            Temizle
          </button>
        </div>
      )}
    </div>
  );
}
