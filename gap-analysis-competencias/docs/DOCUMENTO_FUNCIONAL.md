# Documento Funcional — Gap Analysis de Competências

**Versão:** 2026-08-04

## 1. Objetivo do sistema

Dar a uma equipa de RH e aos gestores de equipa uma visão clara de **onde cada colaborador está
face ao que a empresa exige** (competências, certificações, LOBs/linhas de negócio), sugerir
planos de desenvolvimento individual, e identificar candidatos a carreiras estratégicas (ex.
Arquiteto) — tudo com dados centralizados, multi-utilizador e com histórico de alterações.

## 2. Papéis de utilizador

| Papel | Dashboard | Lista de Colaboradores | Candidatos / Skill Matrix | Ficha pessoal | Gestão de Dados |
|---|---|---|---|---|---|
| **ADMIN_RH** | Sim | Sim (todos) | Sim | Todas | Sim (CRUD + import/export) |
| **MANAGER** | Sim | Não (só via ficha) | Sim | A sua equipa direta | Não |
| **EMPLOYEE** | Não | Não | Não | Só a própria | Não |
| **VIEWER** | Sim | Sim (leitura) | Sim | Todas (leitura) | Não |

Escrita na ficha de um colaborador ("pode editar"): ADMIN_RH sempre, ou o gestor direto desse
colaborador. Todos os outros casos são só leitura.

## 3. Ecrãs

1. **Dashboard** — visão geral: prontidão média, colaboradores em risco, agrupamentos por
   Direção/Área/Núcleo/Cargo, competência mais crítica em falta, contagem por carreira (quantos
   arquitetos/managers/etc.), gráficos de prontidão atual vs. exigida (área do colaborador e
   organização), quadro de **Cobertura de Arquitetos por Área/Núcleo** (ver §4.6).
2. **Colaboradores** (lista) — todos os colaboradores com ID, nome, cargo, direção/área/núcleo,
   BUM (gestor), nível de gestão, ativo/inativo; filtro Todos/Relevantes/Outros; agrupar por
   Direção/Área/Núcleo; criar/editar/eliminar.
3. **Ficha do colaborador** — dados pessoais e organizacionais (incl. data de admissão, anos de
   antiguidade calculados dinamicamente), avaliações de competências, certificações, gráfico
   radar da skill matrix, "Próxima LOB" (escolha manual), **Objetivos de LOB** (sugestões
   automáticas + recomendações do BUD), Plano de Desenvolvimento Individual, botão
   imprimir/exportar PDF.
4. **LOBs** — catálogo de linhas de negócio, requisitos de competências/certificações por LOB.
5. **Formações** — catálogo de formações disponíveis para colmatar lacunas.
6. **Candidatos a carreira** — para uma carreira escolhida (ex. Arquiteto), lista ordenada de
   colaboradores mais próximos de qualificar, com prioridade adicional para quem está em áreas com
   défice de cobertura (§4.6).
7. **Skill Matrix** — matriz colaborador × competência/LOB, edição inline de níveis, filtros por
   Área/LOB/Competência, download/upload em massa.
8. **Gestão de Dados** *(ADMIN_RH)* — ecrã único para todas as tabelas de catálogo: criar,
   editar, eliminar, ordenar por qualquer campo, exportar/importar `.xlsx` (o ficheiro de download
   é o mesmo que se reimporta; campos com ID trazem sempre o texto associado).
9. **Atribuição em Massa** *(ADMIN_RH)* — atribuir competências/formações a vários colaboradores
   de uma vez.
10. **Administração** *(ADMIN_RH)* — gestão de contas de utilizador: criar, ativar/inativar,
    reinicializar password.
11. **Modelo de Dados** — ecrã de referência com todas as entidades, campos e relações entre
    tabelas, e o que está visível na aplicação.
12. **Como Funciona** — documentação viva das regras de negócio aplicadas (fórmulas, critérios,
    exemplos).

## 4. Regras de negócio principais

### 4.1 Prontidão e "atingido"
Uma LOB é considerada **atingida** por um colaborador quando a soma de pontos das competências
(nível atual pontua só se ≥ nível exigido) atinge o mínimo da LOB **e** não falta nenhuma
certificação obrigatória (em falta ou expirada bloqueia sempre, independentemente dos pontos).

### 4.2 Objetivos de LOB (mais recente)
- **Sugestão automática**: até 3 LOBs da área do colaborador, ainda não atingidas, ordenadas pela
  % de prontidão mais alta (as mais próximas de serem alcançadas entram primeiro).
- **Recomendação do BUD**: o gestor direto (ou ADMIN_RH) pode marcar manualmente qualquer LOB
  (sem restrição de área) como objetivo — passa a contar como objetivo a atingir.
- O PDI gera competências/certificações sugeridas com base na **união** de ambas as origens, não
  só numa LOB.

### 4.3 Plano de Desenvolvimento Individual (PDI)
"Gerar sugestões" cria um item por competência/certificação em falta em cada LOB-objetivo ativa
(sem duplicar itens já existentes). Itens podem ser adicionados/eliminados manualmente e o estado
acompanhado (Pendente/Em curso/Concluído).

### 4.4 Candidatos a carreira
Para a carreira-alvo, calcula-se o cargo de entrada (menor `lobsExigidos`) e ordena-se os
colaboradores que ainda não pertencem a essa carreira pelo gap face a esse mínimo (LOBs em falta),
depois por prontidão média. O tempo de antiguidade do colaborador (data de admissão) é considerado
como critério de aptidão para entrar na carreira.

### 4.5 Risco de fuga de talento
O dashboard sinaliza colaboradores com sinais de risco (definidos no motor de insights) para
priorização de retenção.

### 4.6 Cobertura de Arquitetos por Área/Núcleo
Critérios de negócio:
- 1 Arquiteto por cada 10 colaboradores.
- Mínimo de 1 Arquiteto por área com mais de 10 colaboradores.
- Áreas com menos de 10 colaboradores contam com apoio transversal (não exigem arquiteto próprio).

O quadro cruza a tabela **Áreas por Núcleo** com **Colaboradores** (uma linha por
Núcleo/Área com chave única; o total de colaboradores de um Núcleo é a soma dos das suas Áreas) e
assinala défice/excesso; áreas em défice tornam os seus colaboradores prioritários como candidatos
à carreira de Arquiteto.

### 4.7 Relevância
`Direção`, `Área` e `Núcleo` têm um campo "relevante" (editável em Gestão de Dados) usado para
filtrar/agrupar a lista de Colaboradores entre "Relevantes" e "Outros".

### 4.8 Colaboradores ativos/inativos
Um colaborador pode ser marcado inativo; colaboradores inativos são excluídos de toda a análise
(dashboard, skill matrix, candidatos). Se um gestor inativo ainda tiver equipa ativa associada, o
sistema alerta. Eliminar um colaborador é sempre permitido (mesmo com dados associados) — as
referências noutras tabelas ficam a `null` em vez de bloquear a operação.

### 4.9 Locking otimista
Editar a ficha de um colaborador (ou uma das suas certificações) exige enviar de volta a versão
lida; se outra pessoa alterou entretanto, o sistema recusa a escrita e mostra o estado atual em
vez de perder silenciosamente uma das alterações.

### 4.10 Nível de Gestão e Local de Trabalho
Cada colaborador pode ter um Nível de Gestão (BUD, BUM, Team Leader) e um Local de Trabalho,
usados como filtros/agrupamentos no dashboard e na lista de colaboradores.

## 5. Fluxos principais

1. **Avaliar um colaborador**: ADMIN_RH/gestor abre a ficha → regista nível de competência ou
   certificação → sistema recalcula prontidão por LOB automaticamente.
2. **Gerar PDI**: na ficha, botão "Gerar sugestões" → sistema cria itens para as
   competências/certificações em falta nos objetivos de LOB ativos (sistema + BUD) → utilizador
   acompanha/edita manualmente.
3. **Recomendar uma LOB (BUD)**: gestor/ADMIN_RH escolhe uma LOB na secção "Objetivos de LOB" →
   passa a contar para o PDI do colaborador.
4. **Identificar candidatos a Arquiteto**: ecrã Candidatos, escolher a carreira → lista ordenada,
   com prioridade extra para colaboradores de áreas com défice de cobertura.
5. **Atualizar dados em massa**: Gestão de Dados → exportar tabela `.xlsx` → editar offline →
   reimportar (upsert, com relatório de criados/atualizados/erros).
