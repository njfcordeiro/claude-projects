-- AlterEnum
ALTER TYPE "origem_avaliacao" ADD VALUE 'PROJETO';

-- CreateTable
CREATE TABLE "projetos" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "area_id" INTEGER,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projeto_vertentes" (
    "id" SERIAL NOT NULL,
    "projeto_id" INTEGER NOT NULL,
    "competencia_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "projeto_vertentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_projeto" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "projeto_id" INTEGER NOT NULL,
    "data_participacao" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "colaborador_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_projeto_vertente" (
    "colaborador_projeto_id" INTEGER NOT NULL,
    "vertente_id" INTEGER NOT NULL,

    CONSTRAINT "colaborador_projeto_vertente_pkey" PRIMARY KEY ("colaborador_projeto_id","vertente_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projeto_vertentes_projeto_id_competencia_id_key" ON "projeto_vertentes"("projeto_id", "competencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_projeto_colaborador_id_projeto_id_key" ON "colaborador_projeto"("colaborador_id", "projeto_id");

-- AddForeignKey
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projeto_vertentes" ADD CONSTRAINT "projeto_vertentes_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projeto_vertentes" ADD CONSTRAINT "projeto_vertentes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_projeto" ADD CONSTRAINT "colaborador_projeto_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_projeto" ADD CONSTRAINT "colaborador_projeto_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_projeto_vertente" ADD CONSTRAINT "colaborador_projeto_vertente_colaborador_projeto_id_fkey" FOREIGN KEY ("colaborador_projeto_id") REFERENCES "colaborador_projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_projeto_vertente" ADD CONSTRAINT "colaborador_projeto_vertente_vertente_id_fkey" FOREIGN KEY ("vertente_id") REFERENCES "projeto_vertentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
