# Roadmap — NEONVOLT 2.0 (proj2)

Execução fase a fase; só marcar `[x]` com o gate verificado pelo agente principal.

## E1 — Fundação e contratos (agente principal)
- [x] Extender `src/game/types.ts` (TableId+supernova, MiniMission, eventos/HUD/RenderView novos)
- [x] Criar `src/game/progress.ts` (stats/conquistas/settings, API tolerante) + conquistas (§6.5)
- [x] Contrato de áudio: setVolume/getVolume/startMusic/stopMusic + sons dos eventos novos
- [x] `validate.ts` cobre miniMissions e 5 mesas
- GATES: tsgo limpo ✔; suíte verde 20/20 ✔ (regressão neonvolt.v1 intocada).

## E2 — Engine: profundidade de jogo
- [x] Skill shot (iluminação, janela 3s, bônus, evento) — PRD §6.1
- [x] Ball save (janela 8s, re-serve, 1/launch) — PRD §6.2
- [x] Combo com marcos 5/10/20/35 e bônus — PRD §6.3
- [x] Mini-missões na engine (progresso, re-arm, lâmpada) — PRD §6.4
- [x] `getStats()` e todos os eventos novos emitidos
- GATES: browser ✔ — skill shot acende e paga (+2.500, skillShots 1); ball save
  re-serve sem cobrar bola (saves 1, ballsRemaining 3); combo ×7 com melhor
  marca; mini-missão "Relé em Cadeia" concluiu (3/3, +6.000). Hooks DEV
  `debugPlaceBall/debugDrainBall` adicionados (DEV-only).

## E3 — Mesa 5: Supernova
- [x] `tables/index.ts`: órbitas com gate, elementos, 2 miniMissions, missão assinatura (spec do subagente s2)
- [x] Registro em `TABLES` (5 mesas) + paleta própria + fundo procedural no renderer
- GATES: validateTable [] ×5 ✔; teste de mesas verde ✔; browser ✔ — órbitas
  pagam (2×2.500), missão/hint no HUD, visual screenshot conferido.

## E4 — Metajogo: progress, conquistas, estatísticas
- [x] API de progress completa + unlock das 14 conquistas + stats por partida
- GATES: 10 testes de progress verdes (unlock, faixas, storage corrompido,
  torneio, não re-unlock) ✔.

## E5 — Áudio: música ambiente e volume
- [x] Sequenciador de música por mesa (5 timbres) + start/stop nos momentos certos
- [x] setVolume/getVolume persistido; sons dos eventos novos
- GATES: tsgo/build OK; start/stop/pause/mute ligados nos momentos corretos
  (revisão de código); slider persiste (localStorage verificado no browser).
  Pendente fora do ambiente: audibilidade real em hardware de som.

## E6 — Shell/UI: menu 2.0, HUD, torneio, ajustes
- [x] Menu com abas (Mesas/Estats/Conquistas/Ajustes) + navegação por teclado + 5 mesas
- [x] HUD: combo, ball save, mini-missões; game over com breakdown + toasts de conquista
- [x] Torneio "Voltagem Total" (5 mesas × 2 bolas, cumulativo, recorde de torneio)
- [x] Ajustes: volume, reduzir efeitos, controles; persistência
- GATES: browser ✔ — menu→jogo→game over com breakdown; torneio mesa 1→mesa 2
  (bola 1/2, minis da Forja); stats mostrando 2 partidas/1 skill shot/×13;
  3 conquistas desbloqueadas com toasts; 0 erros de console.

## E7 — Verificação final
- [x] Playthrough E2E: Supernova, skill shot, ball save, combo, torneio, ajustes, stats
- [x] Regressão: recordes neonvolt.v1 preservados (testes originais intocados); build/ty
- GATES: tsgo limpo ✔; 20/20 testes ✔; 0 erros de console no browser ✔.
  Pendente fora do ambiente: audibilidade real do áudio e multitouch físico.

## Registro de execução (remix 2 — NEONVOLT 2.0 concluído)
- Enxame adaptado: `spawn_agent` neste ambiente é read-only → subagente
  s2-supernova produziu a especificação da mesa (pilares em
  `.opencode/work/sub/s2-supernova/`); produção de código pelo agente principal.
- Decisões registradas no PRD §10 (gates como sensores de órbita, mini-missões
  nos goal kinds existentes, Supernova em tables/index.ts, hooks DEV).
- Números verificados no browser: skill shot +2.500; mini-missão +6.000;
  missão assinatura +12.000 com multiball (2 bolas); órbitas 2×2.500;
  ball save re-serva; torneio mesa 1→2; stats/conquistas persistidas.
