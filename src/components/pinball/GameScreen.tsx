// NEONVOLT — game screen: canvas, engine wiring, HUD, overlays, controls,
// music lifecycle, metagame result overlays (single game and tournament).
import { Pause, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureAudio, playEvent, startMusic, stopMusic } from "@/game/audio";
import { PinballGame, type RenderView } from "@/game/engine";
import { drawFrame } from "@/game/renderer";
import type { FxState } from "@/game/fx";
import type { AchievementId, } from "@/game/progress";
import type { GameEvent, GameStatsSummary, HudSnapshot, TableDef } from "@/game/types";
import { cn } from "@/lib/utils";

export interface GameResult {
  score: number;
  stats: GameStatsSummary;
  isRecord: boolean;
  unlocked: AchievementId[];
  /** Tournament: cumulative total after this table */
  tournamentTotal?: number;
  /** Tournament: this was the last table */
  tournamentFinal?: boolean;
}

export interface TournamentInfo {
  tableIndex: number;
  totalSoFar: number;
  tablesTotal: number;
}

interface GameScreenProps {
  table: TableDef;
  tournament?: TournamentInfo | undefined;
  result: GameResult | null;
  onExit: () => void;
  onRestart: () => void;
  onGameOver: (finalScore: number, stats: GameStatsSummary) => void;
  onTournamentNext: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const INITIAL_HUD: HudSnapshot = {
  tableId: "circuito-neon",
  tableName: "",
  score: 0,
  balls: 3,
  ballNumber: 1,
  multiplier: 1,
  multiball: 1,
  objective: "",
  objectiveProgress: "",
  objectiveDone: false,
  paused: false,
  tilt: false,
  kickbackArmed: true,
  muted: false,
  fps: 60,
  skillShotId: null,
  ballSaveSeconds: 0,
  combo: 0,
  miniMissions: [],
};

export function GameScreen({
  table,
  tournament,
  result,
  onExit,
  onRestart,
  onGameOver,
  onTournamentNext,
  muted,
  onToggleMute,
}: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PinballGame | null>(null);
  const pausedRef = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [hud, setHud] = useState<HudSnapshot>({ ...INITIAL_HUD, tableId: table.id, tableName: table.name });
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  /** Unlock audio and start the table's ambient music (first gesture). */
  const wakeRef = useRef<() => void>(() => {});
  wakeRef.current = () => {
    ensureAudio();
    if (!mutedRef.current) startMusic(table.id);
  };

  // engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const game = new PinballGame(
      canvas,
      table,
      {
        onHud: (snapshot) => setHud(snapshot),
        onEvent: (evt: GameEvent) => {
          playEvent(evt);
          if (evt.type === "gameOver") {
            stopMusic();
            setGameOver(true);
            onGameOver(evt.finalScore, game.getStats());
          }
        },
      },
      { balls: tournament ? 2 : 3 },
    );
    game.setDrawFn((view: RenderView, fx: FxState, t: number) => drawFrame(ctx, table, view, fx, t));
    game.start();
    gameRef.current = game;
    if (import.meta.env.DEV) {
      // E2E/test hook: exposes the engine handle to the browser console.
      (window as unknown as { __nvGame?: PinballGame }).__nvGame = game;
    }

    const releaseAndPause = () => {
      game.releaseInputs();
      touchLeft.current.clear();
      touchRight.current.clear();
      activePointers.current.clear();
      game.pause();
      stopMusic();
      pausedRef.current = true;
      setPaused(true);
    };
    const onHidden = () => {
      if (document.hidden) releaseAndPause();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", releaseAndPause);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", releaseAndPause);
      observer.disconnect();
      delete (window as unknown as { __nvGame?: unknown }).__nvGame;
      stopMusic();
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  // mute toggle controls the ambient music too
  useEffect(() => {
    if (muted) stopMusic();
    else if (!pausedRef.current && !gameOver) startMusic(table.id);
  }, [muted, table.id, gameOver]);

  // keyboard
  useEffect(() => {
    const game = () => gameRef.current;
    const down = (e: KeyboardEvent) => {
      wakeRef.current();
      switch (e.code) {
        case "ArrowLeft":
        case "KeyZ":
        case "KeyA":
          game()?.input("leftDown");
          e.preventDefault();
          break;
        case "ArrowRight":
        case "KeyX":
        case "KeyL":
          game()?.input("rightDown");
          e.preventDefault();
          break;
        case "ArrowDown":
        case "Space":
        case "Enter":
          game()?.input("plungerDown");
          e.preventDefault();
          break;
        case "ShiftLeft":
        case "ShiftRight":
          if (!e.repeat) game()?.input("nudge");
          break;
        case "Escape":
        case "KeyP": {
          if (e.repeat) break;
          const g = game();
          if (!g) break;
          pausedRef.current = !pausedRef.current;
          if (pausedRef.current) {
            g.pause();
            stopMusic();
          } else if (!mutedRef.current) {
            g.resume();
            startMusic(table.id);
          } else {
            g.resume();
          }
          setPaused(pausedRef.current);
          e.preventDefault();
          break;
        }
        default:
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowLeft":
        case "KeyZ":
        case "KeyA":
          game()?.input("leftUp");
          break;
        case "ArrowRight":
        case "KeyX":
        case "KeyL":
          game()?.input("rightUp");
          break;
        case "ArrowDown":
        case "Space":
        case "Enter":
          game()?.input("plungerUp");
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  // touch flippers: multitouch via pointer events on the two halves
  const touchLeft = useRef(new Set<number>());
  const touchRight = useRef(new Set<number>());
  const activePointers = useRef(new Map<number, "left" | "right" | "plunger">());

  const pointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    wakeRef.current();
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    if (rel < 0.44) {
      touchLeft.current.add(e.pointerId);
      activePointers.current.set(e.pointerId, "left");
      gameRef.current?.input("leftDown");
    } else if (rel > 0.56) {
      touchRight.current.add(e.pointerId);
      activePointers.current.set(e.pointerId, "right");
      gameRef.current?.input("rightDown");
    } else {
      activePointers.current.set(e.pointerId, "plunger");
      gameRef.current?.input("plungerDown");
    }
  }, []);

  const pointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const kind = activePointers.current.get(e.pointerId);
    activePointers.current.delete(e.pointerId);
    if (kind === "left") {
      touchLeft.current.delete(e.pointerId);
      if (touchLeft.current.size === 0) gameRef.current?.input("leftUp");
    } else if (kind === "right") {
      touchRight.current.delete(e.pointerId);
      if (touchRight.current.size === 0) gameRef.current?.input("rightUp");
    } else if (kind === "plunger") {
      gameRef.current?.input("plungerUp");
    }
  }, []);

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    gameRef.current?.resume();
    if (!mutedRef.current) startMusic(table.id);
  };

  const restart = () => {
    onRestart();
  };

  const format = (n: number) => n.toLocaleString("pt-BR");
  const formatTime = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const overlayTitle = tournament
    ? result?.tournamentFinal
      ? "TORNEIO COMPLETO"
      : `MESA ${tournament.tableIndex + 1} CONCLUÍDA`
    : "FIM DE JOGO";

  return (
    <div className="relative flex h-dvh flex-col bg-background">
      {/* HUD */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <div className="min-w-0">
          <p className="font-display truncate text-3xl leading-none text-foreground tabular-nums sm:text-4xl">
            {format(hud.score)}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {table.name} · bola {hud.ballNumber}/{tournament ? 2 : 3}
          </p>
        </div>
        <div className="flex flex-col items-center px-2">
          <p className="font-display text-2xl leading-none text-accent nv-glow-text">
            ×{hud.multiplier}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">mult.</p>
        </div>
        <div className="min-w-0 flex-1 text-center sm:flex-none sm:px-4">
          <p
            className={cn(
              "truncate font-display text-lg tracking-wide sm:text-xl",
              hud.objectiveDone ? "text-primary nv-glow-text" : "text-muted-foreground",
            )}
          >
            {hud.objective}
          </p>
          <p className="text-[10px] text-muted-foreground">{hud.objectiveProgress}</p>
        </div>
        <div className="flex items-center gap-2">
          {hud.multiball > 1 && (
            <span className="font-display animate-pulse rounded-md bg-primary/20 px-2 py-1 text-sm text-primary">
              {hud.multiball} BOLAS
            </span>
          )}
          {hud.combo >= 2 && (
            <span className="font-display rounded-md bg-accent/20 px-2 py-1 text-sm text-accent">
              COMBO ×{hud.combo}
            </span>
          )}
          {hud.ballSaveSeconds > 0 && (
            <span className="font-display rounded-md bg-primary/20 px-2 py-1 text-sm text-primary">
              SALVA-BOLA {Math.ceil(hud.ballSaveSeconds)}s
            </span>
          )}
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              hud.kickbackArmed ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground/50",
            )}
          >
            KICKBACK
          </span>
          <button
            type="button"
            aria-label={muted ? "Ativar som" : "Silenciar"}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            onClick={onToggleMute}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Pausar"
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              gameRef.current?.pause();
              stopMusic();
              setPaused(true);
            }}
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>

      {/* mini missions strip */}
      {hud.miniMissions.length > 0 && (
        <div className="flex items-center justify-center gap-4 px-3 pb-1 sm:gap-6">
          {hud.miniMissions.map((m) => (
            <span
              key={m.id}
              className={cn(
                "text-[10px] uppercase tracking-widest",
                m.done ? "text-primary nv-glow-text" : "text-muted-foreground",
              )}
            >
              {m.title} {m.progress}
            </span>
          ))}
        </div>
      )}

      {/* playfield */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-1 pb-1 sm:px-3 sm:pb-3">
        <div className="relative h-full w-full max-w-[min(100cqh*0.5625,100%)]">
          <canvas ref={canvasRef} className="h-full w-full" />
          {/* touch zones (only useful with touch, harmless with mouse) */}
          <div
            className="absolute inset-0 grid grid-cols-[44fr_12fr_44fr] touch-none select-none"
            onPointerDown={pointerDown}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onPointerLeave={pointerUp}
          >
            <div className="col-start-1 h-full" aria-label="Flipper esquerdo (toque)" />
            <div className="col-start-2 h-full" aria-label="Lançador (toque)" />
            <div className="col-start-3 h-full" aria-label="Flipper direito (toque)" />
          </div>
        </div>
      </div>

      {/* pause overlay */}
      {paused && !gameOver && (
        <Overlay title="PAUSA">
          <div className="flex flex-col gap-3">
            <MenuButton onClick={resume}>CONTINUAR</MenuButton>
            <MenuButton variant="ghost" onClick={onExit}>
              SAIR PARA O MENU
            </MenuButton>
          </div>
        </Overlay>
      )}

      {/* result overlay: game over or tournament table complete */}
      {gameOver && result && (
        <Overlay title={overlayTitle}>
          <p className="font-display text-5xl text-primary nv-glow-text">{format(result.score)}</p>
          <p className="text-sm text-muted-foreground">
            {result.tournamentFinal ? "mesa final" : tournament ? "pontos nesta mesa" : "pontos finais"}
          </p>
          {result.isRecord && (
            <p className="font-display text-lg tracking-widest text-accent nv-glow-text">★ NOVO RECORDE ★</p>
          )}
          {result.tournamentTotal !== undefined && (
            <p className="font-display text-2xl tracking-widest text-accent">
              TOTAL: {format(result.tournamentTotal)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
            <span>tempo: {formatTime(result.stats.durationMs)}</span>
            <span>lançamentos: {result.stats.ballsLaunched}</span>
            <span>skill shots: {result.stats.skillShots}</span>
            <span>ball saves: {result.stats.ballSaves}</span>
            <span>maior combo: ×{result.stats.bestCombo}</span>
            <span>missão: {result.stats.missionCompleted ? "concluída" : "—"}</span>
          </div>
          <div className="flex flex-col gap-3">
            {tournament && !result.tournamentFinal && (
              <MenuButton onClick={onTournamentNext}>PRÓXIMA MESA</MenuButton>
            )}
            {tournament && result.tournamentFinal && (
              <MenuButton onClick={onTournamentNext}>VOLTAR AO MENU</MenuButton>
            )}
            {!tournament && (
              <MenuButton
                onClick={() => {
                  setGameOver(false);
                  restart();
                }}
              >
                JOGAR NOVAMENTE
              </MenuButton>
            )}
            <MenuButton variant="ghost" onClick={onExit}>
              MENU
            </MenuButton>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex max-h-[90dvh] flex-col items-center gap-4 overflow-y-auto rounded-2xl border border-border bg-card/90 p-8 text-center shadow-2xl">
        <h2 className="font-display text-4xl tracking-widest text-foreground">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-display rounded-xl px-8 py-3 text-xl tracking-widest transition-transform hover:scale-[1.03] active:scale-[0.97]",
        variant === "solid"
          ? "bg-primary text-primary-foreground shadow-[0_0_30px_-10px_var(--color-primary)]"
          : "border border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
