// NEONVOLT — main menu 2.0: tabs (tables / stats / achievements / settings),
// keyboard navigation, table carousel with live previews and records.
import { useEffect, useState } from "react";
import { Layers, Play, RotateCcw, Trophy, Volume2, VolumeX, Zap } from "lucide-react";

import { AchievementsPanel, SettingsPanel, StatsPanel } from "@/components/pinball/Meta";
import { TablePreview } from "@/components/pinball/TablePreview";
import { TABLES } from "@/game/tables";
import type { Settings } from "@/game/progress";
import type { HighScores, TableDef } from "@/game/types";
import { cn } from "@/lib/utils";

type Tab = "mesas" | "stats" | "conquistas" | "ajustes";

const TABS: { id: Tab; label: string }[] = [
  { id: "mesas", label: "MESAS" },
  { id: "stats", label: "ESTATÍSTICAS" },
  { id: "conquistas", label: "CONQUISTAS" },
  { id: "ajustes", label: "AJUSTES" },
];

interface MenuProps {
  scores: HighScores;
  selected: number;
  onSelect: (index: number) => void;
  onPlay: (table: TableDef) => void;
  onTournament: () => void;
  muted: boolean;
  onToggleMute: () => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
}

export function Menu({
  scores,
  selected,
  onSelect,
  onPlay,
  onTournament,
  muted,
  onToggleMute,
  settings,
  onSettingsChange,
}: MenuProps) {
  const [tab, setTab] = useState<Tab>("mesas");
  const table = TABLES[selected] ?? TABLES[0];
  const format = (n: number) => n.toLocaleString("pt-BR");

  // keyboard navigation: ←/→ select tables (mesas tab) or switch tabs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (tab === "mesas") onSelect((selected + 1) % TABLES.length);
        else setTab(TABS[(TABS.findIndex((t) => t.id === tab) + 1) % TABS.length]?.id ?? "mesas");
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        if (tab === "mesas") onSelect((selected - 1 + TABLES.length) % TABLES.length);
        else
          setTab(
            TABS[(TABS.findIndex((t) => t.id === tab) - 1 + TABS.length) % TABS.length]?.id ?? "mesas",
          );
        e.preventDefault();
      } else if (e.key === "Enter" && tab === "mesas") {
        onPlay(table);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, selected, table, onSelect, onPlay]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-background px-4 py-6">
      {/* backdrop glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 70%)",
        }}
      />
      <header className="relative z-10 flex w-full max-w-5xl items-start justify-between">
        <div>
          <h1 className="nv-glow-text font-display text-6xl tracking-wider text-primary sm:text-7xl">
            NEONVOLT
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pinball elétrico · física real · 5 mesas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-display text-2xl text-foreground">{format(scores.global)}</p>
            <p className="text-xs text-muted-foreground">recorde global</p>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Ativar som" : "Silenciar"}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>
      </header>

      {/* tabs */}
      <nav className="relative z-10 mt-5 flex w-full max-w-5xl gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "font-display flex-1 rounded-lg border px-2 py-2 text-sm tracking-widest transition-colors sm:text-base",
              tab === t.id
                ? "border-primary/70 bg-primary/10 text-primary nv-glow-text"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* panels */}
      <div className="relative z-10 mt-5 w-full max-w-5xl">
        {tab === "mesas" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {TABLES.map((t, i) => {
                const active = i === selected;
                const best = scores.perTable[t.id] ?? 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(i)}
                    onDoubleClick={() => onPlay(t)}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200",
                      active
                        ? "scale-[1.02] border-primary/70 shadow-[0_0_36px_-8px_var(--color-primary)]"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="relative h-44 w-full overflow-hidden rounded-t-2xl">
                      <TablePreview tableId={t.id} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                      <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 font-display text-xs tracking-widest text-white/90">
                        MESA {i + 1}
                      </span>
                      {best > 0 && (
                        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-amber-300">
                          <Trophy className="size-3" />
                          {format(best)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <h2 className="font-display text-xl tracking-wide" style={{ color: t.palette.wall }}>
                        {t.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">{t.subtitle}</p>
                    </div>
                    {active && (
                      <div className="flex items-center justify-center gap-2 border-t border-primary/30 bg-primary/10 py-2 font-display text-base tracking-widest text-primary">
                        <Play className="size-4" />
                        JOGAR
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => onPlay(table)}
                className="font-display flex items-center gap-3 rounded-xl bg-primary px-10 py-4 text-2xl tracking-widest text-primary-foreground shadow-[0_0_40px_-10px_var(--color-primary)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <Play className="size-6" />
                JOGAR · {table.name.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={onTournament}
                className="font-display flex items-center gap-2 rounded-xl border border-accent/60 px-6 py-2.5 text-lg tracking-widest text-accent transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <Zap className="size-4" />
                TORNEIO · VOLTAGEM TOTAL
              </button>
              <p className="text-center text-xs text-muted-foreground">
                5 mesas × 2 bolas · placar cumulativo
              </p>
            </div>
          </>
        )}
        {tab === "stats" && <StatsPanel />}
        {tab === "conquistas" && <AchievementsPanel />}
        {tab === "ajustes" && <SettingsPanel settings={settings} onChange={onSettingsChange} />}
      </div>

      {tab === "mesas" && (
        <div className="relative z-10 mt-8 grid w-full max-w-5xl gap-x-10 gap-y-1 text-center text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            <kbd className="rounded bg-muted px-1.5 py-0.5">←</kbd>{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">→</kbd> escolher mesa ·{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">Enter</kbd> jogar ·{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">↓</kbd> segure e solte para lançar ·{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">Shift</kbd> empurrar
          </p>
          <p>
            No celular: toque nas metades da tela · 3 empurrões = TILT ·{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> pausa
          </p>
        </div>
      )}

      <footer className="relative z-10 mt-auto flex items-center gap-2 pt-8 text-[10px] text-muted-foreground/60">
        <Layers className="inline size-3" />
        progresso salvo neste navegador
        <RotateCcw className="ml-2 inline size-3" />
        recordes salvos neste navegador
      </footer>
    </div>
  );
}
