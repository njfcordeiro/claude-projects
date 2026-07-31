# Gap Analysis de Competências

Aplicação para RH analisar o desvio (gap) entre as competências/certificações
exigidas por cada função e as competências reais dos colaboradores.

## Estado atual

Modelo de dados especificado e validado contra o Excel de origem, e já
implementado como schema Prisma/PostgreSQL com migração testada e script
de importação. Ver:

- [`docs/01-modelo-dados.md`](docs/01-modelo-dados.md) — esquema
  relacional + ERD, lógica de pontuação por LOB, plano de
  auditoria/histórico, problemas de qualidade de dados encontrados no
  Excel.
- [`backend/`](backend/) — `schema.prisma`, migração SQL (inclui trigger
  de auditoria genérico e a view `colaborador_competencia_atual`) e
  `scripts/import-excel.ts` para popular a base de dados a partir do
  Excel de origem.

Duas questões de qualidade de dados ficaram por confirmar (secção 6 do
documento de modelo de dados): o desalinhamento entre colunas na folha
`Certificações` e a cobertura incompleta de `Pontos`/`Nível` na folha
`LOBS`.

**Nota**: o ficheiro Excel com dados reais de colaboradores nunca é
commitado neste repositório — só o schema e o código de importação.
