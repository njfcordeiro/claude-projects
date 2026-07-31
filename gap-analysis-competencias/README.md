# Gap Analysis de Competências

Aplicação para RH analisar o desvio (gap) entre as competências/certificações
exigidas por cada função e as competências reais dos colaboradores.

## Estado atual

Fase de especificação, validada contra o Excel de origem
(`Tabelas_criação_programa.xlsx`). Ver
[`docs/01-modelo-dados.md`](docs/01-modelo-dados.md) para o modelo de dados
(esquema relacional + ERD), a lógica de pontuação por LOB, o plano de
auditoria/histórico, os problemas de qualidade de dados encontrados no
Excel e a stack técnica sugerida (PostgreSQL + NestJS/Prisma).

Há ainda algumas questões de negócio em aberto (secção 7 do documento) a
confirmar antes de gerar o schema de migração inicial.
