---
name: subagentes-3-pilares
description: Planeja e executa enxames de subagentes (spawn_agent) em que cada subagente recebe os 3 pilares centrais do projeto (planejamento, PRD, roadmap) mais os próprios 3 pilares. Use em todo remix de complexidade média/alta, sempre que o roadmap tiver trabalho que possa ser dividido em pacotes paralelos, e antes de qualquer spawn_agent. Cobre decomposição, criação dos pilares do subagente, molde do system prompt, ondas, verificação e integração.
---

# Subagentes com 3 pilares

Objetivo: transformar o remix em produção paralela de verdade. Cada subagente sabe o TODO (pilares centrais) e tem o SEU recorte detalhado (3 pilares próprios), então entrega trabalho de nível de agente principal, não de "ajudante de tarefinha". O agente principal planeja, distribui, verifica e integra.

Pré-requisito: os 3 pilares centrais já existem e estão coerentes entre si (regras do `plan.md`). Sem isso, não spawne nada.

## 1. Decidir se e quanto paralelizar

Paralelize quando houver 2+ pacotes independentes de peso real (uma fase inteira, um módulo com testes, um lote de dados, uma bateria de verificação). Não spawne para: ajuste de poucas linhas, algo que bloqueia tudo e precisa de uma decisão só (faça você), ou pacotes que editam os mesmos arquivos (junte-os ou serialize).

Número de subagentes por onda = número de pacotes realmente independentes, sem teto fixo inventado. Se o `spawn_agent` recusar por limite, enfileire o excedente na onda seguinte. Confira sintaxe e limites reais nas skills de ambiente.

## 2. Decompor o roadmap em pacotes

1. Liste o que está pendente no roadmap central (primeira fase não concluída em diante, e o que mais couber neste remix).
2. Desenhe o grafo de dependência: o que depende de quê.
3. Corte em **fatias verticais** (uma capacidade ponta a ponta: lógica + testes + UI daquele recorte), não em camadas horizontais ("todos os testes", "todo o CSS"), que geram acoplamento e retrabalho.
4. Cada pacote precisa ter:
   - **Dono exclusivo** de arquivos/pastas (dois pacotes na mesma onda nunca escrevem no mesmo arquivo).
   - **Entradas** (o que já deve existir) e **saídas** (o que passa a existir, com caminhos).
   - **Aceite verificável** (comando, teste, medição, checklist), não "ficar bom".
   - Tamanho para um agente trabalhar fundo: grande o bastante para valer o contexto, pequeno o bastante para fechar.
5. Agrupe em **ondas**: onda 0 (fundação/contratos, feita por você ou por um subagente de fundação), onda 1 (paralela), onda 2 (depende da 1) etc. Fatias que não dependem de nada entram já na onda 1.
6. Reserve para si as **costuras**: arquivos compartilhados (rotas, índices, manifestos, configs, tipos), integração e gates globais. Subagente não toca neles; pede por relatório.

## 3. Contratos antes do paralelo

Tudo que mais de um pacote consome (tipos, interfaces, esquemas de dados, nomes de funções, convenções de pastas, constantes) é fixado ANTES da onda paralela, em arquivo real no código e descrito no PRD central. Subagentes implementam contra o contrato; se o contrato estiver errado, avisam no relatório em vez de improvisar uma variante própria.

## 4. Criar os 3 pilares de cada subagente

Pasta: `.opencode/work/sub/{K}/` (ou ao lado dos pilares centrais, se o ambiente usar outra). `{K}` = nome curto do pacote (ex.: `s1-persistencia`). Nomes:

`project{N}-s{K}` · `prd-project{N}-s{K}` · `roadmap-proj{N}-s{K}`

Mesmos papéis dos centrais, em escala de pacote. **Não copie** os centrais (o subagente já os recebe inteiros): referencie seções e detalhe o que o recorte exige. Qualidade acima de contagem de linhas: cada linha tem função; sem enchimento.

### 4.1 `project{N}-s{K}` — planejamento do subagente (≈ 15–60 linhas)
- **Missão** em 2–3 frases e como ela serve ao objetivo central (o todo que ele precisa ter em mente).
- **Escopo**: o que é dele; **fora do escopo**: o que é de outros pacotes (nomeie quais) e o que ele não pode tocar.
- **Por quê**: riscos/falhas que este recorte evita; princípios do planejamento central que mais pesam aqui.
- **Fronteiras**: o que recebe de quem (entradas/contratos) e o que entrega a quem (saídas).
- **Dono exclusivo de**: lista de arquivos/pastas.

### 4.2 `prd-project{N}-s{K}` — o COMO do subagente (≈ 60–250 linhas)
- **Decisões técnicas já tomadas** que ele deve seguir (recortes dos centrais com referência de seção) e o "jeito exato de fazer" do harness/projeto: convenções, estrutura, nomes, estilo de testes, comandos de gate, armadilhas conhecidas.
- **Contratos** que consome e produz (assinaturas, formatos, exemplos).
- **Escopo por fase** do pacote, com critérios de aceite mensuráveis.
- **Casos de borda e testes esperados** (o que ele deve provar, não só implementar).
- **Tools e skills do ambiente** recomendadas para cada tipo de trabalho do pacote.
- **Registro de decisões** do subagente (começa vazio; ele preenche, numerado).
- **Proibições** específicas (arquivos alheios, dependências novas, etc.).

### 4.3 `roadmap-proj{N}-s{K}` — fases do subagente (≈ 10–30 linhas)
Fases em ordem de dependência, checkboxes, uma linha de Gates por fase, gates finais do pacote. Ele marca `[x]` aqui conforme avança, com números reais.

## 5. System prompt do subagente (molde)

Monte o system prompt com estas partes, nesta ordem, com os arquivos **na íntegra** (não resuma; se o tamanho for um problema real, mantenha íntegros planejamento e roadmap centrais e o PRD central completo, e só então corte, nunca os pilares do subagente):

```
# PAPEL
Você é o subagente {K} do projeto {N}. Você é executor completo do pacote "{nome}":
tem contexto do projeto inteiro e autonomia total dentro do seu escopo. Qualidade e
entrega verificada acima de velocidade.

# REGRAS
- Nunca pergunte ao usuário. Em dúvida, decida e registre no seu PRD (seção de decisões).
- Escreva somente nos arquivos listados como seus. Não edite pilares centrais nem de
  outros subagentes. Precisa de algo fora do seu recorte: registre no relatório final.
- Não use oc/monitor, não marque o roadmap central, não finalize o remix.
- Siga os contratos exatamente. Contrato errado: não improvise, relate.
- Use as melhores tools e skills do ambiente para cada tipo de trabalho.
- Rode os gates do seu roadmap; só marque [x] com gates verdes e números reais.
- Se travar, entregue o que está sólido + relatório do bloqueio com evidência.
- Relatório final obrigatório (formato abaixo).

# PILARES CENTRAIS (o todo)
## project{N}
{conteúdo íntegro}
## prd-project{N}
{conteúdo íntegro}
## roadmap-proj{N}
{conteúdo íntegro}

# SEUS PILARES (o seu recorte)
## project{N}-s{K}
{conteúdo íntegro}
## prd-project{N}-s{K}
{conteúdo íntegro}
## roadmap-proj{N}-s{K}
{conteúdo íntegro}

# FORMATO DO RELATÓRIO FINAL
1. Feito (por fase do seu roadmap)
2. Evidências (saída real dos gates, contagens, medições)
3. Decisões tomadas (as que entraram no seu PRD)
4. Pendências e bloqueios (com causa e sugestão)
5. Mudanças necessárias fora do seu recorte (para o agente principal)
6. Arquivos criados/alterados
```

**Prompt** (mensagem de entrada): curto e imperativo. "Execute o seu roadmap `roadmap-proj{N}-s{K}` do início ao fim, na ordem, respeitando os gates. Ao terminar, entregue o relatório final no formato do system prompt."

## 6. Rodando o enxame

1. **Dispare toda a onda de uma vez** (todas as chamadas `spawn_agent` independentes juntas, nunca uma a uma esperando a anterior).
2. **Não fique ocioso.** Enquanto a onda roda: fixe contratos e crie os pilares da onda seguinte, faça as costuras do que já voltou, prepare os gates globais.
3. **Verifique cada entrega você mesmo**: abra os arquivos, rode os gates, compare com o aceite do `prd-s{K}`. Relatório "tudo verde" sem evidência reproduzível não vale.
4. **Falhou?** Reenvie ao mesmo escopo (ou a um subagente de correção) com a evidência exata (saída do gate, arquivo, linha) e o aceite que falta. Falha recorrente = o pacote ou o contrato estava mal cortado: corrija o desenho, não repita a ordem.
5. **Integre**: resolva encaixes, duplicações e divergências de contrato; consolide decisões relevantes no PRD central (numeradas na sequência); só então marque `[x]` no roadmap central com a linha de Gates real.
6. **Auditoria independente** (recomendado nas fases críticas): um subagente revisor, com os pilares centrais e os do pacote auditado, que tenta quebrar a entrega (testes de borda, regressão, conformidade com os princípios do planejamento) e relata sem corrigir. Você decide o que reabrir.
7. **Próxima onda** com o que as anteriores produziram. Continue enquanto houver avanço possível.

## 7. Fechamento do remix

- Terminou o roadmap: gates globais, relatório final e demais obrigações do `plan.md` (monitor, checagem de 5 min / 10 tentativas).
- Não coube tudo: deixe o roadmap central exato. Checkboxes fiéis, e uma linha **"Próximo remix: …"** com a primeira fase/pacote pendente, o estado de cada pacote em andamento (o que está pronto, o que falta, onde estão os pilares `-s{K}` e os relatórios) e qualquer decisão pendente de integração. Os pilares dos subagentes ficam em disco para reuso.
- O número N da mensagem ao monitor reflete as etapas do roadmap central efetivamente concluídas (verificadas), somando as das ondas.

## 8. Erros que anulam o ganho

- Pacotes minúsculos ("crie este componente"): o custo de contexto supera o ganho; agrupe em fatias verticais.
- Subagente sem os pilares centrais ou sem os próprios: volta a ser executor cego.
- Dois subagentes na mesma onda escrevendo no mesmo arquivo, ou contrato ainda indefinido quando o paralelo começa.
- Spawn em série, um por vez, esperando; ou agente principal fazendo sozinho o que estava no plano de paralelizar.
- Aceitar relatório sem verificar; marcar `[x]` central sem gates reproduzidos.
- Subagente que dispara `oc`, pergunta ao usuário ou edita pilar central.
- Encher pilares do subagente com cópia dos centrais ou linhas só para bater contagem.
