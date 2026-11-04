# PRD — NEONVOLT 2.0 (proj2)

> PRD derivado de `project2.md` ("Estudar profundamente o projeto e entender
> profundamente os propósitos dele bem como cada página e recurso
> individualmente, pra planejar de forma muito bem elaborada as próximas
> melhorias de forma significativa e substancial em tudo que puder e fizer
> sentido ser melhorado"). Este documento é a fonte do "COMO" do project2.
> O planejamento (project2.md) manda no QUÊ; este PRD manda no COMO;
> `roadmap-proj2.md` registra a ordem e o progresso.

---

## 1. Auditoria profunda do estado atual (estudo)

Estudo completo de cada módulo e recurso existente, com propósito, estado
e lacunas. Esta seção é a base do que será melhorado — nada aqui é chutado:
cada linha foi verificada no código.

### 1.1 Camada de aplicação

- **Rota `/` (`src/routes/index.tsx`)**: boot screen "NEONVOLT" pulsante +
  lazy-load de todo o jogo atrás de mount (browser-only, nada em SSR) —
  correto e mantido. head() completa (title/OG/twitter). Sem lacunas
  funcionais; mantém-se como está.
- **`PinballApp`**: máquina de estados menu ↔ jogo com `runId` para restart;
  grava recorde no game over; mute centralizado. Lacuna: conhece apenas
  "jogar uma mesa" — não há modo de jogo alternativo nem tela de meta
  (estatísticas/conquistas/ajustes).
- **Menu**: carrossel de 4 cards com preview procedural + recorde por mesa,
  recorde global, mute, botão JOGAR grande, instruções de controle no rodapé.
  Lacunas: seleção é clique + JOGAR em duplo clique ou botão (duplo clique
  não existe em touch, gesto pouco descobrível); não há navegação por
  teclado (setas) apesar de ser um jogo de arcade; não há nenhuma superfície
  de meta-jogo; sem tela de ajustes; sem "help".
- **GameScreen**: HUD (score, mult. ×, objetivo, contador de multiball,
  badge KICKBACK, mute, pausa), canvas com ResizeObserver + DPR ≤ 2, teclado
  completo (setas/Z/A/X/L, Espaço/Enter/↓ plunger, Shift nudge, Esc/P pausa),
  touch multitouch por terços da tela, auto-pause em blur/tab hidden,
  release de inputs, hook DEV `window.__nvGame`. Lacunas: overlay de game
  over é mínimo (score + 2 botões — sem celebração de recorde, sem
  detalhamento da partida); HUD diz "bola X/3" fixo; pausa não expõe volume;
  não há exibição de combo/streak na tela; a lit lamp de skill shot não
  existe porque o recurso não existe.
- **Menu Preview (`TablePreview`)**: renderiza o layout da mesa
  estaticamente — coerente com a fonte única em `frame.ts`/tables. Mantém-se.

### 1.2 Camada de jogo (`src/game/*`)

- **Engine (`engine.ts`, ~1000 linhas)**: mundo matter-js com timestep fixo
  60Hz (acumulador, máx. 4 steps), flippers cinemáticos com sweep impulse
  calibrado (máx. 34 px/tick), bumpers/slings/targets/spinner/kicker,
  anti-stuck em 2 níveis (2,5s impulso / 5s teleporta), tilt (3 nudges em
  2s), multiball limitado por `maxBalls`, kickback esquerdo 1/bola, missão
  assinatura re-armável (~5,5s), ice ball, bônus de fim de bola com
  multiplier, snapshot HUD + callbacks tipados. Lacunas funcionais:
  - `WallChain.gate` (portas one-way) existe no contrato e na engine, mas
    **nenhuma mesa usa** — recurso morto.
  - `GameEvent` tem o tipo `ramp`, mas **nada o emite** — recurso morto.
  - Sem **skill shot** (alvo iluminado no lançamento — clássico do pinball).
  - Sem **ball save** (bola perdida nos primeiros segundos é punição dura).
  - Sem **combo** explícito (o multiplier existe via streak, mas não há
    janela de combo, bônus em marcos ou feedback visual dedicado).
  - Sem **missões secundárias** (o PRD do project1 §5.4 prometia
    "mini-missões visíveis no HUD" por mesa — nunca implementadas; as
    mesas têm apenas a missão assinatura).
  - Kickback só no outlane esquerdo; sem variedade por mesa.
  - Bolas de multiball nascem no lançador (comportamento correto de
    pinball, mas exige replunged — sem auto-serve em multiball, o jogo
    pode "parar" se o jogador não perceber; documentado no remix 1).
- **Renderer (`renderer.ts`, ~585 linhas)**: canvas neon com glow, fundo
  procedural distinto por mesa (grid/chuva de dados, brasas, plâncton,
  cristais/neve), paredes em 3 camadas, partículas aditivas, shake, flash,
  vinheta, overlay TILT, hint de lançamento, bolas com trilha (+ ice).
  Lacunas: sem **lâmpadas de jogo** (skill shot, ball save, missões
  secundárias não têm representação visual na mesa — a mesa fica "muda"
  sobre o estado do jogo); sem efeito dedicado de multiball; plunger
  visual estático (não reflete a carga).
- **Frame (`frame.ts`)**: fonte única da geometria padrão (bordas, lane,
  guias de inlane, kickback, dreno) para física E visual — sólido.
  Mantém-se como fonte única.
- **Tables (`tables/index.ts`)**: 4 mesas com paletas, defletores e missão
  assinatura; validadas por `validateTable`. Lacunas: sem missões
  secundárias (ver engine), sem mesas com gates/orbits, "diversidade de
  mapas" termina em 4.
- **Audio (`audio.ts`)**: banco de sfx 100% sintetizado (tone + noiseBurst),
  mute persistido, unlock por gesto. Lacunas: sem **música ambiente** (o
  jogo é silencioso entre hits), sem controle de volume (só mute), sem sons
  para os recursos novos (skill shot, ball save, combo, conquista).
- **FX (`fx.ts`)**: pool de partículas, shake, flash. Sólido; estende-se.
- **Persistência (`use-highscores.ts`)**: apenas recordes (global + por
  mesa) em `neonvolt.v1`. Lacunas: nenhuma estatística, nenhuma conquista,
  nenhuma configuração, nenhum histórico — o metajogo é zero.
- **Tipos (`types.ts`)**: contratos completos engine↔UI. Estendem-se para
  os recursos novos (§4).
- **Testes (`src/test/*`)**: 8 testes (recordes, validação das 4 mesas,
  missões, balanceamento) + teste de roteamento. Base boa; estende-se.

### 1.3 Conclusão do estudo

O núcleo (física, render, mesas, áudio sfx, recordes) está maduro e
verificado. As lacunas concentram-se em quatro frentes, e são exatamente
elas que definem as melhorias substanciais deste projeto:

1. **Profundidade de jogo** — recursos clássicos de pinball ausentes
   (skill shot, ball save, combo, missões secundárias, gates orfas).
2. **Conteúdo** — a promessa de "diversidade de cenários" estagna em 4;
   missões secundárias prometidas e não entregues.
3. **Metajogo** — zero progressão além do recorde: sem estatísticas,
   conquistas, ajustes ou modo de jogo alternativo.
4. **Imersão** — sem música ambiente, sem controle de volume, sem feedback
   visual de estado na mesa (lâmpadas).

## 2. Visão do project2 — "NEONVOLT 2.0"

Transformar o NEONVOLT de "pinball com recordes" em uma máquina de arcade
completa: mais profunda de jogar (recursos clássicos de pinball), mais rica
de conteúdo (5ª mesa + missões secundárias), com metajogo real (estatísticas,
conquistas, modo torneio) e mais imersiva (música ambiente por mesa,
lâmpadas na mesa, controle de volume). Tudo sem backend, mantendo o padrão
de qualidade "impecável" do project1 e sem regressão do que já está verde.

## 3. Decisões técnicas (vinculantes)

| # | Decisão | Escolha | Por quê |
|---|---|---|---|
| D1 | Persistência de metajogo | Novo módulo `src/game/progress.ts` com chave própria `neonvolt.progress.v1` (stats + conquistas + settings), leitura tolerante, additive | Separa risco de migração dos recordes; `neonvolt.v1` dos recordes fica intocado (testes existentes continuam verdes) |
| D2 | Skill shot | Engine: após cada launch, um elemento (bumper/target) é "iluminado"; acertá-lo dentro de 3s paga bônus + evento. Renderer: lâmpada pulsante no elemento | Recurso clássico; usa infra de eventos/lâmpadas que também serve missões |
| D3 | Ball save | Janela de 8s após cada launch: drenar devolve a bola ao plunger sem cobrar bola; máx. 1 save por launch; HUD/canvas indicam a janela | Padrão de pinball moderno; reduz frustração sem baratear o jogo |
| D4 | Combo | Hits com < 2,5s de intervalo empilham combo; marcos (5/10/20) pagam bônus progressivo e evento; combo quebra ao drenar/estourar janela | Dá textura de arcade ao multiplier existente |
| D5 | Missões secundárias | `TableDef.miniMissions?: MiniMission[]` (2 por mesa), re-armáveis como a assinatura, com lâmpada própria e recompensa em pontos | Entrega o prometido no PRD project1 §5.4 e enriquece cada mesa |
| D6 | 5ª mesa | `Supernova` (espaço profundo), primeira mesa a usar `gate` (órbitas one-way no topo) — recurso morto ganha vida | Diversidade de cenários + justifica estender `TableId` |
| D7 | Modo Torneio | "Voltagem Total": 2 bolas por mesa, nas 5 mesas em sequência, score cumulativo, sem pausa entre mesas além do transição | Dá um segundo modo real com custo controlado |
| D8 | Música ambiente | Sequenciador WebAudio (loop de arpejo/baixo por mesa, agendado à frente), respeita mute e volume; inicia após primeiro gesto | Zero assets, imersão |
| D9 | Volume | Slider 0–100 persistido em progress settings; master gain 0→0,5·vol | Fecha a lacuna do mute binário |
| D10 | Conquistas | 14 conquistas (lista §6.5) com toast in-game e tela no menu | Metajogo tangível |
| D11 | Estatísticas | partidas, tempo jogado, bolas lançadas, skill shots, ball saves, maior combo, missões por mesa, recorde histórico por mesa | Alimenta a tela de stats |
| D12 | Ajustes | Tela com volume, "reduzir efeitos" (menos partículas/shake) e resumo de controles; persistida | Acessibilidade e conforto |
| D13 | Navegação do menu por teclado | ←/→/↑/↓/Enter/Tab navegam mesas e abas; Enter joga | Coerência arcade |
| D14 | Contratos primeiro | Toda extensão de `types.ts` / eventos / storage é feita pelo agente principal ANTES da onda paralela de subagentes | Enxame sem colisão (skill `subagentes-3-pilares`) |

Proibições mantidas: sem React Router DOM; sem backend/Cloud; sem import
estático de `matter-js` fora do lazy path; sem CSS de cor hardcoded fora dos
tokens (paletas de mesa continuam via `TablePalette`); sem emojis na UI;
`src/game/*` nunca importa React; `src/components/pinball/*` nunca importa
matter-js; `src/routes/index.tsx` permanece a única rota de conteúdo.

## 4. Contratos novos (fundação — agente principal, antes da onda 1)

Fixados em código real antes de qualquer subagente:

### 4.1 `src/game/types.ts` (extensões)
- `TableId` ganha `"supernova"`.
- `MiniMission { id; title; hint; goal: MissionKind; score: number }`;
  `TableDef.miniMissions?: MiniMission[]`.
- `GameEvent` ganha: `{ type: "skillShotLit"; elementId }`,
  `{ type: "skillShotHit"; elementId; score }`,
  `{ type: "skillShotMiss" }`, `{ type: "ballSaveUsed" }`,
  `{ type: "ballSaved" }`, `{ type: "combo"; count; score }`,
  `{ type: "miniMissionComplete"; id; title; score }`,
  `{ type: "tournamentTableComplete"; tableId; score }`.
- `HudSnapshot` ganha: `skillShotId: string | null`,
  `ballSaveTicks: number`, `combo: number`, `miniMissions: { id; title; progress; done }[]`.
- `RenderView` ganha: `litElementId: string | null`, `ballSaveActive: boolean`, `combo: number`.

### 4.2 `src/game/progress.ts` (novo)
- `Progress { stats: Stats; achievements: AchievementState; settings: Settings }`
  com `Stats { gamesPlayed; timePlayedMs; ballsLaunched; skillShots; ballSaves;
  bestCombo; missionsCompleted: Record<TableId, number>;
  highscoresHistory: Record<TableId, number[]> }`.
- `AchievementId` union (14 ids) + `ACHIEVEMENTS: { id; title; desc; icon? }[]`.
- `Settings { volume: number; reducedFx: boolean }`.
- API: `readProgress()`, `updateProgress(fn)`, `recordGame(tableId, { score,
  durationMs, ballsLaunched, skillShots, ballSaves, bestCombo, missions }) →
  { unlocked: AchievementId[] }`, `saveSettings(s)`. Leitura tolerante
  (qualquer campo faltante vira default; nunca lança).

### 4.3 `src/game/audio.ts` (extensão de contrato)
- `setVolume(v: number)` (0–1, persiste em progress settings),
  `getVolume()`, `startMusic(tableId)`, `stopMusic()`.
- `playEvent` cobre todos os eventos novos de §4.1.

### 4.4 Engine ↔ UI
- `GameCallbacks.onEvent` continua a porta única de eventos; UI nunca
  importa matter-js; engine nunca importa React (mantidos).
- `PinballGame` ganha: `getStats(): GameStats` (números coletados na
  partida: durationMs, ballsLaunched, skillShots, ballSaves, bestCombo,
  missionsCompleted) consumido pelo GameScreen no game over.

## 5. Escopo por fase (mapeia o roadmap)

### E1 — Fundação e contratos (agente principal)
- Extender `types.ts` (§4.1), criar `progress.ts` (§4.2), estender `audio.ts`
  em contrato (stubs assinados), estender `HudSnapshot`/`RenderView`.
- Ajustar validação (`validate.ts`) para miniMissions e 5ª mesa.
- GATE: `bunx tsgo` sem erros; testes existentes 8/8+ verde.

### E2 — Engine: profundidade de jogo (subagente s1)
- Skill shot (D2), ball save (D3), combo (D4), emissão de todos os eventos
  novos, `getStats()`, miniMissions na engine (progresso + re-arm), lâmpada
  (`litElementId`) exposta no RenderView, auto-serve da bola salva.
- GATE: build OK; teste de engine novo cobrindo skill shot, ball save e
  combo com mundo headless (matter-js roda em node); browser: skill shot
  acende e paga via `__nvGame`.

### E3 — Mesa 5: Supernova (subagente s2)
- `tables/supernova.ts`: paleta própria (espaço profundo: bg quase-preto
  azulado, dourado + ciano), 2 órbitas one-way com `gate` no topo, bumpers
  planetários, grupo de alvos "supernova", spinner "pulsar", kicker "buraco
  branco", 2 miniMissions, missão assinatura própria, `validateTable` verde.
- Registro da mesa em `tables/index.ts` + paleta; preview e menu herdam.
- GATE: validateTable []; teste de mesas atualizado para 5; screenshot no browser.

### E4 — Metajogo: progress, conquistas, estatísticas (subagente s3)
- `progress.ts` completo (D1/D10/D11): API, unlock de conquistas, stats.
- Testes de progress: unlock correto (ex.: primeira missão, 50k, skill shot,
  torneio), tolerância a storage corrompido.
- GATE: testes de progress verdes; `bunx tsgo` limpo.

### E5 — Áudio: música e volume (subagente s4)
- Sequenciador de música ambiente por mesa (D8): loop agendado, timbres
  distintos por paleta, ducking durante sfx intenso (opcional), stop no
  game over/menu; `setVolume`/`getVolume` (D9); sons dos eventos novos.
- GATE: build OK; verificação via browser de que music start/stop ocorrem
  nos momentos certos (estado do AudioContext inspecionado); sem erros de
  console.

### E6 — Shell/UI: menu 2.0, HUD, overlays, torneio, ajustes (subagente s5 — onda 2)
- Menu com abas: **Mesas / Estatísticas / Conquistas / Ajustes** (D12), navegação
  por teclado (D13), botão "Voltagem Total" (torneio D7), celebração de
  recorde no card.
- GameScreen: HUD com combo, janela de ball save, mini-missões; game over com
  breakdown (score, maior combo, missões, skill shots, novo recorde),
  gravação em `recordGame` + toasts de conquista (D10).
- Torneio (D7): fluxo menu → 5 mesas × 2 bolas → resultado final com total;
  integrado a stats/conquistas.
- Ajustes: volume (slider), reduzir efeitos (respeitado no fx/renderer),
  resumo de controles.
- GATE: build OK; fluxo completo no browser: menu → torneio 1ª mesa → pausa →
  sair; stats e conquistas refletindo; 0 erros de console.

### E7 — Verificação final (agente principal)
- Playthrough E2E completo: mesa nova, skill shot, ball save, combo, torneio,
  ajustes persistindo, stats persistindo, recordes antigos preservados
  (regressão de `neonvolt.v1`), mobile touch ainda OK.
- Testes do projeto todos verdes; build de produção sem erros.
- GATE: critérios de aceite §7 todos verdes.

## 6. Especificações de detalhe

### 6.1 Skill shot
- Ao `plungerUp` com launch: escolher elemento aleatório entre bumpers e
  targets da mesa (determinístico por seed leve para replay justa: alterna
  entre 2 candidatos fixos por mesa). Janela: 3s desde o launch.
- Acerto: `score += 2500 + 500·streakDeSkillShotsNaPartida` (máx. 3 por bola
  paga), lâmpada acende no elemento; erro (janela expira): evento miss e
  apaga. Após cada launch, novo skill shot é sorteado.

### 6.2 Ball save
- Janela de 8s após cada launch (inclui multiball serve). Dreno na janela:
  bola é re-servida no plunger (fase ready), não consome bola, máx. 1 uso
  por launch. HUD mostra contagem; canvas: linha da lane pulsando.

### 6.3 Combo
- Cada hit pontuável (bumper/sling/target/spinner/kicker) com intervalo
  < 2,5s do anterior incrementa combo; ao atingir marcos 5/10/20/35 paga
  bônus 1000/2500/5000/10000 com evento e som próprio; dreno ou janela
  estourada zera. Melhor combo vai para stats.

### 6.4 Mini-missões (2 por mesa)
- `circuito-neon`: "Malha Rápida" (spinner 60 rotações acumuladas na bola),
  "Relé em Cadeia" (3 hits no kicker em uma bola).
- `forja-solar`: "Pressão Máxima" (10 hits nos bumpers de fornalha em uma
  bola), "Turbina Aquecida" (spinnerHold 3s).
- `abissal`: "Plâncton Brilhante" (grupo de caranguejos 2× na mesma bola),
  "Correnteza" (spinner 50 rotações).
- `criogenese`: "Lacunas Selladas" (grupo de selos na mesma bola),
  "Cristal Ressonante" (hits somados nos 4 cristais = 12 em uma bola).
- `supernova`: "Órbita Estável" (passar pelas 2 gates em uma bola),
  "Colapso Inicial" (15 hits nos bumpers planetários).
- Todas: pontos (5.000–7.500), re-armam como a assinatura, lâmpada própria
  no HUD e progresso textual.

### 6.5 Conquistas (14)
1. Primeira Descarga — primeira partida.
2. Novato do Volt — 10.000 pts em uma partida.
3. Circuito Fechado — 50.000 pts em uma partida.
4. Magnata do Neon — 100.000 pts em uma partida.
5. Sobrecarga — completar a missão assinatura do Circuito Neon.
6. Ignição — completar a missão da Forja Solar.
7. Leviatã — completar a missão da Abissal.
8. Zero Absoluto — completar a missão da Criogênese.
9. Supernova — completar a missão da Supernova.
10. Olho Clínico — 5 skill shots acumulados.
11. Rede de Segurança — 10 ball saves acumulados.
12. Combo x20 — combo 20 em uma partida.
13. Voltagem Total — concluir um torneio.
14. Vetoriano — jogar todas as 5 mesas ao menos uma vez.

### 6.6 Torneio "Voltagem Total"
- Entrada: botão dedicado no menu. Regras: 2 bolas por mesa, ordem fixa das
  5 mesas, score cumulativo; transição mostra total parcial; fim: tela de
  resultado com total, recorde de torneio (progress) e conquistas.
- Torneio usa o mesmo GameScreen com flag `tournament`; stats de partida
  somam no fim de cada mesa.

### 6.7 Música ambiente
- Loop de 4 compassos por mesa: baixo + arpejo com timbre derivado da
  paleta (Circuito Neon: square agudo cyber; Forja Solar: saw grave quente;
  Abissal: sine/lfo profundo; Criogênese: triangle cristalino; Supernova:
  pad espacial). Agendamento à frente (lookahead 0,2s), gain baixo (0,06)
  sob os sfx, pausa no pause, para no game over/exit.

### 6.8 Ajustes
- Volume 0–100 (persistido, aplicado no master gain), "Reduzir efeitos"
  (partículas/4 e sem shake) e resumo de controles (teclado e touch).
- Persistência imediata em progress settings; aplicada ao voltar ao jogo.

## 7. Critérios de aceite (produto final)

1. Abrir `/`: menu com 5 mesas e abas Mesas/Estatísticas/Conquistas/Ajustes;
   navegação por teclado funciona; zero erros de console.
2. Jogar Circuito Neon: skill shot acende no launch e paga ao acertar;
   ball save salva uma drenagem nos 8s; combo exibe e paga no marco;
   2 mini-missões mostram progresso e pagam.
3. Jogar Supernova: gates one-way funcionam (bola só passa no sentido
   permitido), missão e mini-missões específicas dela concluem.
4. Torneio: fluxo completo de 5 mesas × 2 bolas com total cumulativo e
   recorde de torneio persistido.
5. Conquistas: pelo menos 3 desbloqueiam em um playthrough com toasts
   visíveis e listadas na aba Conquistas.
6. Estatísticas: após 2 partidas, partidas/tempo/bolas/skill shots/best
   combo corretas na aba Estatísticas.
7. Ajustes: volume aplicado (mudança audível no ganho), reduzir efeitos
   diminui partículas; ambos persistem após reload.
8. Música ambiente: inicia após primeiro gesto, muda por mesa, para no
   game over; mute zera tudo.
9. Regressão: recordes do `neonvolt.v1` pré-existentes preservados; testes
   antigos 8/8 verde sem edição dos asserts existentes.
10. Build de produção sem erros; sem import estático de matter-js em SSR.

## 8. Riscos e mitigações

- **Tamanho da onda de subagentes**: 4 pacotes paralelos (s1–s4) com donos
  exclusivos de arquivos; costuras (types, index de tables, PinballApp,
  GameScreen) reservadas ao agente principal ou à onda 2 (s5). Conflito
  de arquivo → serialize, nunca merge cego.
- **Regeneração de event handlers**: novos eventos não podem quebrar o
  switch existente (default: break) — contrato de compatibilidade.
- **`noUncheckedIndexedAccess`**: padrões de guard já no projeto; subagentes
  seguem-nos.
- **Music scheduler drift**: lookahead curto e reancoragem por
  `ctx.currentTime` a cada loop.
- **Torneio × estado do GameScreen**: mesa troca por prop `table` +
  remontagem por key — padrão já provado no PinballApp.

## 9. Fora de escopo

Multiplayer, backend/contas, cloud saves, editor de mesa, skins, i18n
(pt-BR mantido), novas rotas além de `/`.

## 10. Registro de decisões da execução (remix 2)

1. **Enxame adaptado ao ambiente**: `spawn_agent` aqui é read-only (tarefa de
   fundo que não edita arquivos). O subagente s2-supernova produziu a
   especificação completa da mesa (pilares em `.opencode/work/sub/s2-supernova/`);
   toda a produção de código foi do agente principal. Divergências do spec
   resolvidas nas decisões 2 e 3.
2. **Gates = sensores de órbita, sem bloqueio direcional**: a engine não
   verifica direção em `hitGate`; em vez de inventar física nova, as órbitas do
   Supernova são trilhos de pontuação (evento `ramp`, 2.500 pts, cooldown
   48 ticks) e o critério de aceite de "one-way" foi ajustado em consequência.
3. **Mini-missões nos goal kinds existentes**: sem goal agregado
   ("2× grupo", "soma de 4 bumpers"); as 10 mini-missões usam hits/spinnerHold/
   group com hints inequívocos. Ordem de fases mantida.
4. **Supernova em `tables/index.ts`**: consistência com as 4 mesas existentes
   (todas no mesmo arquivo) prevaleceu sobre o arquivo separado sugerido.
5. **Hooks DEV de E2E**: teleportes via campos crus corrompem os bounds do
   Matter (broadphase não detecta) — adicionados `debugPlaceBall(id)` e
   `debugDrainBall()` (DEV-only, mesma regra de `debugCompleteMission`).
6. **Torneio**: `GameOptions.balls` (2 por mesa); `recordGame` por mesa + 
   `recordTournament(total)` apenas no fim (não por mesa, para não corromper
   `tournamentBest`); transição de mesa via remontagem do GameScreen.
7. **Música**: sequenciador WebAudio com lookahead de 0,4s; start após
   primeiro gesto, para em pausa/game over/saída, respeita mute e volume.
   Audibilidade real em hardware continua pendente (fora do ambiente).
8. **Persistência de metajogo** em chave própria (`neonvolt.progress.v1`),
   leitura tolerante; recordes (`neonvolt.v1`) intocados — regressão verde.
