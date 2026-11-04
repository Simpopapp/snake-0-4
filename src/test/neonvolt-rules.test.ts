import { beforeEach, describe, expect, it } from "vitest";

import { readScores, saveScore } from "@/hooks/use-highscores";
import { TABLES } from "@/game/tables";
import { validateTable } from "@/game/validate";

describe("NEONVOLT highscores", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty", () => {
    expect(readScores()).toEqual({ global: 0, perTable: {} });
  });

  it("records a score per table and updates the global record", () => {
    expect(saveScore("circuito-neon", 12000)).toBe(true);
    const after = readScores();
    expect(after.global).toBe(12000);
    expect(after.perTable["circuito-neon"]).toBe(12000);

    // lower score on another table: stored per table, does not beat global
    expect(saveScore("abissal", 5000)).toBe(true);
    const mixed = readScores();
    expect(mixed.global).toBe(12000);
    expect(mixed.perTable.abissal).toBe(5000);

    // lower score on the same table is not a record
    expect(saveScore("circuito-neon", 1000)).toBe(false);
    expect(readScores().perTable["circuito-neon"]).toBe(12000);

    // higher score becomes the new record
    expect(saveScore("circuito-neon", 20000)).toBe(true);
    expect(readScores().global).toBe(20000);
  });

  it("persists across reloads (localStorage)", () => {
    saveScore("forja-solar", 7777);
    // simulate a fresh page: read again from storage
    expect(readScores().perTable["forja-solar"]).toBe(7777);
  });
});

describe("NEONVOLT tables", () => {
  it("all five tables validate with zero issues", () => {
    expect(TABLES).toHaveLength(5);
    for (const table of TABLES) {
      expect(validateTable(table)).toEqual([]);
    }
  });

  it("every table has a signature mission with an existing goal", () => {
    for (const table of TABLES) {
      expect(table.mission.title).toBeTruthy();
      expect(table.mission.hint).toBeTruthy();
      const goal = table.mission.goal;
      if (goal.type === "hits") {
        expect(table.elements.some((e) => e.id === goal.elementId)).toBe(true);
      }
      if (goal.type === "spinnerHold") {
        expect(table.elements.some((e) => e.id === goal.spinnerId)).toBe(true);
      }
      if (goal.type === "group") {
        expect(table.elements.some((e) => e.kind === "target" && e.group === goal.groupId)).toBe(true);
      }
    }
  });

  it("every table has two mini missions with valid goals (PRD project2 §6.4)", () => {
    for (const table of TABLES) {
      expect(table.miniMissions).toHaveLength(2);
      for (const mini of table.miniMissions ?? []) {
        const goal = mini.goal;
        expect(mini.title).toBeTruthy();
        expect(mini.hint).toBeTruthy();
        expect(mini.score).toBeGreaterThanOrEqual(3000);
        expect(mini.score).toBeLessThanOrEqual(7500);
        if (goal.type === "hits") {
          expect(table.elements.some((e) => e.id === goal.elementId)).toBe(true);
        }
        if (goal.type === "spinnerHold") {
          expect(table.elements.some((e) => e.id === goal.spinnerId)).toBe(true);
        }
        if (goal.type === "group") {
          expect(table.elements.some((e) => e.kind === "target" && e.group === goal.groupId)).toBe(true);
        }
      }
    }
  });

  it("skill shot has lit candidates on every table (bumpers + targets)", () => {
    for (const table of TABLES) {
      const candidates = table.elements.filter((e) => e.kind === "bumper" || e.kind === "target");
      expect(candidates.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("NEONVOLT balanceamento (PRD §5.3)", () => {
  it("drop targets valem 500 e bumpers ficam entre 100 e 500", () => {
    for (const table of TABLES) {
      for (const el of table.elements) {
        if (el.kind === "target") expect(el.score).toBe(500);
        if (el.kind === "bumper") {
          expect(el.score).toBeGreaterThanOrEqual(100);
          expect(el.score).toBeLessThanOrEqual(500);
        }
      }
    }
  });

  it("concluir a missão assinatura paga 10.000+", () => {
    for (const table of TABLES) {
      expect(table.mission.score).toBeGreaterThanOrEqual(10000);
    }
  });
});
