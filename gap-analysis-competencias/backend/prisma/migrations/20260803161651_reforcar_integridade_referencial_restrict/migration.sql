-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_area_id_fkey";

-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_cargo_id_fkey";

-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_carreira_id_fkey";

-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_categoria_id_fkey";

-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_direcao_id_fkey";

-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_manager_id_fkey";

-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_nucleo_id_fkey";

-- DropForeignKey
ALTER TABLE "pdi_items" DROP CONSTRAINT "pdi_items_certificacao_id_fkey";

-- DropForeignKey
ALTER TABLE "pdi_items" DROP CONSTRAINT "pdi_items_competencia_id_fkey";

-- DropForeignKey
ALTER TABLE "pdi_items" DROP CONSTRAINT "pdi_items_formacao_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_colaborador_id_fkey";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_carreira_id_fkey" FOREIGN KEY ("carreira_id") REFERENCES "carreiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_direcao_id_fkey" FOREIGN KEY ("direcao_id") REFERENCES "direcoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_nucleo_id_fkey" FOREIGN KEY ("nucleo_id") REFERENCES "nucleos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_certificacao_id_fkey" FOREIGN KEY ("certificacao_id") REFERENCES "certificacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_formacao_id_fkey" FOREIGN KEY ("formacao_id") REFERENCES "formacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
