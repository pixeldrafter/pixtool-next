/**
 * Spider Clock — sistem saatini gösteren örümcek temalı duvar kağıdı.
 *
 * Referans: "Spider Clock Animation" (gsap + 42 KB SVG). Burada bağımlılıksız,
 * React + SVG ile yeniden yazıldı ve **gerçek sistem saatine** bağlandı.
 *
 * Bileşenler:
 *   • Neon kadran, tik işaretleri ve Romen yerine sade çizgiler
 *   • Üç akrep (saat / dakika / saniye) — yumuşak hareket
 *   • Kadranın çevresinde yürüyen örümcek (saniyeyi takip eder)
 *   • Altında dijital okuma
 */

import { useEffect, useState } from "react";
import "./SpiderClock.css";

interface SpiderClockProps {
  /** Arkaplan animasyon hızı çarpanı (ayarlardan) */
  speed?: number;
  /** Kesme çizik efekti (CRT hissi) */
  accent?: string;
}

export function SpiderClock({ speed = 1, accent = "#00ff9c" }: SpiderClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(new Date());
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  // Milisaniyeli saniye → akrep sürekli akar
  const ms = now.getMilliseconds();
  const seconds = now.getSeconds() + ms / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  const secondAngle = seconds * 6 * speed;
  const minuteAngle = minutes * 6;
  const hourAngle = hours * 30;

  // Örümcek kadranın çevresinde
  const spiderAngle = secondAngle - 90;
  const radius = 42;
  const spiderX = 50 + Math.cos((spiderAngle * Math.PI) / 180) * radius;
  const spiderY = 50 + Math.sin((spiderAngle * Math.PI) / 180) * radius;

  return (
    <div className="spider-clock" style={{ ["--accent" as string]: accent }}>
      <svg viewBox="0 0 100 100" className="spider-clock__svg" role="img" aria-label="Saat">
        <defs>
          <radialGradient id="clockGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.14" />
            <stop offset="70%" stopColor={accent} stopOpacity="0.03" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <filter id="clockSoft">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
        </defs>

        {/* Dış parıltı */}
        <circle cx="50" cy="50" r="48" fill="url(#clockGlow)" />

        {/* Kadran çerçevesi */}
        <circle cx="50" cy="50" r="44" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="41" fill="none" stroke={accent} strokeOpacity="0.12" strokeWidth="0.25" />

        {/* Tik işaretleri */}
        {Array.from({ length: 60 }, (_, index) => {
          const angle = (index * 6 - 90) * (Math.PI / 180);
          const isHour = index % 5 === 0;
          const outer = 41;
          const inner = isHour ? 35.5 : 38.5;
          return (
            <line
              key={index}
              x1={50 + Math.cos(angle) * inner}
              y1={50 + Math.sin(angle) * inner}
              x2={50 + Math.cos(angle) * outer}
              y2={50 + Math.sin(angle) * outer}
              stroke={accent}
              strokeOpacity={isHour ? 0.75 : 0.22}
              strokeWidth={isHour ? 0.9 : 0.4}
              strokeLinecap="round"
            />
          );
        })}

        {/* Saat akrebi */}
        <g transform={`rotate(${hourAngle} 50 50)`}>
          <line x1="50" y1="50" x2="50" y2="27" stroke={accent} strokeWidth="2.1" strokeLinecap="round" />
        </g>

        {/* Dakika akrebi */}
        <g transform={`rotate(${minuteAngle} 50 50)`}>
          <line x1="50" y1="50" x2="50" y2="18" stroke={accent} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
        </g>

        {/* Saniye akrebi — ince, uzun */}
        <g transform={`rotate(${secondAngle} 50 50)`}>
          <line x1="50" y1="58" x2="50" y2="12" stroke="#ff2d95" strokeWidth="0.5" strokeLinecap="round" />
        </g>

        {/* Merkez */}
        <circle cx="50" cy="50" r="1.7" fill={accent} />
        <circle cx="50" cy="50" r="3.4" fill="none" stroke={accent} strokeOpacity="0.4" strokeWidth="0.4" />

        {/* --- Örümcek: kadranın çevresinde yürür --- */}
        <g transform={`translate(${spiderX} ${spiderY}) rotate(${secondAngle + 90})`} filter="url(#clockSoft)">
          {/* Bacaklar */}
          {[-1, 1].flatMap((side) =>
            [0, 1, 2, 3].map((index) => {
              const spread = 0.7 + index * 0.3;
              const angle = side * spread;
              const hipX = Math.cos(angle) * 1.6;
              const hipY = Math.sin(angle) * 1.6;
              const kneeX = hipX + Math.cos(angle) * 2.6;
              const kneeY = hipY + Math.sin(angle) * 2.6;
              const footX = kneeX + Math.cos(angle * 0.75) * 2.2;
              const footY = kneeY + Math.sin(angle * 0.75) * 2.2;
              return (
                <polyline
                  key={`${side}-${index}`}
                  points={`${hipX},${hipY} ${kneeX},${kneeY} ${footX},${footY}`}
                  fill="none"
                  stroke={accent}
                  strokeWidth="0.42"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              );
            }),
          )}
          {/* Gövde */}
          <ellipse cx="0" cy="0" rx="2.6" ry="2" fill="#05070a" stroke={accent} strokeWidth="0.42" />
          <ellipse cx="2.5" cy="0" rx="1.3" ry="1.1" fill="#05070a" stroke={accent} strokeWidth="0.38" />
          <circle cx="3" cy="-0.5" r="0.32" fill={accent} />
          <circle cx="3" cy="0.5" r="0.32" fill={accent} />
        </g>
      </svg>

      <div className="spider-clock__digital mono">
        {now.toLocaleTimeString("tr-TR")}
        <span className="spider-clock__date">{now.toLocaleDateString("tr-TR", { dateStyle: "full" })}</span>
      </div>
    </div>
  );
}
