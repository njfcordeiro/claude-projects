-- Limpa linhas órfãs (sem data de obtenção) que ficaram para trás de antes
-- de ColaboradoresService.upsertCertificacao passar a eliminar a linha em
-- vez de a atualizar para null — pedido do utilizador (ex.: colaborador 301).
DELETE FROM "colaborador_certificacao" WHERE "data_obtencao" IS NULL;

-- Torna a coluna obrigatória: sem data de obtenção não há certificação a
-- registar, é simplesmente "em falta" — nunca mais deve existir uma linha
-- "vazia" (ver comentário em schema.prisma).
ALTER TABLE "colaborador_certificacao" ALTER COLUMN "data_obtencao" SET NOT NULL;
