# Backend — Gap Analysis de Competências

API NestJS + schema Prisma/PostgreSQL, implementando o modelo documentado
em [`../docs/01-modelo-dados.md`](../docs/01-modelo-dados.md) e a
arquitetura descrita em
[`../docs/02-arquitetura-tecnica.md`](../docs/02-arquitetura-tecnica.md).

## Setup

```bash
npm install
cp .env.example .env   # ajusta DATABASE_URL, JWT_SECRET, etc.
npx prisma migrate deploy   # aplica as migrações a uma BD Postgres vazia
npm run seed:admin          # cria o primeiro utilizador ADMIN_RH (usa ADMIN_EMAIL/ADMIN_PASSWORD do .env)
npm run start:dev           # arranca a API em modo watch — http://localhost:3000
```

Requer PostgreSQL 14+ e Node 20+. `DATABASE_URL` segue o formato standard
do Prisma: `postgresql://user:password@host:5432/database?schema=public`.
Documentação interativa da API em `http://localhost:3000/api/docs`
(Swagger, gerado a partir dos decorators — ver `src/main.ts`).

## Testes

```bash
npm test          # Jest — atualmente cobre a lógica pura do motor de gap
npm run test:cov  # com relatório de cobertura
```

24 testes em `src/gap-analysis/gap-analysis.logic.spec.ts`, sem BD (a
lógica de negócio do motor de comparação é pura, sem Prisma/Nest — ver
`docs/02-arquitetura-tecnica.md` secção 2). Cobrem: nível exato/acima/
abaixo do exigido, competência nunca avaliada, certificação em falta,
sem validade (não expira), válida, e expirada; obrigatório em falta
bloqueia a LOB mesmo com pontos suficientes (competência e certificação);
prontidão capada a 100%; LOB sem requisitos; e toda a lógica de ordenação
de sugestões (cobre-a-lacuna vs. progresso parcial, desempate por
duração/nome).

## Estrutura

- `prisma/schema.prisma` — esquema relacional completo (corresponde 1:1 à
  secção 3 do documento de modelo de dados).
- `prisma/migrations/*/migration.sql` — migração inicial gerada pelo Prisma
  **mais** SQL manual adicionado no fim do ficheiro para o motor de
  auditoria (secção 5 do documento):
  - `audit_trigger_fn()` + triggers em `colaboradores`, `cargos`,
    `lob_requisito_competencia`, `lob_requisito_certificacao`,
    `certificacoes`, `users` — gravam old/new em JSONB em `audit_log` a
    cada INSERT/UPDATE/DELETE.
  - view `colaborador_competencia_atual` — resolve o "nível atual" de cada
    colaborador como a avaliação mais recente em `colaborador_competencia`
    (tabela append-only), sem depender de UPDATE.
- `scripts/import-excel.ts` — lê o Excel de origem e popula a BD via
  Prisma Client, pela ordem de dependências do esquema.
- `scripts/seed-admin.ts` — cria/atualiza o primeiro utilizador `ADMIN_RH`
  (não há self-registo nesta app).
- `src/` — API NestJS. Ver
  [`../docs/02-arquitetura-tecnica.md`](../docs/02-arquitetura-tecnica.md)
  secção 2 para a estrutura completa de módulos (implementados e
  planeados) e secção 4 para o desenho de autenticação/autorização.

## Autenticação e RBAC (implementado nesta entrega)

- `POST /auth/login` — email + password → JWT (8h). `GET /auth/me` —
  perfil do utilizador autenticado.
- `RolesGuard` + `@Roles(...)` — bloqueia por papel à entrada do
  controller (grosseiro). Ver `colaboradores.controller.ts`.
- Restrição fina (ex.: um `MANAGER` só vê a sua equipa direta, um
  `EMPLOYEE` só se vê a si) fica no service, não no guard — ver
  `colaboradores.service.ts` e a justificação na secção 4.3 do doc de
  arquitetura.
- `PrismaService.runAsUser(userId, fn)` — usar em toda a escrita que deve
  ficar atribuída ao utilizador autenticado no `audit_log` (ver secção
  seguinte). **Testado end-to-end**: login como ADMIN_RH → `PATCH
  /colaboradores/:id` → `audit_log.changed_by` fica corretamente
  preenchido com o id do utilizador.

## Motor de gap analysis (implementado nesta entrega)

Ver `docs/02-arquitetura-tecnica.md` secção 2 ("O motor de comparação")
para o desenho completo. Dois endpoints, RBAC igual ao de
`/colaboradores/:id`:

```bash
GET /gap-analysis/colaboradores/:colaboradorId/lobs/:lobId
GET /gap-analysis/colaboradores/:colaboradorId/cargo
```

**Testado end-to-end** contra Postgres local com um cenário construído à
mão (LOB com 2 requisitos de competência — um obrigatório, um não — e uma
certificação obrigatória, formações/certificações candidatas para
sugestão): confirmei manualmente pontuação, `atingido`, ordenação das
sugestões, o efeito de uma certificação expirada a bloquear a LOB mesmo
com as competências todas cumpridas, e o rollup por cargo (`lobsAtingidos`
a passar de 0 para 1 depois de completar os requisitos em falta).

## Catálogo, administração e dashboard (Prompt 4)

Adicionados para dar dados reais aos ecrãs do frontend — nada disto é
mock/hardcoded no lado do cliente:

```bash
GET  /lobs                 GET /lobs/:id            # autenticado, sem restrição de papel
GET  /formacoes             GET /formacoes/:id        # idem
GET  /users                 POST /users                # ADMIN_RH only
PATCH /users/:id                                       # ADMIN_RH only (role, isActive)
GET  /gap-analysis/dashboard                           # ADMIN_RH/VIEWER veem tudo, MANAGER só a equipa; EMPLOYEE sem acesso (403)
```

`gap-analysis/dashboard` agrega a organização inteira sem N+1: os níveis
de competência e certificações de todos os colaboradores em causa são
lidos em **1 query cada** (`ANY($1::int[])` / `IN (...)`, não uma por
colaborador), com os LOBs e cargos também pré-carregados uma única vez —
ver `buscarNiveisAtuaisEmLote`/`buscarCertificacoesEmLote` em
`gap-analysis.service.ts`.

**Testado end-to-end**: dashboard como ADMIN_RH (organização inteira,
agrupado por direção) e como MANAGER (só o subordinado direto), bloqueio
403 para EMPLOYEE, criação de utilizador + mudança de papel com
confirmação em `audit_log.changed_by`.

## Escrita concorrente e auditoria (Prompt 5)

Ver `docs/02-arquitetura-tecnica.md` secção 4.5 para o desenho completo
(locking otimista por `version`, `baseAssessmentId` para a tabela
append-only, advisory lock para a corrida na primeira avaliação). Resumo
dos endpoints novos:

```bash
PATCH /colaboradores/:id                                          # body inclui `version`
POST  /colaboradores/:id/competencias                             # body inclui `baseAssessmentId`
PUT   /colaboradores/:id/certificacoes/:certificacaoId             # body inclui `version`; cria ou atualiza
GET   /colaboradores/:id/competencias/:competenciaId/ultima-avaliacao
GET   /colaboradores/:id/certificacoes/:certificacaoId
```

Todos passam por `ColaboradoresService.podeEditar` (mesma regra de
`ADMIN_RH`/`MANAGER` da leitura fina, secção 4.3 do doc de arquitetura) e
por `PrismaService.runAsUser`, pelo que ficam atribuídos em
`audit_log.changed_by`. Duas novas migrações cobrem isto:
`add_optimistic_locking_version` (coluna `version` em `colaboradores` e
`colaborador_certificacao`) e
`audit_trigger_colaborador_competencia_certificacao` (trigger de auditoria
nas duas tabelas — `colaborador_certificacao` com CRUD completo,
`colaborador_competencia` só `INSERT`, por ser append-only).

**Testado**: dois scripts, propósitos diferentes.

- `npm run test:concurrency` (`scripts/test-concurrency.mjs`) — script
  idempotente e auto-seeding (cria/reutiliza colaboradores/competência/
  certificação de teste com ids `900001+`; aceita `--reset`). Dispara
  pedidos verdadeiramente concorrentes via `Promise.all` contra a API real
  a correr localmente e confirma: (1) duas escritas simultâneas à mesma
  certificação → exatamente um `200` e um `409`; (2) duas primeiras
  avaliações simultâneas da mesma competência → exatamente um `201` e um
  `409` (este teste apanhou a corrida real do advisory lock, secção 4.5b —
  sem o lock, os dois pedidos passavam); (3) duas escritas simultâneas ao
  mesmo colaborador → um `200`/um `409`; (4) `MANAGER` bloqueado (`403`) a
  editar um colaborador fora da sua equipa. Corrido 3× seguidas sem
  falhas.
- Validação de UI (Playwright, não commitado): fluxo completo num browser
  real — abrir a ficha, avaliar uma competência, editar uma certificação,
  e um cenário de conflito determinístico (abre o modal, injeta uma
  escrita concorrente diretamente via API a simular "outra pessoa",
  submete pelo formulário já aberto e confirma que a UI mostra o aviso de
  conflito com o valor do servidor em vez de rebentar ou sobrescrever;
  confirma também que "Atualizar e tentar novamente" recarrega o estado e
  permite gravar a seguir). Zero erros de consola.

### Dependência conhecida (não resolvida nesta entrega)

`npm audit` acusa vulnerabilidades moderadas/altas (DoS) em `multer`/`qs`,
transitivas de `@nestjs/platform-express@10`. A correção exige subir para
`@nestjs/platform-express@11` (breaking change, não validado nesta
entrega). Não há endpoints de upload de ficheiros nesta versão, o que
reduz a exposição prática; ainda assim, planear a migração para Nest 11
antes de expor a API fora de uma rede interna/VPN. (A vulnerabilidade
crítica original, via `bcrypt`→`node-gyp`→`tar`, já foi eliminada trocando
`bcrypt` nativo por `bcryptjs`, puro JS.)

## `audit_log.changed_by`

Os triggers só preenchem `changed_by` se a aplicação definir, na mesma
transação, a variável de sessão do Postgres `app.current_user_id`:

```sql
SELECT set_config('app.current_user_id', '42', true);
```

Sem isso (ex.: scripts administrativos, importação inicial), o valor fica
`NULL` — auditável na mesma (sabemos que existiu a alteração e o que
mudou), só não sabemos automaticamente "quem" sem essa configuração
explícita por pedido autenticado.

## Importação do Excel

```bash
EXCEL_SOURCE_PATH=/caminho/para/Tabelas_criação_programa.xlsx npm run import:excel
```

**O ficheiro Excel nunca deve ser commitado neste repositório** — contém
dados pessoais de colaboradores (nomes, datas de admissão, certificações).
Passa sempre o caminho por variável de ambiente.

O script corre em fases, pela ordem de dependências de FK: organização →
carreiras/categorias/cargos → níveis → competências → certificações →
formações → LOBs → colaboradores → avaliações/certificações/recomendações
dos colaboradores. É idempotente para as tabelas de catálogo (usa
`upsert`); as tabelas de histórico/bridge (`colaborador_competencia`,
`cargo_progressao`, requisitos de LOB/certificação/formação) são limpas e
reinseridas a cada corrida — corre num ambiente de teste, não diretamente
em produção com dados já editados pela app.

### Decisões tomadas ao escrever o script

1. **Fórmulas do Excel**: este workbook usa Tabelas do Excel com colunas
   derivadas por fórmula (ex.: `ID Cargo` = concatenação Carreira+
   Categoria; a maioria dos nomes são `VLOOKUP` a partir do ID). O
   `exceljs` devolve essas células como `{ formula, result }`, não como o
   valor simples — o script desembrulha isto centralmente em
   `resolveValue()`. Sem isto, os IDs derivados por fórmula (ex.
   `ID Cargo`) seriam gravados como texto inútil.
2. **`colaborador_competencia.origem`**: a folha `Colaboradores&Competências`
   só guarda o nível atual, sem data nem avaliador. Em vez de inventar uma
   origem (`self`/`manager`/`formal`), o script usa um valor novo,
   `IMPORTADO_EXCEL`, e `data_avaliacao` = data da importação. Isto é uma
   pequena adição ao enum `OrigemAvaliacao` face à v5 do documento — ver
   comentário no `schema.prisma`.

### Corrigido na origem (v7 do Excel)

3. ~~`Certificações`, colunas A/B vs D/E desalinhadas~~ — **resolvido**.
   As duas cópias da lista de certificações ficaram idênticas em 100% das
   47 linhas. O script continua a usar a coluna A por robustez, mas já não
   há divergência com a coluna D.
4. ~~`LOBS`, requisitos de competência incompletos~~ — **resolvido**. As
   105 linhas de requisito competência↔LOB têm agora todas `Pontos`/
   `Nível` preenchidos (eram só 26 de 105). O motor de pontuação (secção 2
   do documento) já é calculável para todas as LOBs.
