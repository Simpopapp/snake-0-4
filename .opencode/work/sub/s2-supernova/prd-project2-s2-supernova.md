# prd-project2-s2 — COMO desenhar a mesa Supernova

## Decisões vinculadas (dos pilares centrais)
- Coordenada virtual 540×960; cores só via `TablePalette` (PRD project1 §6).
- `validateTable`: ids únicos; bumpers/targets/spinner/kicker com pos em
  x∈(16,486), y∈(60,860); slings dentro de 540×960; 2 flippers (padrão).
- Gates: `WallChain.gate: true` com points[0]→points[1]; na engine são
  sensores de passagem (evento "ramp", 2.500 pts, cooldown 48 ticks) —
  desenhar como "órbita" no topo, não como parede sólida.
- Missões: 2 mini-missões com goals do tipo hits/group/spinnerHold
  (MiniMission = { id; title; hint; goal; score 5.000–7.500 }).
- Sem imagens externas; fundo procedural desenhado pelo renderer a partir
  do id `supernova` (o desenho em si é do agente principal — especifique
  apenas o CLIMA: poeira estelar, nebulosa, cores).

## O que a especificação deve conter (formato do relatório)
1. **Paleta** (TablePalette): bg, bgDetail, wall, glowA, glowB, hot, dim —
   hex com contraste real sobre bg quase-preto azulado (tema: espaço
   profundo; sugerido: dourado solar + ciano estelar; sem roxo genérico).
2. **Defletores laterais** (WallChain sem gate, 2–3 pontos cada, como as
   outras mesas: ex. reflexos em y 390–580).
3. **Órbitas com gate**: 2 arcos no terço superior (y < 300), cada um com
   id (`supernova-orbit-left/right`), 4–6 pontos, `gate: true`. Coordenar
   para que uma bola lançada com força média complete a órbita e volte.
4. **Elementos** (cada um com id prefixado `supernova-`):
   - 3–4 bumpers ("planetas": núcleo maior central + satélites), score
     200–350, power 19–24, radius 24–38, cores alternando glowA/glowB.
   - Grupo de alvos `supernova-nova` (3–4 targets, score 500).
   - 1 spinner ("pulsar", length 56–72, score 125–150).
   - 1 kicker ("buraco branco", radius 16–20, hold 0.6–0.9, score 600–1000,
     ejectTo seguro — não dentro de elemento).
   - 2 slings compartilhados podem ser omitidos na especificação (o frame
     do agente principal reusa SLINGS padrão) — mas indique se desejar
     slings próprios.
5. **Missão assinatura**: título/hint pt-BR, goal (sugestão: hits no bumper
   núcleo OU grupo nova), reward (multiball balls 2 OU jackpot 15000),
   score 12.000–15.000.
6. **2 mini-missões** (PRD §6.4): ids `supernova-orbita-estavel` (usar
   goal `hits` nos gates? — gates não contam hits; use hits em bumper
   planetário ou spinnerHold) e `supernova-colapso-inicial` (hits
   acumulados). Cada uma com título, hint, goal e score.
7. **Geometria coerente**: nada dentro da lane (x > 486), nada sobre os
   flippers (y > 780 exceto guias), espaçamento mínimo ~40px entre
   elementos com raio.

## Regras
- Não pergunta ao usuário; decide e registra as escolhas no relatório
  (seção "Decisões").
- Relatório final: especificação completa + decisões + pontos de risco
  (ex. órbita que engole a bola, kicker com ejectTo ruim).
