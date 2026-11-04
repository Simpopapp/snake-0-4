# Contrato NEONVOLT (fundação)

Fonte de verdade: `src/game/types.ts`. Regras de fronteira:

- `src/game/*` — NUNCA importa React. Só lógica, física, render (canvas).
- `src/components/pinball/*` — NUNCA importa `matter-js`. Consome apenas
  `HudSnapshot`, `GameEvent`, `GameHandle`, `TableDef` (sem lógica física).
- `matter-js` só pode ser importado dentro de `src/game/engine.ts` e dos
  helpers de física (nada em módulo carregado por SSR sem `React.lazy`).
- A rota `/` carrega o jogo com `React.lazy` atrás de `<ClientOnly>`.

## APIs pactuadas

```ts
// src/game/engine.ts
createGame(canvas: HTMLCanvasElement, table: TableDef, cbs: GameCallbacks): GameHandle

// src/game/renderer.ts
drawFrame(ctx, table, view, fx): void   // view: corpos/estados do engine p/ render
```

## Convenções

- Coordenada virtual: 540×960 (`TABLE_WIDTH/HEIGHT`); o renderer escala por DPR.
- Paredes espessura física ≥ 14px (anti-tunneling); timestep fixo 60Hz.
- Cores: sempre via `TablePalette` — nenhum hex novo no engine/renderer.
- Sons: `src/game/audio.ts` (WebAudio sintetizado), ligado por eventos
  `GameEvent` — nunca por elementos DOM.
- Validar tabelas com `validateTable()` (`src/game/validate.ts`).
