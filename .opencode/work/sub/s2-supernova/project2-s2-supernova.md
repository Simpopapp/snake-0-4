# project2-s2 — Planejamento: mesa "Supernova" (espaço profundo)

**Missão**: desenhar, como especificação completa (o agente principal
implementa), a 5ª mesa do NEONVOLT — "Supernova" — a primeira mesa a usar o
recurso `gate` (sensor de órbita/rampa one-way) da engine. A especificação
serve ao project2: diversidade de cenários (PRD §2, D6) e vida para um
recurso morto (PRD §1.2).

**Escopo**: geometria (coordenadas 540×960), paleta, elementos (bumpers,
grupo de alvos, spinner, kicker, defletores, 2 órbitas com gate), missão
assinatura, 2 mini-missões (PRD §6.4), hint/subtítulo em pt-BR.
**Fora do escopo**: implementar arquivos, tocar engine/renderer/tables
(pacote do agente principal, roadmap E3), balanceamento de outras mesas.

**Por quê**: o projeto exige diversidade impecável; a 5ª mesa deve ter
identidade própria (espaço: supernova, pulsar, buraco branco) e geometry
coerente com o frame padrão (lane à direita, flippers em y=880, kickback
esquerdo, dreno y=990) e com `validateTable` (elementos em
x∈(16,486), y∈(60,860)).

**Fronteiras**: recebe os pilares centrais (project2/prd-project2/roadmap E3)
e as regras de geometria do PRD §6. Entrega um relatório de especificação
(markdown no corpo da resposta) que o agente principal traduz em
`src/game/tables/supernova.ts`.
