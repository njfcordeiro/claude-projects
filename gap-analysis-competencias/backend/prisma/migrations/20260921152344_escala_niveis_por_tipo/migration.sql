-- Pedido do utilizador: "é preciso uma nova escala de competências, para as
-- comportamentais — a que já existe só se aplica às técnicas". A partir de
-- agora "niveis" tem DUAS escalas (Técnica/Comportamental), com os MESMOS
-- números 0-5 em cada uma — só o nome/descrição pode divergir por escala —
-- para que qualquer código que trate nivelId como uma ordem numérica
-- (heatmap da Skill Matrix, "nível X de 5", comparações >=) continue a
-- funcionar sem alterações nenhumas.

-- 1) As colunas nivelId das tabelas que referenciam um nível guardam só o
--    número 0-5 (nunca o tipo) — a escala correta é sempre a da Competência
--    associada nessa mesma linha. Como isso deixa de ser uma FK de uma só
--    coluna para uma PK composta, as FKs para "niveis" são removidas antes
--    de tudo o resto (dependem do índice da PK atual): a validação de que
--    o nivelId pertence à escala certa passa a ser feita em código (ver
--    comentário em schema.prisma no modelo Nivel).
ALTER TABLE "certificacao_requisito_competencia" DROP CONSTRAINT "certificacao_requisito_competencia_nivel_id_fkey";
ALTER TABLE "formacao_requisito_competencia" DROP CONSTRAINT "formacao_requisito_competencia_nivel_id_fkey";
ALTER TABLE "cargo_requisito_competencia" DROP CONSTRAINT "cargo_requisito_competencia_nivel_exigido_id_fkey";
ALTER TABLE "lob_requisito_competencia" DROP CONSTRAINT "lob_requisito_competencia_nivel_minimo_id_fkey";
ALTER TABLE "colaborador_competencia" DROP CONSTRAINT "colaborador_competencia_nivel_id_fkey";
ALTER TABLE "pdi_items" DROP CONSTRAINT "pdi_items_nivel_alvo_id_fkey";

-- 2) Nova coluna "tipo", já preenchida como TECNICA em todas as linhas
--    existentes (a escala original era só para competências técnicas).
ALTER TABLE "niveis" ADD COLUMN "tipo" "tipo_desenvolvimento" NOT NULL DEFAULT 'TECNICA';

-- 3) A identidade de uma linha passa a ser (tipo, id) — sem isto não seria
--    possível ter um nível 3 Técnico e um nível 3 Comportamental em
--    simultâneo. A unicidade de "nome" passa a ser só dentro da mesma
--    escala (as duas escalas podem ter nomes iguais, como vão ficar já a
--    seguir). Trocadas ANTES de duplicar as linhas — as novas linhas
--    partilham id/nome com as existentes, só divergem em "tipo".
ALTER TABLE "niveis" DROP CONSTRAINT "niveis_pkey";
DROP INDEX "niveis_nome_key";
ALTER TABLE "niveis" ADD CONSTRAINT "niveis_pkey" PRIMARY KEY ("tipo", "id");
ALTER TABLE "niveis" ADD CONSTRAINT "niveis_tipo_nome_key" UNIQUE ("tipo", "nome");

-- 4) Duplica as 6 linhas existentes para a nova escala Comportamental —
--    mesmos ids 0-5, mesmo nome/descrição por agora (pedido do utilizador:
--    "de momento podem ficar iguais, que eu depois ajusto").
INSERT INTO "niveis" ("id", "tipo", "nome", "descricao")
SELECT "id", 'COMPORTAMENTAL', "nome", "descricao" FROM "niveis" WHERE "tipo" = 'TECNICA';
