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

## 5. Frontend — React

- **Vite + React 18 + TypeScript**: arranque rápido, sem a complexidade de
  SSR que este caso de uso (app interna atrás de login, sem necessidade de
  SEO) não precisa — por isso Vite em vez de Next.js.
- **React Router v6**: rotas protegidas por papel.
- **TanStack Query**: cache/estado de dados do servidor (evita gerir
  loading/erro/refetch à mão em cada página).
- **Cliente API**: wrapper fino sobre `fetch`, injeta o JWT no header
  `Authorization: Bearer <token>`.
- **Estado de autenticação**: `AuthContext` guarda o JWT descodificado
  (role, colaboradorId) e o token; persistido em `localStorage` — trade-off
  igual ao do 4.1 (mais simples que cookies `httpOnly`, mas suscetível a
  XSS; aceitável para uma ferramenta interna, a revisitar se o risco
  justificar).

```
frontend/src/
├── main.tsx
├── App.tsx                    # define as rotas
├── api/
│   └── client.ts               # wrapper fetch + injeção do JWT
├── auth/
│   ├── AuthContext.tsx
│   ├── ProtectedRoute.tsx      # bloqueia por autenticação e/ou papel
│   └── useAuth.ts
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx       # placeholder — próximo passo: gráfico de gap
│   └── ColaboradoresPage.tsx   # placeholder — lista via API
└── types/
    └── api.ts                  # tipos partilhados com os DTOs do backend
```

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

1. Implementar os módulos de catálogo (`cargos`, `competencias`,
   `certificacoes`, `formacoes`, `lobs`) seguindo o padrão de
   `colaboradores/`.
2. Persistir snapshots do motor de gap: `POST /gap-analysis/runs` que
   grava `gap_analysis_runs` / `gap_analysis_lob_results` /
   `gap_analysis_cargo_results`, reutilizando `gap-analysis.logic.ts` — as
   tabelas já existem, só falta o endpoint de escrita (os dois endpoints
   atuais são só leitura/cálculo em tempo real).
3. Testes automatizados: o backend já tem Jest (24 testes na lógica pura
   do motor de gap); faltam testes ao `gap-analysis.service.ts` e
   `colaboradores.service.ts` com Prisma mockado, e testes e2e HTTP contra
   uma BD de teste. Frontend continua sem testes (Vitest + Testing
   Library).
4. Refresh token + revogação (ver 4.1) antes de sair de piloto interno.
5. CI/CD (GitHub Actions) depois de existirem testes a correr.
