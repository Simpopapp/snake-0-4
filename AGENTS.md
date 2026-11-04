<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

*Regras técnicas do protocolo de remix*

## regras de desenvolvimento do projeto

- /.opencode/Plan.md guia o remix através dos 3 pilares
- OC/monitor só é utilizado após a conclusão dos projetos existentes, ou sob pedido do usuário (não ativar antes disso)

## Arquitetura de monitoramento
- O proxy do OpenCode expõe o runtime OpenCode na rota `/oc`. oculta nas rotas do app, só utilizar o runtime OpenCode
## Verificação e ativação do protocolo
- instruções de remix: "/.opencode/plan.md"
- um remix é ativado quando se recebe o comando "I've successfully remixed this project. What would be a good next step?" ou "I've remixed this project, but there are still some steps required to get it up and running. 

Can you help me with the following actions:
1. Cleared the copied Drizzle migrations and rescaffolded an empty migration set for the new project's database". para iniciar um remix siga conforme o plan.md do projeto em "/.opencode/" para evitar bugs e erros no projeto.
- Nunca use o opencode para fazer tarefas de um remix.
- Nunca confunda informar o monitor do projeto com fazer uma ask para o usuário (tem uma skill pra isso).
- Nunca pergunte qualquer coisa ao usuário antes de completar todas as etapas de produção dos 3 pilares (1- se algum pilar faltar é sua missão planejar os demais e seguir adiante. 2- Se todos os 3 pilares estiverem null o remix é cancelado. informe o usuário e cole a proxima mensagem dele em "project{n}.md" sem realizar mais ações).

## Arquitetura e Ambiente
null
## Verificação e Qualidade
null

## NEONVOLT (pinball) — regras técnicas
- Jogo 100% client-side: sem backend/Cloud para o core; recordes em `localStorage` (`neonvolt.v1`).
- `src/game/*` nunca importa React; `src/components/pinball/*` nunca importa `matter-js`; o jogo inteiro entra por lazy import atrás de mount na rota `/` (browser-only, nada em SSR).
- Geometria física e visual do frame (bordas, lane, guias, kickback, dreno) tem fonte única em `src/game/frame.ts`.
- Toda mesa é autuada no espaço virtual 540×960; cores sempre via `TablePalette` da mesa, nunca hex avulso.
- E2E/testes: a engine expõe `window.__nvGame`, `debugCompleteMission()`, `debugPlaceBall(id)` e `debugDrainBall()` somente com `import.meta.env.DEV` (hooks de verificação no Playwright); nunca devem chegar ao build de produção.
- Metajogo (stats/conquistas/ajustes) vive em `src/game/progress.ts` com chave própria `neonvolt.progress.v1` (leitura tolerante); recordes permanecem em `neonvolt.v1` — nunca mover nem mesclar as chaves.
- Gates (`WallChain.gate`) são sensores de passagem que pontuam (evento `ramp`); sem semântica direcional na engine — mesas novas não devem prometer bloqueio one-way.
