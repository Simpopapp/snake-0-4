// NEONVOLT — the four tables. Interior content integrated from the swarm
// table-design spec; the standard frame (borders, lane, guides, kickback,
// drain) is built by the engine (src/game/frame.ts).
import type { FlipperDef, TableDef, TableElement, WallChain } from "../types";

export const PALETTES = {
  "circuito-neon": {
    bg: "#0b0d1a",
    bgDetail: "#164e63",
    wall: "#22d3ee",
    glowA: "#22d3ee",
    glowB: "#e879f9",
    hot: "#fbbf24",
    dim: "#334155",
  },
  "forja-solar": {
    bg: "#1a0903",
    bgDetail: "#7c2d12",
    wall: "#f97316",
    glowA: "#f97316",
    glowB: "#ef4444",
    hot: "#fde047",
    dim: "#78350f",
  },
  abissal: {
    bg: "#020617",
    bgDetail: "#0e7490",
    wall: "#38bdf8",
    glowA: "#38bdf8",
    glowB: "#a3e635",
    hot: "#f472b6",
    dim: "#1e3a8a",
  },
  criogenese: {
    bg: "#0c1425",
    bgDetail: "#334e77",
    wall: "#e0f2fe",
    glowA: "#7dd3fc",
    glowB: "#8b5cf6",
    hot: "#a78bfa",
    dim: "#475569",
  },
} as const;

/** Slings above the inlane guides — shared lower assembly for every table. */
const SLINGS: TableElement[] = [
  { kind: "sling", id: "lower-sling-left", a: { x: 112, y: 728 }, b: { x: 168, y: 798 }, c: { x: 112, y: 832 }, score: 50, power: 18 },
  { kind: "sling", id: "lower-sling-right", a: { x: 428, y: 728 }, b: { x: 372, y: 798 }, c: { x: 428, y: 832 }, score: 50, power: 18 },
];

const FLIPPERS: [FlipperDef, FlipperDef] = [
  { side: "left", pivot: { x: 162, y: 880 }, length: 105, restAngle: 27, activeAngle: -30 },
  { side: "right", pivot: { x: 378, y: 880 }, length: 105, restAngle: 153, activeAngle: 210 },
];

const LAUNCH = { x: 515, ballRestY: 918, power: 46 };

const deflectors = {
  neon: [
    { id: "neon-left-return", points: [{ x: 45, y: 470 }, { x: 65, y: 530 }, { x: 100, y: 575 }] },
    { id: "neon-right-return", points: [{ x: 445, y: 470 }, { x: 425, y: 530 }, { x: 390, y: 575 }] },
  ] as WallChain[],
  forja: [
    { id: "forja-left-anvil", points: [{ x: 30, y: 430 }, { x: 55, y: 485 }, { x: 95, y: 510 }], rail: 16 },
    { id: "forja-right-anvil", points: [{ x: 455, y: 430 }, { x: 435, y: 485 }, { x: 395, y: 510 }], rail: 16 },
  ] as WallChain[],
  abyss: [
    { id: "abyss-left-reef", points: [{ x: 40, y: 390 }, { x: 90, y: 420 }, { x: 120, y: 460 }] },
    { id: "abyss-right-reef", points: [{ x: 450, y: 510 }, { x: 425, y: 555 }, { x: 390, y: 585 }] },
  ] as WallChain[],
  cryo: [
    { id: "cryo-left-facet", points: [{ x: 40, y: 460 }, { x: 65, y: 510 }, { x: 110, y: 550 }] },
    { id: "cryo-right-facet", points: [{ x: 450, y: 460 }, { x: 425, y: 510 }, { x: 380, y: 550 }] },
  ] as WallChain[],
};

export const circuitoNeon: TableDef = {
  id: "circuito-neon",
  name: "Circuito Neon",
  subtitle: "Feche o circuito. Multiplique a descarga.",
  palette: PALETTES["circuito-neon"],
  gravity: 1.0,
  ballRadius: 7,
  ballRestitution: 0.82,
  maxBalls: 3,
  walls: deflectors.neon,
  elements: [
    ...SLINGS,
    { kind: "bumper", id: "neon-bumper-1", pos: { x: 165, y: 245 }, radius: 28, score: 150, power: 20, color: "glowA" },
    { kind: "bumper", id: "neon-bumper-2", pos: { x: 325, y: 245 }, radius: 28, score: 150, power: 20, color: "glowA" },
    { kind: "bumper", id: "neon-bumper-3", pos: { x: 245, y: 370 }, radius: 32, score: 250, power: 22, color: "glowB" },
    { kind: "target", id: "neon-target-phase-1", pos: { x: 80, y: 350 }, w: 5, h: 17, angle: 0, score: 500, group: "neon-phases" },
    { kind: "target", id: "neon-target-phase-2", pos: { x: 410, y: 350 }, w: 5, h: 17, angle: 0, score: 500, group: "neon-phases" },
    { kind: "spinner", id: "neon-spinner", pos: { x: 245, y: 535 }, length: 64, score: 100 },
    { kind: "kicker", id: "neon-relay", pos: { x: 100, y: 645 }, radius: 16, ejectTo: { x: 350, y: 450 }, score: 500, hold: 0.45 },
  ],
  flippers: FLIPPERS,
  launch: LAUNCH,
  mission: {
    title: "Sobrecarga",
    hint: "Acerte o bumper central 8 vezes para liberar o multiball.",
    goal: { type: "hits", elementId: "neon-bumper-3", count: 8 },
    reward: { type: "multiball", balls: 2 },
    score: 12000,
  },
};

export const forjaSolar: TableDef = {
  id: "forja-solar",
  name: "Forja Solar",
  subtitle: "Alimente o núcleo. Libere a erupção.",
  palette: PALETTES["forja-solar"],
  gravity: 1.0,
  ballRadius: 7,
  ballRestitution: 0.8,
  maxBalls: 3,
  walls: deflectors.forja,
  elements: [
    ...SLINGS,
    { kind: "bumper", id: "forja-core", pos: { x: 250, y: 340 }, radius: 38, score: 350, power: 24, color: "glowA" },
    { kind: "bumper", id: "forja-furnace-left", pos: { x: 120, y: 205 }, radius: 26, score: 200, power: 20, color: "glowB" },
    { kind: "bumper", id: "forja-furnace-right", pos: { x: 375, y: 205 }, radius: 26, score: 200, power: 20, color: "glowB" },
    { kind: "target", id: "forja-target-fuel-1", pos: { x: 100, y: 325 }, w: 5, h: 17, angle: 0, score: 500, group: "forja-fuel" },
    { kind: "target", id: "forja-target-fuel-2", pos: { x: 395, y: 325 }, w: 5, h: 17, angle: 0, score: 500, group: "forja-fuel" },
    { kind: "target", id: "forja-target-fuel-3", pos: { x: 160, y: 565 }, w: 5, h: 17, angle: 0, score: 500, group: "forja-fuel" },
    { kind: "spinner", id: "forja-turbine", pos: { x: 325, y: 540 }, length: 60, score: 150 },
    { kind: "kicker", id: "forja-crucible", pos: { x: 90, y: 650 }, radius: 18, ejectTo: { x: 250, y: 470 }, score: 750, hold: 0.65 },
  ],
  flippers: FLIPPERS,
  launch: LAUNCH,
  mission: {
    title: "Ignição Solar",
    hint: "Derrube os 3 alvos de combustível para liberar o jackpot.",
    goal: { type: "group", groupId: "forja-fuel" },
    reward: { type: "jackpot", score: 15000 },
    score: 12000,
  },
};

export const abissal: TableDef = {
  id: "abissal",
  name: "Abissal",
  subtitle: "Desperte o leviatã nas profundezas.",
  palette: PALETTES.abissal,
  gravity: 1.0,
  ballRadius: 7,
  ballRestitution: 0.78,
  maxBalls: 2,
  walls: deflectors.abyss,
  elements: [
    ...SLINGS,
    { kind: "bumper", id: "abyss-bumper-medusa", pos: { x: 145, y: 235 }, radius: 30, score: 200, power: 19, color: "glowB" },
    { kind: "bumper", id: "abyss-bumper-angler", pos: { x: 335, y: 320 }, radius: 34, score: 250, power: 21, color: "glowA" },
    { kind: "bumper", id: "abyss-bumper-pearl", pos: { x: 220, y: 500 }, radius: 26, score: 300, power: 20, color: "glowB" },
    { kind: "target", id: "abyss-target-crab-1", pos: { x: 75, y: 310 }, w: 5, h: 17, angle: 0, score: 500, group: "abyss-crabs" },
    { kind: "target", id: "abyss-target-crab-2", pos: { x: 420, y: 215 }, w: 5, h: 17, angle: 0, score: 500, group: "abyss-crabs" },
    { kind: "target", id: "abyss-target-crab-3", pos: { x: 410, y: 420 }, w: 5, h: 17, angle: 0, score: 500, group: "abyss-crabs" },
    { kind: "spinner", id: "abyss-current", pos: { x: 310, y: 640 }, length: 56, score: 125 },
    { kind: "kicker", id: "abyss-leviathan", pos: { x: 100, y: 600 }, radius: 20, ejectTo: { x: 250, y: 170 }, score: 1000, hold: 0.9 },
  ],
  flippers: FLIPPERS,
  launch: LAUNCH,
  mission: {
    title: "Despertar do Leviatã",
    hint: "Entre 3 vezes na toca do leviatã para liberar o multiball.",
    goal: { type: "hits", elementId: "abyss-leviathan", count: 3 },
    reward: { type: "multiball", balls: 1 },
    score: 15000,
  },
};

export const criogenese: TableDef = {
  id: "criogenese",
  name: "Criogênese",
  subtitle: "Sustente a rotação. Congele o impossível.",
  palette: PALETTES.criogenese,
  gravity: 1.0,
  ballRadius: 7,
  ballRestitution: 0.84,
  maxBalls: 2,
  walls: deflectors.cryo,
  elements: [
    ...SLINGS,
    { kind: "bumper", id: "cryo-bumper-crystal-1", pos: { x: 140, y: 235 }, radius: 26, score: 200, power: 19, color: "glowA" },
    { kind: "bumper", id: "cryo-bumper-crystal-2", pos: { x: 350, y: 235 }, radius: 26, score: 200, power: 19, color: "glowA" },
    { kind: "bumper", id: "cryo-bumper-crystal-3", pos: { x: 140, y: 400 }, radius: 30, score: 250, power: 20, color: "glowB" },
    { kind: "bumper", id: "cryo-bumper-crystal-4", pos: { x: 350, y: 400 }, radius: 30, score: 250, power: 20, color: "glowB" },
    { kind: "target", id: "cryo-target-seal-1", pos: { x: 70, y: 315 }, w: 5, h: 17, angle: 0, score: 500, group: "cryo-seals" },
    { kind: "target", id: "cryo-target-seal-2", pos: { x: 420, y: 315 }, w: 5, h: 17, angle: 0, score: 500, group: "cryo-seals" },
    { kind: "spinner", id: "cryo-spinner", pos: { x: 245, y: 560 }, length: 72, score: 150 },
    { kind: "kicker", id: "cryo-vault", pos: { x: 105, y: 650 }, radius: 18, ejectTo: { x: 245, y: 300 }, score: 600, hold: 0.7 },
  ],
  flippers: FLIPPERS,
  launch: LAUNCH,
  mission: {
    title: "Zero Absoluto",
    hint: "Acumule 4s de rotação no rotor para ativar a Ice Ball.",
    goal: { type: "spinnerHold", spinnerId: "cryo-spinner", seconds: 4 },
    reward: { type: "iceBall", seconds: 12 },
    score: 12000,
  },
};

export const TABLES = [circuitoNeon, forjaSolar, abissal, criogenese] as const;

export function getTable(id: string): TableDef {
  const found = TABLES.find((t) => t.id === id);
  return found ?? circuitoNeon;
}
