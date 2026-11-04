import { beforeEach, describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  readProgress,
  recordGame,
  recordTournament,
  type GameSummary,
} from "@/game/progress";

const summary = (over: Partial<GameSummary> = {}): GameSummary => ({
  score: 1000,
  durationMs: 60_000,
  ballsLaunched: 3,
  skillShots: 0,
  ballSaves: 0,
  bestCombo: 0,
  missionCompleted: false,
  ...over,
});

describe("NEONVOLT progress (PRD project2 §6.5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("has exactly 14 achievements with unique ids", () => {
    expect(ACHIEVEMENTS).toHaveLength(14);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(14);
  });

  it("starts with default settings (volume 70, no reduced fx)", () => {
    const p = readProgress();
    expect(p.settings.volume).toBe(70);
    expect(p.settings.reducedFx).toBe(false);
  });

  it("unlocks score achievements at 10k/50k/100k", () => {
    const r1 = recordGame("circuito-neon", summary({ score: 9999 }));
    expect(r1.unlocked).toContain("first-game");
    expect(r1.unlocked).not.toContain("score-10k");
    const r2 = recordGame("circuito-neon", summary({ score: 10_000 }));
    expect(r2.unlocked).toContain("score-10k");
    const r3 = recordGame("circuito-neon", summary({ score: 50_000 }));
    expect(r3.unlocked).toContain("score-50k");
    const r4 = recordGame("circuito-neon", summary({ score: 100_000 }));
    expect(r4.unlocked).toContain("score-100k");
  });

  it("unlocks the table mission achievement on the right table only", () => {
    const r = recordGame("abissal", summary({ missionCompleted: true }));
    expect(r.unlocked).toContain("mission-abissal");
    expect(r.unlocked).not.toContain("mission-circuito-neon");
    expect(readProgress().stats.missionsCompleted.abissal).toBe(1);
  });

  it("unlocks skill/saves/combo achievements from cumulative stats", () => {
    for (let i = 0; i < 5; i++) {
      const r = recordGame("circuito-neon", summary({ skillShots: 1 }));
      if (i === 4) expect(r.unlocked).toContain("skill-5");
      else expect(r.unlocked).not.toContain("skill-5");
    }
    for (let i = 0; i < 10; i++) {
      const r = recordGame("circuito-neon", summary({ ballSaves: 1 }));
      if (i === 9) expect(r.unlocked).toContain("saves-10");
    }
    const rCombo = recordGame("circuito-neon", summary({ bestCombo: 20 }));
    expect(rCombo.unlocked).toContain("combo-20");
  });

  it("unlocks all-tables only after all five tables are played", () => {
    const ids = ["circuito-neon", "forja-solar", "abissal", "criogenese"] as const;
    let last = { unlocked: [] as string[] };
    for (const id of ids) last = recordGame(id, summary());
    expect(last.unlocked).not.toContain("all-tables");
    last = recordGame("supernova", summary());
    expect(last.unlocked).toContain("all-tables");
  });

  it("keeps the last 5 scores of history per table", () => {
    for (let i = 1; i <= 7; i++) recordGame("forja-solar", summary({ score: i * 100 }));
    expect(readProgress().stats.highscoresHistory["forja-solar"]).toEqual([300, 400, 500, 600, 700]);
  });

  it("tolerates corrupted storage without throwing", () => {
    window.localStorage.setItem("neonvolt.progress.v1", "{not json");
    expect(readProgress().stats.gamesPlayed).toBe(0);
    expect(() => recordGame("circuito-neon", summary())).not.toThrow();
  });

  it("records the tournament achievement and best score", () => {
    const r = recordTournament(88_000);
    expect(r.unlocked).toContain("tournament");
    expect(readProgress().stats.tournamentBest).toBe(88_000);
    expect(recordTournament(500).unlocked).toEqual([]);
    expect(readProgress().stats.tournamentBest).toBe(88_000);
  });

  it("does not re-unlock achievements", () => {
    recordGame("circuito-neon", summary({ score: 10_000 }));
    const again = recordGame("circuito-neon", summary({ score: 20_000 }));
    expect(again.unlocked).not.toContain("score-10k");
  });
});
