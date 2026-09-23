/**
 * Örümcek imleci.
 *
 * Fareyi yumuşak bir gecikmeyle takip eden, 8 bacaklı bir örümcek.
 * Bacaklar yürüme döngüsüyle (sinüs fazı) hareket eder; hız arttıkça
 * adım sıklığı artar.
 *
 * Referans: "Spider Cursor Animation" (gsap tabanlıydı — burada bağımlılıksız,
 * canvas ile yeniden yazıldı).
 */

import { useEffect, useRef } from "react";

interface SpiderCursorProps {
  /** İz (ağ) uzunluğu — 0 ise iz çizilmez */
  trail: number;
  color?: string;
}

interface Point {
  x: number;
  y: number;
}

export function SpiderCursor({ trail, color = "#00ff9c" }: SpiderCursorProps) {
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

    const mouse: Point = { x: width / 2, y: height / 2 };
    let spider: Point = { x: mouse.x, y: mouse.y };
    let bodyAngle = 0;
    let walkPhase = 0;

    const history: Point[] = [];

    function onMove(event: PointerEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize);

    /** Bacak çizer: kalça → diz → ayak, dikey dalga ile */
    function drawLeg(
      cx: number,
      cy: number,
      side: number,
      index: number,
      legPhase: number,
      facing: number,
    ) {
      const spread = 0.62 + index * 0.24; // kalça açısı
      const baseAngle = facing + side * spread;

      const hipLength = 6;
      const shinLength = 11;
      const footLength = 5;

      // Dikey salınım — yürüme
      const lift = Math.sin(legPhase) * 4;
      const swing = Math.cos(legPhase) * 3;

      const hipX = cx + Math.cos(baseAngle) * hipLength * 0.4;
      const hipY = cy + Math.sin(baseAngle) * hipLength * 0.4;

      const kneeAngle = baseAngle + side * (0.5 + Math.sin(legPhase) * 0.18);
      const kneeX = hipX + Math.cos(kneeAngle) * shinLength;
      const kneeY = hipY + Math.sin(kneeAngle) * shinLength - lift;

      const footAngle = kneeAngle + side * 0.9;
      const footX = kneeX + Math.cos(footAngle) * footLength + swing * 0.35;
      const footY = kneeY + Math.sin(footAngle) * footLength;

      ctx!.beginPath();
      ctx!.moveTo(hipX, hipY);
      ctx!.lineTo(kneeX, kneeY);
      ctx!.lineTo(footX, footY);
      ctx!.stroke();
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);

      // --- KESİN KONUM GÖSTERGESİ ---
      // Örümcek geriden takip ettiği için, tıklanacak gerçek noktayı
      // işaretler. `cursor: none` iken nişan almayı mümkün kılar.
      ctx!.save();
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1;
      ctx!.globalAlpha = 0.9;
      ctx!.beginPath();
      ctx!.arc(mouse.x, mouse.y, 5.5, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(mouse.x, mouse.y, 1.6, 0, Math.PI * 2);
      ctx!.fillStyle = color;
      ctx!.fill();
      ctx!.globalAlpha = 1;
      ctx!.restore();

      // Gövde fareyi yumuşak takip eder
      const dx = mouse.x - spider.x;
      const dy = mouse.y - spider.y;
      const distance = Math.hypot(dx, dy);

      spider.x += dx * 0.12;
      spider.y += dy * 0.12;

      // Yürüme döngüsü hıza bağlı
      walkPhase += Math.min(distance * 0.09, 0.7);

      // Gövde açısı: hedefe döner
      if (distance > 1.2) {
        const target = Math.atan2(dy, dx);
        let delta = target - bodyAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        bodyAngle += delta * 0.18;
      }

      // --- Ağ izi ---
      if (trail > 0) {
        history.unshift({ x: spider.x, y: spider.y });
        if (history.length > trail) history.length = trail;

        ctx!.beginPath();
        ctx!.strokeStyle = color;
        ctx!.globalAlpha = 0.28;
        ctx!.lineWidth = 0.8;
        ctx!.setLineDash([2, 4]);
        for (let i = 0; i < history.length; i += 1) {
          const point = history[i];
          if (!point) continue;
          if (i === 0) ctx!.moveTo(point.x, point.y);
          else ctx!.lineTo(point.x, point.y);
        }
        ctx!.stroke();
        ctx!.setLineDash([]);
        ctx!.globalAlpha = 1;
      }

      // --- Bacaklar (arka sıra) ---
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1.4;
      ctx!.lineCap = "round";
      ctx!.globalAlpha = 0.55;
      for (let side = -1; side <= 1; side += 2) {
        for (let index = 0; index < 4; index += 1) {
          const legPhase = walkPhase + index * 1.1 + (side > 0 ? Math.PI : 0);
          drawLeg(spider.x, spider.y, side, index, legPhase, bodyAngle + Math.PI);
        }
      }
      ctx!.globalAlpha = 1;

      // --- Gövde ---
      ctx!.save();
      ctx!.translate(spider.x, spider.y);
      ctx!.rotate(bodyAngle);

      ctx!.fillStyle = "rgba(5, 7, 10, 0.92)";
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1.4;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.stroke();

      // Baş (öne doğru küçük daire)
      ctx!.beginPath();
      ctx!.ellipse(8, 0, 4.4, 3.6, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.stroke();

      // Gözler
      ctx!.fillStyle = color;
      ctx!.beginPath();
      ctx!.arc(9.4, -1.7, 1.05, 0, Math.PI * 2);
      ctx!.arc(9.4, 1.7, 1.05, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.restore();

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
