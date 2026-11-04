// NEONVOLT — app shell: menu ↔ game screen switching + highscores.
import { useCallback, useState } from "react";

import { GameScreen } from "@/components/pinball/GameScreen";
import { Menu } from "@/components/pinball/Menu";
import { useHighScores } from "@/hooks/use-highscores";
import { isMuted, toggleMute } from "@/game/audio";
import type { TableDef } from "@/game/types";

export default function PinballApp() {
  const { scores, record } = useHighScores();
  const [selected, setSelected] = useState(0);
  const [muted, setMuted] = useState(() => isMuted());
  const [game, setGame] = useState<{ table: TableDef; runId: number } | null>(null);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      if (game) record(game.table.id, finalScore);
    },
    [game, record],
  );

  if (game) {
    return (
      <GameScreen
        key={`${game.table.id}-${game.runId}`}
        table={game.table}
        onExit={() => setGame(null)}
        onRestart={() => setGame((g) => (g ? { ...g, runId: g.runId + 1 } : g))}
        onGameOver={handleGameOver}
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
      onPlay={(table) => setGame({ table, runId: 0 })}
      muted={muted}
      onToggleMute={() => setMuted(toggleMute())}
    />
  );
}
