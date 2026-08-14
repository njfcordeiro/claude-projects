-- AlterTable
ALTER TABLE "carreiras" ADD COLUMN     "grupo_carreira_id" TEXT;

-- CreateTable
CREATE TABLE "grupos_carreira" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_carreira_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "carreiras" ADD CONSTRAINT "carreiras_grupo_carreira_id_fkey" FOREIGN KEY ("grupo_carreira_id") REFERENCES "grupos_carreira"("id") ON DELETE SET NULL ON UPDATE CASCADE;
