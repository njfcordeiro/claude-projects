-- Pedido do utilizador: as competências Comportamentais de um colaborador
-- passam a ser geridas manualmente na secção "Competências Comportamentais"
-- da ficha (ver CompetenciasComportamentaisSection no frontend e
-- ColaboradoresService.criarAvaliacao/eliminarCompetencia no backend) — os
-- valores que lá estivessem antes (import inicial ou outra via) não
-- refletem essa atribuição manual, por isso são limpos de uma vez para
-- todos os colaboradores. Não afeta Competências Técnicas nem o histórico
-- de avaliação delas.
DELETE FROM "colaborador_competencia"
WHERE "competencia_id" IN (SELECT "id" FROM "competencias" WHERE "tipo" = 'COMPORTAMENTAL');
