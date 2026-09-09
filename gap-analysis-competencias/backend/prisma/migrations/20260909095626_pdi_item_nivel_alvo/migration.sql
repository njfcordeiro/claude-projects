-- AlterTable
ALTER TABLE "pdi_items" ADD COLUMN     "nivel_alvo_id" INTEGER;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_nivel_alvo_id_fkey" FOREIGN KEY ("nivel_alvo_id") REFERENCES "niveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
