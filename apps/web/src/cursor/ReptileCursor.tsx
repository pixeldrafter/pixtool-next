/**
 * Sürüngen (kertenkele) imleci — etkileşimli.
 *
 * Fareyi takip eden, gövdesi halka halka sürüklenen bir kertenkele.
 * Yakınındaki arayüz öğelerine (buton, kart) yaklaşınca "ilgilenir":
 * başını çevirir ve diliyle dokunur.
 *
 * Referans: "Reptile Interactive Cursor" — bağımlılıksız, canvas ile yeniden yazıldı.
 */

import { useEffect, useRef } from "react";

interface ReptileCursorProps {
  /** Kuyruk uzunluğu (halka sayısı) */
  trail: number;
  color?: string;
}

interface Segment {
  x: number;
  y: number;
}

export function ReptileCursor({ trail, color = "#b6ff3d" }: ReptileCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const mouse = { x: width / 2, y: height / 2 };
    /** Halka sayısı: ayardaki iz uzunluğuna bağlı (en az 6, en çok 40) */
    const segmentCount = Math.min(40, Math.max(6, trail + 6));
    const segments: Segment[] = Array.from({ length: segmentCount }, () => ({
      x: mouse.x,
      y: mouse.y,
    }));

    let headAngle = 0;
    let walkPhase = 0;
    let tongueTimer = 0;
    let interested = false;
    let blinkTimer = Math.random() * 200;

    function onMove(event: PointerEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;

      // Etkileşim: bir arayüz öğesinin üzerinde miyiz?
      const element = document.elementFromPoint(event.clientX, event.clientY);
      interested = Boolean(
        element?.closest("button, a, input, select, textarea, [role='button'], .ui-card"),
      );
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize);

    function frame() {
      ctx!.clearRect(0, 0, width, height);

      // --- Gövde zinciri: her halka bir öncekini takip eder ---
      const head = segments[0];
      if (head) {
        head.x += (mouse.x - head.x) * 0.32;
        head.y += (mouse.y - head.y) * 0.32;
      }

      for (let i = 1; i < segments.length; i += 1) {
        const current = segments[i];
        const previous = segments[i - 1];
        if (!current || !previous) continue;
        const ease = 0.42 - Math.min(i * 0.004, 0.2);
        current.x += (previous.x - current.x) * ease;
        current.y += (previous.y - current.y) * ease;
      }

      // Yön
      const second = segments[1] ?? head;
      if (head && second) {
        const dx = head.x - second.x;
        const dy = head.y - second.y;
        if (Math.hypot(dx, dy) > 0.6) {
          headAngle = Math.atan2(dy, dx);
          walkPhase += 0.22;
        }
      }

      // --- Kuyruk ---
      ctx!.lineCap = "round";
      for (let i = segments.length - 1; i >= 1; i -= 1) {
        const current = segments[i];
        if (!current) continue;
        const ratio = i / segments.length;
        const radius = Math.max(1.2, 7.2 * (1 - ratio));

        ctx!.beginPath();
        ctx!.strokeStyle = color;
        ctx!.globalAlpha = 0.75 * (1 - ratio * 0.7);
        ctx!.lineWidth = radius * 1.8;
        const next = segments[i - 1];
        if (next) {
          ctx!.moveTo(current.x, current.y);
          ctx!.lineTo(next.x, next.y);
          ctx!.stroke();
        }
      }
      ctx!.globalAlpha = 1;

      // --- Bacaklar (gövde boyunca birkaç çift) ---
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1.5;
      ctx!.globalAlpha = 0.8;
      for (const legIndex of [3, 7, 12, 17]) {
        const segment = segments[legIndex];
        if (!segment) continue;
        const phase = walkPhase + legIndex * 0.9;
        for (let side = -1; side <= 1; side += 2) {
          const swing = Math.cos(phase) * 0.35 * side;
          const angle = headAngle + Math.PI / 2 + side * 0.75 + swing;
          const length = 9;
          ctx!.beginPath();
          ctx!.moveTo(segment.x, segment.y);
          ctx!.lineTo(
            segment.x + Math.cos(angle) * length,
            segment.y + Math.sin(angle) * length,
          );
          ctx!.stroke();
        }
      }
      ctx!.globalAlpha = 1;

      // --- Baş ---
      if (head) {
        ctx!.save();
        ctx!.translate(head.x, head.y);
        ctx!.rotate(headAngle);

        // Gövde rengi
        ctx!.fillStyle = "rgba(5, 7, 10, 0.94)";
        ctx!.strokeStyle = color;
        ctx!.lineWidth = 1.5;

        ctx!.beginPath();
        ctx!.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.stroke();

        // Burun
        ctx!.beginPath();
        ctx!.ellipse(8.5, 0, 4, 3.2, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.stroke();

        // Gözler
        blinkTimer += 1;
        const blinking = blinkTimer % 260 > 244;
        ctx!.fillStyle = color;
        if (!blinking) {
          ctx!.beginPath();
          ctx!.arc(6.5, -2.6, 1.7, 0, Math.PI * 2);
          ctx!.arc(6.5, 2.6, 1.7, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = "#05070a";
          ctx!.beginPath();
          ctx!.arc(7, -2.6, 0.75, 0, Math.PI * 2);
          ctx!.arc(7, 2.6, 0.75, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          ctx!.strokeStyle = color;
          ctx!.beginPath();
          ctx!.moveTo(5, -2.6);
          ctx!.lineTo(8, -2.6);
          ctx!.moveTo(5, 2.6);
          ctx!.lineTo(8, 2.6);
          ctx!.stroke();
        }

        // Dil — ilgilenince daha sık ve daha uzun
        tongueTimer += 1;
        const fire = interested ? 42 : 130;
        if (tongueTimer % fire < 10) {
          const extend = Math.sin((tongueTimer % fire) / 10 * Math.PI) * (interested ? 16 : 9);
          ctx!.strokeStyle = "#ff2d95";
          ctx!.lineWidth = 1.6;
          ctx!.beginPath();
          ctx!.moveTo(11, 0);
          ctx!.quadraticCurveTo(11 + extend * 0.6, -2, 11 + extend, 0);
          ctx!.stroke();
        }

        ctx!.restore();
      }

      raf = window.requestAnimationFrame(frame);
    }

    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, [trail, color]);

  return <canvas ref={canvasRef} className="cursor-canvas" />;
}
