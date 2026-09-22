/**
 * Pixel Bat — piksel sanatı yarasa animasyonu (duvar kağıdı + boşta ekranı).
 *
 * Referans: "Pixel Bat Animation" (295 KB CSS içeren tek dosyalık demo).
 * Burada **box-shadow piksel sanatı** tekniğiyle kompakt biçimde yeniden
 * yazıldı: her "X" karakteri bir piksel kutusuna dönüşür ve gölge olarak
 * çizilir.
 *
 * İki kare (kanat yukarı / kanat aşağı) hızlıca değiştirilerek uçuş hissi
 * verilir. Birden fazla yarasa farklı gecikme ve yükseklikte uçar.
 */

import { useMemo } from "react";
import "./PixelBat.css";

/**
 * Yarasa kareleri — `X` = piksel.
 * Kanatlar aşağı/yukarı iki kare arasında gidip gelir.
 */
const WINGS_UP = [
  "X...........X",
  "XX.........XX",
  "XXX.XXXXX.XXX",
  "XXXXXXXXXXXXX",
  "..XXX...XXX..",
];

const WINGS_DOWN = [
  "..X.......X..",
  ".XX.XXXXX.XX.",
  "XXXXXXXXXXXXX",
  "XXX.X...X.XXX",
  "X...X...X...X",
];

interface BatSpec {
  /** Uçuş süresi (saniye) */
  duration: number;
  /** Dikey konum (%) */
  top: number;
  /** Boyut (piksel) */
  size: number;
  /** Gecikme (saniye) */
  delay: number;
  /** Renk */
  color: string;
  /** Kanat çırpma süresi (saniye) */
  flap: number;
}

const BATS: BatSpec[] = [
  { duration: 26, top: 18, size: 5, delay: 0, color: "#a855f7", flap: 0.34 },
  { duration: 34, top: 34, size: 4, delay: 6, color: "#00e5ff", flap: 0.42 },
  { duration: 20, top: 52, size: 6, delay: 11, color: "#00ff9c", flap: 0.3 },
  { duration: 40, top: 70, size: 3, delay: 3, color: "#ff2d95", flap: 0.5 },
  { duration: 30, top: 26, size: 5, delay: 17, color: "#ff8a3d", flap: 0.38 },
  { duration: 44, top: 62, size: 4, delay: 21, color: "#b6ff3d", flap: 0.46 },
];

/** Bir kareyi box-shadow listesine çevirir (piksel sanatı). */
function frameToShadow(frame: string[], pixelSize: number, color: string): string {
  const parts: string[] = [];
  frame.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "X") {
        parts.push(`${x * pixelSize}px ${y * pixelSize}px 0 0 ${color}`);
      }
    });
  });
  return parts.join(", ");
}

interface PixelBatProps {
  /** Animasyon hızı çarpanı */
  speed?: number;
  /** Yalnızca tek, ortalanmış yarasa (boşta ekranı için) */
  single?: boolean;
  className?: string;
}

export function PixelBat({ speed = 1, single = false, className }: PixelBatProps) {
  const bats = useMemo(() => (single ? [BATS[0]!] : BATS), [single]);

  return (
    <div className={`pixel-bat${single ? " pixel-bat--single" : ""}${className ? ` ${className}` : ""}`}>
      {bats.map((bat, index) => {
        const upShadow = frameToShadow(WINGS_UP, bat.size, bat.color);
        const downShadow = frameToShadow(WINGS_DOWN, bat.size, bat.color);

        return (
          <div
            key={index}
            className="pixel-bat__flyer"
            style={{
              top: `${bat.top}%`,
              animationDuration: `${bat.duration / speed}s`,
              animationDelay: `${bat.delay}s`,
            }}
          >
            <div
              className="pixel-bat__sprite"
              style={{
                ["--shadow-up" as string]: upShadow,
                ["--shadow-down" as string]: downShadow,
                animationDuration: `${bat.flap / speed}s`,
                ["--bat-color" as string]: bat.color,
              }}
            />
          </div>
        );
      })}

      {/* Ay — atmosfer */}
      {!single && <div className="pixel-bat__moon" aria-hidden="true" />}
    </div>
  );
}
