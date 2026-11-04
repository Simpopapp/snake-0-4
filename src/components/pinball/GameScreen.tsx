// NEONVOLT — game screen: canvas, engine wiring, HUD, overlays, controls.
import { Pause, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureAudio, playEvent } from "@/game/audio";
import { PinballGame, type RenderView } from "@/game/engine";
import { drawFrame } from "@/game/renderer";
import type { FxState } from "@/game/fx";
import type { GameEvent, HudSnapshot, TableDef } from "@/game/types";
import { cn } from "@/lib/utils";

interface GameScreenProps {
  table: TableDef;
  onExit: () => void;
  onRestart: () => void;
  onGameOver: (finalScore: number) => void;
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
};

export function GameScreen({ table, onExit, onRestart, onGameOver, muted, onToggleMute }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PinballGame | null>(null);
  const pausedRef = useRef(false);
  const [hud, setHud] = useState<HudSnapshot>({ ...INITIAL_HUD, tableId: table.id, tableName: table.name });
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);

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

    const game = new PinballGame(canvas, table, {
      onHud: (snapshot) => setHud(snapshot),
      onEvent: (evt: GameEvent) => {
        playEvent(evt);
        if (evt.type === "gameOver") {
          setGameOver(true);
          onGameOver(evt.finalScore);
        }
      },
    });
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
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id]);

  // keyboard
  useEffect(() => {
    const game = () => gameRef.current;
    const down = (e: KeyboardEvent) => {
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
          ensureAudio();
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
          if (pausedRef.current) g.pause();
          else g.resume();
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
  }, []);

  // touch flippers: multitouch via pointer events on the two halves
  const touchLeft = useRef(new Set<number>());
  const touchRight = useRef(new Set<number>());
  const activePointers = useRef(new Map<number, "left" | "right" | "plunger">());

  const pointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    ensureAudio();
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
  };

  const restart = () => {
    onRestart();
  };

  const format = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div className="relative flex h-dvh flex-col bg-background">
      {/* HUD */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <div className="min-w-0">
          <p className="font-display truncate text-3xl leading-none text-foreground tabular-nums sm:text-4xl">
            {format(hud.score)}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {table.name} · bola {hud.ballNumber}/3
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
              setPaused(true);
            }}
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>

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

      {/* game over overlay */}
      {gameOver && (
        <Overlay title="FIM DE JOGO">
          <p className="font-display text-5xl text-primary nv-glow-text">{format(hud.score)}</p>
          <p className="mb-2 text-sm text-muted-foreground">pontos finais</p>
          <div className="flex flex-col gap-3">
            <MenuButton
              onClick={() => {
                setGameOver(false);
                restart();
              }}
            >
              JOGAR NOVAMENTE
            </MenuButton>
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
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/90 p-8 text-center shadow-2xl">
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
