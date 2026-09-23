/**
 * Ceza ekranı — "The Impossible Light Bulb".
 *
 * ⚠️ BİREBİR PORT. Yapı, sınıf adları, SVG ve zaman çizelgesi referanstan
 * (`The impossible light bulb/index.html` + `script.js`) **birebir** alınmıştır.
 *
 * Nasıl çalışır (referanstaki gibi):
 *   1. Lambanın **ipini sürükle** (>50px) → ampul yanar/söner
 *   2. Her çekişte ayı **kapıyı açar**, pençe atar, kapıyı **çarpar**
 *   3. Çekiş sayısı arttıkça ayı **öfkelenir** — 4. çekişte kaşları çatılır
 *
 * Referans: jhey (CodePen) — GSAP + MorphSVGPlugin + Draggable.
 * MorphSVGPlugin artık GSAP 3.13+ ile **ücretsiz** ve npm paketinde gelir.
 *
 * Not: Referans `--on` değişkenini `document.documentElement`'e yazıyordu;
 * burada ekranın kendi köküne yazılır (sayfayı ele geçirmesin).
 */

import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSettingsStore } from "../settings/store";
import type { LoginTheme } from "./types";
import "./PunishmentScreen.css";

gsap.registerPlugin(MorphSVGPlugin, Draggable);

interface PunishmentScreenProps {
  theme: LoginTheme;
  /** Kaç saniye ceza */
  seconds: number;
  /** Süre dolduğunda */
  onFinished: () => void;
  /** Kaç yanlış deneme yapıldı */
  wrongAttempts: number;
}

/** Referanstaki ses dosyaları — yerel kopyalar. */
const AUDIO = {
  BEAR_LONG: "/audio/bulb/bear-groan-long.mp3",
  BEAR_SHORT: "/audio/bulb/bear-groan-short.mp3",
  DOOR_OPEN: "/audio/bulb/door-open.mp3",
  DOOR_CLOSE: "/audio/bulb/door-close.mp3",
  CLICK: "/audio/bulb/click.mp3",
} as const;

type SoundKey = keyof typeof AUDIO;

/** Referans: `CONFIG` nesnesi — birebir. */
const CONFIG = {
  ARM_DUR: 0.4,
  CLENCH_DUR: 0.1,
  BEAR_START: 40,
  BEAR_FINISH: -55,
  BEAR_ROTATE: -50,
  DOOR_OPEN: 25,
  INTRO_DELAY: 1,
  BEAR_APPEARANCE: 2,
  SLAM: 3,
  BROWS: 4,
} as const;

/** Referans: `CORD_DURATION` */
const CORD_DURATION = 0.1;

export function PunishmentScreen({
  theme,
  seconds,
  onFinished,
  wrongAttempts,
}: PunishmentScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState(seconds);

  const soundEnabled = useSettingsStore(
    (state) => state.settings.login.punishment.sound,
  );
  const globalSound = useSettingsStore(
    (state) => state.settings.appearance.soundEnabled,
  );
  const canPlaySound = soundEnabled && globalSound;
  const soundRef = useRef(canPlaySound);
  soundRef.current = canPlaySound;

  /** Kaç kez ip çekildi — referanstaki `STATE.ANGER` ekranda da gösterilir. */
  const [pulls, setPulls] = useState(0);

  /** Sesleri önceden yükle (mobil tarayıcılar için). */
  const audioRef = useRef<Partial<Record<SoundKey, HTMLAudioElement>>>({});

  useEffect(() => {
    const bag: Partial<Record<SoundKey, HTMLAudioElement>> = {};
    for (const [key, src] of Object.entries(AUDIO) as [SoundKey, string][]) {
      const audio = new Audio(src);
      audio.preload = "auto";
      bag[key] = audio;
    }
    audioRef.current = bag;
  }, []);

  const play = useMemo(
    () =>
      (key: SoundKey, volume = 0.5): void => {
        if (!soundRef.current) return;
        const base = audioRef.current[key];
        if (!base) return;
        try {
          const node = base.cloneNode(true) as HTMLAudioElement;
          node.volume = volume;
          void node.play().catch(() => {
            /* otomatik oynatma engeli — yut */
          });
        } catch {
          /* ses desteklenmiyor */
        }
      },
    [],
  );

  // ------------------------------------------------------------------
  // Geri sayım
  // ------------------------------------------------------------------
  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onFinished();
      return undefined;
    }
    const timer = window.setTimeout(
      () => setRemaining((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [remaining, onFinished]);

  // ------------------------------------------------------------------
  // GSAP sahnesi — referans `script.js` mantığı birebir
  // ------------------------------------------------------------------
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const ctx = gsap.context(() => {
      // --- Referans: değişkenler ---
      let startX = 0;
      let startY = 0;

      const INPUT = root.querySelector<HTMLInputElement>("#light-mode");
      const ARMS = root.querySelectorAll(".bear__arm");
      const PAW = root.querySelector(".bear__paw");
      const CORDS =
        root.querySelectorAll<SVGPathElement>(".toggle-scene__cord");
      const HIT = root.querySelector(".toggle-scene__hit-spot");
      const DUMMY = root.querySelector(".toggle-scene__dummy-cord");
      const DUMMY_CORD =
        root.querySelector<SVGLineElement>(".toggle-scene__dummy-cord line");
      const PROXY = document.createElement("div");

      if (!DUMMY_CORD || !INPUT || !PAW || !HIT || !DUMMY) return;

      root.appendChild(PROXY);

      const endY = DUMMY_CORD.getAttribute("y2") ?? "0";
      const endX = DUMMY_CORD.getAttribute("x2") ?? "0";

      /** Referans: `RESET` */
      const RESET = (): void => {
        gsap.set(PROXY, { x: endX, y: endY });
      };

      /** Referans: `STATE` */
      const STATE = { ON: false, ANGER: 0 };

      // --- Referans: başlangıç ayarları ---
      gsap.set(PAW, { transformOrigin: "50% 50%", xPercent: -30 });
      gsap.set(".bulb", { z: 10 });
      gsap.set(ARMS, {
        xPercent: 10,
        rotation: -90,
        transformOrigin: "100% 50%",
        yPercent: -2,
        display: "block",
      });

      gsap.set(".bear__brows", { display: "none" });
      gsap.set(".bear", {
        rotate: CONFIG.BEAR_ROTATE,
        xPercent: CONFIG.BEAR_START,
        transformOrigin: "50% 50%",
        scale: 0,
        display: "block",
      });

      RESET();

      /** Referans: `CORD_TL` — ipi morph ederek titretir. */
      const CORD_TL = (): gsap.core.Timeline => {
        const TL = gsap.timeline({
          paused: false,
          onStart: () => {
            STATE.ON = !STATE.ON;
            INPUT.checked = !STATE.ON;
            gsap.set(root, { "--on": STATE.ON ? 1 : 0 });
            gsap.set([DUMMY], { display: "none" });
            gsap.set(CORDS[0], { display: "block" });
            play("CLICK", 0.4);
            setPulls(() => STATE.ANGER);
          },
          onComplete: () => {
            gsap.set([DUMMY], { display: "block" });
            gsap.set(CORDS[0], { display: "none" });
            RESET();
          },
        });

        for (let i = 1; i < CORDS.length; i += 1) {
          TL.add(
            gsap.to(CORDS[0], {
              morphSVG: CORDS[i],
              duration: CORD_DURATION,
              repeat: 1,
              yoyo: true,
            }),
          );
        }
        return TL;
      };

      /** Referans: `BEAR_TL` — kapı açılır, ayı pençe atar, kapı çarpar. */
      const BEAR_TL = (): gsap.core.Timeline => {
        const ARM_SWING = STATE.ANGER > 4 ? 0.2 : CONFIG.ARM_DUR;
        const SLIDE =
          STATE.ANGER > CONFIG.BROWS + 3 ? 0.2 : gsap.utils.random(0.2, 0.6);
        const CLOSE_DELAY =
          STATE.ANGER >= CONFIG.INTRO_DELAY ? gsap.utils.random(0.2, 2) : 0;

        const TL = gsap
          .timeline({ paused: false })
          .to(".door", {
            onStart: () => play("DOOR_OPEN", 0.5),
            rotateY: 25,
            duration: 0.2,
          })
          .add(
            STATE.ANGER >= CONFIG.BEAR_APPEARANCE && Math.random() > 0.25
              ? gsap.to(".bear", {
                  onStart: () => {
                    gsap.set(".bear", { scale: 1 });
                  },
                  xPercent: CONFIG.BEAR_FINISH,
                  repeat: 1,
                  repeatDelay: 1,
                  yoyo: true,
                  duration: SLIDE,
                })
              : () => {
                  /* referansta boş */
                },
          )
          .to(ARMS, {
            delay: CLOSE_DELAY,
            duration: ARM_SWING,
            rotation: 0,
            xPercent: 0,
            yPercent: 0,
          })
          .to(
            [PAW, "#knuckles"],
            {
              duration: CONFIG.CLENCH_DUR,
              xPercent: (_, target: Element) =>
                target.id === "knuckles" ? 10 : 0,
            },
            `>-${ARM_SWING * 0.5}`,
          )
          .to(ARMS, { duration: ARM_SWING * 0.5, rotation: 5 })
          .to(ARMS, {
            rotation: -90,
            xPercent: 10,
            duration: ARM_SWING,
            onComplete: () => {
              gsap.to(".door", {
                onComplete: () => play("DOOR_CLOSE", 0.42),
                duration: 0.2,
                rotateY: 0,
              });
            },
          })
          .to(
            DUMMY_CORD,
            {
              duration: CONFIG.CLENCH_DUR,
              attr: {
                x2: parseInt(endX, 10) + 20,
                y2: parseInt(endY, 10) + 60,
              },
            },
            "<",
          )
          .to(
            DUMMY_CORD,
            { duration: CONFIG.CLENCH_DUR, attr: { x2: endX, y2: endY } },
            ">",
          )
          .to(
            [PAW, "#knuckles"],
            {
              duration: CONFIG.CLENCH_DUR,
              xPercent: (_, target: Element) =>
                target.id === "knuckles" ? 0 : -28,
            },
            "<",
          )
          .add(() => CORD_TL(), "<");

        return TL;
      };

      /** Referans: `IMPOSSIBLE_TL` */
      const IMPOSSIBLE_TL = (): gsap.core.Timeline =>
        gsap
          .timeline({
            onStart: () => gsap.set(HIT, { display: "none" }),
            onComplete: () => {
              gsap.set(HIT, { display: "block" });
              STATE.ANGER += 1;
              if (STATE.ANGER >= CONFIG.BROWS) {
                gsap.set(".bear__brows", { display: "block" });
              }
              if (soundRef.current) {
                play(Math.random() > 0.5 ? "BEAR_LONG" : "BEAR_SHORT", 0.35);
              }
            },
          })
          .add(CORD_TL())
          .add(BEAR_TL());

      // --- Referans: Draggable — ipi sürükle ---
      Draggable.create(PROXY, {
        trigger: HIT,
        type: "x,y",
        onPress: (event: PointerEvent & { x: number; y: number }) => {
          startX = event.x;
          startY = event.y;
          RESET();
        },
        onDrag(this: Draggable) {
          gsap.set(DUMMY_CORD, {
            attr: { x2: this.x, y2: this.y },
          });
        },
        onRelease(this: Draggable, event: PointerEvent & { x: number; y: number }) {
          const DISTX = Math.abs(event.x - startX);
          const DISTY = Math.abs(event.y - startY);
          const TRAVELLED = Math.sqrt(DISTX * DISTX + DISTY * DISTY);

          gsap.to(DUMMY_CORD, {
            attr: { x2: endX, y2: endY },
            duration: CORD_DURATION,
            onComplete: () => {
              // Referans: 50'den fazla çekildiyse sahne oynar
              if (TRAVELLED > 50) {
                IMPOSSIBLE_TL();
              } else {
                RESET();
              }
            },
          });
        },
      });

      // --- Açılışta kapı sesi (referans dışı, atmosfer) ---
      play("DOOR_OPEN", 0.45);
      const opener = window.setTimeout(() => play("DOOR_CLOSE", 0.35), 1400);

      return () => {
        window.clearTimeout(opener);
        PROXY.remove();
      };
    }, root);

    return () => ctx.revert();
  }, [play]);

  // ------------------------------------------------------------------
  // Görsel
  // ------------------------------------------------------------------
  const style = useMemo(
    () =>
      ({
        "--pun-accent": theme.colors.accent,
        "--pun-font": theme.font,
      }) as React.CSSProperties,
    [theme],
  );

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = seconds > 0 ? 1 - remaining / seconds : 1;

  return (
    <div className="punishment" style={style} ref={rootRef}>
      {/* ---------- Referans işaretlemesi (birebir) ---------- */}
      <div className="toggle">
        <input id="light-mode" type="checkbox" readOnly />
        <svg
          className="toggle-scene"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMinYMin"
          viewBox="0 0 197.451 581.081"
        >
          <defs>
            <marker
              id="e"
              orient="auto"
              overflow="visible"
              refX="0"
              refY="0"
            >
              <path
                className="toggle-scene__cord-end"
                fillRule="evenodd"
                strokeWidth=".2666"
                d="M.98 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </marker>
            <marker
              id="d"
              orient="auto"
              overflow="visible"
              refX="0"
              refY="0"
            >
              <path
                className="toggle-scene__cord-end"
                fillRule="evenodd"
                strokeWidth=".2666"
                d="M.98 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </marker>
            <marker
              id="c"
              orient="auto"
              overflow="visible"
              refX="0"
              refY="0"
            >
              <path
                className="toggle-scene__cord-end"
                fillRule="evenodd"
                strokeWidth=".2666"
                d="M.98 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </marker>
            <marker
              id="b"
              orient="auto"
              overflow="visible"
              refX="0"
              refY="0"
            >
              <path
                className="toggle-scene__cord-end"
                fillRule="evenodd"
                strokeWidth=".2666"
                d="M.98 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </marker>
            <marker
              id="a"
              orient="auto"
              overflow="visible"
              refX="0"
              refY="0"
            >
              <path
                className="toggle-scene__cord-end"
                fillRule="evenodd"
                strokeWidth=".2666"
                d="M.98 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </marker>
            <clipPath id="scene" clipPathUnits="userSpaceOnUse">
              <rect x="0" y="0" width="208.5" height="581.081" />
            </clipPath>
            <clipPath id="g" clipPathUnits="userSpaceOnUse">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4.677"
                d="M-774.546 827.629s12.917-13.473 29.203-13.412c16.53.062 29.203 13.412 29.203 13.412v53.6s-8.825 16-29.203 16c-21.674 0-29.203-16-29.203-16z"
              />
            </clipPath>
            <clipPath id="knuckles" clipPathUnits="userSpaceOnUse">
              <path d="M-868.418 945.051c-4.188 73.011 78.255 53.244 150.216 52.941 82.387-.346 98.921-19.444 98.921-47.058 0-27.615-4.788-42.55-73.823-42.55-69.036 0-171.436-30.937-175.314 36.667z" />
            </clipPath>
          </defs>

          <g clipPath="url(#scene)">
            <g className="toggle-scene__arm toggle-scene__arm--main bear__arm bear__arm--back">
              <g transform="translate(905.657 -597.025)" clipPath="url(#knuckles)">
                <path
                  className="bear__fur"
                  d="M-868.418 945.051c-4.188 73.011 78.255 53.244 150.216 52.941 82.387-.346 98.921-19.444 98.921-47.058 0-27.615-4.788-42.55-73.823-42.55-69.036 0-171.436-30.937-175.314 36.667z"
                />
                <ellipse
                  className="bear__pad"
                  cx="804.83"
                  cy="950.986"
                  rx="29.911"
                  ry="29.414"
                  transform="scale(-1 1)"
                />
              </g>
            </g>
          </g>

          <g className="toggle-scene__cords">
            <path
              className="toggle-scene__cord"
              markerEnd="url(#a)"
              fill="none"
              strokeLinecap="square"
              strokeWidth="6"
              d="M123.228-28.56v150.493"
              transform="translate(-24.503 256.106)"
            />
            <path
              className="toggle-scene__cord"
              markerEnd="url(#a)"
              fill="none"
              strokeLinecap="square"
              strokeWidth="6"
              d="M123.228-28.59s28 8.131 28 19.506-18.667 13.005-28 19.507c-9.333 6.502-28 8.131-28 19.506s28 19.507 28 19.507"
              transform="translate(-24.503 256.106)"
            />
            <path
              className="toggle-scene__cord"
              markerEnd="url(#a)"
              fill="none"
              strokeLinecap="square"
              strokeWidth="6"
              d="M123.228-28.575s-20 16.871-20 28.468c0 11.597 13.333 18.978 20 28.468 6.667 9.489 20 16.87 20 28.467 0 11.597-20 28.468-20 28.468"
              transform="translate(-24.503 256.106)"
            />
            <path
              className="toggle-scene__cord"
              markerEnd="url(#a)"
              fill="none"
              strokeLinecap="square"
              strokeWidth="6"
              d="M123.228-28.569s16 20.623 16 32.782c0 12.16-10.667 21.855-16 32.782-5.333 10.928-16 20.623-16 32.782 0 12.16 16 32.782 16 32.782"
              transform="translate(-24.503 256.106)"
            />
            <path
              className="toggle-scene__cord"
              markerEnd="url(#a)"
              fill="none"
              strokeLinecap="square"
              strokeWidth="6"
              d="M123.228-28.563s-10 24.647-10 37.623c0 12.977 6.667 25.082 10 37.623 3.333 12.541 10 24.647 10 37.623 0 12.977-10 37.623-10 37.623"
              transform="translate(-24.503 256.106)"
            />
            <g className="line toggle-scene__dummy-cord">
              <line
                markerEnd="url(#a)"
                x1="98.7255"
                x2="98.7255"
                y1="250.5405"
                y2="380.5405"
              />
            </g>
            <circle
              className="toggle-scene__hit-spot"
              cx="98.7255"
              cy="380.5405"
              r="60"
              fill="transparent"
            />
          </g>

          <g className="toggle-scene__bulb bulb" transform="translate(844.069 -645.213)">
            <path
              className="bulb__cap"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4.677"
              d="M-774.546 827.629s12.917-13.473 29.203-13.412c16.53.062 29.203 13.412 29.203 13.412v53.6s-8.825 16-29.203 16c-21.674 0-29.203-16-29.203-16z"
            />
            <path
              className="bulb__cap-shine"
              d="M-778.379 802.873h25.512v118.409h-25.512z"
              clipPath="url(#g)"
              transform="matrix(.52452 0 0 .90177 -368.282 82.976)"
            />
            <path
              className="bulb__cap"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
              d="M-774.546 827.629s12.917-13.473 29.203-13.412c16.53.062 29.203 13.412 29.203 13.412v0s-8.439 10.115-28.817 10.115c-21.673 0-29.59-10.115-29.59-10.115z"
            />
            <path
              className="bulb__cap-outline"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4.677"
              d="M-774.546 827.629s12.917-13.473 29.203-13.412c16.53.062 29.203 13.412 29.203 13.412v53.6s-8.825 16-29.203 16c-21.674 0-29.203-16-29.203-16z"
            />
            <g className="bulb__filament" fill="none" strokeLinecap="round" strokeWidth="5">
              <path d="M-752.914 823.875l-8.858-33.06" />
              <path d="M-737.772 823.875l8.858-33.06" />
            </g>
            <path
              className="bulb__bulb"
              strokeLinecap="round"
              strokeWidth="5"
              d="M-783.192 803.855c5.251 8.815 5.295 21.32 13.272 27.774 12.299 8.045 36.46 8.115 49.127 0 7.976-6.454 8.022-18.96 13.273-27.774 3.992-6.7 14.408-19.811 14.408-19.811 8.276-11.539 12.769-24.594 12.769-38.699 0-35.898-29.102-65-65-65-35.899 0-65 29.102-65 65 0 13.667 4.217 26.348 12.405 38.2 0 0 10.754 13.61 14.746 20.31z"
            />
            <circle
              className="bulb__flash"
              cx="-745.343"
              cy="743.939"
              r="83.725"
              fill="none"
              strokeDasharray="10,30"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="10"
            />
            <path
              className="bulb__shine"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="12"
              d="M-789.19 757.501a45.897 45.897 0 013.915-36.189 45.897 45.897 0 0129.031-21.957"
            />
          </g>

          <g clipPath="url(#scene)">
            <g className="toggle-scene__arm toggle-scene__arm--front bear__arm bear__arm--front">
              <g transform="translate(905.657 -597.025)">
                <path
                  fill="transparent"
                  d="M-868.418 945.051c-4.188 73.011 78.255 53.244 150.216 52.941 82.387-.346 98.921-19.444 98.921-47.058 0-27.615-4.788-42.55-73.823-42.55-69.036 0-171.436-30.937-175.314 36.667z"
                />
                <ellipse
                  cx="804.83"
                  cy="950.986"
                  fill="transparent"
                  rx="29.911"
                  ry="29.414"
                  transform="scale(-1 1)"
                />
              </g>
              <g clipPath="url(#knuckles)" transform="translate(905.657 -597.025)">
                <path
                  className="toggle-scene__paw bear__paw bear__fur"
                  d="M-798.725 945.051c4.188 73.011-78.254 53.244-150.215 52.941-82.387-.346-98.922-19.444-98.922-47.058 0-27.615 4.788-42.55 73.824-42.55 69.035 0 171.436-30.937 175.313 36.667z"
                />
              </g>
            </g>
          </g>
        </svg>
      </div>

      <div className="doorway">
        <div className="doorway__opening" />
        <svg className="bear" viewBox="0 0 284.946 359.737">
          <g transform="translate(-42.557 -974.222) scale(1.23353)">
            <path
              className="bear__fur"
              d="M263.91 1081.415a113.968 96.863 0 00-113.919-95.7 113.968 96.863 0 00-113.9 95.7h227.818z"
            />
            <path
              className="bear__fur"
              d="M250.428 903.362c0 66.271-44.754 114.995-102.428 114.995s-98.428-48.724-98.428-114.995c0-66.27 40.754-92.994 98.428-92.994s102.428 26.723 102.428 92.994z"
            />
            <path
              d="M217 972.862c0 21.54-30.445 42-68 42s-66-20.46-66-42c0-21.539 28.445-36 66-36s68 14.461 68 36z"
              fill="#e9c6af"
            />
            <path d="M181.5 944.362c0 8.284-20.6 26.5-32.75 26.5-12.15 0-34.75-18.216-34.75-26.5 0-8.284 22.6-13.5 34.75-13.5 12.15 0 32.75 5.216 32.75 13.5z" />
            <ellipse className="bear__fur" cx="69" cy="823.073" rx="34.5" ry="33.289" />
            <path
              d="M69 799.673a24.25 23.4 0 00-24.25 23.4 24.25 23.4 0 0019.97 23.01c.277-.407.505-.868.788-1.268a71.11 71.11 0 0111.65-12.802 73.691 73.691 0 016.856-5.227 79.249 79.249 0 017.498-4.469c.54-.283 1.133-.5 1.681-.773A24.25 23.4 0 0069 799.673z"
              fill="#e9c6af"
            />
            <g transform="matrix(-1 0 0 1 300 0)">
              <ellipse className="bear__fur" ry="33.289" rx="34.5" cy="823.073" cx="69" />
              <path
                d="M69 799.673a24.25 23.4 0 00-24.25 23.4 24.25 23.4 0 0019.97 23.01c.277-.407.505-.868.788-1.268a71.11 71.11 0 0111.65-12.802 73.691 73.691 0 016.856-5.227 79.249 79.249 0 017.498-4.469c.54-.283 1.133-.5 1.681-.773A24.25 23.4 0 0069 799.673z"
                fill="#e9c6af"
              />
            </g>
            <ellipse ry="9.679" rx="9.27" cy="900.389" cx="105.831" />
            <ellipse cx="186.899" cy="900.389" rx="9.27" ry="9.679" />
            <path
              className="bear__brows"
              d="M92.058 865.461l39.427 22.763M202.825 865.461l-39.427 22.763"
              fill="none"
              stroke="#000"
              strokeWidth="4.864"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
        <div className="doorway__door door">
          <div className="door__side">
            <div className="door__panel" />
            <div className="door__panel" />
            <div className="door__panel" />
            <div className="door__panel" />
            <div className="door__handle">
              <div />
              <div />
            </div>
          </div>
          <div className="door__side" />
        </div>
      </div>

      {/* ---------- PIXTOOL eklentisi: üst şerit ---------- */}
      <div className="punishment__topbar">
        <span>
          ⛔ Erişim kilitli — <b>{wrongAttempts}</b> yanlış deneme
        </span>
        <span>
          İpi <b>sürükle</b> — ayı {pulls >= 4 ? "çok" : "biraz"} sinirli
        </span>
      </div>

      {/* ---------- PIXTOOL eklentisi: alt şerit (sayaç + kayan yazı) ---------- */}
      <div className="punishment__bottom">
        <div className="punishment__timer">
          <small>Bekleme süresi</small>
          <span>
            {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <small>· {pulls} çekiş</small>
        </div>

        <div className="punishment__progress" aria-hidden="true">
          <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>

        <div className="punishment__marquee" aria-live="off">
          <div className="punishment__marquee-track">
            <span>
              Doğrulama kodu <b>3 kez</b> yanlış girildi — hesap geçici olarak
              kilitlendi
            </span>
            <span>Kapıyı çalmayı deneyebilirsin, ayı pek memnun değil</span>
            <span>
              Kalan süre: <b>{String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}</b>
            </span>
            <span>Süre dolunca doğrulama ekranına döneceksin</span>
            <span>Ampulün ipini çekmek ücretsiz — sıkılmamanı istemeyiz :)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
