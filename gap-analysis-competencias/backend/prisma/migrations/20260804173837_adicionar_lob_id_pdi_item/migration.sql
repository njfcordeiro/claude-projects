-- AlterTable
ALTER TABLE "pdi_items" ADD COLUMN     "lob_id" INTEGER;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_lob_id_fkey" FOREIGN KEY ("lob_id") REFERENCES "lobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
