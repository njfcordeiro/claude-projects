-- CreateEnum
CREATE TYPE "avaliacao_formacao" AS ENUM ('APROVADO', 'REPROVADO', 'FALTOU');

-- CreateTable
CREATE TABLE "colaborador_formacao" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "formacao_id" INTEGER NOT NULL,
    "data_conclusao" DATE NOT NULL,
    "horas_formacao" INTEGER NOT NULL,
    "avaliacao" "avaliacao_formacao" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "colaborador_formacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colaborador_formacao_colaborador_id_formacao_id_idx" ON "colaborador_formacao"("colaborador_id", "formacao_id");

-- AddForeignKey
ALTER TABLE "colaborador_formacao" ADD CONSTRAINT "colaborador_formacao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_formacao" ADD CONSTRAINT "colaborador_formacao_formacao_id_fkey" FOREIGN KEY ("formacao_id") REFERENCES "formacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
