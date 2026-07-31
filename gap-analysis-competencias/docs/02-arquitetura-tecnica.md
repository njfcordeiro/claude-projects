# Arquitetura técnica — Gap Analysis de Competências

Consequência direta de [`01-modelo-dados.md`](01-modelo-dados.md) (schema
já implementado em `../backend/`). Este documento cobre a stack completa:
backend, autenticação/autorização, frontend, execução local e deploy.

## 1. Visão geral

```
┌─────────────────┐        HTTPS/JSON        ┌──────────────────────┐        SQL         ┌──────────────┐
│   Frontend       │ ───────────────────────▶ │   Backend             │ ──────────────────▶ │  PostgreSQL   │
│   React + Vite    │ ◀─────────────────────── │   NestJS + Prisma      │ ◀────────────────── │               │
│   (SPA)           │      JWT no header        │   (API REST)          │                     │               │
└─────────────────┘                           └──────────────────────┘                     └──────────────┘
```

Monorepo simples (sem workspaces partilhados por agora — dois projetos
Node independentes, mais direto para uma equipa pequena a arrancar):

```
gap-analysis-competencias/
├── docs/                     # este documento + modelo de dados
├── backend/                  # NestJS + Prisma (API REST)
├── frontend/                 # React + Vite (SPA)
└── docker-compose.yml        # Postgres + backend + frontend para dev local
```

## 2. Backend — NestJS + TypeScript + Prisma

Já era a recomendação da secção 6 de `01-modelo-dados.md`; mantém-se, e o
schema Prisma já existe em `backend/prisma/schema.prisma`.

**Porquê NestJS e não Express simples ou FastAPI**: o domínio tem ~20
entidades interligadas e quatro papéis de acesso distintos — a estrutura
por módulos do Nest (controller/service/module por entidade), os Guards
para RBAC, e a integração nativa com Prisma e `class-validator` poupam
bastante boilerplate repetitivo face a Express cru, sem o custo de operar
dois runtimes (Node + Python) que a alternativa FastAPI implicaria, já que
o script de importação e o schema já estão em TypeScript/Prisma.

### Estrutura de módulos

```
backend/src/
├── main.ts                   # bootstrap, CORS, Swagger, ValidationPipe global
├── app.module.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts     # extende PrismaClient; injeta app.current_user_id
│                              # por pedido (ver secção 4.4 e doc de auditoria)
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts    # POST /auth/login, GET /auth/me
│   ├── auth.service.ts       # valida credenciais, emite JWT
│   ├── jwt.strategy.ts       # passport-jwt
│   ├── roles.guard.ts        # @Roles(...) — RBAC grosseiro
│   ├── roles.decorator.ts
│   └── current-user.decorator.ts
├── colaboradores/
│   ├── colaboradores.module.ts
│   ├── colaboradores.controller.ts
│   └── colaboradores.service.ts   # RBAC fino: gestor só vê a sua equipa
├── gap-analysis/                  # motor de comparação (Prompt 3)
│   ├── gap-analysis.module.ts
│   ├── gap-analysis.controller.ts
│   ├── gap-analysis.service.ts    # busca dados via Prisma, chama a lógica pura
│   ├── gap-analysis.logic.ts      # funções puras — fórmula da secção 2,
│   │                              # sem Prisma/Nest, testadas exaustivamente
│   ├── gap-analysis.logic.spec.ts # 24 testes Jest
│   └── gap-analysis.types.ts
└── cargos/ competencias/ certificacoes/ formacoes/ lobs/
    └── ...                   # módulos de catálogo (CRUD ADMIN_RH,
                               # leitura para os restantes papéis) — por
                               # implementar; estrutura já preparada
```

Esta entrega inclui `auth/`, `prisma/`, `colaboradores/` e `gap-analysis/`
funcionais; os módulos de catálogo (`cargos/`, `competencias/`, etc.)
ficam com o mesmo padrão a replicar (ver secção 8, próximos passos).

### O motor de comparação (`gap-analysis/`)

Implementa literalmente a fórmula da secção 2 de `01-modelo-dados.md`:
dado um colaborador e uma LOB, compara competências (por nível, sem
crédito parcial) e certificações obrigatórias (com verificação de
validade) contra o que o colaborador possui. Dividido em duas camadas:

- **`gap-analysis.logic.ts`** — funções puras (`calcularGapLob`,
  `ordenarFormacoes`, `ordenarCertificacoes`), sem nenhuma dependência de
  Prisma ou NestJS. É aqui que vive toda a regra de negócio, e é o que
  está exaustivamente coberto por testes (24 casos, incluindo os
  cantos mais importantes: obrigatório em falta bloqueia mesmo com
  pontos suficientes, certificação expirada não conta, prontidão capada
  a 100%).
- **`gap-analysis.service.ts`** — busca os dados reais (requisitos da
  LOB, nível atual do colaborador via a view
  `colaborador_competencia_atual`, certificações do colaborador) e
  entrega-os à camada pura. Reutiliza
  `ColaboradoresService.obterComVerificacaoDeAcesso` para o mesmo RBAC
  fino já usado em `/colaboradores/:id` — um gestor só vê a sua equipa, um
  colaborador só se vê a si.

Dois endpoints:

- `GET /gap-analysis/colaboradores/:colaboradorId/lobs/:lobId` —
  relatório completo para uma LOB: por competência e por certificação,
  nível/validade atual vs. exigido, se está cumprido, e (só para os não
  cumpridos) sugestões ordenadas de formações/certificações do catálogo
  que fecham essa lacuna. Pontuação total, `prontidaoPercentual` e
  `atingido`.
- `GET /gap-analysis/colaboradores/:colaboradorId/cargo` — resumo por
  cargo: corre a mesma avaliação contra todas as LOBs do catálogo (não há
  uma lista fixa de LOBs por cargo — `cargos.lobs_exigidos` é só uma
  contagem, ver `01-modelo-dados.md` secção 6.8) e compara quantas foram
  atingidas com o que o cargo exige.

**Sugestões, "relevância" e "duração"**: para cada competência em falta,
`ordenarFormacoes`/`ordenarCertificacoes` ordenam os candidatos do
catálogo assim: primeiro os que fecham a lacuna (nível oferecido ≥
exigido) antes dos que não fecham; entre os que fecham, o mais próximo do
necessário primeiro (não sugerir uma formação de nível 5 para uma lacuna
de nível 2 se houver uma de nível 2); entre os que não fecham, o de maior
progresso primeiro; desempate por duração mais curta (só formações — as
certificações não têm duração no catálogo, desempatam por nome). Um
candidato que representa um nível igual ou inferior ao que o colaborador
já tem é filtrado (não é uma sugestão útil). Para uma certificação em
falta, como o requisito é a própria certificação (não há "alternativas"),
o relatório sugere antes as competências que essa certificação valida
(via `certificacao_requisito_competencia`) com as suas próprias formações
recomendadas — uma "preparação indireta" fundamentada no catálogo real,
não inventada.

**Por fazer (fora do âmbito desta entrega)**: persistir snapshots em
`gap_analysis_runs`/`gap_analysis_lob_results`/`gap_analysis_cargo_results`
(as tabelas já existem no schema desde o Prompt 1, pensadas exatamente
para isto) — os dois endpoints atuais calculam sempre em tempo real, sem
gravar histórico. Ver secção 8.

### Validação e documentação da API

- `class-validator` + `class-transformer` nos DTOs de entrada, com
  `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` global
  — rejeita campos não esperados em vez de os ignorar silenciosamente.
- `@nestjs/swagger` gera `/api/docs` automaticamente a partir dos
  decorators — documentação sempre sincronizada com o código, sem ficheiro
  OpenAPI mantido à mão.

## 3. Base de dados — PostgreSQL

Já decidido e implementado (`01-modelo-dados.md` secção 6,
`backend/prisma/`). Sem alterações aqui — só uma nota operacional:

- **Pool de ligações**: o Prisma Client mantém o seu próprio pool; em
  produção com múltiplas instâncias do backend (ver secção 6), usar
  PgBouncer (ou o pooler do serviço gerido, ex. Neon/Supabase/RDS Proxy)
  para não esgotar `max_connections` do Postgres.

## 4. Autenticação e autorização

### 4.1 Autenticação

- **Login por email/password**: `POST /auth/login`. Password com hash
  `bcrypt` (custo 12) em `users.password_hash` — nunca texto simples,
  nunca reversível.
- **JWT de acesso**: assinado com `JWT_SECRET` (só no backend), validade
  curta (8h — suficiente para um dia de trabalho numa app interna; força
  novo login no dia seguinte). Payload: `{ sub: userId, colaboradorId,
  role }`.
- **Sem self-registo**: contas são criadas por um ADMIN_RH (endpoint
  restrito) ou por seed inicial — isto é uma ferramenta interna de RH, não
  um produto com signup público.
- **Trade-off documentado, não implementado nesta entrega**: um JWT único
  de 8h em vez de access+refresh token com rotação é mais simples de
  arrancar, mas um token roubado fica válido até expirar (sem revogação
  imediata). Para lá de um piloto interno, migrar para refresh token em
  cookie `httpOnly` + `secure` + rotação, e/ou lista de revogação em Redis,
  é o passo natural — fica registado aqui como dívida técnica intencional,
  não esquecimento.

### 4.2 Autorização — os 4 papéis (`users.role`, já no schema)

| Papel | Acesso |
|---|---|
| `ADMIN_RH` | Total: CRUD em todos os catálogos (cargos, competências, LOBs, certificações, formações), gestão de colaboradores e utilizadores, corre gap analysis para qualquer âmbito. |
| `MANAGER` | Leitura/avaliação da sua equipa direta (`colaboradores.manager_id = <colaborador do utilizador>`); vê o próprio gap e o da equipa; sem acesso de escrita aos catálogos. |
| `EMPLOYEE` | Lê e regista autoavaliação das suas próprias competências (`colaborador_competencia` com `origem=SELF`); vê o seu próprio gap; sem acesso a dados de outros colaboradores. |
| `VIEWER` | Leitura agregada alargada (reporting/BI), sem acesso a dados nominais de detalhe nem escrita — pensado para leadership sem necessidade de ver avaliações individuais. |

### 4.3 Implementação

Dois níveis, porque RBAC "só por papel" não chega aqui (um `MANAGER` pode
editar a sua equipa mas não a equipa de outro `MANAGER`):

1. **Grosseiro — `RolesGuard` + `@Roles(...)`**: bloqueia à entrada do
   controller quem nem sequer tem o papel certo (ex.: só `ADMIN_RH` pode
   `POST /cargos`).
2. **Fino — verificação no service**: para endpoints onde o mesmo papel
   pode ou não aceder consoante a linha (ex.: `GET /colaboradores/:id` —
   um `MANAGER` só pode ver `:id` se for gestor direto desse colaborador;
   um `EMPLOYEE` só pode ver o seu próprio `id`). Implementado como
   verificação explícita no service, não escondido num guard genérico —
   mais fácil de ler a regra de negócio real por endpoint.

Este padrão está implementado em `colaboradores.service.ts` nesta entrega
e replica-se nos módulos seguintes.

### 4.4 Autorização e o `audit_log`

O trigger de auditoria genérico (`01-modelo-dados.md` secção 5.3) só
preenche `audit_log.changed_by` se a transação Postgres tiver a GUC de
sessão `app.current_user_id` definida. O `PrismaService` (middleware do
Nest, `PrismaInterceptor`) faz `SELECT set_config('app.current_user_id',
$1, true)` no início de cada pedido autenticado, usando o `userId` do JWT
— assim toda a escrita feita através da API fica automaticamente atribuída
a quem a fez, sem cada service ter de se lembrar de o fazer.

### 4.5 Concorrência multi-utilizador (Prompt 5)

Vários utilizadores (ex.: um `MANAGER` e um `ADMIN_RH`) podem abrir a ficha
do mesmo colaborador ao mesmo tempo. Sem proteção, "o último a gravar
ganha" apagaria silenciosamente a alteração de quem gravou primeiro. Duas
tabelas passam a ser editáveis pela API nesta entrega
(`colaboradores`, `colaborador_certificacao`) mais uma terceira que já era
escrita mas em modo append-only (`colaborador_competencia`) — cada uma
precisa de uma estratégia diferente, porque não têm o mesmo padrão de
escrita:

**a) Tabelas com UPDATE — locking otimista por coluna `version`**

`colaboradores` e `colaborador_certificacao` ganharam uma coluna
`version` (`Int`, default `0`). O cliente tem de enviar de volta a
`version` que leu; a escrita é um `UPDATE ... WHERE id = $1 AND version =
$2 SET ..., version = version + 1` (via `updateMany` do Prisma, que
devolve uma contagem de linhas afetadas em vez de rebentar):

```ts
const resultado = await tx.colaborador.updateMany({
  where: { id, version },
  data: { ...alteracoes, version: { increment: 1 } },
});
if (resultado.count === 0) {
  // outra escrita já mudou a version entretanto — vai buscar o estado
  // atual e devolve 409 com ele, para o cliente decidir o que fazer
}
```

Se `count === 0`, ninguém apagou nada — a condição `WHERE version = $2`
simplesmente não encontrou a linha porque outra transação já a mudou
primeiro (committada antes desta). Nesse caso o service busca o estado
atual e responde `409 Conflict` com `{ message, current }`, nunca faz
merge automático nem escolhe "quem ganha" — essa decisão fica para quem
está a editar (ver frontend, secção 5).

**b) Tabela append-only — conflito por `baseAssessmentId` + advisory lock**

`colaborador_competencia` nunca é alterada por `UPDATE`/`DELETE` (histórico
completo de avaliações; o "nível atual" é sempre a linha mais recente,
resolvida pela view `colaborador_competencia_atual` — ver
`01-modelo-dados.md`). Não há coluna `version` para bloquear porque não há
UPDATE nenhum a fazer. Em vez disso, o cliente envia `baseAssessmentId`: o
`id` da última avaliação que viu (ou `null`, se nunca houve nenhuma). O
service compara esse id com o que está de facto na view no momento do
INSERT, dentro da mesma transação:

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avaliacao:${colaboradorId}:${competenciaId}`}))`;
const atual = (await tx.$queryRaw`SELECT id, ... FROM colaborador_competencia_atual WHERE ...`)[0] ?? null;
if ((atual?.id ?? null) !== (dto.baseAssessmentId ?? null)) {
  throw new ConflictException({ message: ..., current: atual });
}
// só agora faz o INSERT
```

O `pg_advisory_xact_lock` é necessário por uma razão subtil: um simples
"SELECT para ver se já existe avaliação, depois INSERT" tem uma janela de
corrida real quando a resposta ao SELECT é "não existe nada ainda" — duas
transações concorrentes em READ COMMITTED podem **ambas** ver "não existe"
e ambas inserir, porque não há nenhuma linha existente para um `UPDATE ...
WHERE` bloquear (ao contrário do caso (a)). Isto foi apanhado a testar
(secção seguinte), não adivinhado: sem o lock, duas primeiras-avaliações
concorrentes para a mesma competência resultavam em dois `201`, quando só
um devia passar e o outro devia ver `409`. O advisory lock é
transacional (`_xact_`) — chave por `(colaboradorId, competenciaId)` via
`hashtext(...)`, `pg_advisory_xact_lock` bloqueia a segunda transação até
a primeira committar (ou fazer rollback), momento em que o `SELECT`
seguinte já vê a linha inserida pela primeira e o conflito é detetado
corretamente. Libertado automaticamente no fim da transação, sem unlock
manual.

**c) RBAC de escrita — `podeEditar`**

As mesmas regras de leitura fina (secção 4.3) aplicam-se à escrita:
`ADMIN_RH` edita qualquer colaborador; `MANAGER` só o colaborador cuja
`manager_id` seja o seu próprio `colaboradorId`; `EMPLOYEE`/`VIEWER` não
podem escrever avaliações/certificações de terceiros (fica fora do âmbito
desta entrega dar ao `EMPLOYEE` autoavaliação via API, embora o schema já
suporte `origem = SELF` — ver secção 8). Verificado em
`ColaboradoresService.podeEditar(id, user)`, chamado no início de todos os
métodos de escrita antes de qualquer lógica de locking.

**d) Endpoints novos**

```bash
PATCH /colaboradores/:id                                          # requer `version` no body
POST  /colaboradores/:id/competencias                             # requer `baseAssessmentId` (ou null)
PUT   /colaboradores/:id/certificacoes/:certificacaoId             # requer `version` (upsert: cria se não existir)
GET   /colaboradores/:id/competencias/:competenciaId/ultima-avaliacao   # "peek" — estado atual antes de editar
GET   /colaboradores/:id/certificacoes/:certificacaoId                 # idem, para certificação
```

Os dois endpoints `GET ".../ultima-avaliacao"` e `GET ".../certificacoes/:id"`
existem só para o frontend ler o estado mais recente **no momento em que
o formulário de edição abre** — nunca reaproveitar dados já em cache
(vindos do relatório de gap analysis, por exemplo) como base do
`version`/`baseAssessmentId`, porque isso alargaria a janela entre "o que
eu vi" e "o que vou gravar por cima", tornando conflitos reais mais
prováveis de passar despercebidos.

**e) Testado**: `backend/scripts/test-concurrency.mjs` (`npm run
test:concurrency`) — script idempotente e auto-seeding, ver
`backend/README.md`, secção "Concorrência".

## 5. Frontend — React

- **Vite + React 18 + TypeScript**: arranque rápido, sem a complexidade de
  SSR que este caso de uso (app interna atrás de login, sem necessidade de
  SEO) não precisa — por isso Vite em vez de Next.js.
- **React Router v7**: rotas protegidas por papel (`ProtectedRoute` aceita
  `allowedRoles`, espelhando o `@Roles(...)` do backend rota a rota).
- **TanStack Query**: cache/estado de dados do servidor (evita gerir
  loading/erro/refetch à mão em cada página).
- **Cliente API**: wrapper fino sobre `fetch` (`api/client.ts`), injeta o
  JWT no header `Authorization: Bearer <token>`; `api/endpoints.ts`
  centraliza os caminhos tipados de cada chamada.
- **Estado de autenticação**: `AuthContext` guarda o JWT descodificado
  (role, colaboradorId) e o token; persistido em `localStorage` — trade-off
  igual ao do 4.1 (mais simples que cookies `httpOnly`, mas suscetível a
  XSS; aceitável para uma ferramenta interna, a revisitar se o risco
  justificar).

### Visual — Fiori-like (Prompt 4)

**Decisão**: Tailwind CSS com tokens inspirados no SAP Fiori Design System
(tema Horizon), em vez de importar `@ui5/webcomponents-react` (os
componentes Fiori oficiais). Uma biblioteca de componentes SAP real dá
fidelidade visual maior, mas é uma integração muito mais pesada (API
própria, bundle maior, curva de aprendizagge) para validar bem numa
única entrega — o utilizador aceitou explicitamente esta alternativa
("Fiori-like com Tailwind"). Fica documentado como opção a reconsiderar
se a fidelidade visual ao Fiori real se tornar um requisito rígido.

- **Paleta** (`tailwind.config.js`, prefixo `fiori-`): shell bar azul-marinho
  escuro (`#354A5F`), azul de marca `#0070F2`, fundo de página `#F5F6F7`,
  cores de estado reservadas (sucesso `#107E3E`, aviso `#E76500`, erro
  `#BB0000`) — valores documentados como aproximação ao tema Horizon do
  Fiori, não um pacote oficial redistribuído.
- **Tipografia**: pilha `"72", "72full", Arial, "Segoe UI", sans-serif`.
  "72" é a fonte proprietária da SAP — sem licença/CDN público para a
  distribuir aqui, por isso fica declarada primeiro (cai em Arial/Segoe UI
  na prática, exatamente o fallback pedido).
- **Cores de gráfico**: validadas com a skill de dataviz
  (`scripts/validate_palette.js`) antes de escrever qualquer componente —
  o gráfico do dashboard usa um único tom de magnitude (azul de marca),
  não uma paleta categórica, porque compara UMA métrica (prontidão média)
  entre grupos; as cores de estado (sucesso/aviso/erro) usadas nos
  `Badge`/barras "em risco" vêm sempre com ícone + texto, nunca só cor —
  o validador confirmou que essas cores falham o teste de adjacência
  categórica sozinhas (como esperado — não se destinam a esse uso).

```
frontend/src/
├── main.tsx
├── App.tsx                       # rotas
├── AppLayout.tsx                 # ShellBar + SideNav + <Outlet/>
├── api/
│   ├── client.ts                  # wrapper fetch + injeção do JWT
│   └── endpoints.ts                # chamadas tipadas por endpoint
├── auth/
│   ├── AuthContext.tsx
│   ├── ProtectedRoute.tsx          # bloqueia por autenticação e/ou papel
│   └── useAuth.ts
├── components/
│   ├── layout/ShellBar.tsx         # cabeçalho: logo, pesquisa global, perfil
│   ├── layout/SideNav.tsx          # menu lateral, itens filtrados por papel
│   ├── ui/                         # Card, Badge, Tag, DataTable, Modal,
│   │                                # ProgressRing, KpiTile, ReadinessBarChart, form.tsx
│   └── gap/                        # NivelPill, SugestoesLista, LobGapDetail
│                                    # (partilhados entre ficha do colaborador
│                                    # e o detalhe de LOB)
├── pages/                          # os 5 ecrãs — ver lista abaixo
└── types/api.ts                    # tipos espelhando os DTOs do backend
```

### Os 5 ecrãs

1. **Dashboard** (`/`) — `gap-analysis/dashboard`: KPIs, gráfico de
   prontidão média por direção, tabela de colaboradores. ADMIN_RH/VIEWER
   veem a organização; MANAGER só a sua equipa direta (o backend já filtra
   — o frontend não recebe dados que não devia ver).
2. **Ficha do colaborador** (`/colaboradores/:id`) — anel de prontidão para
   o cargo, lista de LOBs, e ao selecionar uma, o detalhe completo
   (competências por nível atual/exigido, certificações com validade, e
   sugestões de formação/certificação para cada lacuna — reutiliza
   `gap-analysis.service.ts` sem alterações). **Prompt 5**: `ADMIN_RH` e
   `MANAGER` (só na sua equipa) veem um ícone de lápis por competência/
   certificação, que abre `AvaliarCompetenciaModal`/`EditarCertificacaoModal`
   — ambos leem sempre o estado atual do servidor ao abrir (nunca
   reaproveitam o relatório em cache) e, se o backend devolver `409` porque
   outra pessoa gravou entretanto, mostram o valor atual do servidor com um
   botão "Atualizar e tentar novamente" em vez de sobrescrever às cegas ou
   falhar silenciosamente (ver `docs/02-arquitetura-tecnica.md` secção
   4.5). Ao gravar com sucesso, invalidam as queries do relatório de gap
   (`gap-lob`, `gap-cargo`) para refletir o novo estado sem refresh manual.
3. **Gestão de LOBs** (`/lobs`, `/lobs/:id`) — lista e detalhe dos
   requisitos de competência/certificação de cada LOB. Só leitura nesta
   entrega (ver secção 8).
4. **Catálogo de formações** (`/formacoes`) — nome, área, duração,
   competências desenvolvidas.
5. **Administração** (`/admin`, só ADMIN_RH) — lista de utilizadores,
   mudança de papel inline, ativar/desativar, criar utilizador (modal).

Screenshots capturados durante a validação (não commitados, só para
conferência nesta sessão) confirmaram visualmente o layout em todos os 5
ecrãs antes de dar a entrega como concluída.

## 6. Execução local

`docker-compose.yml` na raiz do projeto (`gap-analysis-competencias/`):
três serviços — `db` (Postgres 16), `backend` (Nest em modo watch, monta
`backend/src` como volume), `frontend` (Vite dev server, monta
`frontend/src` como volume). Um único comando arranca tudo:

```bash
docker compose up
```

- Frontend em `http://localhost:5173`
- Backend em `http://localhost:3000` (Swagger em `/api/docs`)
- Postgres em `localhost:5432` (só acessível dentro da rede Docker por
  omissão, exposto para debugging local)

Sem Docker (desenvolvimento direto na máquina): Postgres local ou remoto +
`npm run start:dev` no backend + `npm run dev` no frontend — instruções
completas em `backend/README.md` e `frontend/README.md`.

> **Nota de validação**: o ambiente onde esta entrega foi construída não
> tem acesso a um daemon Docker, por isso `docker-compose.yml` e os dois
> `Dockerfile` foram escritos e revistos com cuidado mas **não foram
> executados**. Tudo o resto (backend, frontend, fluxo de login/RBAC,
> trigger de auditoria) foi validado a correr diretamente (Postgres local
> + `node`/`npm`, sem Docker) — ver `backend/README.md` e
> `frontend/README.md`. Corre `docker compose up` uma vez antes de
> confiares nisto para desenvolvimento em equipa ou CI.

## 7. Deploy

Dados de RH (nomes, datas de admissão, certificações) são dados pessoais —
para uma organização em Portugal/UE isto tem implicações de RGPD
(localização dos dados, minimização, direito de acesso/apagamento).
Recomendação abaixo já considera isso.

**Recomendação**: containers para backend e frontend (Dockerfiles já
preparados nesta entrega), Postgres gerido, tudo em região UE.

- **Backend + Postgres → Railway** (ou Render como alternativa
  equivalente): plataforma única, deploy direto do `Dockerfile`, Postgres
  gerido com backups automáticos, escolha de região UE (`europe-west4`),
  variáveis de ambiente geridas na plataforma. Simples de operar para uma
  equipa pequena sem SRE dedicado.
- **Frontend → Vercel ou Netlify**: build estático do Vite, deploy por
  push a `main`/PR previews automáticos. CORS habilitado no backend para o
  domínio do frontend.

**Alternativa** (mais controlo, mais esforço operacional): tudo em
containers Docker numa única VM (ou Kubernetes se já houver essa
capacidade instalada na organização) — justifica-se se houver requisito
de dados não saírem de infraestrutura própria/VPC da empresa, algo comum
em RH consoante a política interna de dados. Vale a pena confirmar isto
antes de escolher definitivamente a opção gerida acima.

**CI/CD**: fora do âmbito desta entrega — GitHub Actions (lint + testes +
`prisma migrate deploy` + build de imagens) é o próximo passo natural
quando houver testes automatizados a correr (ver secção 7 de próximos
passos abaixo).

## 8. Próximos passos

1. **CRUD de catálogo**: `lobs/` e `formacoes/` só têm leitura (GET) nesta
   entrega — dá para "gerir" no sentido de consultar requisitos, mas
   criar/editar LOBs, requisitos ou formações ainda não tem endpoint nem
   UI. `cargos/`, `competencias/`, `certificacoes/` continuam sem módulo
   dedicado (têm dados, mas só acessíveis indiretamente via `/lobs`).
2. Persistir snapshots do motor de gap: `POST /gap-analysis/runs` que
   grava `gap_analysis_runs` / `gap_analysis_lob_results` /
   `gap_analysis_cargo_results`, reutilizando `gap-analysis.logic.ts` — as
   tabelas já existem, só falta o endpoint de escrita (os endpoints atuais
   são só leitura/cálculo em tempo real, incluindo o dashboard — recalcula
   a organização inteira a cada pedido, aceitável para o tamanho de dados
   atual mas vale a pena rever se crescer muito).
3. Testes automatizados: o backend tem Jest (24 testes na lógica pura do
   motor de gap); faltam testes aos services com Prisma mockado e testes
   e2e HTTP contra uma BD de teste. Frontend continua sem testes (Vitest +
   Testing Library) — a validação desta entrega foi manual, via Playwright
   contra os servidores reais, não testes automatizados no repositório.
4. Refresh token + revogação (ver 4.1) antes de sair de piloto interno.
5. CI/CD (GitHub Actions) depois de existirem testes a correr.
6. Fidelidade visual: se o "Fiori-like com Tailwind" da secção 5 não for
   suficiente, `@ui5/webcomponents-react` (componentes Fiori oficiais) é o
   caminho para fidelidade real — troca maior do que a feita aqui, por
   isso não foi o ponto de partida.
