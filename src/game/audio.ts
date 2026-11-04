// NEONVOLT — synthesized WebAudio sound bank. No external assets.
// Lazily created on first user gesture; muted state persists in localStorage.
import type { GameEvent } from "./types";

const MUTE_KEY = "neonvolt.v1.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let muted = false;
let volume = 70; // 0–100, runtime mirror of progress settings

/** Gain = base * (volume/100), clamped. */
function masterGain(): number {
  return 0.5 * Math.max(0, Math.min(100, volume)) / 70;
}

function readMuted(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return muted;
  }
}

if (typeof window !== "undefined") {
  muted = readMuted();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    }
  } catch {
    // storage unavailable: keep mute in memory only
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : masterGain(), ctx.currentTime, 0.02);
  }
  return muted;
}

/** Volume 0–100 (persisted by the progress module; this is the runtime mirror). */
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(100, Math.round(v)));
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : masterGain(), ctx.currentTime, 0.02);
  }
}

export function getVolume(): number {
  return volume;
}

/** Call from a user-gesture handler (click/keydown) to unlock audio. */
export function ensureAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : masterGain();
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.16;
  musicBus.connect(master);
}

// ------------------------------------------------------------ ambient music

type MusicPattern = {
  bpm: number;
  wave: OscillatorType;
  bass: number[];
  arp: number[];
};

// 8 eighth-note steps per pattern; frequencies in Hz (chord tones, kept low).
const MUSIC: Record<string, MusicPattern> = {
  "circuito-neon": {
    bpm: 122,
    wave: "square",
    bass: [110, 110, 146.8, 146.8, 110, 110, 130.8, 130.8],
    arp: [440, 523, 659, 523, 440, 587, 659, 587],
  },
  "forja-solar": {
    bpm: 108,
    wave: "sawtooth",
    bass: [98, 98, 116.5, 116.5, 98, 98, 87.3, 87.3],
    arp: [392, 466, 587, 466, 392, 466, 523, 466],
  },
  abissal: {
    bpm: 84,
    wave: "sine",
    bass: [73.4, 73.4, 87.3, 87.3, 73.4, 73.4, 65.4, 65.4],
    arp: [293.7, 349.2, 440, 349.2, 293.7, 392, 440, 392],
  },
  criogenese: {
    bpm: 100,
    wave: "triangle",
    bass: [82.4, 82.4, 98, 98, 82.4, 82.4, 110, 110],
    arp: [659, 784, 988, 784, 659, 880, 988, 880],
  },
  supernova: {
    bpm: 96,
    wave: "square",
    bass: [92.5, 92.5, 123.5, 123.5, 92.5, 92.5, 138.6, 138.6],
    arp: [494, 587, 740, 587, 494, 622, 740, 622],
  },
};

let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStep = 0;
let musicNextTime = 0;

function scheduleMusicStep(pattern: MusicPattern, time: number, step: number): void {
  if (!ctx || !musicBus) return;
  const stepDur = 60 / pattern.bpm / 2; // eighth notes
  const bass = pattern.bass[step % 8];
  const arp = pattern.arp[step % 8];
  if (bass) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = pattern.wave;
    osc.frequency.setValueAtTime(bass, time);
    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 0.95);
    osc.connect(gain);
    gain.connect(musicBus);
    osc.start(time);
    osc.stop(time + stepDur);
  }
  if (arp) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = pattern.wave === "square" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(arp, time);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.4);
    osc.connect(gain);
    gain.connect(musicBus);
    osc.start(time);
    osc.stop(time + stepDur * 1.5);
  }
}

/** Starts the ambient loop for a table (no-op if already playing it). */
export function startMusic(tableId: string): void {
  if (!ctx || !musicBus || muted) return;
  const pattern = MUSIC[tableId] ?? MUSIC["circuito-neon"];
  if (!pattern) return;
  stopMusic();
  musicStep = 0;
  musicNextTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx || muted) return;
    const stepDur = 60 / pattern.bpm / 2;
    // lookahead scheduling: keep ~0.4s of music queued
    while (musicNextTime < ctx.currentTime + 0.4) {
      scheduleMusicStep(pattern, musicNextTime, musicStep++);
      musicNextTime += stepDur;
    }
  }, 100);
}

export function stopMusic(): void {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  endFreq?: number;
  dur?: number;
  vol?: number;
  delay?: number;
}

function tone({ type = "square", freq, endFreq, dur = 0.08, vol = 0.3, delay = 0 }: ToneOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur = 0.06, vol = 0.2, freq = 1800): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

export function playEvent(evt: GameEvent): void {
  switch (evt.type) {
    case "bumperHit":
      tone({ type: "square", freq: 340 + (evt.pos.x % 7) * 40, endFreq: 220, dur: 0.07, vol: 0.28 });
      break;
    case "slingHit":
      noiseBurst(0.05, 0.25, 2400);
      tone({ type: "triangle", freq: 520, endFreq: 300, dur: 0.05, vol: 0.2 });
      break;
    case "targetDown":
      tone({ type: "square", freq: 660, endFreq: 440, dur: 0.09, vol: 0.25 });
      noiseBurst(0.04, 0.15, 3200);
      break;
    case "groupCleared":
      tone({ type: "triangle", freq: 523, dur: 0.12, vol: 0.3 });
      tone({ type: "triangle", freq: 659, dur: 0.12, vol: 0.3, delay: 0.09 });
      tone({ type: "triangle", freq: 784, dur: 0.2, vol: 0.32, delay: 0.18 });
      break;
    case "spinner":
      tone({ type: "sawtooth", freq: 900 + Math.random() * 300, endFreq: 1300, dur: 0.05, vol: 0.14 });
      break;
    case "ramp":
      tone({ type: "sawtooth", freq: 300, endFreq: 1200, dur: 0.25, vol: 0.22 });
      break;
    case "kicker":
      tone({ type: "sine", freq: 180, endFreq: 90, dur: 0.18, vol: 0.35 });
      tone({ type: "triangle", freq: 880, dur: 0.1, vol: 0.2, delay: 0.05 });
      break;
    case "kickback":
      tone({ type: "sawtooth", freq: 120, endFreq: 700, dur: 0.3, vol: 0.35 });
      break;
    case "launch":
      tone({ type: "sawtooth", freq: 140 + evt.power * 120, endFreq: 900, dur: 0.28, vol: 0.3 });
      break;
    case "ballLost":
      tone({ type: "sine", freq: 420, endFreq: 70, dur: 0.5, vol: 0.35 });
      break;
    case "bonusAwarded":
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: 0.14, vol: 0.26, delay: i * 0.08 }),
      );
      break;
    case "missionComplete":
      [392, 523, 659, 784, 1046].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: 0.22, vol: 0.28, delay: i * 0.07 }),
      );
      break;
    case "multiballStarted":
      [440, 587, 740, 880, 1174].forEach((f, i) =>
        tone({ type: "square", freq: f, dur: 0.09, vol: 0.24, delay: i * 0.06 }),
      );
      break;
    case "tilt":
      tone({ type: "sawtooth", freq: 110, endFreq: 60, dur: 0.7, vol: 0.4 });
      break;
    case "nudge":
      noiseBurst(0.05, 0.18, 300);
      break;
    case "gameOver":
      [523, 415, 349, 262].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: 0.3, vol: 0.3, delay: i * 0.18 }),
      );
      break;
    case "skillShotLit":
      tone({ type: "triangle", freq: 740, endFreq: 988, dur: 0.16, vol: 0.2 });
      break;
    case "skillShotHit":
      [784, 988, 1319].forEach((f, i) =>
        tone({ type: "square", freq: f, dur: 0.12, vol: 0.28, delay: i * 0.06 }),
      );
      break;
    case "skillShotMiss":
      tone({ type: "triangle", freq: 392, endFreq: 262, dur: 0.18, vol: 0.14 });
      break;
    case "ballSaveUsed":
      tone({ type: "sawtooth", freq: 220, endFreq: 660, dur: 0.24, vol: 0.26 });
      tone({ type: "square", freq: 880, dur: 0.1, vol: 0.2, delay: 0.2 });
      break;
    case "ballSaved":
      tone({ type: "sine", freq: 660, endFreq: 880, dur: 0.2, vol: 0.2 });
      break;
    case "combo": {
      const base = 440 + Math.min(6, Math.floor(evt.count / 5)) * 110;
      tone({ type: "square", freq: base, endFreq: base * 1.5, dur: 0.14, vol: 0.26 });
      break;
    }
    case "miniMissionComplete":
      [523, 659, 784].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: 0.16, vol: 0.26, delay: i * 0.08 }),
      );
      break;
    case "tournamentTableComplete":
      [392, 523, 659, 784].forEach((f, i) =>
        tone({ type: "square", freq: f, dur: 0.16, vol: 0.26, delay: i * 0.09 }),
      );
      break;
    default:
      break;
  }
}
