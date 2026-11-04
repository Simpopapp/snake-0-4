// NEONVOLT — app shell: menu ↔ game ↔ tournament + metagame recording.
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { GameScreen, type GameResult } from "@/components/pinball/GameScreen";
import { Menu } from "@/components/pinball/Menu";
import { useHighScores } from "@/hooks/use-highscores";
import { isMuted, setVolume, toggleMute } from "@/game/audio";
import { setReducedFx } from "@/game/fx";
import { ACHIEVEMENTS, recordGame, recordTournament, readProgress, type AchievementId, type Settings } from "@/game/progress";
import { TABLES } from "@/game/tables";
import type { GameStatsSummary, TableDef } from "@/game/types";

type Session =
  | { kind: "single"; table: TableDef; runId: number }
  | { kind: "tournament"; index: number; total: number; runId: number };

const tournamentTable = (index: number): TableDef => TABLES[index] ?? TABLES[0];

function announceUnlocks(unlocked: AchievementId[]): void {
  for (const id of unlocked) {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (def) toast.success(`Conquista: ${def.title}`, { description: def.desc });
  }
}

export default function PinballApp() {
  const { scores, record } = useHighScores();
  const [selected, setSelected] = useState(0);
  const [muted, setMuted] = useState(() => isMuted());
  const [settings, setSettings] = useState<Settings>(() => readProgress().settings);
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  // apply persisted settings once (volume + reduced effects)
  if (typeof window !== "undefined") {
    setVolume(settings.volume);
    setReducedFx(settings.reducedFx);
  }

  const handleSettingsChange = useCallback((s: Settings) => {
    setSettings(s);
  }, []);

  const handleGameOver = useCallback(
    (finalScore: number, stats: GameStatsSummary) => {
      if (!session) return;
      const table = session.kind === "single" ? session.table : tournamentTable(session.index);
      const isRecord = record(table.id, finalScore);
      const { unlocked } = recordGame(table.id, { ...stats, score: finalScore });
      announceUnlocks(unlocked);
      if (session.kind === "single") {
        setResult({ score: finalScore, stats, isRecord, unlocked });
        return;
      }
      const total = session.total + finalScore;
      const isFinal = session.index >= TABLES.length - 1;
      if (isFinal) {
        const { unlocked: tUnlocked } = recordTournament(total);
        announceUnlocks(tUnlocked);
      }
      setResult({ score: finalScore, stats, isRecord, unlocked, tournamentTotal: total, tournamentFinal: isFinal });
    },
    [session, record],
  );

  const nextTournamentTable = useCallback(() => {
    setResult(null);
    setSession((s) => {
      if (!s || s.kind !== "tournament") return s;
      if (s.index >= TABLES.length - 1) return null; // final: back to menu
      return { kind: "tournament", index: s.index + 1, total: s.total, runId: 0 };
    });
  }, []);

  const exitToMenu = useCallback(() => {
    setResult(null);
    setSession(null);
  }, []);

  if (session) {
    const table = session.kind === "single" ? session.table : tournamentTable(session.index);
    const tournament =
      session.kind === "tournament"
        ? { tableIndex: session.index, totalSoFar: session.total, tablesTotal: TABLES.length }
        : undefined;
    return (
      <GameScreen
        key={`${table.id}-${session.runId}-${session.kind}`}
        table={table}
        tournament={tournament}
        result={result}
        onExit={exitToMenu}
        onRestart={() =>
          setSession((s) => {
            if (!s) return s;
            setResult(null);
            return { ...s, runId: s.runId + 1 };
          })
        }
        onGameOver={handleGameOver}
        onTournamentNext={nextTournamentTable}
        muted={muted}
        onToggleMute={() => setMuted(toggleMute())}
      />
    );
  }

  return (
    <Menu
      scores={scores}
      selected={selected}
      onSelect={setSelected}
      onPlay={(table) => {
        setResult(null);
        setSession({ kind: "single", table, runId: 0 });
      }}
      onTournament={() => {
        setResult(null);
        setSession({ kind: "tournament", index: 0, total: 0, runId: 0 });
      }}
      muted={muted}
      onToggleMute={() => setMuted(toggleMute())}
      settings={settings}
      onSettingsChange={handleSettingsChange}
    />
  );
}
