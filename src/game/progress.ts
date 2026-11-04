// NEONVOLT — metagame persistence: stats, achievements and settings.
// Own storage key, tolerant reads (never throws), additive schema.
import { TABLES } from "./tables";
import type { TableId } from "./types";

export const PROGRESS_KEY = "neonvolt.progress.v1";

export type AchievementId =
  | "first-game"
  | "score-10k"
  | "score-50k"
  | "score-100k"
  | "mission-circuito-neon"
  | "mission-forja-solar"
  | "mission-abissal"
  | "mission-criogenese"
  | "mission-supernova"
  | "skill-5"
  | "saves-10"
  | "combo-20"
  | "tournament"
  | "all-tables";

export interface AchievementDef {
  id: AchievementId;
  title: string;
  desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-game", title: "Primeira Descarga", desc: "Jogue a sua primeira partida" },
  { id: "score-10k", title: "Novato do Volt", desc: "Faça 10.000 pontos em uma partida" },
  { id: "score-50k", title: "Circuito Fechado", desc: "Faça 50.000 pontos em uma partida" },
  { id: "score-100k", title: "Magnata do Neon", desc: "Faça 100.000 pontos em uma partida" },
  { id: "mission-circuito-neon", title: "Sobrecarga", desc: "Complete a missão do Circuito Neon" },
  { id: "mission-forja-solar", title: "Ignição", desc: "Complete a missão da Forja Solar" },
  { id: "mission-abissal", title: "Leviatã", desc: "Complete a missão da Abissal" },
  { id: "mission-criogenese", title: "Zero Absoluto", desc: "Complete a missão da Criogênese" },
  { id: "mission-supernova", title: "Supernova", desc: "Complete a missão da Supernova" },
  { id: "skill-5", title: "Olho Clínico", desc: "Acumule 5 skill shots" },
  { id: "saves-10", title: "Rede de Segurança", desc: "Acumule 10 ball saves" },
  { id: "combo-20", title: "Combo x20", desc: "Alcance combo 20 em uma partida" },
  { id: "tournament", title: "Voltagem Total", desc: "Conclua um torneio" },
  { id: "all-tables", title: "Vetoriano", desc: "Jogue todas as mesas ao menos uma vez" },
];

export interface GameStats {
  gamesPlayed: number;
  timePlayedMs: number;
  ballsLaunched: number;
  skillShots: number;
  ballSaves: number;
  bestCombo: number;
  /** Signature missions completed, per table (cumulative) */
  missionsCompleted: Partial<Record<TableId, number>>;
  /** Last 5 scores per table */
  highscoresHistory: Partial<Record<TableId, number[]>>;
  /** Tables played at least once */
  tablesPlayed: TableId[];
  /** Best cumulative tournament score */
  tournamentBest: number;
}

export interface AchievementState {
  unlocked: AchievementId[];
  /** When each achievement was unlocked (epoch ms) */
  unlockedAt: Partial<Record<AchievementId, number>>;
}

export interface Settings {
  /** 0–100 */
  volume: number;
  /** Fewer particles, no shake */
  reducedFx: boolean;
}

export interface Progress {
  stats: GameStats;
  achievements: AchievementState;
  settings: Settings;
}

export interface GameSummary {
  score: number;
  durationMs: number;
  ballsLaunched: number;
  skillShots: number;
  ballSaves: number;
  bestCombo: number;
  /** Signature mission completed in this game? */
  missionCompleted: boolean;
  /** Was this a tournament table (score counts toward tournament)? */
  tournament?: boolean;
}

const HISTORY_SIZE = 5;

function defaultProgress(): Progress {
  return {
    stats: {
      gamesPlayed: 0,
      timePlayedMs: 0,
      ballsLaunched: 0,
      skillShots: 0,
      ballSaves: 0,
      bestCombo: 0,
      missionsCompleted: {},
      highscoresHistory: {},
      tablesPlayed: [],
      tournamentBest: 0,
    },
    achievements: { unlocked: [], unlockedAt: {} },
    settings: { volume: 70, reducedFx: false },
  };
}

export function readProgress(): Progress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const d = defaultProgress();
    return {
      stats: { ...d.stats, ...(parsed.stats ?? {}) },
      achievements: { ...d.achievements, ...(parsed.achievements ?? {}) },
      settings: { ...d.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultProgress();
  }
}

function writeProgress(p: Progress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // storage unavailable: keep in memory only
  }
}

/** Low-level mutation for stats/settings screens; returns the new progress. */
export function updateProgress(fn: (p: Progress) => Progress): Progress {
  const next = fn(readProgress());
  writeProgress(next);
  return next;
}

export function saveSettings(settings: Settings): Progress {
  return updateProgress((p) => ({ ...p, settings }));
}

/**
 * Records a finished game: merges stats, appends score history and unlocks
 * achievements. Returns the ids unlocked by THIS call (deduped).
 */
export function recordGame(tableId: TableId, s: GameSummary): { unlocked: AchievementId[] } {
  const before = readProgress();
  const st = before.stats;
  const stats: GameStats = {
    ...st,
    gamesPlayed: st.gamesPlayed + 1,
    timePlayedMs: st.timePlayedMs + s.durationMs,
    ballsLaunched: st.ballsLaunched + s.ballsLaunched,
    skillShots: st.skillShots + s.skillShots,
    ballSaves: st.ballSaves + s.ballSaves,
    bestCombo: Math.max(st.bestCombo, s.bestCombo),
    missionsCompleted: s.missionCompleted
      ? { ...st.missionsCompleted, [tableId]: (st.missionsCompleted[tableId] ?? 0) + 1 }
      : st.missionsCompleted,
    highscoresHistory: {
      ...st.highscoresHistory,
      [tableId]: [...(st.highscoresHistory[tableId] ?? []), s.score].slice(-HISTORY_SIZE),
    },
    tablesPlayed: st.tablesPlayed.includes(tableId) ? st.tablesPlayed : [...st.tablesPlayed, tableId],
    tournamentBest: s.tournament ? Math.max(st.tournamentBest, s.score) : st.tournamentBest,
  };

  const unlocked = new Set<AchievementId>(before.achievements.unlocked);
  const now = Date.now();
  const fresh: AchievementId[] = [];
  const grant = (id: AchievementId, condition: boolean): void => {
    if (condition && !unlocked.has(id)) {
      unlocked.add(id);
      fresh.push(id);
    }
  };
  grant("first-game", stats.gamesPlayed >= 1);
  grant("score-10k", s.score >= 10_000);
  grant("score-50k", s.score >= 50_000);
  grant("score-100k", s.score >= 100_000);
  if (s.missionCompleted) grant(`mission-${tableId}` as AchievementId, true);
  grant("skill-5", stats.skillShots >= 5);
  grant("saves-10", stats.ballSaves >= 10);
  grant("combo-20", stats.bestCombo >= 20);
  grant("all-tables", TABLES.every((t) => stats.tablesPlayed.includes(t.id)));

  const achievements: AchievementState = { unlocked: [...unlocked], unlockedAt: { ...before.achievements.unlockedAt } };
  for (const id of fresh) achievements.unlockedAt[id] = now;

  const next: Progress = { stats, achievements, settings: before.settings };
  writeProgress(next);
  return { unlocked: fresh };
}

/** Marks a full tournament completion with the given cumulative score. */
export function recordTournament(totalScore: number): { unlocked: AchievementId[] } {
  const before = readProgress();
  const unlocked = new Set<AchievementId>(before.achievements.unlocked);
  const fresh: AchievementId[] = [];
  if (totalScore > 0 && !unlocked.has("tournament")) {
    unlocked.add("tournament");
    fresh.push("tournament");
  }
  const now = Date.now();
  const achievements: AchievementState = { unlocked: [...unlocked], unlockedAt: { ...before.achievements.unlockedAt } };
  for (const id of fresh) achievements.unlockedAt[id] = now;
  const next: Progress = {
    stats: { ...before.stats, tournamentBest: Math.max(before.stats.tournamentBest, totalScore) },
    achievements,
    settings: before.settings,
  };
  writeProgress(next);
  return { unlocked: fresh };
}
