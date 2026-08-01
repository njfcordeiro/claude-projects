-- CreateEnum
CREATE TYPE "estado_pdi" AS ENUM ('PENDENTE', 'EM_CURSO', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "origem_pdi" AS ENUM ('AUTOMATICO', 'MANUAL');

-- CreateTable
CREATE TABLE "pdi_items" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "competencia_id" INTEGER,
    "certificacao_id" TEXT,
    "formacao_id" INTEGER,
    "descricao" TEXT NOT NULL,
    "estado" "estado_pdi" NOT NULL DEFAULT 'PENDENTE',
    "origem" "origem_pdi" NOT NULL DEFAULT 'AUTOMATICO',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "pdi_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdi_items_colaborador_id_idx" ON "pdi_items"("colaborador_id");

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_certificacao_id_fkey" FOREIGN KEY ("certificacao_id") REFERENCES "certificacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_items" ADD CONSTRAINT "pdi_items_formacao_id_fkey" FOREIGN KEY ("formacao_id") REFERENCES "formacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
