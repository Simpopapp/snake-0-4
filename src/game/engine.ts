// NEONVOLT — physics engine (matter-js). Browser-only module: loaded lazily.
// Contract: see src/game/contract.md. This module never imports React.
import Matter from "matter-js";

import { addFlash, addShake, createFx, spawnBurst, updateFx, type FxState } from "./fx";
import { DRAIN_Y, FRAME_WALLS, KICKBACK_POS } from "./frame";
import {
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type FlipperDef,
  type GameCallbacks,
  type GameEvent,
  type GameHandle,
  type GameInput,
  type GameStatsSummary,
  type HudSnapshot,
  type MiniMission,
  type MissionKind,
  type MissionReward,
  type TableDef,
  type TableElement,
  type Vec2,
} from "./types";

const FIXED_DT = 1000 / 60;
const BALL_R_DEFAULT = 7;
const NUDGE_WINDOW_TICKS = 120; // 2s
const STUCK_TICKS_SOFT = 150; // 2.5s
const STUCK_TICKS_HARD = 300; // 5s
const TARGET_RESET_TICKS = 330; // ~5.5s
const FLIPPER_SPEED = 0.28; // rad per tick (~17 rad/s)
const MAX_BALLS = 3;
const COMBO_WINDOW_TICKS = 150; // 2.5s
const COMBO_MILESTONES = [
  { count: 5, score: 1000 },
  { count: 10, score: 2500 },
  { count: 20, score: 5000 },
  { count: 35, score: 10000 },
];

interface NvPlugin {
  nv: "ball" | "bumper" | "sling" | "target" | "spinner" | "kicker" | "drain" | "kickback" | "gate" | "wall";
  id?: string;
  el?: TableElement;
  groupId?: string;
  score?: number;
  power?: number;
  gateCooldown?: number;
  // ball-only
  trail?: Vec2[];
  slowTicks?: number;
  iceTicks?: number;
  baseMass?: number;
  held?: boolean;
}

type NvBody = Matter.Body & { plugin: NvPlugin };

interface BallEntry {
  body: NvBody;
}

interface KickerHold {
  body: NvBody;
  def: Extract<TableElement, { kind: "kicker" }>;
  ticksLeft: number;
}

interface TimerEntry {
  ticksLeft: number;
  fn: () => void;
}

export interface RenderView {
  balls: { x: number; y: number; r: number; trail: Vec2[]; ice: boolean }[];
  flipperAngles: [number, number];
  spinnerAngles: Record<string, number>;
  targetsDown: Set<string>;
  kickbackArmed: boolean;
  plungerCharge: number;
  ballReady: boolean;
  tilt: boolean;
  tableJustName: string;
  /** Element lit for the skill shot (renderer draws the lamp) */
  litElementId: string | null;
  /** Ball-save window active (renderer pulses the launch lane) */
  ballSaveActive: boolean;
  /** Live combo counter */
  combo: number;
}

function seg(x1: number, y1: number, x2: number, y2: number, t: number, plugin: NvPlugin): NvBody {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const body = Matter.Bodies.rectangle(mx, my, Math.max(len, t), t, {
    angle: Math.atan2(y2 - y1, x2 - x1),
    isStatic: true,
    friction: 0.02,
    restitution: 0.35,
  }) as NvBody;
  body.plugin = plugin;
  return body;
}

/** Engine construction options. */
export interface GameOptions {
  /** Balls for the whole game (default 3; tournament tables use 2) */
  balls?: number;
}

export class PinballGame implements GameHandle {
  private canvas: HTMLCanvasElement;
  private table: TableDef;
  private cbs: GameCallbacks;
  private engine: Matter.Engine;
  private world: Matter.World;

  private balls: BallEntry[] = [];
  private flipperBodies: [NvBody, NvBody];
  private flipperAngles: [number, number];
  private flipperTargets: [number, number];
  private leftDown = false;
  private rightDown = false;

  private spinnerBodies = new Map<string, NvBody>();
  private spinnerAngle = new Map<string, number>();
  private spinnerVel = new Map<string, number>();
  private spinnerHoldTicks = new Map<string, number>();

  private targetBodies = new Map<string, NvBody>();
  private targetsDown = new Set<string>();
  private groupTotal = new Map<string, number>();
  private gateLast = new Map<string, number>();

  private kickerHolds: KickerHold[] = [];
  private timers: TimerEntry[] = [];
  private hitCount = new Map<string, number>();

  private score = 0;
  private ballsRemaining = 3;
  private ballNumber = 1;
  private streak = 0;
  private multiball = 0; // extra balls beyond first
  private kickbackArmed = true;
  private tilt = false;
  private nudgeTimes: number[] = [];
  private tick = 0;
  private phase: "idle" | "ready" | "play" | "gameover" = "idle";
  private paused = false;
  private destroyed = false;
  private plungerCharge = 0;
  private plungerDown = false;
  private missionDoneFlash = 0;
  private lastFps = 60;

  // skill shot (PRD project2 §6.1)
  private skillShotId: string | null = null;
  private skillShotDeadline = 0;
  private skillShotCandidates: string[] = [];
  private skillShotCount = 0;
  private skillShotsGame = 0;

  // ball save (PRD §6.2): ticks left in the window, once per launch
  private ballSaveTicks = 0;
  private savedThisLaunch = false;

  // combo (PRD §6.3)
  private comboCount = 0;
  private comboLastTick = -9999;
  private bestComboGame = 0;

  // mini missions (PRD §6.4)
  private miniState = new Map<string, { armed: boolean; doneFlash: number; hits: number; groups: number }>();

  // per-game stats for the meta layer (progress.ts)
  private gameStartMs = 0;
  private ballsLaunchedGame = 0;
  private ballSavesGame = 0;
  private missionCompletionsGame = 0;

  private fx: FxState = createFx();
  private view: RenderView;
  private hudFrame = 0;

  private raf = 0;
  private lastTime = 0;
  private accumulator = 0;
  private drawFn: (view: RenderView, fx: FxState, t: number) => void = () => {};
  private collisionHandler = (evt: Matter.IEventCollision<Matter.Engine>) => this.onCollisions(evt);

  constructor(canvas: HTMLCanvasElement, table: TableDef, cbs: GameCallbacks = {}, options: GameOptions = {}) {
    this.canvas = canvas;
    this.table = table;
    this.cbs = cbs;
    this.ballsRemaining = options.balls ?? 3;

    this.engine = Matter.Engine.create({
      positionIterations: 8,
      velocityIterations: 6,
      enableSleeping: false,
    });
    this.engine.gravity.y = table.gravity ?? 1;
    this.world = this.engine.world;

    this.view = {
      balls: [],
      flipperAngles: [0, 0],
      spinnerAngles: {},
      targetsDown: new Set(),
      kickbackArmed: true,
      plungerCharge: 0,
      ballReady: false,
      tilt: false,
      tableJustName: table.name,
      litElementId: null,
      ballSaveActive: false,
      combo: 0,
    };

    this.buildFrame();
    this.buildTable();
    const [fl, fr] = this.buildFlippers();
    this.flipperBodies = [fl, fr];
    this.flipperAngles = [deg(table.flippers[0].restAngle), deg(table.flippers[1].restAngle)];
    this.flipperTargets = [...this.flipperAngles] as [number, number];
    this.applyFlipperTransforms();

    Matter.Events.on(this.engine, "collisionStart", this.collisionHandler);
  }

  /** Renderer hook: called every rendered frame with the live view. */
  setDrawFn(fn: (view: RenderView, fx: FxState, t: number) => void): void {
    this.drawFn = fn;
  }

  // ------------------------------------------------------------ construction

  private buildFrame(): void {
    const wall = (id: string): NvPlugin => ({ nv: "wall", id });
    const add = (b: NvBody) => Matter.Composite.add(this.world, b);
    for (const fw of FRAME_WALLS) {
      for (let i = 0; i < fw.pts.length - 1; i++) {
        const a = fw.pts[i];
        const b = fw.pts[i + 1];
        if (!a || !b) continue;
        add(seg(a.x, a.y, b.x, b.y, fw.t, wall("frame")));
      }
    }
    // drain sensor (full width, below everything)
    const drain = Matter.Bodies.rectangle(TABLE_WIDTH / 2, DRAIN_Y, TABLE_WIDTH + 60, 70, {
      isStatic: true,
      isSensor: true,
    }) as NvBody;
    drain.plugin = { nv: "drain" };
    add(drain);
    // kickback sensor in left outlane
    const kick = Matter.Bodies.circle(KICKBACK_POS.x, KICKBACK_POS.y, 13, {
      isStatic: true,
      isSensor: true,
    }) as NvBody;
    kick.plugin = { nv: "kickback" };
    add(kick);
  }

  private buildTable(): void {
    const add = (b: NvBody) => Matter.Composite.add(this.world, b);
    for (const w of this.table.walls) {
      if (w.gate) {
        const p0 = w.points[0];
        const p1 = w.points[1] ?? p0;
        if (!p0 || !p1) continue;
        const gate = seg(p0.x, p0.y, p1.x, p1.y, 6, {
          nv: "gate",
          id: w.id,
          gateCooldown: 0,
        });
        Matter.Body.set(gate, { isSensor: true });
        add(gate);
        continue;
      }
      for (let i = 0; i < w.points.length - 1; i++) {
        const a = w.points[i];
        const b = w.points[i + 1];
        if (!a || !b) continue;
        const t = w.rail ?? 14;
        add(seg(a.x, a.y, b.x, b.y, t, { nv: "wall", id: w.id }));
      }
    }
    for (const el of this.table.elements) {
      switch (el.kind) {
        case "bumper": {
          const b = Matter.Bodies.circle(el.pos.x, el.pos.y, el.radius, {
            isStatic: true,
            restitution: 0.4,
          }) as NvBody;
          b.plugin = { nv: "bumper", id: el.id, el, score: el.score, power: el.power };
          add(b);
          break;
        }
        case "sling": {
          const cx = (el.a.x + el.b.x + el.c.x) / 3;
          const cy = (el.a.y + el.b.y + el.c.y) / 3;
          const verts = [
            { x: el.a.x - cx, y: el.a.y - cy },
            { x: el.b.x - cx, y: el.b.y - cy },
            { x: el.c.x - cx, y: el.c.y - cy },
          ];
          const b = Matter.Bodies.fromVertices(cx, cy, [verts], { isStatic: true }) as NvBody;
          b.plugin = { nv: "sling", id: el.id, el, score: el.score, power: el.power };
          add(b);
          break;
        }
        case "target": {
          const b = Matter.Bodies.rectangle(el.pos.x, el.pos.y, el.w * 2, el.h * 2, {
            isStatic: true,
            angle: el.angle ?? 0,
          }) as NvBody;
          b.plugin = { nv: "target", id: el.id, el, groupId: el.group, score: el.score };
          this.targetBodies.set(el.id, b);
          this.groupTotal.set(el.group, (this.groupTotal.get(el.group) ?? 0) + 1);
          add(b);
          break;
        }
        case "spinner": {
          const b = Matter.Bodies.rectangle(el.pos.x, el.pos.y, el.length, 8, {
            isStatic: true,
            isSensor: true,
          }) as NvBody;
          b.plugin = { nv: "spinner", id: el.id, el, score: el.score };
          this.spinnerBodies.set(el.id, b);
          this.spinnerAngle.set(el.id, 0);
          this.spinnerVel.set(el.id, 0);
          this.spinnerHoldTicks.set(el.id, 0);
          add(b);
          break;
        }
        case "kicker": {
          const b = Matter.Bodies.circle(el.pos.x, el.pos.y, el.radius, {
            isStatic: true,
            isSensor: true,
          }) as NvBody;
          b.plugin = { nv: "kicker", id: el.id, el, score: el.score };
          add(b);
          break;
        }
      }
    }
  }

  private buildFlippers(): [NvBody, NvBody] {
    const make = (def: FlipperDef, label: string): NvBody => {
      const rad = deg(def.restAngle);
      const cx = def.pivot.x + Math.cos(rad) * (def.length / 2);
      const cy = def.pivot.y + Math.sin(rad) * (def.length / 2);
      const b = Matter.Bodies.rectangle(cx, cy, def.length, 14, {
        isStatic: true,
        angle: rad,
        chamfer: { radius: 6 },
        friction: 0.05,
        restitution: 0.2,
      }) as NvBody;
      b.plugin = { nv: "wall", id: `flipper-${label}` };
      (b as NvBody & { nvPivot: Vec2; nvLen: number }).nvPivot = def.pivot;
      (b as NvBody & { nvPivot: Vec2; nvLen: number }).nvLen = def.length;
      Matter.Composite.add(this.world, b);
      return b;
    };
    return [make(this.table.flippers[0], "l"), make(this.table.flippers[1], "r")];
  }

  /** Transfers the moving flipper's surface velocity to nearby balls. */
  private applyFlipperSweepImpulse(body: NvBody, angleBefore: number, stepAng: number): void {
    const meta = body as NvBody & { nvPivot: Vec2; nvLen: number };
    const pivot = meta.nvPivot;
    const len = meta.nvLen;
    const dirX = Math.cos(angleBefore);
    const dirY = Math.sin(angleBefore);
    for (const entry of this.balls) {
      const b = entry.body;
      if (b.plugin.held) continue;
      const rx = b.position.x - pivot.x;
      const ry = b.position.y - pivot.y;
      const along = rx * dirX + ry * dirY;
      const perp = rx * dirY - ry * dirX;
      if (along < -6 || along > len + 8 || Math.abs(perp) > 20) continue;
      // surface velocity at the contact point: ω × r
      let vx = b.velocity.x + stepAng * -ry * 1.4;
      let vy = b.velocity.y + stepAng * rx * 1.4;
      const sp = Math.hypot(vx, vy);
      const maxSp = 34;
      if (sp > maxSp) {
        vx = (vx / sp) * maxSp;
        vy = (vy / sp) * maxSp;
      }
      Matter.Body.setVelocity(b, { x: vx, y: vy });
      b.plugin.slowTicks = 0;
    }
  }

  private applyFlipperTransforms(): void {
    const [bodL, bodR] = this.flipperBodies;
    for (let i = 0; i < 2; i++) {
      const body = (i === 0 ? bodL : bodR) as NvBody & { nvPivot: Vec2; nvLen: number };
      const pivot = body.nvPivot;
      const a = this.flipperAngles[i] ?? 0;
      const cx = pivot.x + Math.cos(a) * (body.nvLen / 2);
      const cy = pivot.y + Math.sin(a) * (body.nvLen / 2);
      Matter.Body.setPosition(body, { x: cx, y: cy });
      Matter.Body.setAngle(body, a);
      Matter.Body.setAngularVelocity(body, 0);
    }
  }

  // ------------------------------------------------------------------- loop

  start(): void {
    if (this.phase !== "idle") return;
    this.phase = "ready";
    this.gameStartMs = performance.now();
    this.skillShotCandidates = this.table.elements
      .filter((e) => e.kind === "bumper" || e.kind === "target")
      .map((e) => e.id);
    for (const mini of this.table.miniMissions ?? []) {
      this.miniState.set(mini.id, { armed: true, doneFlash: 0, hits: 0, groups: 0 });
    }
    this.serveBall();
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(100, now - this.lastTime);
      this.lastTime = now;
      this.lastFps = this.lastFps * 0.9 + (1000 / Math.max(1, dt)) * 0.1;
      if (!this.paused) {
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= FIXED_DT && steps < 4) {
          this.step();
          this.accumulator -= FIXED_DT;
          steps++;
        }
        if (steps === 4) this.accumulator = 0;
      }
      updateFx(this.fx, dt / 1000);
      this.drawFn(this.view, this.fx, now);
      this.pushHud();
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    Matter.Events.off(this.engine, "collisionStart", this.collisionHandler);
    this.timers = [];
    this.kickerHolds = [];
    Matter.Composite.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    this.cbs = {};
  }

  /** Release every held control (blur/tab-hidden/pause) so nothing sticks. */
  releaseInputs(): void {
    this.leftDown = false;
    this.rightDown = false;
    this.plungerDown = false;
    this.plungerCharge = 0;
    this.flipperTargets = [deg(this.table.flippers[0].restAngle), deg(this.table.flippers[1].restAngle)];
  }

  // ------------------------------------------------------------------ input

  input(input: GameInput): void {
    if (this.destroyed) return;
    // gameplay inputs are ignored while paused or after game over;
    // releases still pass so no control sticks
    const gameplayDown =
      input === "leftDown" || input === "rightDown" || input === "plungerDown" || input === "nudge";
    if ((this.paused || this.phase === "gameover") && gameplayDown) return;
    switch (input) {
      case "leftDown":
        this.leftDown = true;
        this.flipperTargets[0] = deg(this.table.flippers[0].activeAngle);
        break;
      case "leftUp":
        this.leftDown = false;
        this.flipperTargets[0] = deg(this.table.flippers[0].restAngle);
        break;
      case "rightDown":
        this.rightDown = true;
        this.flipperTargets[1] = deg(this.table.flippers[1].activeAngle);
        break;
      case "rightUp":
        this.rightDown = false;
        this.flipperTargets[1] = deg(this.table.flippers[1].restAngle);
        break;
      case "plungerDown":
        if (this.phase === "ready" || this.balls.some((b) => this.inLane(b.body))) {
          this.plungerDown = true;
        }
        break;
      case "plungerUp": {
        if (!this.plungerDown) break;
        this.plungerDown = false;
        const power = 0.5 + 0.5 * this.plungerCharge;
        const lane = this.table.launch;
        let launched = false;
        for (const b of this.balls) {
          if (this.inLane(b.body)) {
            launched = true;
            Matter.Body.setVelocity(b.body, { x: 0, y: -lane.power * power });
            this.emit({ type: "launch", power });
            addShake(this.fx, 3 + 4 * this.plungerCharge);
            spawnBurst(this.fx, { x: lane.x, y: lane.ballRestY - 8 }, this.table.palette.hot, 10, 4, {
              gravity: 0.02,
              dir: { x: 0, y: -1 },
            });
          }
        }
        if (launched) {
          this.ballsLaunchedGame++;
          // ball save window: 8s after every launch, one save per launch
          this.ballSaveTicks = 480;
          this.savedThisLaunch = false;
          this.armSkillShot();
        }
        if (this.balls.length > 0) this.phase = "play";
        this.plungerCharge = 0;
        break;
      }
      case "nudge":
        this.doNudge();
        break;
    }
  }

  private inLane(body: Matter.Body): boolean {
    return (
      body.position.x > this.table.launch.x - 22 &&
      body.position.y > this.table.launch.ballRestY - 260
    );
  }

  private doNudge(): void {
    if (this.tilt || this.balls.length === 0) return;
    const now = this.tick;
    this.nudgeTimes = this.nudgeTimes.filter((t) => now - t < NUDGE_WINDOW_TICKS);
    this.nudgeTimes.push(now);
    for (const b of this.balls) {
      if (b.body.plugin.held) continue;
      Matter.Body.applyForce(b.body, b.body.position, {
        x: (Math.random() - 0.5) * 0.02 * b.body.mass,
        y: -0.012 * b.body.mass,
      });
    }
    addShake(this.fx, 4);
    this.emit({ type: "nudge" });
    if (this.nudgeTimes.length >= 3) {
      this.tilt = true;
      this.emit({ type: "tilt" });
      addShake(this.fx, 12);
    }
  }

  // ------------------------------------------------------------------- step

  private step(): void {
    this.tick++;

    // flippers (kinematic sweep; tilt forces both back to rest)
    const [flL, flR] = this.table.flippers;
    const restL = deg(flL.restAngle);
    const restR = deg(flR.restAngle);
    const [bodL, bodR] = this.flipperBodies;
    for (let i = 0; i < 2; i++) {
      const rest = i === 0 ? restL : restR;
      const target = this.tilt ? rest : (this.flipperTargets[i] ?? rest);
      const cur = this.flipperAngles[i] ?? rest;
      const diff = target - cur;
      const stepAng = Math.sign(diff) * Math.min(Math.abs(diff), FLIPPER_SPEED);
      this.flipperAngles[i] = cur + stepAng;
      if (!this.tilt && Math.abs(stepAng) > 0.004) {
        this.applyFlipperSweepImpulse(i === 0 ? bodL : bodR, cur, stepAng);
      }
    }
    this.applyFlipperTransforms();

    // plunger charge
    if (this.plungerDown && this.plungerCharge < 1) {
      this.plungerCharge = Math.min(1, this.plungerCharge + 0.013);
    }

    // spinners
    for (const [id, vel] of this.spinnerVel) {
      const nv = vel * 0.985;
      this.spinnerVel.set(id, Math.abs(nv) < 0.01 ? 0 : nv);
      this.spinnerAngle.set(id, (this.spinnerAngle.get(id) ?? 0) + nv);
      const hold = (this.spinnerHoldTicks.get(id) ?? 0);
      this.spinnerHoldTicks.set(id, Math.abs(nv) > 1.2 ? hold + 1 : Math.max(0, hold - 1));
    }

    // balls: trails, anti-stuck, ice
    for (const entry of this.balls) {
      const b = entry.body;
      const trail = b.plugin.trail ?? (b.plugin.trail = []);
      trail.push({ x: b.position.x, y: b.position.y });
      if (trail.length > 12) trail.shift();
      const sp = Math.hypot(b.velocity.x, b.velocity.y);
      if (b.plugin.held) {
        b.plugin.slowTicks = 0;
      } else if (sp < 0.9 && !this.inLane(b)) {
        b.plugin.slowTicks = (b.plugin.slowTicks ?? 0) + 1;
        if (b.plugin.slowTicks === STUCK_TICKS_SOFT) {
          Matter.Body.setVelocity(b, {
            x: (Math.random() - 0.5) * 6,
            y: -5,
          });
        } else if (b.plugin.slowTicks >= STUCK_TICKS_HARD) {
          Matter.Body.setPosition(b, { x: this.table.launch.x, y: this.table.launch.ballRestY });
          Matter.Body.setVelocity(b, { x: 0, y: 0 });
          b.plugin.slowTicks = 0;
        }
      } else {
        b.plugin.slowTicks = 0;
      }
      if ((b.plugin.iceTicks ?? 0) > 0) {
        b.plugin.iceTicks!--;
        if (b.plugin.iceTicks === 0) {
          if (b.plugin.baseMass) Matter.Body.setMass(b, b.plugin.baseMass);
          b.frictionAir = 0.006;
        }
      }
    }

    // kicker holds
    for (let i = this.kickerHolds.length - 1; i >= 0; i--) {
      const hold = this.kickerHolds[i];
      if (!hold) continue;
      hold.ticksLeft--;
      if (hold.ticksLeft <= 0) {
        Matter.Body.setStatic(hold.body, false);
        hold.body.collisionFilter.mask = 0xffffffff;
        hold.body.plugin.held = false;
        Matter.Body.setPosition(hold.body, { x: hold.def.ejectTo.x, y: hold.def.ejectTo.y });
        Matter.Body.setVelocity(hold.body, { x: 0, y: -12 });
        this.kickerHolds.splice(i, 1);
        addShake(this.fx, 5);
      }
    }

    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i];
      if (!timer) continue;
      timer.ticksLeft--;
      if (timer.ticksLeft <= 0) {
        timer.fn();
        this.timers.splice(i, 1);
      }
    }

    // skill shot window / ball save window / combo window / mini missions
    this.skillShotTick();
    if (this.ballSaveTicks > 0) this.ballSaveTicks--;
    if (this.comboCount > 0 && this.tick - this.comboLastTick > COMBO_WINDOW_TICKS) this.comboCount = 0;
    this.miniTick();

    Matter.Engine.update(this.engine, FIXED_DT);
    // safety net: recover balls that escaped the playfield entirely
    for (const entry of [...this.balls]) {
      const b = entry.body;
      if (b.plugin.held) continue;
      if (b.position.y > 1080 || b.position.x < -40 || b.position.x > 580) {
        this.drainBall(b);
      }
    }
    this.missionTick();
    this.syncView();
  }

  private syncView(): void {
    this.view.balls = this.balls.map((b) => ({
      x: b.body.position.x,
      y: b.body.position.y,
      r: this.table.ballRadius ?? BALL_R_DEFAULT,
      trail: b.body.plugin.trail ?? [],
      ice: (b.body.plugin.iceTicks ?? 0) > 0,
    }));
    this.view.flipperAngles = [this.flipperAngles[0], this.flipperAngles[1]];
    this.view.spinnerAngles = Object.fromEntries(this.spinnerAngle);
    this.view.targetsDown = new Set(this.targetsDown);
    this.view.kickbackArmed = this.kickbackArmed;
    this.view.plungerCharge = this.plungerCharge;
    this.view.ballReady = this.balls.some((b) => this.inLane(b.body) && Math.hypot(b.body.velocity.x, b.body.velocity.y) < 1.5);
    this.view.tilt = this.tilt;
    this.view.litElementId = this.skillShotId;
    this.view.ballSaveActive = this.ballSaveTicks > 0;
    this.view.combo = this.comboCount;
  }

  // ------------------------------------------------------------- collisions

  private onCollisions(evt: Matter.IEventCollision<Matter.Engine>): void {
    for (const pair of evt.pairs) {
      const a = pair.bodyA as NvBody;
      const b = pair.bodyB as NvBody;
      const ball = (a.plugin.nv === "ball" ? a : b.plugin.nv === "ball" ? b : null);
      if (!ball) continue;
      const other = ball === a ? b : a;
      const pos: Vec2 = { x: ball.position.x, y: ball.position.y };
      switch (other.plugin.nv) {
        case "bumper":
          this.hitBumper(other, ball, pos);
          break;
        case "sling":
          this.hitSling(other, ball, pos);
          break;
        case "target":
          this.hitTarget(other, ball, pos);
          break;
        case "spinner":
          this.hitSpinner(other, pos);
          break;
        case "kicker":
          this.enterKicker(other, ball);
          break;
        case "gate":
          this.hitGate(other, pos);
          break;
        case "kickback":
          this.hitKickback(ball);
          break;
        case "drain":
          this.drainBall(ball);
          break;
        default:
          break;
      }
    }
  }

  private addScore(base: number, pos?: Vec2): number {
    const multiplier = Math.min(8, 1 + Math.floor(this.streak / 12));
    const multiballBonus = this.balls.length > 1 ? 2 : 1;
    const gained = base * multiplier * multiballBonus;
    this.score += gained;
    this.streak++;
    // combo: consecutive scoring hits within the combo window
    this.comboCount = this.tick - this.comboLastTick <= COMBO_WINDOW_TICKS ? this.comboCount + 1 : 1;
    this.comboLastTick = this.tick;
    this.bestComboGame = Math.max(this.bestComboGame, this.comboCount);
    const milestone = COMBO_MILESTONES.find((m) => m.count === this.comboCount);
    if (milestone) {
      this.score += milestone.score;
      this.emit({ type: "combo", count: this.comboCount, score: milestone.score });
      addFlash(this.fx, 0.3);
    }
    if (pos) {
      spawnBurst(this.fx, pos, this.table.palette.glowA, 8, 3.2);
    }
    return gained;
  }

  private hitBumper(other: NvBody, ball: NvBody, pos: Vec2): void {
    const el = other.plugin.el as Extract<TableElement, { kind: "bumper" }>;
    const dx = ball.position.x - other.position.x;
    const dy = ball.position.y - other.position.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    Matter.Body.setVelocity(ball, {
      x: ball.velocity.x * 0.4 + (dx / d) * other.plugin.power!,
      y: ball.velocity.y * 0.4 + (dy / d) * other.plugin.power!,
    });
    const gained = this.addScore(other.plugin.score ?? el.score, pos);
    this.trySkillShot(el.id);
    this.emit({ type: "bumperHit", elementId: el.id, score: gained, pos });
    addShake(this.fx, 2);
    this.countHit(el.id);
  }

  private hitSling(other: NvBody, ball: NvBody, pos: Vec2): void {
    const el = other.plugin.el as Extract<TableElement, { kind: "sling" }>;
    // push away from triangle centroid along its face normal-ish
    const dx = ball.position.x - other.position.x;
    const dy = ball.position.y - other.position.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    Matter.Body.setVelocity(ball, {
      x: ball.velocity.x * 0.3 + (dx / d) * other.plugin.power!,
      y: ball.velocity.y * 0.3 + (dy / d) * other.plugin.power!,
    });
    const gained = this.addScore(other.plugin.score ?? el.score, pos);
    this.emit({ type: "slingHit", elementId: el.id, score: gained, pos });
    addShake(this.fx, 3);
  }

  private hitTarget(other: NvBody, _ball: NvBody, pos: Vec2): void {
    const id = other.plugin.id!;
    if (this.targetsDown.has(id)) return;
    const el = other.plugin.el as Extract<TableElement, { kind: "target" }>;
    this.targetsDown.add(id);
    Matter.Composite.remove(this.world, other);
    this.targetBodies.delete(id);
    const gained = this.addScore(other.plugin.score ?? el.score, pos);
    this.trySkillShot(id);
    this.emit({ type: "targetDown", elementId: id, groupId: el.group, pos });
    addShake(this.fx, 3);
    // group cleared?
    const groupTargets = [...this.targetBodies.values()].filter(
      (b) => b.plugin.groupId === el.group,
    );
    if (groupTargets.length === 0) {
      this.score += 2500;
      this.emit({ type: "groupCleared", groupId: el.group, score: 2500 });
      this.miniCountGroup(el.group);
      addFlash(this.fx, 0.35);
      addShake(this.fx, 7);
      this.timers.push({
        ticksLeft: TARGET_RESET_TICKS,
        fn: () => this.resetGroup(el.group),
      });
    }
  }

  private resetGroup(group: string): void {
    for (const el of this.table.elements) {
      if (el.kind === "target" && el.group === group && this.targetsDown.has(el.id)) {
        const body = Matter.Bodies.rectangle(el.pos.x, el.pos.y, el.w * 2, el.h * 2, {
          isStatic: true,
          angle: el.angle ?? 0,
        }) as NvBody;
        body.plugin = { nv: "target", id: el.id, el, groupId: el.group, score: el.score };
        Matter.Composite.add(this.world, body);
        this.targetBodies.set(el.id, body);
        this.targetsDown.delete(el.id);
      }
    }
  }

  private hitSpinner(other: NvBody, pos: Vec2): void {
    const id = other.plugin.id!;
    const el = other.plugin.el as Extract<TableElement, { kind: "spinner" }>;
    if ((this.spinnerVel.get(id) ?? 0) > 6) return; // rate limit
    this.spinnerVel.set(id, 14);
    const gained = this.addScore(other.plugin.score ?? el.score, pos);
    this.emit({ type: "spinner", score: gained });
    spawnBurst(this.fx, pos, this.table.palette.glowB, 6, 2.5);
  }

  private enterKicker(other: NvBody, ball: NvBody): void {
    const el = other.plugin.el as Extract<TableElement, { kind: "kicker" }>;
    if (this.kickerHolds.some((h) => h.body === ball)) return;
    ball.collisionFilter.mask = 0;
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Body.setStatic(ball, true);
    Matter.Body.setPosition(ball, { x: el.pos.x, y: el.pos.y });
    ball.plugin.held = true;
    this.kickerHolds.push({ body: ball, def: el, ticksLeft: Math.round(el.hold * 60) });
    this.score += this.addScore(other.plugin.score ?? el.score);
    this.countHit(el.id);
    this.emit({ type: "kicker", pos: { x: el.pos.x, y: el.pos.y } });
    addFlash(this.fx, 0.25);
  }

  private hitGate(other: NvBody, pos: Vec2): void {
    const id = other.plugin.id!;
    const last = this.gateLast.get(id) ?? -9999;
    if (this.tick - last < 48) return;
    this.gateLast.set(id, this.tick);
    const gained = this.addScore(2500, pos);
    this.emit({ type: "ramp", elementId: id, score: gained });
    addFlash(this.fx, 0.15);
    addShake(this.fx, 3);
  }

  private hitKickback(ball: NvBody): void {
    if (!this.kickbackArmed) return;
    this.kickbackArmed = false;
    Matter.Body.setVelocity(ball, { x: 0, y: -30 });
    addShake(this.fx, 8);
    this.emit({ type: "kickback", pos: { x: 24, y: 880 } });
    spawnBurst(this.fx, { x: 24, y: 880 }, this.table.palette.hot, 18, 5, { gravity: 0.01 });
  }

  private drainBall(ball: NvBody): void {
    if (this.kickerHolds.some((h) => h.body === ball)) return;
    // ball save: last ball drains inside the window → re-serve without cost
    if (
      this.ballSaveTicks > 0 &&
      !this.savedThisLaunch &&
      this.balls.length === 1 &&
      this.phase !== "gameover"
    ) {
      Matter.Composite.remove(this.world, ball);
      this.balls = [];
      this.ballSaveTicks = 0;
      this.savedThisLaunch = true;
      this.skillShotId = null;
      this.ballSavesGame++;
      this.timers.push({ ticksLeft: 45, fn: () => this.serveBall() });
      addFlash(this.fx, 0.35);
      addShake(this.fx, 6);
      this.emit({ type: "ballSaveUsed" });
      this.emit({ type: "ballSaved" });
      return;
    }
    Matter.Composite.remove(this.world, ball);
    this.balls = this.balls.filter((b) => b.body !== ball);
    if (this.balls.length > 0) {
      this.emit({ type: "ballLost", ballsRemaining: this.balls.length });
      return;
    }
    // end of ball
    const multiplier = Math.min(8, 1 + Math.floor(this.streak / 12));
    const bonus = 2500 * multiplier;
    this.score += bonus;
    this.emit({ type: "bonusAwarded", score: bonus, multiplier });
    this.tilt = false;
    this.nudgeTimes = [];
    this.streak = 0;
    this.comboCount = 0;
    this.kickbackArmed = true;
    this.spinnerHoldTicks.forEach((_, id) => this.spinnerHoldTicks.set(id, 0));
    this.ballsRemaining--;
    if (this.ballsRemaining <= 0) {
      this.phase = "gameover";
      this.emit({ type: "gameOver", finalScore: this.score });
      this.syncView();
      return;
    }
    this.emit({ type: "ballLost", ballsRemaining: this.ballsRemaining });
    this.ballNumber++;
    this.timers.push({ ticksLeft: 70, fn: () => this.serveBall() });
  }

  private serveBall(): void {
    if (this.phase === "gameover") return;
    const r = this.table.ballRadius ?? BALL_R_DEFAULT;
    const body = Matter.Bodies.circle(this.table.launch.x, this.table.launch.ballRestY, r, {
      restitution: this.table.ballRestitution ?? 0.82,
      friction: 0.04,
      frictionAir: 0.006,
      density: 0.004,
    }) as NvBody;
    body.plugin = { nv: "ball", trail: [], slowTicks: 0, iceTicks: 0 };
    Matter.Composite.add(this.world, body);
    this.balls.push({ body });
    this.phase = "ready";
    this.syncView();
  }

  // ---------------------------------------------------------------- mission

  private countHit(elementId: string): void {
    this.hitCount.set(elementId, (this.hitCount.get(elementId) ?? 0) + 1);
    this.miniCountHit(elementId);
  }

  private missionProgress(): { done: boolean; text: string } {
    const goal: MissionKind = this.table.mission.goal;
    switch (goal.type) {
      case "hits": {
        const have = this.hitCount.get(goal.elementId) ?? 0;
        return { done: have >= goal.count, text: `${Math.min(have, goal.count)}/${goal.count}` };
      }
      case "group": {
        const total = this.groupTotal.get(goal.groupId) ?? 0;
        const up = [...this.targetBodies.values()].filter((b) => b.plugin.groupId === goal.groupId).length;
        const down = total - up;
        return { done: total > 0 && down >= total, text: `${Math.min(down, total)}/${total}` };
      }
      case "spinnerHold": {
        const ticks = this.spinnerHoldTicks.get(goal.spinnerId) ?? 0;
        const secs = ticks / 60;
        return { done: secs >= goal.seconds, text: `${Math.min(secs, goal.seconds).toFixed(1)}/${goal.seconds}s` };
      }
    }
  }

  private missionArmed = true;

  /** DEV-only: completes the signature mission immediately (E2E verification). */
  debugCompleteMission(): void {
    if (!import.meta.env.DEV) return;
    this.missionTick(true);
  }

  /**
   * DEV-only: places the first ball at an element with a proper Matter
   * setPosition (bounds stay consistent) and launches it upward — E2E hook.
   */
  debugPlaceBall(elementId: string): void {
    if (!import.meta.env.DEV) return;
    const ball = this.balls[0]?.body;
    if (!ball) return;
    const el = this.table.elements.find((e) => e.id === elementId);
    const wall = this.table.walls.find((w) => w.id === elementId);
    let x: number | undefined;
    let y: number | undefined;
    let vy = -14;
    if (el && "pos" in el) {
      const r = "radius" in el ? el.radius : 8;
      x = el.pos.x;
      y = el.pos.y + r + 9;
    } else if (wall) {
      // gate sensors only exist on the first segment (points[0] → points[1])
      const p0 = wall.points[0];
      const p1 = wall.points[1] ?? p0;
      if (!p0 || !p1) return;
      x = (p0.x + p1.x) / 2;
      y = (p0.y + p1.y) / 2 + 12;
      vy = -10;
    }
    if (x === undefined || y === undefined) return;
    Matter.Body.setPosition(ball, { x, y });
    Matter.Body.setVelocity(ball, { x: 0, y: vy });
  }

  /** DEV-only: sends the last ball into the drain (E2E hook). */
  debugDrainBall(): void {
    if (!import.meta.env.DEV) return;
    const ball = this.balls[this.balls.length - 1]?.body;
    if (!ball) return;
    Matter.Body.setPosition(ball, { x: 270, y: 995 });
    Matter.Body.setVelocity(ball, { x: 0, y: 8 });
  }

  private missionTick(force = false): void {
    if (this.missionDoneFlash > 0 && !force) {
      this.missionDoneFlash -= 1 / 60;
      return;
    }
    if (!this.missionArmed) return;
    const { done } = force ? { done: true as const } : this.missionProgress();
    if (!done) return;
    this.missionArmed = false;
    this.missionDoneFlash = 3;
    const reward: MissionReward = this.table.mission.reward;
    this.score += this.table.mission.score;
    if (this.table.mission.goal.type === "spinnerHold") {
      this.spinnerHoldTicks.set(this.table.mission.goal.spinnerId, 0);
    }
    this.emit({ type: "missionComplete", score: this.table.mission.score, title: this.table.mission.title });
    this.missionCompletionsGame++;
    addFlash(this.fx, 0.8);
    addShake(this.fx, 10);
    switch (reward.type) {
      case "multiball": {
        const room = Math.max(0, (this.table.maxBalls ?? MAX_BALLS) - this.balls.length);
        const n = Math.min(reward.balls, room);
        if (n > 0) {
          this.emit({ type: "multiballStarted", balls: this.balls.length + n });
        }
        for (let i = 0; i < n; i++) {
          this.timers.push({
            ticksLeft: 40 + i * 50,
            fn: () => this.spawnBonusBall(),
          });
        }
        break;
      }
      case "jackpot":
        this.score += reward.score;
        break;
      case "iceBall":
        for (const b of this.balls) {
          b.body.plugin.iceTicks = Math.round(reward.seconds * 60);
          b.body.plugin.baseMass = b.body.mass;
          Matter.Body.setMass(b.body, b.body.mass * 0.55);
          b.body.frictionAir = 0.004;
          Matter.Body.setVelocity(b.body, {
            x: b.body.velocity.x * 1.15,
            y: b.body.velocity.y * 1.15,
          });
        }
        break;
    }
    this.emit({ type: "reward", reward });
    // re-arm mission after delay for replay value
    this.timers.push({
      ticksLeft: TARGET_RESET_TICKS,
      fn: () => {
        this.missionArmed = true;
        this.hitCount.clear();
        if (this.table.mission.goal.type === "spinnerHold") {
          this.spinnerHoldTicks.set(this.table.mission.goal.spinnerId, 0);
        }
        if (this.table.mission.goal.type === "group") {
          this.resetGroup(this.table.mission.goal.groupId);
        }
      },
    });
  }

  private spawnBonusBall(): void {
    if (this.phase === "gameover") return;
    if (this.balls.length >= (this.table.maxBalls ?? MAX_BALLS)) return;
    const r = this.table.ballRadius ?? BALL_R_DEFAULT;
    const body = Matter.Bodies.circle(this.table.launch.x, this.table.launch.ballRestY, r, {
      restitution: this.table.ballRestitution ?? 0.82,
      friction: 0.04,
      frictionAir: 0.006,
      density: 0.004,
    }) as NvBody;
    body.plugin = { nv: "ball", trail: [], slowTicks: 0, iceTicks: 0 };
    Matter.Composite.add(this.world, body);
    this.balls.push({ body });
    Matter.Body.setVelocity(body, { x: 0, y: -this.table.launch.power * 0.9 });
    this.phase = "play";
  }

  // ------------------------------------------------- skill shot + minis

  private armSkillShot(): void {
    if (this.skillShotCandidates.length === 0) return;
    const id = this.skillShotCandidates[this.skillShotCount % this.skillShotCandidates.length];
    if (!id) return;
    this.skillShotCount++;
    this.skillShotId = id;
    this.skillShotDeadline = this.tick + 180; // 3s window
    this.emit({ type: "skillShotLit", elementId: id });
  }

  private skillShotTick(): void {
    if (!this.skillShotId) return;
    if (this.tick > this.skillShotDeadline) {
      this.skillShotId = null;
      this.emit({ type: "skillShotMiss" });
    }
  }

  /** Pays the skill-shot bonus when the hit element is the lit one. */
  private trySkillShot(elementId: string): void {
    if (this.skillShotId !== elementId || this.tick > this.skillShotDeadline) return;
    this.skillShotId = null;
    this.skillShotsGame++;
    const bonus = 2500 + 500 * Math.min(3, this.skillShotsGame - 1);
    this.score += bonus;
    addFlash(this.fx, 0.4);
    addShake(this.fx, 6);
    spawnBurst(this.fx, { x: 270, y: 480 }, this.table.palette.hot, 24, 5);
    this.emit({ type: "skillShotHit", elementId, score: bonus });
  }

  private miniCountHit(elementId: string): void {
    for (const mini of this.table.miniMissions ?? []) {
      const st = this.miniState.get(mini.id);
      if (!st || !st.armed) continue;
      if (mini.goal.type === "hits" && mini.goal.elementId === elementId) st.hits++;
    }
  }

  private miniCountGroup(groupId: string): void {
    for (const mini of this.table.miniMissions ?? []) {
      const st = this.miniState.get(mini.id);
      if (!st || !st.armed) continue;
      if (mini.goal.type === "group" && mini.goal.groupId === groupId) st.groups++;
    }
  }

  private miniTick(): void {
    for (const mini of this.table.miniMissions ?? []) {
      const st = this.miniState.get(mini.id);
      if (!st) continue;
      if (st.doneFlash > 0) {
        st.doneFlash = Math.max(0, st.doneFlash - 1 / 60);
        continue;
      }
      if (!st.armed) continue;
      const done =
        mini.goal.type === "hits"
          ? st.hits >= mini.goal.count
          : mini.goal.type === "group"
            ? st.groups >= 1
            : (this.spinnerHoldTicks.get(mini.goal.spinnerId) ?? 0) / 60 >= mini.goal.seconds;
      if (!done) continue;
      st.armed = false;
      st.doneFlash = 3;
      this.score += mini.score;
      this.emit({ type: "miniMissionComplete", id: mini.id, title: mini.title, score: mini.score });
      addFlash(this.fx, 0.45);
      addShake(this.fx, 6);
      this.timers.push({
        ticksLeft: TARGET_RESET_TICKS,
        fn: () => {
          const s2 = this.miniState.get(mini.id);
          if (s2) {
            s2.armed = true;
            s2.hits = 0;
            s2.groups = 0;
          }
          if (mini.goal.type === "spinnerHold") {
            this.spinnerHoldTicks.set(mini.goal.spinnerId, 0);
          }
        },
      });
    }
  }

  private miniProgressText(mini: MiniMission): string {
    const st = this.miniState.get(mini.id);
    if (!st) return "";
    switch (mini.goal.type) {
      case "hits":
        return `${Math.min(st.hits, mini.goal.count)}/${mini.goal.count}`;
      case "group":
        return `${Math.min(st.groups, 1)}/1`;
      case "spinnerHold": {
        const secs = (this.spinnerHoldTicks.get(mini.goal.spinnerId) ?? 0) / 60;
        return `${Math.min(secs, mini.goal.seconds).toFixed(1)}/${mini.goal.seconds}s`;
      }
    }
  }

  /** Per-game numbers consumed by the meta layer at game over. */
  getStats(): GameStatsSummary {
    return {
      durationMs: Math.max(0, performance.now() - this.gameStartMs),
      ballsLaunched: this.ballsLaunchedGame,
      skillShots: this.skillShotsGame,
      ballSaves: this.ballSavesGame,
      bestCombo: this.bestComboGame,
      missionCompleted: this.missionCompletionsGame > 0,
    };
  }

  // -------------------------------------------------------------------- hud

  private objectiveText(): string {
    const m = this.table.mission;
    if (this.missionDoneFlash > 0) return `${m.title} — concluída!`;
    return m.title;
  }

  private pushHud(): void {
    this.hudFrame++;
    if (this.hudFrame % 6 !== 0) return; // ~10 Hz
    const { text } = this.missionProgress();
    const hud: HudSnapshot = {
      tableId: this.table.id,
      tableName: this.table.name,
      score: this.score,
      balls: this.ballsRemaining,
      ballNumber: this.ballNumber,
      multiplier: Math.min(8, 1 + Math.floor(this.streak / 12)),
      multiball: this.balls.length,
      objective: this.objectiveText(),
      objectiveProgress: this.missionDoneFlash > 0 ? "✔" : text,
      objectiveDone: this.missionDoneFlash > 0,
      paused: this.paused,
      tilt: this.tilt,
      kickbackArmed: this.kickbackArmed,
      muted: false,
      fps: Math.round(this.lastFps),
      skillShotId: this.skillShotId,
      ballSaveSeconds: this.ballSaveTicks / 60,
      combo: this.comboCount,
      miniMissions: (this.table.miniMissions ?? []).map((mini) => {
        const st = this.miniState.get(mini.id);
        return {
          id: mini.id,
          title: mini.title,
          progress: st && st.doneFlash > 0 ? "✔" : this.miniProgressText(mini),
          done: (st?.doneFlash ?? 0) > 0,
        };
      }),
    };
    this.cbs.onHud?.(hud);
  }

  private emit(evt: GameEvent): void {
    this.cbs.onEvent?.(evt);
  }
}

function deg(d: number): number {
  return (d * Math.PI) / 180;
}
