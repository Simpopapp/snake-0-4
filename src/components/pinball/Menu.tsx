// NEONVOLT — main menu: table carousel with live previews and records.
import { Play, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";

import { TablePreview } from "@/components/pinball/TablePreview";
import { TABLES } from "@/game/tables";
import type { HighScores, TableDef } from "@/game/types";
import { cn } from "@/lib/utils";

interface MenuProps {
  scores: HighScores;
  selected: number;
  onSelect: (index: number) => void;
  onPlay: (table: TableDef) => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function Menu({ scores, selected, onSelect, onPlay, muted, onToggleMute }: MenuProps) {
  const table = TABLES[selected] ?? TABLES[0];
  const format = (n: number) => n.toLocaleString("pt-BR");

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
            Pinball elétrico · física real · 4 mesas
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

      {/* table carousel */}
      <div className="relative z-10 mt-6 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="relative h-56 w-full overflow-hidden rounded-t-2xl">
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
              <div className="flex flex-1 flex-col gap-1 p-4">
                <h2
                  className="font-display text-2xl tracking-wide"
                  style={{ color: t.palette.wall }}
                >
                  {t.name}
                </h2>
                <p className="text-xs text-muted-foreground">{t.subtitle}</p>
                <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground/80">
                  {t.mission.hint}
                </p>
              </div>
              {active && (
                <div className="flex items-center justify-center gap-2 border-t border-primary/30 bg-primary/10 py-2.5 font-display text-lg tracking-widest text-primary">
                  <Play className="size-4" />
                  JOGAR
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative z-10 mt-8 flex w-full max-w-5xl flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => onPlay(table)}
          className="font-display flex items-center gap-3 rounded-xl bg-primary px-10 py-4 text-2xl tracking-widest text-primary-foreground shadow-[0_0_40px_-10px_var(--color-primary)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          <Play className="size-6" />
          JOGAR · {table.name.toUpperCase()}
        </button>
        <div className="grid gap-x-10 gap-y-1 text-center text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            <kbd className="rounded bg-muted px-1.5 py-0.5">←</kbd>{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">→</kbd> flippers ·{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">↓</kbd> segure e solte para lançar ·{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">Shift</kbd> empurrar
          </p>
          <p>
            No celular: toque nas metades da tela · 3 empurrões = TILT ·{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> pausa
          </p>
        </div>
      </div>

      <footer className="relative z-10 mt-auto pt-8 text-[10px] text-muted-foreground/60">
        <RotateCcw className="mr-1 inline size-3" />
        recordes salvos neste navegador
      </footer>
    </div>
  );
}
