// NEONVOLT — animated table preview using the real renderer (browser-only).
import { useEffect, useRef } from "react";

import { drawFrame } from "@/game/renderer";
import { TABLES } from "@/game/tables";
import type { RenderView } from "@/game/engine";
import type { TableDef } from "@/game/types";

function staticView(table: TableDef): RenderView {
  return {
    balls: [],
    flipperAngles: [
      (table.flippers[0].restAngle * Math.PI) / 180,
      (table.flippers[1].restAngle * Math.PI) / 180,
    ],
    spinnerAngles: Object.fromEntries(
      table.elements.filter((e) => e.kind === "spinner").map((e) => [e.id, 0]),
    ),
    targetsDown: new Set<string>(),
    kickbackArmed: true,
    plungerCharge: 0,
    ballReady: false,
    tilt: false,
    tableJustName: table.name,
    litElementId: null,
    ballSaveActive: false,
    combo: 0,
  };
}

export function TablePreview({ tableId }: { tableId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const table = TABLES.find((t) => t.id === tableId) ?? TABLES[0];
    const view = staticView(table);
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

    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      drawFrame(ctx, table, view, { particles: [], shake: 0, flash: 0 }, t);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [tableId]);

  return (
    <canvas
      ref={ref}
      className="h-full w-full"
      aria-hidden="true"
    />
  );
}
