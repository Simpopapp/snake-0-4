// NEONVOLT — FX state shared by engine (spawns) and renderer (draws). No DOM.
import type { Vec2 } from "./types";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface FxState {
  particles: Particle[];
  shake: number;
  flash: number; // jackpot-style full-table flash 0..1
}

const MAX_PARTICLES = 420;

let reduced = false;

/** "Reduced effects" setting: fewer particles, no shake (accessibility). */
export function setReducedFx(v: boolean): void {
  reduced = v;
}

export function isReducedFx(): boolean {
  return reduced;
}

export function createFx(): FxState {
  return { particles: [], shake: 0, flash: 0 };
}

export function spawnBurst(
  fx: FxState,
  pos: Vec2,
  color: string,
  count: number,
  speed = 3,
  opts?: { gravity?: number; size?: number; spread?: number; dir?: Vec2 },
): void {
  const budget = MAX_PARTICLES - fx.particles.length;
  const n = Math.min(reduced ? Math.ceil(count / 4) : count, Math.max(0, budget));
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const mag = speed * (0.4 + Math.random() * 0.8);
    const dirBias = opts?.dir;
    fx.particles.push({
      x: pos.x,
      y: pos.y,
      vx: Math.cos(ang) * mag + (dirBias ? dirBias.x * speed : 0),
      vy: Math.sin(ang) * mag + (dirBias ? dirBias.y * speed : 0),
      life: 1,
      maxLife: 0.5 + Math.random() * 0.5,
      size: (opts?.size ?? 2) * (0.6 + Math.random() * 0.8),
      color,
      gravity: opts?.gravity ?? 0.06,
    });
  }
}

export function addShake(fx: FxState, strength: number): void {
  if (reduced) return;
  fx.shake = Math.min(14, Math.max(fx.shake, strength));
}

export function addFlash(fx: FxState, amount: number): void {
  fx.flash = Math.min(1, fx.flash + amount);
}

/** Advance particles and decay shake. dt in seconds. */
export function updateFx(fx: FxState, dt: number): void {
  const parts = fx.particles;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!p) continue;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += p.gravity * dt * 60;
    p.vx *= 0.985;
    p.life -= dt / p.maxLife;
    if (p.life <= 0) {
      const last = parts[parts.length - 1];
      if (last) parts[i] = last;
      parts.pop();
    }
  }
  fx.shake *= Math.pow(0.0016, dt);
  if (fx.shake < 0.05) fx.shake = 0;
  fx.flash = Math.max(0, fx.flash - dt * 2.2);
}
