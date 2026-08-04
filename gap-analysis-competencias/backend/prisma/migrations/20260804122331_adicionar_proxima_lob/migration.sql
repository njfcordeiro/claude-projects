-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "proxima_lob_id" INTEGER;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_proxima_lob_id_fkey" FOREIGN KEY ("proxima_lob_id") REFERENCES "lobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
