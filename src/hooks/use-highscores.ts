// NEONVOLT — highscore persistence (localStorage).
import { useCallback, useState } from "react";
import { STORAGE_KEY, type HighScores, type TableId } from "@/game/types";

export function readScores(): HighScores {
  if (typeof window === "undefined") return { global: 0, perTable: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { global: 0, perTable: {} };
    const parsed = JSON.parse(raw) as Partial<HighScores>;
    return {
      global: typeof parsed.global === "number" ? parsed.global : 0,
      perTable: parsed.perTable ?? {},
    };
  } catch {
    return { global: 0, perTable: {} };
  }
}

/** Records a score if it beats the stored one. Returns true when it is a new record. */
export function saveScore(tableId: TableId, score: number): boolean {
  if (typeof window === "undefined") return false;
  const current = readScores();
  const tableBest = current.perTable[tableId] ?? 0;
  const isRecord = score > current.global || score > tableBest;
  const next: HighScores = {
    global: Math.max(current.global, score),
    perTable: { ...current.perTable, [tableId]: Math.max(tableBest, score) },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return isRecord;
}

export function useHighScores() {
  const [scores, setScores] = useState<HighScores>(() => readScores());

  const record = useCallback((tableId: TableId, score: number) => {
    const isRecord = saveScore(tableId, score);
    setScores(readScores());
    return isRecord;
  }, []);

  return { scores, record };
}
