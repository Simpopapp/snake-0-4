// NEONVOLT — canvas renderer. Browser-only; draws everything from TableDef + view.
import type { FxState } from "./fx";
import { FRAME_WALLS } from "./frame";
import type { RenderView } from "./engine";
import { TABLE_HEIGHT, TABLE_WIDTH, type TableDef, type TableElement, type Vec2 } from "./types";

const FONT_DISPLAY = '"Bebas Neue", "Arial Narrow", sans-serif';

function pseudo(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function strokeChain(ctx: CanvasRenderingContext2D, pts: Vec2[], closed = false): void {
  const first = pts[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const pt = pts[i];
    if (pt) ctx.lineTo(pt.x, pt.y);
  }
  if (closed) ctx.closePath();
  ctx.stroke();
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function noGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  table: TableDef,
  view: RenderView,
  fx: FxState,
  t: number,
): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, cw, ch);

  const s = Math.min(cw / TABLE_WIDTH, ch / TABLE_HEIGHT);
  const ox = (cw - TABLE_WIDTH * s) / 2;
  const oy = (ch - TABLE_HEIGHT * s) / 2;

  ctx.setTransform(s, 0, 0, s, ox, oy);
  const p = table.palette;

  // background (not shaken)
  drawBackground(ctx, table, t);

  // shake
  if (fx.shake > 0) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }

  // interior walls from the table
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const w of table.walls) {
    if (w.gate) {
      // ramp gate: dashed arrow line
      ctx.save();
      ctx.strokeStyle = p.glowB;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      strokeChain(ctx, w.points);
      ctx.setLineDash([]);
      ctx.restore();
      continue;
    }
    drawWallChain(ctx, w.points, p, w.rail ?? 14);
  }

  // standard frame walls
  for (const fw of FRAME_WALLS) {
    drawWallChain(ctx, fw.pts, p, fw.t);
  }

  // elements
  for (const el of table.elements) {
    drawElement(ctx, el, table, view, t);
  }

  // flippers
  drawFlippers(ctx, table, view);

  // plunger + launch hint
  drawPlunger(ctx, table, view);

  // balls with trails
  for (const b of view.balls) drawBall(ctx, b.x, b.y, b.r, b.trail, b.ice, p);

  // particles (additive)
  if (fx.particles.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pt of fx.particles) {
      ctx.globalAlpha = Math.max(0, pt.life) * 0.9;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // jackpot flash
  if (fx.flash > 0) {
    ctx.fillStyle = p.hot;
    ctx.globalAlpha = fx.flash * 0.28;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    ctx.globalAlpha = 1;
  }

  // vignette
  const vg = ctx.createRadialGradient(270, 480, 260, 270, 480, 720);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  // TILT overlay
  if (view.tilt) {
    ctx.save();
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t / 90);
    ctx.font = `700 110px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    glow(ctx, "#ff3b3b", 40);
    ctx.fillStyle = "#ff5252";
    ctx.fillText("TILT", 270, 470);
    noGlow(ctx);
    ctx.font = `700 26px ${FONT_DISPLAY}`;
    ctx.fillStyle = "#fda4af";
    ctx.fillText("FLIPPERS BLOQUEADOS", 270, 545);
    ctx.restore();
  }

  // launch hint
  if (view.ballReady && !view.tilt) {
    const bob = Math.sin(t / 300) * 6;
    ctx.save();
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t / 300);
    ctx.strokeStyle = p.hot;
    ctx.lineWidth = 4;
    glow(ctx, p.hot, 14);
    for (let i = 0; i < 3; i++) {
      const yy = 800 - i * 26 + bob * (1 - i * 0.2);
      ctx.beginPath();
      ctx.moveTo(508, yy + 8);
      ctx.lineTo(515, yy);
      ctx.lineTo(522, yy + 8);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawWallChain(
  ctx: CanvasRenderingContext2D,
  pts: Vec2[],
  p: TableDef["palette"],
  thickness: number,
): void {
  // dark body
  ctx.strokeStyle = "rgba(6,8,16,0.92)";
  ctx.lineWidth = thickness;
  strokeChain(ctx, pts);
  // neon rail
  ctx.strokeStyle = p.wall;
  ctx.lineWidth = Math.max(2.5, thickness * 0.28);
  glow(ctx, p.wall, 12);
  strokeChain(ctx, pts);
  noGlow(ctx);
  // hot core line
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.2;
  strokeChain(ctx, pts);
}

// ----------------------------------------------------------- backgrounds

function drawBackground(ctx: CanvasRenderingContext2D, table: TableDef, t: number): void {
  const p = table.palette;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  switch (table.id) {
    case "circuito-neon": {
      // perspective grid + data rain
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = p.bgDetail;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const x = 10 + i * 45;
        ctx.beginPath();
        ctx.moveTo(x, 60);
        ctx.lineTo(x, TABLE_HEIGHT);
        ctx.stroke();
      }
      for (let j = 0; j < 16; j++) {
        const y = 80 + j * 55;
        ctx.globalAlpha = 0.05 + 0.09 * (j / 16);
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(530, y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = p.bgDetail;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 22; i++) {
        const x = pseudo(i) * 520 + 10;
        const speed = 90 + pseudo(i + 40) * 160;
        const y = ((t / 1000) * speed + pseudo(i + 90) * 960) % 1000;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(x, y - 26);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "forja-solar": {
      // heat glow + rising embers
      const g = ctx.createRadialGradient(270, 500, 40, 270, 500, 560);
      g.addColorStop(0, "rgba(249,115,22,0.30)");
      g.addColorStop(0.5, "rgba(239,68,68,0.10)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      ctx.fillStyle = p.bgDetail;
      for (let i = 0; i < 30; i++) {
        const x = pseudo(i) * 500 + 20 + Math.sin(t / 900 + i) * 14;
        const speed = 40 + pseudo(i + 50) * 70;
        const y = 990 - (((t / 1000) * speed + pseudo(i + 90) * 1000) % 1000);
        ctx.globalAlpha = 0.25 + 0.45 * pseudo(i + 130);
        ctx.beginPath();
        ctx.arc(x, y, 1 + pseudo(i + 170) * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "abissal": {
      // light shafts + drifting plankton
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const x = 80 + i * 120;
        const grad = ctx.createLinearGradient(x, 0, x + 60, 700);
        grad.addColorStop(0, "rgba(56,189,248,0.10)");
        grad.addColorStop(1, "rgba(56,189,248,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - 30, 0);
        ctx.lineTo(x + 30, 0);
        ctx.lineTo(x + 90, 720);
        ctx.lineTo(x - 60, 720);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = p.bgDetail;
      for (let i = 0; i < 36; i++) {
        const x = pseudo(i) * 500 + 20 + Math.sin(t / 1400 + i * 2) * 10;
        const speed = 18 + pseudo(i + 60) * 30;
        const y = 990 - (((t / 1000) * speed + pseudo(i + 100) * 1000) % 1000);
        ctx.globalAlpha = 0.2 + 0.4 * pseudo(i + 140);
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + pseudo(i + 180) * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "criogenese": {
      // faceted crystal veins + falling snow
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = p.bgDetail;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const x0 = 30 + pseudo(i) * 480;
        const y0 = 60 + pseudo(i + 20) * 300;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (pseudo(i + 40) - 0.5) * 220, y0 + 120 + pseudo(i + 60) * 260);
        ctx.lineTo(x0 + (pseudo(i + 80) - 0.5) * 260, y0 + 300 + pseudo(i + 100) * 300);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = p.bgDetail;
      for (let i = 0; i < 40; i++) {
        const x = pseudo(i) * 500 + 20 + Math.sin(t / 1000 + i) * 18;
        const speed = 24 + pseudo(i + 55) * 40;
        const y = (((t / 1000) * speed + pseudo(i + 95) * 1000) % 1000);
        ctx.globalAlpha = 0.3 + 0.4 * pseudo(i + 135);
        ctx.beginPath();
        ctx.arc(x, y, 1 + pseudo(i + 175) * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

// ------------------------------------------------------------- elements

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: TableElement,
  table: TableDef,
  view: RenderView,
  t: number,
): void {
  const p = table.palette;
  switch (el.kind) {
    case "bumper": {
      const pulse = 1 + 0.05 * Math.sin(t / 260 + el.pos.x);
      const color = el.color === "glowB" ? p.glowB : p.glowA;
      // outer glow disc
      const g = ctx.createRadialGradient(el.pos.x, el.pos.y, el.radius * 0.3, el.pos.x, el.pos.y, el.radius * 1.9);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(el.pos.x, el.pos.y, el.radius * 1.9 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // cap
      ctx.beginPath();
      ctx.arc(el.pos.x, el.pos.y, el.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(8,10,20,0.9)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      glow(ctx, color, 18);
      ctx.stroke();
      noGlow(ctx);
      ctx.beginPath();
      ctx.arc(el.pos.x, el.pos.y, el.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(el.pos.x - el.radius * 0.18, el.pos.y - el.radius * 0.2, el.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "sling": {
      ctx.beginPath();
      ctx.moveTo(el.a.x, el.a.y);
      ctx.lineTo(el.b.x, el.b.y);
      ctx.lineTo(el.c.x, el.c.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(8,10,20,0.9)";
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = p.glowB;
      glow(ctx, p.glowB, 14);
      ctx.stroke();
      noGlow(ctx);
      break;
    }
    case "target": {
      const down = view.targetsDown.has(el.id);
      ctx.save();
      ctx.translate(el.pos.x, el.pos.y);
      ctx.rotate(el.angle ?? 0);
      if (down) {
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = p.dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(-el.w, -el.h, el.w * 2, el.h * 2);
      } else {
        const col = p.glowB;
        ctx.fillStyle = "rgba(8,10,20,0.85)";
        ctx.fillRect(-el.w, -el.h, el.w * 2, el.h * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = col;
        glow(ctx, col, 12);
        ctx.strokeRect(-el.w, -el.h, el.w * 2, el.h * 2);
        noGlow(ctx);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-el.w + 3, -el.h + 3, el.w * 2 - 6, 5);
      }
      ctx.restore();
      break;
    }
    case "spinner": {
      const ang = view.spinnerAngles[el.id] ?? 0;
      const dx = Math.cos(ang) * (el.length / 2);
      const dy = Math.sin(ang) * (el.length / 2);
      ctx.save();
      // lane
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = p.dim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(el.pos.x - el.length / 2 - 8, el.pos.y - 14);
      ctx.lineTo(el.pos.x + el.length / 2 + 8, el.pos.y - 14);
      ctx.moveTo(el.pos.x - el.length / 2 - 8, el.pos.y + 14);
      ctx.lineTo(el.pos.x + el.length / 2 + 8, el.pos.y + 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // blade
      ctx.strokeStyle = p.glowB;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      glow(ctx, p.glowB, 16);
      ctx.beginPath();
      ctx.moveTo(el.pos.x - dx, el.pos.y - dy);
      ctx.lineTo(el.pos.x + dx, el.pos.y + dy);
      ctx.stroke();
      noGlow(ctx);
      // hub
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(el.pos.x, el.pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "kicker": {
      const pulse = 0.5 + 0.5 * Math.sin(t / 320);
      ctx.save();
      ctx.strokeStyle = p.hot;
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.lineWidth = 3;
      glow(ctx, p.hot, 16 + pulse * 10);
      ctx.beginPath();
      ctx.arc(el.pos.x, el.pos.y, el.radius, 0, Math.PI * 2);
      ctx.stroke();
      noGlow(ctx);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(el.pos.x, el.pos.y, el.radius * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

// ----------------------------------------------------------- actors

function drawFlippers(ctx: CanvasRenderingContext2D, table: TableDef, view: RenderView): void {
  const p = table.palette;
  const [flipL, flipR] = table.flippers;
  const defs = flipL && flipR ? [flipL, flipR] : [];
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (!def) continue;
    const ang = view.flipperAngles[i] ?? 0;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const nx = -dy;
    const ny = dx;
    const w0 = 11;
    const w1 = 6;
    const tipX = def.pivot.x + dx * def.length;
    const tipY = def.pivot.y + dy * def.length;
    ctx.beginPath();
    ctx.moveTo(def.pivot.x + nx * w0, def.pivot.y + ny * w0);
    ctx.lineTo(tipX + nx * w1, tipY + ny * w1);
    ctx.lineTo(tipX - nx * w1, tipY - ny * w1);
    ctx.lineTo(def.pivot.x - nx * w0, def.pivot.y - ny * w0);
    ctx.closePath();
    ctx.fillStyle = view.tilt ? "rgba(60,20,25,0.95)" : "rgba(10,12,24,0.95)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = view.tilt ? "#ff5252" : p.wall;
    glow(ctx, view.tilt ? "#ff5252" : p.wall, 14);
    ctx.stroke();
    noGlow(ctx);
    // pivot cap
    ctx.fillStyle = p.wall;
    ctx.beginPath();
    ctx.arc(def.pivot.x, def.pivot.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlunger(
  ctx: CanvasRenderingContext2D,
  table: TableDef,
  view: RenderView,
): void {
  const p = table.palette;
  const laneX = table.launch.x;
  const charge = view.plungerCharge;
  const knobY = table.launch.ballRestY + 26 + charge * 26;
  // spring
  ctx.strokeStyle = p.dim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const coils = 6;
  for (let i = 0; i <= coils; i++) {
    const yy = table.launch.ballRestY + 48 - (i / coils) * (table.launch.ballRestY + 48 - knobY);
    const xx = laneX + (i % 2 === 0 ? -6 : 6);
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  // knob
  ctx.fillStyle = p.hot;
  glow(ctx, p.hot, 12 + charge * 20);
  ctx.beginPath();
  ctx.roundRect(laneX - 18, knobY, 36, 16, 6);
  ctx.fill();
  noGlow(ctx);
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  trail: Vec2[],
  ice: boolean,
  p: TableDef["palette"],
): void {
  // trail
  if (trail.length > 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const cur = trail[i];
      if (!prev || !cur) continue;
      const a = (i / trail.length) * 0.35;
      ctx.strokeStyle = ice ? "#a5f3fc" : p.hot;
      ctx.globalAlpha = a;
      ctx.lineWidth = r * 1.4 * (i / trail.length);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  // body
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  if (ice) {
    g.addColorStop(0, "#e0f2fe");
    g.addColorStop(0.6, "#7dd3fc");
    g.addColorStop(1, "#0369a1");
  } else {
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.55, "#cbd5e1");
    g.addColorStop(1, "#475569");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // glow
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = ice ? "#7dd3fc" : p.hot;
  ctx.beginPath();
  ctx.arc(x, y, r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
