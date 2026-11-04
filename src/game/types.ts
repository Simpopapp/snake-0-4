// NEONVOLT — shared game types. Pure types only: no React, no Matter imports.
// This module is the contract between engine, renderer, tables and UI.

export interface Vec2 {
  x: number;
  y: number;
}

/** Virtual playfield coordinate space every table is authored in. */
export const TABLE_WIDTH = 540;
export const TABLE_HEIGHT = 960;

export type TableId = "circuito-neon" | "forja-solar" | "abissal" | "criogenese";

/** Table color identity — everything in the renderer derives from this. */
export interface TablePalette {
  /** Playfield background base */
  bg: string;
  /** Background detail accent (grid, brasa, plâncton, floco) */
  bgDetail: string;
  /** Wall / rail neon */
  wall: string;
  /** Primary interactive glow (bumpers) */
  glowA: string;
  /** Secondary glow (targets, spinner) */
  glowB: string;
  /** Ball trail + jackpot accent */
  hot: string;
  /** Muted structure lines */
  dim: string;
}

export type TableElement =
  | {
      kind: "bumper";
      id: string;
      pos: Vec2;
      radius: number;
      /** Points per hit */
      score: number;
      /** Impulse strength applied on hit */
      power: number;
      color?: "glowA" | "glowB";
    }
  | {
      kind: "sling";
      id: string;
      /** Triangle: three points, the middle facet is the active face */
      a: Vec2;
      b: Vec2;
      c: Vec2;
      score: number;
      power: number;
    }
  | {
      kind: "target";
      id: string;
      pos: Vec2;
      /** Half width/height of the target plate */
      w: number;
      h: number;
      angle?: number;
      score: number;
      /** Group id — when every target in a group is down, the group awards */
      group: string;
    }
  | {
      kind: "spinner";
      id: string;
      pos: Vec2;
      length: number;
      /** Points per hit on the spinner blade */
      score: number;
    }
  | {
      kind: "kicker";
      id: string;
      pos: Vec2;
      radius: number;
      /** Where the ball is teleported/ejected */
      ejectTo: Vec2;
      score: number;
      /** Hold seconds before eject */
      hold: number;
    };

/** A polyline wall segment chain (static body). */
export interface WallChain {
  id: string;
  points: Vec2[];
  /** Optional arc rendering hint: closed shape gets filled frame styling */
  closed?: boolean;
  /** Visual thickness of the neon rail (physical thickness is fixed) */
  rail?: number;
  /** One-way gate: ball passes only left→right or top→bottom through `points[0]→points[1]` */
  gate?: boolean;
}

export interface LaunchLane {
  /** Inner lane wall chain from plunger bottom to lane top */
  x: number;
  /** y where the ball waits on the plunger */
  ballRestY: number;
  /** Plunger release impulse base */
  power: number;
}

export interface FlipperDef {
  /** Pivot point */
  pivot: Vec2;
  length: number;
  /** Rest angle (degrees, 0 = pointing right/left horizontally inward) */
  restAngle: number;
  /** Deployed (pressed) angle in degrees */
  activeAngle: number;
  side: "left" | "right";
}

export type MissionKind =
  | { type: "hits"; elementId: string; count: number }
  | { type: "group"; groupId: string }
  | { type: "spinnerHold"; spinnerId: string; seconds: number };

export type MissionReward =
  | { type: "multiball"; balls: number }
  | { type: "jackpot"; score: number }
  | { type: "iceBall"; seconds: number };

export interface TableMission {
  /** Signature objective shown on the HUD */
  title: string;
  /** One-line description */
  hint: string;
  goal: MissionKind;
  reward: MissionReward;
  /** Points for completing */
  score: number;
}

export interface TableDef {
  id: TableId;
  name: string;
  subtitle: string;
  palette: TablePalette;
  gravity: number;
  walls: WallChain[];
  elements: TableElement[];
  flippers: [FlipperDef, FlipperDef];
  launch: LaunchLane;
  mission: TableMission;
  /** Extra engine tuning */
  ballRestitution?: number;
  ballRadius?: number;
  /** Max simultaneous balls (multiball cap) */
  maxBalls?: number;
}

// ---------- Runtime types (engine → UI) ----------

export interface HudSnapshot {
  tableId: TableId;
  tableName: string;
  score: number;
  balls: number;
  ballNumber: number;
  multiplier: number;
  multiball: number;
  objective: string;
  objectiveProgress: string;
  objectiveDone: boolean;
  paused: boolean;
  tilt: boolean;
  kickbackArmed: boolean;
  muted: boolean;
  fps: number;
}

export type GameEvent =
  | { type: "bumperHit"; elementId: string; score: number; pos: Vec2 }
  | { type: "slingHit"; elementId: string; score: number; pos: Vec2 }
  | { type: "targetDown"; elementId: string; groupId: string; pos: Vec2 }
  | { type: "groupCleared"; groupId: string; score: number }
  | { type: "spinner"; score: number }
  | { type: "ramp"; elementId: string; score: number }
  | { type: "kicker"; pos: Vec2 }
  | { type: "kickback"; pos: Vec2 }
  | { type: "launch"; power: number }
  | { type: "ballLost"; ballsRemaining: number }
  | { type: "bonusAwarded"; score: number; multiplier: number }
  | { type: "missionComplete"; score: number; title: string }
  | { type: "reward"; reward: MissionReward }
  | { type: "multiballStarted"; balls: number }
  | { type: "tilt" }
  | { type: "gameOver"; finalScore: number }
  | { type: "shake"; strength: number }
  | { type: "nudge" };

export interface GameCallbacks {
  onHud?: (hud: HudSnapshot) => void;
  onEvent?: (event: GameEvent) => void;
}

export type GameInput =
  | "leftDown"
  | "leftUp"
  | "rightDown"
  | "rightUp"
  | "plungerDown"
  | "plungerUp"
  | "nudge";

export interface GameHandle {
  start: () => void;
  pause: () => void;
  resume: () => void;
  input: (input: GameInput) => void;
  destroy: () => void;
}

// ---------- Persistence ----------

export interface HighScores {
  global: number;
  perTable: Partial<Record<TableId, number>>;
}

export const STORAGE_KEY = "neonvolt.v1";
