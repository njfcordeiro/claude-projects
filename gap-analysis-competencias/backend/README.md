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
