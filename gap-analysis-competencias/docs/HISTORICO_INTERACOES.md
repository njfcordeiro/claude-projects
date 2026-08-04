# Histórico de Interações — Gap Analysis de Competências

Changelog funcional, organizado cronologicamente por funcionalidade: o que foi pedido e o que foi
entregue em cada etapa. Cobre a sessão completa, de 31 de julho a 4 de agosto de 2026.

## 1. Especificação e modelo de dados (31 jul, início da tarde)

**Pedido:** construir uma app de "Gap Analysis de Competências" para RH; propor um modelo
relacional (com auditoria) e a tecnologia de BD/backend, partindo de um Excel de referência
existente. Correções ao longo de várias iterações do ficheiro: Núcleo não se liga a Direção; "LOBs
exigidos" é uma contagem, não uma lista; competências abaixo do nível não pontuam; certificação
obrigatória em falta ou expirada bloqueia a LOB.

**Entregue:** modelo relacional completo em PostgreSQL/Prisma (Direção/Área/Núcleo, Carreira/
Categoria/Cargo, Competência/Certificação/Formação/LOB, Colaborador + histórico de avaliações,
AuditLog), validado contra 5 versões sucessivas do Excel de origem.

## 2. Arquitetura técnica e scaffold (31 jul)

**Pedido:** arquitetura completa (backend, BD, auth/RBAC, frontend React, execução
local/deploy); estrutura de pastas e setup inicial.

**Entregue:** backend NestJS + Prisma + PostgreSQL, frontend React/Vite, Docker Compose para
desenvolvimento local; tudo validado a correr localmente e commitado.

## 3. Motor de comparação / gap analysis (31 jul)

**Pedido:** lógica que compara, por colaborador × cargo/LOB, competências exigidas vs. possuídas
(por nível) e certificações obrigatórias vs. válidas (com atenção a expiração); relatório de gap
com sugestões de formação/certificação ordenadas por relevância, e um score de prontidão (%).
Endpoints de API + testes.

**Entregue:** `gap-analysis.logic.ts` (funções puras, testadas exaustivamente), `GapAnalysisService`
+ `GapAnalysisController`, validado end-to-end contra Postgres local.

## 4. Interface com visual SAP SuccessFactors (31 jul)

**Pedido:** UI em React com aparência SAP Fiori (paleta azul/branco, menu lateral, cabeçalho com
pesquisa/perfil, cards, tabelas densas, tipografia estilo "72"/Arial); 5 ecrãs: Dashboard, Ficha do
Colaborador, LOBs, Formações, Administração.

**Entregue:** sistema de design Fiori-like em Tailwind, 5 ecrãs iniciais, validado num browser
real.

## 5. Autenticação, papéis e concorrência (31 jul)

**Pedido:** autenticação multi-utilizador com controlo de concorrência (locking otimista ou
transações); papéis Admin RH / Gestor / Colaborador; todas as alterações auditadas (quem, o quê,
quando).

**Entregue:** JWT + `passport-jwt`, locking otimista por coluna `version` (Colaborador,
ColaboradorCertificacao), UI de avaliação/edição na Ficha do Colaborador, teste real de conflito de
concorrência (dois pedidos simultâneos), auditoria via trigger de BD + `runAsUser`.

## 6. Primeiro deploy e acesso (31 jul – 1 ago)

**Pedido:** "posso ver o produto a funcionar?" → deploy no Vercel, ajuda passo-a-passo com
autorização, variáveis de ambiente, credenciais de acesso, diagnóstico de erros (CORS, 404,
build a falhar, redeploys).

**Entregue:** backend e frontend publicados em dois projetos Vercel ligados ao `main` via
integração git; troubleshooting iterativo de CORS/variáveis de ambiente/builds até o login e os
ecrãs funcionarem em produção (confirmado pelo utilizador: "tudo a funcionar, login e ecrãs OK").

## 7. Gestão de dados completa: CRUD, import/export, dashboards multi-dimensão, candidatos (1 ago)

**Pedido:** "o programa não me permite fazer nada a não ser ver resultados. quero ecrãs para
alterar todas as tabelas, upload/download por tabela, resumos por área/departamento/núcleo/cargo,
e identificar candidatos à carreira de Arquiteto."

**Entregue:** módulo `catalogo` genérico (CRUD + export/import `.xlsx` por tabela, registo estático
de campos), dashboard multi-dimensão (`porArea`/`porNucleo`/`porCargo` além de `porDirecao`),
endpoint e ecrã de Candidatos a carreira (baseado no gap contra o cargo de entrada da carreira),
CRUD completo de Colaboradores (criar/eliminar), tudo validado e publicado.

## 8. Ecrã "Frontend mobile" — decisão adiada (1 ago)

**Pedido:** frontend ajustado a telemóvel, mantendo o atual para PC/tablet — pedido explicitamente
com "não avances antes de confirmar".

**Entregue:** em vez de um frontend separado, tornou-se responsivo o existente: navegação
hambúrguer/drawer abaixo de `md`, `DataTable` em modo cartão em mobile, modais a largura total,
revisão de todos os ecrãs para não quebrar em ecrãs pequenos — validado em viewport mobile via
Playwright.

## 9. Colaboradores: mais campos, relevância e agrupamentos (2 ago)

**Pedido:** no ecrã de Colaboradores, acrescentar ID, Cargo (texto), Direção/Área/Núcleo, ID e nome
do BUM (gestor); separar colaboradores "relevantes" dos restantes; visões agrupadas por
Área/Núcleo/Direção.

**Entregue:** campo `relevante` acrescentado a Área e Núcleo (Direção já tinha), editável em Gestão
de Dados; coluna BUM ligada ao campo `eBum` existente; seletor "Agrupar por" + filtro
Todos/Relevantes/Outros na lista de Colaboradores.

## 10. Ecrã "Como Funciona" (2 ago)

**Pedido:** ecrã criativo a explicar as regras aplicadas e o modelo de dados — com pedido explícito
de explicar o plano antes de avançar.

**Entregue:** `ComoFuncionaPage` com clusters de entidades (Organização/Catálogo/Pessoas), fórmulas
de gap explicadas com exemplo interativo, e uma secção de regras de negócio atualizada a cada nova
funcionalidade desde então.

## 11. Correções de acesso e CORS pós-deploy (3 ago)

**Pedido:** vários relatos de login a falhar, 404, e erros de CORS (`No 'Access-Control-Allow-
Origin'`) entre o novo domínio do frontend e o backend.

**Entregue:** correção da configuração `FRONTEND_ORIGIN`/CORS no backend e novo redeploy,
confirmado com `{"status":"ok","database":"up"}` no health-check.

## 12. Administração de contas (3 ago)

**Pedido:** no ecrã de Administração, poder reinicializar password e ativar/inativar utilizador; no
ecrã de login, opção de reinicializar password.

**Entregue:** ações de reset de password e ativar/inativar na `AdminPage`; fluxo de reset acessível
a partir do `LoginPage`.

## 13. Gestão de Dados: nomes em vez de códigos, edição completa, proteção de eliminação (3 ago)

**Pedido:** na Atribuição em Massa, mostrar o texto do cargo em vez do código; em Gestão de Dados,
tabela "Progressão de Cargos" com todos os campos editáveis; CRUD completo (criar/alterar/apagar)
em todas as tabelas, com aviso e bloqueio ao eliminar um registo ainda referenciado noutro lado; e,
mais tarde, ordenação por qualquer campo em todas as tabelas.

**Entregue:** todas as tabelas de catálogo com CRUD completo e todos os campos visíveis/editáveis;
eliminação bloqueada com mensagem amigável (`P2003` → 409) quando há referências noutras tabelas;
ordenação por coluna em todas as grelhas de Gestão de Dados.

## 14. Dashboard: números por carreira, gráficos por área vs. organização (3 ago)

**Pedido:** questionar a contagem "362 colaboradores" para uma competência crítica (só havia 192
avaliados); pedido de contagem por carreira (arquitetos, managers, etc.) e do peso de cada carreira
na empresa; LOBs da área do colaborador devem ter prioridade; dois gráficos no perfil (atual vs.
exigido da área do colaborador, e atual vs. exigido de todas as LOBs).

**Entregue:** correção da contagem no insight de competência crítica; quadro de contagem por
carreira no dashboard; dois gráficos de prontidão no perfil (área vs. organização completa).

## 15. Cobertura de Arquitetos por Área/Núcleo (3–4 ago)

**Pedido:** quadro por núcleo e área com contagem de colaboradores e de arquitetos; critérios: 1
arquiteto por cada 10 colaboradores, mínimo 1 por área com mais de 10 colaboradores, áreas
menores com apoio transversal; défice deve priorizar candidatos a Arquiteto nessa área;
documentar as regras em "Como Funciona". Iterações seguintes: unificar duas tabelas separadas
numa só, agrupada por núcleo e por área (com prévia de mockup pedida antes de alterar); listagem
plana com chave única Área+Núcleo; corrigir contagem (estava só por área, devia ser área+núcleo);
cruzar com a nova tabela "Áreas por Núcleo" em vez de calcular sozinho.

**Entregue:** quadro único "Cobertura de Arquitetos por Área/Núcleo", cruzando `NucleoArea` com
`Colaborador`, com défice/excesso calculado pelos critérios acima e priorização automática de
candidatos nas áreas em défice; regras documentadas em "Como Funciona".

## 16. Núcleo ↔ Área (associação) e importação assistida (4 ago)

**Pedido:** poder associar Áreas a um Núcleo; popular automaticamente essa associação a partir dos
colaboradores existentes (uma vez); gerar um Excel com os registos a criar a partir de um ficheiro
de colaboradores fornecido pelo utilizador.

**Entregue:** tabela `NucleoArea` (N:N) editável em Gestão de Dados, uma linha por Núcleo com as
Áreas indentadas por baixo; população inicial automática a partir dos dados existentes; ficheiro
Excel gerado com os registos a criar a partir do upload do utilizador.

## 17. Colaboradores: antiguidade, Próxima LOB, PDI de LOB única (4 ago)

**Pedido:** modelo de dados dos campos de Colaborador; corrigir a contagem de Cobertura de
Arquitetos (estava a contar só por área); acrescentar edição de `dataAdmissao`; novo ecrã "Modelo
de Dados" com ligações entre tabelas e visibilidade na app; considerar antiguidade como critério de
aptidão para a carreira de Arquiteto; anos de experiência calculados dinamicamente no ecrã do
colaborador; campo "Próxima LOB" (editável, opções = LOBs da área do colaborador); PDI passa a
seguir a Próxima LOB se preenchida, senão a LOB da área mais próxima de ser atingida — sempre uma
única LOB por geração —, com possibilidade de eliminar/regenerar sugestões e adicionar/remover
manualmente.

**Entregue:** ecrã `ModeloDadosPage`; antiguidade como critério de candidatos; campo "anos de
experiência" calculado no perfil; campo "Próxima LOB"; `PdiService.gerar()` reescrito para seguir a
regra Próxima LOB → LOB da área mais próxima → único conjunto de sugestões por geração, com
eliminação/regeneração e adição/remoção manual mantidas.

## 18. Skill Matrix: agrupamento por área e filtros combináveis (4 ago)

**Pedido:** no separador "Por LOB", agrupar as LOBs por Área; filtrar colunas por Área OU por LOB
(nunca os dois em simultâneo); no separador "Por competência", filtrar por Área, por LOB ou por
Competência (só um de cada vez).

**Entregue:** agrupamento visual por Área no separador "Por LOB"; filtros mutuamente exclusivos
implementados em ambos os separadores da Skill Matrix.

## 19. Nível de Gestão, download/upload com texto associado (4 ago)

**Pedido:** nova tabela de Níveis de Gestão (BUD/BUM/Team Leader) com dados iniciais; campo de
nível de gestão no colaborador; na Skill Matrix, poder alterar níveis de competência e fazer
download/upload de um ficheiro que traga o texto associado a cada chave, não só o ID; a mesma regra
para o download/upload geral de todas as tabelas em Gestão de Dados (ficheiro de download = ficheiro
de upload); e, numa correção seguinte, o texto associado num Excel de Colaboradores deve
atualizar-se automaticamente sempre que o ID correspondente muda.

**Entregue:** tabelas `NivelGestao` e `LocalTrabalho`, campo `nivelGestaoId` em Colaborador; edição
inline de níveis na Skill Matrix; round-trip completo de download/upload em todas as tabelas do
Gestão de Dados, com texto associado a cada ID e atualização automática desse texto quando o ID
muda.

## 20. Ativo/Inativo e eliminação sem bloqueios (4 ago)

**Pedido:** permitir eliminar um colaborador independentemente de estar associado a outros
processos/tabelas (limpando as referências); campo de estado ativo/inativo; excluir inativos de
toda a análise; alertar se um colaborador inativo ainda tem colaboradores associados a ele.

**Entregue:** todas as FKs para `Colaborador` alteradas para `SetNull`/`Cascade` (eliminação nunca
bloqueada); campo `Colaborador.ativo`; inativos excluídos de dashboard/skill matrix/candidatos;
alerta quando um gestor inativo ainda tem equipa ativa.

## 21. Objetivos de LOB no PDI — múltiplos objetivos, sistema + BUD (4 ago, em curso)

**Pedido:** o sistema deve propor até 3 LOBs da área do colaborador (ainda não cumpridas) como
objetivo, pela % de cumprimento; se o BUD recomendar uma ou mais LOBs, estas também passam a ser
objetivo; as competências sugeridas devem basear-se nas LOBs determinadas pelo sistema e/ou BUD —
com o pedido explícito de apresentar o plano e mockups antes de qualquer alteração de código.

**Entregue até agora:** plano apresentado com mockup da nova secção "Objetivos de LOB" na ficha do
colaborador; aprovado pelo utilizador ("avança"). Backend implementado: `LobObjetivosService`
(sugestões automáticas ao vivo + CRUD de recomendações do BUD sobre `ColaboradorLobRecomendacao`),
novo endpoint `colaboradores/:id/objetivos-lob`, e `PdiService.gerar()` reescrito para gerar
sugestões a partir da união de todos os objetivos ativos (sistema + BUD), anotando a origem de
cada item. Pendente: interface no frontend (secção "Objetivos de LOB" na ficha, origem visível no
PDI) e atualização do ecrã "Como Funciona".

## 22. Documentação da solução (4 ago)

**Pedido:** criar um documento técnico, um documento funcional, e um documento com todas as
interações tidas ao longo da sessão.

**Entregue:** este conjunto de três documentos (`DOCUMENTO_TECNICO.md`, `DOCUMENTO_FUNCIONAL.md`,
`HISTORICO_INTERACOES.md`), também exportados em `.docx`.
