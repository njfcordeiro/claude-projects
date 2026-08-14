-- CreateEnum
CREATE TYPE "tipo_desenvolvimento" AS ENUM ('TECNICA', 'COMPORTAMENTAL');

-- AlterTable
ALTER TABLE "competencias" ADD COLUMN     "tipo" "tipo_desenvolvimento" NOT NULL DEFAULT 'TECNICA';

-- AlterTable
ALTER TABLE "lobs" ADD COLUMN     "tipo" "tipo_desenvolvimento" NOT NULL DEFAULT 'TECNICA';

-- CreateTable
CREATE TABLE "cargo_lob" (
    "cargo_id" TEXT NOT NULL,
    "lob_id" INTEGER NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cargo_lob_pkey" PRIMARY KEY ("cargo_id","lob_id")
);

-- AddForeignKey
ALTER TABLE "cargo_lob" ADD CONSTRAINT "cargo_lob_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_lob" ADD CONSTRAINT "cargo_lob_lob_id_fkey" FOREIGN KEY ("lob_id") REFERENCES "lobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
