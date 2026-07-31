# Backend — Gap Analysis de Competências

Schema Prisma/PostgreSQL e script de importação do Excel de origem,
implementando o modelo documentado em
[`../docs/01-modelo-dados.md`](../docs/01-modelo-dados.md).

## Setup

```bash
npm install
cp .env.example .env   # ajusta DATABASE_URL e EXCEL_SOURCE_PATH
npx prisma migrate deploy   # aplica as migrações a uma BD Postgres vazia
```

Requer PostgreSQL 14+. `DATABASE_URL` segue o formato standard do Prisma:
`postgresql://user:password@host:5432/database?schema=public`.

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
