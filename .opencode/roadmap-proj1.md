# Roadmap — NEONVOLT Pinball (proj1)

Execução fase a fase; só marcar `[x]` com o gate verificado pelo agente principal.

## F1 — Fundação/Contratos
- [x] Instalar `matter-js` + `@types/matter-js`
- [x] Criar `src/game/types.ts` (tipos compartilhados) e `src/game/contract.md`
- [x] Tokens de tema neon no `src/styles.css` + fonte Bebas Neue no `__root.tsx`
- [x] head() completa na rota `/` (title/desc/og/twitter)
- GATES: build OK; tipos compilam.

## F2 — Engine de física
- [x] `src/game/engine.ts`: mundo Matter, bola, flippers, plunger, paredes
- [x] Colisões → eventos (bumper/sling/target/spinner), pontuação, multiplier
- [x] Anti-stuck, tilt (3 nudges), multiball, bônus de fim de bola, snapshot
- GATES: build OK; colisões e flippers verificados no browser.

## F3 — Renderer neon
- [x] `src/game/renderer.ts`: glow, partículas (pool), shake, fundo procedural
- [x] Desenho de todos os TableElement + bola com trilha
- GATES: build OK; screenshot da mesa no browser.

## F4 — As 4 mesas (cenários)
- [x] `circuito-neon.ts` · `forja-solar.ts` · `abissal.ts` · `criogenese.ts`
- [x] Missão assinatura + mini-missões por mesa; `validateTable` nos 4
- GATES: validateTable verde ×4; playtest de cada mesa no browser.

## F5 — Shell/UI
- [x] Menu com carrossel de mesas + recordes por mesa (localStorage)
- [x] HUD (score, multiplier, objetivo), pausa, game over, controles touch
- GATES: build OK; fluxo menu→jogo→game over→menu no browser.

## F6 — Áudio + polish
- [x] `src/game/audio.ts`: sons WebAudio sintetizados, mute persistido
- [x] Balanceamento de pontuação + polish visual final
- GATES: console sem erros; som audível (state verificado via code review).

## F7 — Verificação final
- [x] Playthrough E2E real no browser (3 bolas, multiball, troca de mesa)
- [x] Recorde persiste em reload; testes do projeto passando
- [x] Build de produção sem erros
- GATES: todos os critérios de aceite do PRD §10 verdes.

## Registro de execução (remix 1)
- F1–F5 verificadas no browser (menu, lançamento, flippers, pontuação, pausa,
  game over, troca de mesa, recordes) — gates verdes, console sem erros.
- Calibração física: gravidade efetiva ~0.87 px/tick² → lançamento 46·power,
  multiball −42, kickback −30, forças dos elementos ×3. Testes: 6/6 verdes.
- Próximo remix: concluir F6 (balanceamento fino + verificação de som audível)
  e F7 (build de produção + mobile touch real).
- Rodada de fixes pós-revisão (subagente s2): contrato GameHandle, erros de TS
  (noUncheckedIndexedAccess), impulso de superfície do flipper, kicker com bola
  estática, gating de input em pausa/game over, tilt devolve flippers ao repouso,
  e.repeat filtrado, release de inputs no blur, rede de segurança fora do mundo,
  rearm da missão do spinner, listener Matter removido por identidade, áudio
  tolerante a storage bloqueado, mute centralizado no PinballApp.
- Playtest final: pontuação circulando (2.650 na bola 2), sem erros de console,
  6/6 testes verdes, build OK.
- Pendente: observação E2E do multiball disparado pela missão (requer 8 hits no
  bumper central) e verificação real de multitouch em dispositivo móvel.

## Registro de execução (remix 2 — conclusão)
- F6 balanceamento (PRD §5.3): drop targets padronizados em 500 pts; missões
  assinatura agora pagam 12.000/12.000/15.000/12.000 (≥ 10.000); bumpers
  mantidos em 150–350 (dentro da faixa 100–500); spinner por burst com
  rate-limit mantido (burst ≈ várias rotações, ≥ 50/rot). Teste novo:
  "NEONVOLT balanceamento (PRD §5.3)" — 2 asserts, suíte 8/8 verde.
- Hook DEV-only para E2E: `debugCompleteMission()` na engine + `window.__nvGame`
  exposto no GameScreen apenas com import.meta.env.DEV (não vai para prod).
- F7 playthrough E2E real (Playwright, dev preview): menu com 4 mesas →
  Circuito Neon → lançamento → pontuação 0→500 → multiball via missão
  ("2 BOLAS", +12.000) → fim de jogo (36.350) → recorde salvo → troca p/
  Forja Solar → reload manteve recorde. 0 erros de console. Build OK.
- Observação de E2E: a bola extra do multiball nasce no lançador e exige
  lançamento (comportamento correto de pinball); sem input o jogo não termina.
- Pendente (fora do ambiente): audibilidade real do áudio em hardware de som e
  multitouch físico em dispositivo móvel — não verificáveis em headless.
