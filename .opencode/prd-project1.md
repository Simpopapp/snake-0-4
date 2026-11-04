# PRD — NEONVOLT Pinball

> PRD derivado de `project1.md` ("game pimball, invente o nome, o resultado deve
> ser impecável e de altíssimo nível visual e de jogabilidade e com diversidade
> de mapas/cenários"). Este documento é a fonte do "COMO": decisões técnicas,
> escopo por fase e critérios de aceite.

---

## 1. Visão do produto

**NEONVOLT** é um jogo de pinball arcade moderno para browser, single-page,
sem instalação. O jogador controla um pinball elétrico em mesas temáticas com
física real, iluminação neon, efeitos de partículas, missões, multiball e
placar persistente.

Promessa central: **o melhor pinball jogável no navegador** — visual de
arcade premium, resposta de flipper em tempo real (perceptível < 1 frame),
e 4 mesas com identidade própria.

Nome inventado: **NEONVOLT** (título completo: "NEONVOLT — Pinball Elétrico").
Logotipo/texto do título: "NEONVOLT" com paleta âmbar-ciano.

## 2. Pilares de qualidade (definição de "impecável")

1. **Jogabilidade**: flipper responsivo, bola com momento e atrito críveis,
   lançamento com controle de força (plunger), colisões com feedback visual e
   sonoro, nunca há "bola presa" sem resolução automática (anti-stuck).
2. **Visual**: nada genérico. Cada mesa tem paleta, geometria e identidade
   visual próprias; brilho neon, glow, partículas de impacto, shake de tela
   sutil em hits grandes, animação de HUD.
3. **Diversidade de cenários**: mínimo 4 mesas jogáveis com layout, regras e
   objetivos distintos entre si.
4. **Robustez**: pausa/retomada, redimensionamento de janela, perda de foco
   (auto-pause), mobile touch (multitouch flippers), sem erros no console.

## 3. Decisões técnicas ( Vinculantes )

| Decisão | Escolha | Por quê |
|---|---|---|
| Motor de física | `matter-js` (pacote npm + `@types`) | Física 2D madura, colisões por vértices, API de eventos |
| Renderização | Canvas 2D próprio (não o renderer do Matter) | Controle total de neon/glow/partículas |
| Arquitetura | Engine desacoplada do React; React só no HUD/menus | Loop de jogo a 60fps fora do ciclo do React |
| Carregamento | `matter-js` e o jogo via `React.lazy` atrás de `<ClientOnly>` | Evita SSR executar código de browser |
| Persistência | `localStorage` (recorde e progresso) | Jogo não precisa de backend; Lovable Cloud desnecessário |
| Roteamento | Rota única `/` (menu + jogo); head() própria | Jogo single-page; evita rotas vazias |
| Áudio | WebAudio sintetizado (osciladores) | Zero assets externos, latência zero |
| Controles | Teclado (setas/Z-X/Espaço) + touch (multitouch) | Desktop e mobile |
| Idioma da UI | Português (BR) | Público do usuário |

Proibido: React Router DOM, backend/Cloud para o core do jogo, `useEffect`
fetching, import estático de `matter-js` em rota SSR, CSS hardcoded de cor fora
dos tokens do tema em `src/styles.css`.

## 4. Contratos de código (fundação da onda paralela)

Fundação criada pelo agente principal ANTES dos subagentes:

- `src/game/types.ts` — todos os tipos compartilhados:
  - `Vec2`, `BumperKind`, `TablePalette`, `TableElement`,
    `TableDef`, `GameState`, `HudSnapshot`, `GameEvent`.
- `src/game/contract.md` — API pactuada entre módulos (resumo aqui):
  - **Engine** (`src/game/engine.ts`): `createGame(canvas, table, callbacks)`
    → `{ start, pause, resume, destroy, input, getSnapshot }`.
  - **Renderer** (`src/game/renderer.ts`):
    `drawFrame(ctx, world, table, fx)` desenha o frame completo.
  - **Tables** (`src/game/tables/*.ts`): exportam `TableDef` válidos
    (validados por `validateTable()`).
  - **UI** (`src/components/pinball/*`): consome só `HudSnapshot` e callbacks;
    não importa `matter-js` diretamente.
- Convenções: nenhum módulo do jogo importa React; nenhum componente importa
  Matter. Comunicação engine↔UI por callbacks tipados + snapshot por frame.

## 5. Mecânicas (especificação)

### 5.1 Controles
- Flipper esquerdo: `ArrowLeft`/`Z`/`A` · direito: `ArrowRight`/`X`/`M`.
- Plunger (lançador): `ArrowDown`/`Espaço` segurado → força pela carga.
- Nudge: `Shift` esquerdo (limitado a 3 por bola; 3 = tilt).
- Pausa: `Esc`/`P`. Touch: metade esquerda/direita da tela = flippers;
  botão dedicado para plunger; multitouch simultâneo obrigatório.

### 5.2 Física e gameplay
- Bola: aço (restituição ~0.9), raio 7px em coordenada virtual 540×960.
- Flippers: corpos kinematics com rotação angular limitada (~-30° a +30°),
  resposta imediata no keydown (sem atraso perceptível).
- Elementos por mesa: bumpers (pop, pontos + som), slingshots laterais,
  drop targets (podem cair e resetar), spinner (soma pontos ao girar),
  rampas/lanes, kicker/saucer, kickback na saída esquerda (1 por bola).
- Multiball: 2-3 bolas simultâneas; jogo só perde a bola quando todas caem.
- Anti-stuck: se a velocidade da bola ≈ 0 por > 2.5s fora do plunger,
  aplicar impulso fraco; se preso > 5s, teleportar para o plunger.
- Tilt: 3 nudges em sequência curta desligam flippers até a bola cair.
- Bonus de fim de bola: multiplicador de bola (ball multiplier) acumulado
  durante o jogo, aplicado ao bônus.

### 5.3 Pontuação e progressão
- Bumpers 100–500 pts; drop target 500; spinner 50/rot; rampa 2.500;
  missão concluída 10.000+; multiball x2 pontos.
- Multiplier por bola cresce com hits consecutivos sem perder a bola (x1→x8).
- Recorde por mesa e global persistidos em `localStorage` (`neonvolt.v1`).

### 5.4 Missões por mesa (diferenciação)
Cada mesa tem 1 objetivo assinatura + mini-missões visíveis no HUD:
- **Circuito Neon**: fechar os 3 nós de energia para abrir o portal (multiball).
- **Forja Solar**: aquecer o núcleo com 6 hits no bumper central →
  "erupção" (jackpot + partículas de lava).
- **Abissal**: acender 4 criaturas bioluminescentes com drop targets →
  sonar multiball.
- **Criogênese**: manter o spinner girando 5s congelados → bola "gelo"
  (massa menor, mais rápido) por 20s.

## 6. As 4 mesas (cenários) — identidade visual e geometria

Coordenada virtual: 540×960 (escala para o container; DPR-aware).

### 6.1 Circuito Neon (cyber city)
- Paleta: fundo #0b0d1a, trilhas ciano #22d3ee, magenta #e879f9, âmbar #fbbf24.
- Layout: 2 rampas em espiral central, 5 bumpers hexagonais, 3 lanes
  superiores, alvo móvel no topo. Visual: grid de cidade, "chuva" de dados
  sutil no fundo.

### 6.2 Forja Solar (vulcão)
- Paleta: fundo #1a0903, laranja #f97316, vermelho #ef4444, dourado #fde047.
- Layout: bumper central grande (o Núcleo), 2 canais de lava laterais
  (kickback por dentro), drop targets em losango. Visual: brasas flutuantes,
  glow térmico pulsante.

### 6.3 Abissal (oceano profundo)
- Paleta: fundo #020617, azul #38bdf8, verde-lima #a3e635, rosa #f472b6.
- Layout: corredores curvos (arcos), spinner central, 4 criaturas como
  drop targets com animação de "respiração". Visual: partículas de plâncton
  subindo, bolhas em hits.

### 6.4 Criogênese (geleira)
- Paleta: fundo #0c1425, gelo #e0f2fe, ciano-claro #7dd3fc, violeta #8b5cf6.
- Layout: simétrico, com paredes poligonais facetadas, 2 slingshots fortes,
  spinner no topo. Visual: cristais, respingo de flocos, cintilância.

Todas as mesas compartilham: launch lane à direita com plunger, outlanes
com kickback esquerdo (1 uso/bola), drenos centrais entre flippers,
arte de fundo procedural desenhada no renderer (sem imagens externas).

## 7. Identidade visual global (fora das mesas)

- Direção: **arcade neon dark**, tipografia display condensada
  (Bebas Neue via Google Fonts link no `__root.tsx`) + corpo Inter-ish
  do sistema. Nada de gradiente roxo/índigo genérico: o neon vive nos
  detalhes das mesas.
- Fundo do shell: quase-preto com vinheta radial e scanlines sutis.
- HUD: pontuação com fonte tabular, animação de "twitch" ao pontuar,
  medidor de multiplier, nome da mesa e objetivo ativo.
- Menu: carrossel de mesas (cards com preview procedural do layout,
  recorde por mesa), botão grande "JOGAR", instruções de controle.
- Sem emojis na UI; ícones `lucide-react` quando necessários.

## 8. Áudio (síntese WebAudio)

- Biblioteca de sons: flipper (thock curto), bumper (blip com pitch por
  bumper), slingshot, drop target (clack + desce), spinner (trill),
  rampa (sweep), jackpot (acorde), multiball (arpejo), dreno (descida),
  launch (sweep up), tilt (buzz).
- Master gain com toggle de mute persistido; nada de arquivos externos.

## 9. Escopo por fase (mapeia o roadmap)

- **F1 Fundação/Contratos**: deps (`matter-js`), `types.ts`, `contract.md`,
  tokens de tema, fontes, head metadata. Gate: tipos compilam, build OK.
- **F2 Engine de física**: mundo Matter, bola/flippers/plunger, eventos de
  colisão, anti-stuck, tilt, multiball, snapshot e callbacks.
  Gate: build OK + teste manual via browser com script de colisão.
- **F3 Renderer**: canvas neon (glow, trilhas, partículas, shake), fundo
  procedural, desenho de todos os `TableElement`. Gate: build + screenshot.
- **F4 Mesas**: 4 `TableDef` completos + missões + validação. Gate:
  `validateTable` passa para as 4; playtest de cada uma via browser.
- **F5 Shell/UI**: rota `/` com menu, carrossel, HUD, pausa, game over,
  recordes, controles touch. Gate: build + fluxo completo no browser.
- **F6 Áudio + polish**: sons sintetizados, mute, partículas/streams
  finais, balanceamento de pontuação. Gate: console sem erros, fluxo E2E.
- **F7 Verificação final**: build/preview, playthrough real (lançar bola,
  pontuar, perder bola, multiball, trocar mesa), recordes persistindo,
  testes do projeto passando. Gate: tudo verde.

## 10. Critérios de aceite (produto final)

1. Abrir `/`: menu NEONVOLT com 4 mesas navegáveis e recordes; zero erros no console.
2. Jogar 3 bolas completas na mesa padrão: lançar, pontuar em bumper/rampa,
   multiball disparado por missão, bônus de fim de bola, game over com recorde salvo.
3. Trocar de mesa e jogar: layout, paleta e missão claramente diferentes.
4. No mobile (viewport estreito): flippers por touch funcionam em multitouch.
5. Pausar (Esc) congela o jogo; retomar sem salto de física; trocar de aba pausa.
6. Recorde sobrevive a recarregar a página (localStorage).
7. Build de produção sem erros; sem import estático de matter-js em SSR.

## 11. Riscos e mitigações

- **Física do Matter com flippers rápidos**: usar `Matter.Body.setAngularVelocity`
  + timestep fixo (60Hz, acumulador) e colisões contínuas nas bordas finas
  (paredes grossas o suficiente).
- **Tunneling da bola em paredes finas**: paredes com espessura ≥ 14px
  e `positionIterations` aumentado.
- **Desempenho**: máx. 3 bolas, partículas em pool (≤ 400), sem GC no loop
  (objetos reusados), `devicePixelRatio` limitado a 2.
- **Enxame**: subagentes não marcam o roadmap central; integração e gates
  são do agente principal. Adaptado: `subagentes-3-pilares` skill ausente no
  projeto → enxame executado com system prompts condensados contendo os
  pilares centrais por referência + recorte do subagente.

## 12. Fora de escopo

Multiplayer online, backend/contas, tabela de líderes global em servidor,
compras/iap, skins compráveis, editor de mesa.

---

## 13. Registro de decisões da execução (remix 1)

1. **Skill `subagentes-3-pilares` ausente** no projeto: o enxame foi executado
   com spawn_agent e system prompts condensados (regras + recorte). Dois
   subagentes rodaram: (a) design das 4 mesas → especificação integrada nas
   `src/game/tables/index.ts`; (b) revisão de código da engine/UI.
2. **Frame padrão na engine** (`src/game/frame.ts`): bordas, lane de
   lançamento, guias de inlane, kickback e dreno são padrão da engine; as
   mesas declaram só o interior (bumpers, alvos, spinner, kicker, defletores).
   A especificação do subagente foi integrada nesse recorte (COMMON_WALLS/
   COMMON_ELEMENTS dela foram descartados; paletas, layouts, missões e ids
   adotados como especificados).
3. **Multiball**: `reward.balls` = bolas ADICIONAIS, limitado por `maxBalls`.
4. **Missão re-armável**: a missão assinatura pode ser concluída novamente
   após ~5,5s (replay value) — desvia do "uma vez por partida" do subagente,
   decisão registrada aqui prevalece.
5. **Spinner hold**: acumula enquanto gira e decai quando para (não zera).
6. **Calibração física** (medida no browser): aceleração efetiva da gravidade
   ≈ 0,87 px/tick²; lançamento pleno = 46 px/tick, multiball = 42, kickback =
   30, forças de bumper/sling na faixa 18–24. Valores no engine/tables.
7. **Áudio** verificado por code review/console; audibilidade real não testada
   em ambiente headless — pendência do F6.
