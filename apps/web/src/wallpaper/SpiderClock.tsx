/**
 * Spider Clock — sistem saatini gösteren mekanik duvar kağıdı.
 *
 * ⚠️ BİREBİR PORT. İşaretleme referanstan olduğu gibi alınır
 * (`spiderClockMarkup.ts`) ve `script.js` mantığı GSAP ile birebir uygulanır.
 *
 * Referans: "Spider Clock Animation | @coding.pixel"
 *   • Dişliler `bounce` yumuşatmasıyla döner
 *   • Akrepler morph ederek "tik" atar (MorphSVGPlugin)
 *   • Kadran nefes alır gibi şekil değiştirir (`#face01` ⇄ `#face02`)
 *   • Akrepler 180°'yi geçince yatay aynalanır (scaleX: -1)
 *
 * Saat **gerçek sistem saatinden** okunur (`new Date()`).
 */

import { gsap } from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { useEffect, useRef } from "react";

import { SPIDER_CLOCK_MARKUP } from "./spiderClockMarkup";
import "./SpiderClock.css";

gsap.registerPlugin(MorphSVGPlugin);

interface SpiderClockProps {
  /**
   * Animasyon hız çarpanı (1 = referans hızı).
   * `gsap.timeScale` ile tüm zaman çizelgelerine uygulanır.
   */
  speed?: number;
}

export function SpiderClock({ speed = 1 }: SpiderClockProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const ctx = gsap.context(() => {
      /** Hız çarpanını verilen animasyona uygular (1 ise dokunmaz). */
      const paced = <T extends gsap.core.Animation>(animation: T): T => {
        if (speed !== 1) animation.timeScale(speed);
        return animation;
      };

      // --- Referans: eleman referansları ---
      const pick = <T extends Element>(selector: string): T | null =>
        root.querySelector<T>(selector);
      const attr = (selector: string): string =>
        pick(selector)?.getAttribute("d") ?? "";

      const face01 = attr("#face01");
      const handSec01 = attr("#handSec01");
      const handMin01 = attr("#handMin01");
      const handHr01 = attr("#handHr01");

      const sec = pick("#sec");
      const min = pick("#min");
      const hr = pick("#hr");

      if (!sec || !min || !hr) return;

      // --- Referans: başlangıç şekilleri ---
      gsap.set("#face", { attr: { d: face01 } });
      gsap.set("#hand-sec", { attr: { d: handSec01 } });
      gsap.set("#hand-min", { attr: { d: handMin01 } });
      gsap.set("#hand-hr", { attr: { d: handHr01 } });

      // ------------------------------------------------------------------
      //  Referans: `geSecRotation` / `getMinRotation` / `getHrRotation`
      // ------------------------------------------------------------------
      const geSecRotation = (): number => {
        const rotation = new Date().getSeconds() * 6;
        const scaleX = Number(gsap.getProperty(sec, "scaleX"));

        if (Math.abs(Number(gsap.getProperty(sec, "rotation")) - rotation) >= 12) {
          gsap.set(sec, { rotation, transformOrigin: "50% 50%" });
        }
        if (rotation >= 180 && rotation < 360 && scaleX === 1) {
          gsap.to(sec, { scaleX: -1, duration: 0.25 });
        } else if ((rotation < 180 || rotation >= 360) && scaleX === -1) {
          gsap.to(sec, { scaleX: 1, duration: 0.25 });
        }
        return rotation;
      };

      const getMinRotation = (): number => {
        const now = new Date();
        const rotation = now.getMinutes() * 6 + (now.getSeconds() * 6) / 59;
        const scaleX = Number(gsap.getProperty(min, "scaleX"));

        if (Math.abs(Number(gsap.getProperty(min, "rotation")) - rotation) >= 5) {
          gsap.set(min, { rotation, transformOrigin: "50% 50%" });
        }
        if (rotation >= 180 && rotation < 360 && scaleX === 1) {
          gsap.to(min, { scaleX: -1, duration: 0.25 });
        } else if ((rotation < 180 || rotation >= 360) && scaleX === -1) {
          gsap.to(min, { scaleX: 1, duration: 0.25 });
        }
        return rotation;
      };

      const getHrRotation = (): number => {
        const now = new Date();
        const rotation = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
        const scaleX = Number(gsap.getProperty(hr, "scaleX"));

        if (Math.abs(Number(gsap.getProperty(hr, "rotation")) - rotation) >= 5) {
          gsap.set(hr, { rotation, transformOrigin: "50% 50%" });
        }
        if (rotation >= 180 && rotation < 360 && scaleX === 1) {
          gsap.to(hr, { scaleX: -1, duration: 0.25 });
        } else if ((rotation < 180 || rotation >= 360) && scaleX === -1) {
          gsap.to(hr, { scaleX: 1, duration: 0.25 });
        }
        return rotation;
      };

      const setTimeSec = (): void => {
        gsap.set(sec, { rotation: geSecRotation(), transformOrigin: "50% 50%" });
      };
      const setTimeMinHr = (): void => {
        gsap.set(min, { rotation: getMinRotation(), transformOrigin: "50% 50%" });
        gsap.set(hr, { rotation: getHrRotation(), transformOrigin: "50% 50%" });
      };

      // ------------------------------------------------------------------
      //  Referans: `startAnimation`
      // ------------------------------------------------------------------
      setTimeSec();
      setTimeMinHr();
      gsap.set([".gsapWrapper", ".vline"], { autoAlpha: 1 });

      const anims: gsap.core.Animation[] = [];

      // --- Dişliler (referans değerleri: -15° / -18° / +30°) ---
      anims.push(paced(gsap.to(".cw.t24", {
        rotation: "-=15",
        duration: 1,
        transformOrigin: "50% 50%",
        ease: "bounce",
        onComplete() {
          this.invalidate().delay(1).restart(true);
        },
      })));
      anims.push(paced(gsap.to(".cw.t20", {
        rotation: "-=18",
        duration: 1,
        transformOrigin: "50% 50%",
        ease: "bounce",
        onComplete() {
          this.invalidate().delay(1).restart(true);
        },
      })));
      anims.push(paced(gsap.to(".ccw.t12", {
        rotation: "+=30",
        duration: 1,
        transformOrigin: "50% 50%",
        ease: "bounce",
        onComplete() {
          this.invalidate().delay(1).restart(true);
        },
      })));

      // --- Akrepler ---
      anims.push(paced(gsap.to(min, {
        rotation: getMinRotation,
        duration: 0.5,
        transformOrigin: "50% 50%",
        ease: "none",
        onComplete() {
          if (Number(gsap.getProperty(min, "rotation")) >= 360) {
            gsap.set(min, { rotation: 0, transformOrigin: "50% 50%" });
          }
          this.invalidate().delay(5).restart(true);
        },
      })));

      anims.push(paced(gsap.to(hr, {
        rotation: getHrRotation,
        duration: 0.5,
        transformOrigin: "50% 50%",
        ease: "none",
        onComplete() {
          if (Number(gsap.getProperty(hr, "rotation")) >= 360) {
            gsap.set(hr, { rotation: 0, transformOrigin: "50% 50%" });
          }
          this.invalidate().delay(5).restart(true);
        },
      })));

      anims.push(paced(gsap.to(sec, {
        rotation: geSecRotation,
        duration: 0.5,
        transformOrigin: "50% 50%",
        ease: "bounce",
        onComplete() {
          setTimeSec();
          if (Number(gsap.getProperty(sec, "rotation")) >= 360) {
            gsap.set(sec, { rotation: 0, transformOrigin: "50% 50%" });
          }
          this.invalidate().delay(0).restart(true);
        },
      })));

      void anims;

      // --- Kadran "nefes alma" morph'u (tg0) ---
      const tg0 = paced(gsap.timeline({
        repeat: -1,
        repeatDelay: 5,
        defaults: { duration: 0.5, ease: "power1.out" },
      }));
      tg0.to("#face", {
        morphSVG: "#face02",
        repeat: 4,
        yoyo: true,
        onComplete() {
          tg0.repeatDelay(gsap.utils.random(4, 8, 0.25));
        },
      });

      // --- Saniye akrebinin "tik" morph'u (tg1) ---
      const tg1 = paced(gsap.timeline({
        repeat: -1,
        repeatDelay: 5,
        defaults: { duration: 1.5, ease: "bounce" },
        delay: 1,
      }));
      tg1
        .call(() => {
          const rotation = parseFloat(
            Number(gsap.getProperty(sec, "rotation")).toFixed(1),
          );
          if (
            (rotation > 30 && rotation < 150) ||
            (rotation > 210 && rotation < 330)
          ) {
            paced(gsap
              .timeline({ repeat: 0, defaults: { duration: 0.25, ease: "bounce.in" } })
              .to("#hand-sec", { morphSVG: "#handSec02" })
              .to("#hand-sec", { morphSVG: "#handSec01" }));
          }
        })
        .set(sec, {
          onComplete() {
            tg1.repeatDelay(gsap.utils.random(6, 10, 0.25));
            tg1.delay(0);
          },
        });

      // --- Dakika akrebinin "tik" morph'u (tg2) ---
      const tg2 = paced(gsap.timeline({
        repeat: -1,
        repeatDelay: 5,
        defaults: { duration: 1.5, ease: "bounce" },
        delay: 5,
      }));
      tg2
        .call(() => {
          const rotation = parseFloat(
            Number(gsap.getProperty(min, "rotation")).toFixed(1),
          );
          if (
            (rotation > 5 && rotation < 175) ||
            (rotation > 185 && rotation < 355)
          ) {
            paced(gsap
              .timeline({ repeat: 0, defaults: { duration: 0.25, ease: "bounce.in" } })
              .to("#hand-min", { morphSVG: "#handMin02" })
              .to("#hand-min", { morphSVG: "#handMin01" }));
          }
        })
        .set(min, {
          onComplete() {
            tg2.repeatDelay(gsap.utils.random(6, 10, 0.25));
            tg2.delay(0);
          },
        });

      // --- Saat akrebinin "tik" morph'u (tg3) ---
      const tg3 = paced(gsap.timeline({
        repeat: -1,
        repeatDelay: 5,
        defaults: { duration: 1.5, ease: "bounce" },
        delay: 7,
      }));
      tg3
        .call(() => {
          const rotation = parseFloat(
            Number(gsap.getProperty(hr, "rotation")).toFixed(1),
          );
          if (
            (rotation > 2 && rotation < 178) ||
            (rotation > 182 && rotation < 358)
          ) {
            paced(gsap
              .timeline({ repeat: 0, defaults: { duration: 0.25, ease: "bounce.in" } })
              .to("#hand-hr", { morphSVG: "#handHr02" })
              .to("#hand-hr", { morphSVG: "#handHr01" }));
          }
        })
        .set(hr, {
          onComplete() {
            tg3.repeatDelay(gsap.utils.random(6, 10, 0.25));
            tg3.delay(0);
          },
        });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      className="spider-clock"
      ref={rootRef}
      role="img"
      aria-label="Mekanik duvar saati"
      // Referans işaretlemesi olduğu gibi basılır (43 KB SVG).
      // Salt-okunur statik içerik olduğu için güvenli.
      dangerouslySetInnerHTML={{ __html: SPIDER_CLOCK_MARKUP }}
    />
  );
}
