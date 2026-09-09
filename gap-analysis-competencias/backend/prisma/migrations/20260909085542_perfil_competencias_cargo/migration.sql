/*
  Warnings:

  - You are about to drop the `cargo_lob` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "cargo_lob" DROP CONSTRAINT "cargo_lob_cargo_id_fkey";

-- DropForeignKey
ALTER TABLE "cargo_lob" DROP CONSTRAINT "cargo_lob_lob_id_fkey";

-- AlterTable
ALTER TABLE "pdi_items" ADD COLUMN     "cargo_id" TEXT;

-- DropTable
DROP TABLE "cargo_lob";

-- CreateTable
CREATE TABLE "cargo_requisito_competencia" (
    "cargo_id" TEXT NOT NULL,
    "competencia_id" INTEGER NOT NULL,
    "nivel_exigido_id" INTEGER NOT NULL,

    CONSTRAINT "cargo_requisito_competencia_pkey" PRIMARY KEY ("cargo_id","competencia_id")
);

-- AddForeignKey
ALTER TABLE "cargo_requisito_competencia" ADD CONSTRAINT "cargo_requisito_competencia_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_requisito_competencia" ADD CONSTRAINT "cargo_requisito_competencia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_requisito_competencia" ADD CONSTRAINT "cargo_requisito_competencia_nivel_exigido_id_fkey" FOREIGN KEY ("nivel_exigido_id") REFERENCES "niveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
