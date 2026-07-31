-- AlterTable
ALTER TABLE "colaborador_certificacao" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
