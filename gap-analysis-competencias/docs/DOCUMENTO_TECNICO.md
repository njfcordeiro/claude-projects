# Documento Técnico — Gap Analysis de Competências

**Versão:** 2026-08-04 · **Branch:** `claude/gap-analysis-data-model-vc9g7b`

## 1. Visão geral

Aplicação web multi-utilizador para análise de lacunas de competências/certificações de RH:
compara o perfil de cada colaborador (competências avaliadas, certificações obtidas) contra os
requisitos das "LOBs" (Lines of Business) da sua área, calcula uma % de prontidão, sugere planos
de desenvolvimento individual (PDI) e identifica candidatos a carreiras (ex. Arquiteto).

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 (Node.js/TypeScript), REST + Swagger (`/api/docs`) |
| ORM / BD | Prisma 5 + PostgreSQL |
| Autenticação | JWT (`@nestjs/jwt`, `passport-jwt`), password hash `bcryptjs` |
| Frontend | React 18 + Vite + TypeScript, React Router 7, TanStack Query 5 |
| UI | Tailwind CSS, sistema de design "Fiori-like" (inspirado em SAP Fiori/SuccessFactors), `lucide-react`, `recharts` |
| Import/Export | ExcelJS (upload/download `.xlsx` por tabela) |
| Deploy | Vercel (backend e frontend em dois projetos separados, deploy automático a partir do `main` via integração git) |
| Dev local | Docker Compose (Postgres) ou Postgres local (`pg_ctlcluster`) |

## 2. Arquitetura

```
┌─────────────────┐        HTTPS/JSON        ┌──────────────────┐        SQL        ┌────────────┐
│  Frontend (SPA)  │ ───────────────────────▶ │  Backend (NestJS) │ ─────────────────▶ │ PostgreSQL │
│  React + Vite    │ ◀─────────────────────── │  REST + JWT auth  │ ◀───────────────── │  (Prisma)  │
│  Vercel (static)  │                          │  Vercel (serverless)│                 └────────────┘
└─────────────────┘                          └──────────────────┘
```

- O frontend é uma SPA servida como site estático no Vercel; comunica com o backend só por
  `fetch` autenticado (`Authorization: Bearer <jwt>`), sem SSR.
- O backend é um NestJS "normal" (Express por baixo, `NestFactory.create(AppModule)`), com CORS
  restrito a `FRONTEND_ORIGIN`, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`,
  `transform`), Swagger montado em `/api/docs`.
- Cada escrita passa por `PrismaService.runAsUser(userId, tx => ...)`, que corre a operação numa
  transação e define `app.current_user_id` (Postgres `set_config`) na mesma ligação — é isto que
  um trigger de base de dados lê para preencher `AuditLog.changedBy`. Nenhuma escrita usa
  `prisma.<model>` diretamente fora deste wrapper.

## 3. Modelo de dados (Prisma / PostgreSQL)

### 3.1 Organização
`Direcao`, `Area`, `Nucleo`, `NucleoArea` (associação N:N Núcleo↔Área, com contagem de
colaboradores derivada), `Carreira`, `Categoria`, `Cargo` (`lobsExigidos` é um número-limiar, não
uma lista de LOBs específicas), `CargoProgressao`, `NivelGestao` (BUD/BUM/Team Leader),
`LocalTrabalho`.

### 3.2 Catálogo de competências
`Nivel` (escala 0–5), `Competencia` (por Área), `Certificacao` (+ `CertificacaoRequisitoCompetencia`),
`Formacao` (+ `FormacaoRequisitoCompetencia`), `Lob` (por Área, com `pontosMinimos` — o motor de
gap real) + `LobRequisitoCompetencia` / `LobRequisitoCertificacao`.

### 3.3 Pessoas
- `User` — conta de acesso (email, hash, `role`, `colaboradorId?`).
- `Colaborador` — entidade central: `id` (replica o Excel de origem, não autoincrement), `nome`,
  `cargoId`, `managerId`, `direcaoId`/`areaId`/`nucleoId`, `nivelGestaoId`, `localTrabalhoId`,
  `dataAdmissao`, `proximaLobId` (LOB manualmente escolhida para o PDI), `ativo`, `version`
  (locking otimista), `eBum` (legado). Todas as FKs para `Colaborador` são `onDelete: SetNull` ou
  `Cascade` — eliminar um colaborador nunca é bloqueado por referências noutras tabelas.
- `ColaboradorCompetencia` — histórico **append-only** de avaliações (nunca `UPDATE`; o "nível
  atual" é sempre a linha mais recente, lida através de uma view SQL).
- `ColaboradorCertificacao` — posse de certificação, com `dataValidade` e locking otimista próprio
  (`version`).
- `ColaboradorLobRecomendacao` — recomendação de LOB para um colaborador; campo `bud` marca
  recomendação manual de um gestor/ADMIN_RH (ver §7).
- `PdiItem` — item de plano de desenvolvimento (competência/certificação/formação em falta),
  `estado` (Pendente/Em curso/Concluído), `origem` (Automático/Manual).
- `GapAnalysisRun`, `GapAnalysisLobResult`, `GapAnalysisCargoResult` — histórico de execuções do
  motor de gap.
- `AuditLog` — populado por trigger de BD a partir de `app.current_user_id`; regista operação,
  tabela, registo, autor e timestamp.

## 4. Módulos backend (`backend/src/*`)

| Módulo | Endpoints principais | RBAC |
|---|---|---|
| `auth` | `POST /auth/login`, reset de password | público (login) |
| `colaboradores` | `GET/POST/PATCH/DELETE /colaboradores`, avaliações, certificações | leitura: ADMIN_RH/VIEWER todos, MANAGER equipa, EMPLOYEE self; escrita: `podeEditar` (ADMIN_RH ou manager direto) |
| `gap-analysis` | `GET /gap-analysis/colaboradores/:id/...` (cargo/LOB), `GET /gap-analysis/dashboard`, `GET /gap-analysis/candidatos`, `GET /gap-analysis/skill-matrix` | EMPLOYEE sem dashboard/candidatos; MANAGER só equipa |
| `pdi` | `GET/POST /colaboradores/:id/pdi`, `POST .../pdi/gerar`, `PATCH/DELETE .../pdi/:itemId` | mesmo RBAC de `colaboradores` |
| `pdi` (objetivos de LOB) | `GET/POST /colaboradores/:id/objetivos-lob`, `DELETE .../objetivos-lob/:lobId` | idem |
| `lobs` | `GET /lobs`, `GET /lobs/:id` | qualquer autenticado |
| `formacoes` | `GET /formacoes` | qualquer autenticado |
| `catalogo` | `GET/POST/PATCH/DELETE /catalogo/:tabela`, `GET .../export`, `POST .../import`, `GET /catalogo/meta` | leitura: qualquer autenticado; escrita: ADMIN_RH |
| `atribuicoes` | `POST /atribuicoes` (atribuição em massa de competências/formações) | ADMIN_RH |
| `users` | CRUD de contas (`/users`) | ADMIN_RH |
| `health` | `GET /health` | público |

Guards: `JwtAuthGuard` (valida o token) + `RolesGuard` (lê `@Roles(...)` via `Reflector`, deixa
passar qualquer papel se a rota não declarar `@Roles`). Três níveis usados no código: (a) só
`JwtAuthGuard` = qualquer autenticado; (b) `@Roles` por rota = mistura de papéis; (c) `@Roles` a
nível de controller = módulo inteiro restrito (ex. `catalogo` escrita, `users`).

## 5. Motor de Gap Analysis (`gap-analysis.logic.ts`)

Funções puras, sem dependências, testadas exaustivamente (Jest):

- `calcularGapCompetencia(requisito, nivelAtual)` — compara nível atual vs. exigido; abaixo do
  nível não pontua.
- `calcularGapCertificacao(requisito, registo, hoje)` — obrigatória em falta ou expirada bloqueia.
- `calcularGapLob(lob, requisitosCompetencia, requisitosCertificacao, niveisAtuais, certificações, hoje)`
  → `pontosObtidos`, `pontosMinimos`, `prontidaoPercentual` (0–100), `atingido` (pontos ≥ mínimo
  **e** zero obrigatórios em falta).
- `ordenarFormacoes` / `ordenarCertificacoes` — ranking de sugestões de remediação por
  relevância/duração.

`GapAnalysisService` orquestra Prisma → chama o motor puro por colaborador × LOB (evita N+1 com
leituras em lote). `avaliarColaboradorCargo` devolve o gap contra **todas** as LOBs da
organização (não só as da área) — chave para "Objetivos de LOB" e "Candidatos a carreira": LOBs
não estão ligadas a um cargo específico, `Cargo.lobsExigidos` é só uma contagem-limiar.

## 6. Segurança e concorrência

- **Locking otimista** — `Colaborador` e `ColaboradorCertificacao` têm coluna `version`;
  `updateMany({ where: { id, version } })` atómico, `count === 0` ⇒ `409 ConflictException` com o
  estado atual para o cliente re-renderizar.
- **Histórico append-only** — `ColaboradorCompetencia` nunca é atualizado, só criado; concorrência
  entre duas avaliações simultâneas é resolvida com `pg_advisory_xact_lock`.
- **Auditoria** — trigger de BD + `runAsUser` (ver §2); toda a escrita é atribuída a um utilizador.
- **Papéis**: `ADMIN_RH` (tudo), `MANAGER` (a sua equipa direta), `EMPLOYEE` (só os seus dados),
  `VIEWER` (leitura alargada, sem escrita).

## 7. Objetivos de LOB e PDI (funcionalidade mais recente)

`LobObjetivosService` combina duas origens de "objetivo de LOB" por colaborador:
- **auto** — até 3 LOBs da área do colaborador, ainda não atingidas, ordenadas por prontidão
  desc.; **sempre calculado ao vivo** a partir de `avaliarColaboradorCargo` (nunca persistido, para
  nunca ficar desatualizado).
- **bud** — recomendações manuais de um gestor direto/ADMIN_RH, persistidas em
  `ColaboradorLobRecomendacao.bud`, sem limite de quantidade nem restrição de área.

`PdiService.gerar()` itera a união (sem duplicados) de ambas as origens e cria um `PdiItem` por
competência/certificação em falta em qualquer uma delas, gravando `lobId` (a LOB de origem) em
cada item criado. A classificação BUD/Sistema/Outras mostrada no frontend é sempre derivada ao
vivo, cruzando `lobId` com os objetivos de LOB atuais — nunca guardada como texto, para nunca
ficar desatualizada se um objetivo mudar de origem ou deixar de existir.

## 8. Frontend

- **Design system Fiori** (`frontend/tailwind.config.*`): paleta de tokens (`shell`, `primary`,
  `canvas`, `surface`, `border`, `success`/`warning`/`error`/`info` + variantes `-bg`), componentes
  reutilizáveis em `src/components/ui/` (`Badge`, `DataTable`, `Card`, `form.tsx`, etc.).
- **Responsividade**: `SideNav` fixo ≥ `md`, `MobileNavDrawer` (hambúrguer) abaixo disso;
  `DataTable` muda para modo cartão em ecrãs pequenos.
- **Routing**: `react-router-dom` 7, rotas protegidas por papel (`ProtectedRoute
  allowedRoles={[...]}`), lista única de navegação partilhada (`navItems.ts`) entre desktop e
  mobile.
- **Dados**: TanStack Query para cache/invalidação; `frontend/src/api/client.ts` centraliza
  `get/post/patch/put/delete/postForm` + `downloadFile` (blob com header `Authorization`, para
  exportações `.xlsx` autenticadas).
- **Páginas** (`frontend/src/pages/`): `DashboardPage`, `ColaboradoresListPage`,
  `ColaboradorProfilePage`, `LobsListPage`/`LobDetailPage`, `FormacoesPage`, `CandidatosPage`,
  `SkillMatrixPage`, `CatalogoPage` ("Gestão de Dados"), `AtribuicoesPage`, `AdminPage`,
  `ModeloDadosPage`, `ComoFuncionaPage`, `LoginPage`.

## 9. Import/Export (Gestão de Dados)

Módulo `catalogo` genérico: um registo estático (`catalogo.registry.ts`) descreve cada tabela
administrável (chave de URL, delegate Prisma, campos tipados, chave de identidade para upsert).
Um único controller cobre `GET/POST/PATCH/DELETE /catalogo/:tabela`, mais `/export` (gera `.xlsx`
via ExcelJS com texto associado aos IDs) e `/import` (`FileInterceptor`, upsert linha a linha,
devolve `{ criados, atualizados, erros[] }`). Eliminar um registo referenciado noutra tabela dá
erro explícito (`P2003` → 409) em vez de falhar silenciosamente — exceto `Colaborador`, cujas FKs
são todas `SetNull`/`Cascade` por pedido explícito (eliminar sempre permitido, referências ficam a
`null`).

## 10. Deployment

- Dois projetos Vercel independentes: backend (Node/serverless) e frontend (estático), cada um
  ligado por integração git ao `main` deste repositório — push para `main` dispara deploy
  automático.
- Variáveis de ambiente: `DATABASE_URL` (Postgres), `JWT_SECRET`, `FRONTEND_ORIGIN` (CORS) no
  backend; `VITE_API_URL` no frontend.
- Base de dados Postgres gerida externamente (não faz parte do Vercel); migrações Prisma
  (`prisma migrate deploy`) aplicadas manualmente/via script antes do deploy do backend.

## 11. Convenções de desenvolvimento

- `runAsUser` obrigatório em toda a escrita (nunca `prisma.<model>.create/update/delete` direto).
- DTOs `class-validator`, `ValidationPipe` global.
- Erros Prisma mapeados explicitamente: `P2002` (único) → `ConflictException`, `P2003` (FK) →
  `ConflictException` com mensagem amigável.
- Fluxo de validação antes de commit: `tsc --noEmit` (backend + frontend) → `jest` (backend) →
  smoke test via `curl` → verificação visual via Playwright → limpeza de dados de teste →
  `jest` novamente → commit + push.
