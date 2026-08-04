-- DropForeignKey
ALTER TABLE "colaborador_certificacao" DROP CONSTRAINT "colaborador_certificacao_colaborador_id_fkey";

-- DropForeignKey
ALTER TABLE "colaborador_competencia" DROP CONSTRAINT "colaborador_competencia_colaborador_id_fkey";

-- DropForeignKey
ALTER TABLE "colaborador_lob_recomendacao" DROP CONSTRAINT "colaborador_lob_recomendacao_colaborador_id_fkey";

-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_manager_id_fkey";

-- DropForeignKey
ALTER TABLE "gap_analysis_cargo_results" DROP CONSTRAINT "gap_analysis_cargo_results_colaborador_id_fkey";

-- DropForeignKey
ALTER TABLE "gap_analysis_lob_results" DROP CONSTRAINT "gap_analysis_lob_results_colaborador_id_fkey";

-- DropForeignKey
ALTER TABLE "pdi_items" DROP CONSTRAINT "pdi_items_colaborador_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_colaborador_id_fkey";

-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_competencia" ADD CONSTRAINT "colaborador_competencia_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_certificacao" ADD CONSTRAINT "colaborador_certificacao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_lob_recomendacao" ADD CONSTRAINT "colaborador_lob_recomendacao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_lob_results" ADD CONSTRAINT "gap_analysis_lob_results_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_cargo_results" ADD CONSTRAINT "gap_analysis_cargo_results_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
