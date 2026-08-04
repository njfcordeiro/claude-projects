-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "nivel_gestao_id" INTEGER;

-- CreateTable
CREATE TABLE "niveis_gestao" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "niveis_gestao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locais_trabalho" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locais_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "niveis_gestao_nome_key" ON "niveis_gestao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "locais_trabalho_nome_key" ON "locais_trabalho"("nome");

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_nivel_gestao_id_fkey" FOREIGN KEY ("nivel_gestao_id") REFERENCES "niveis_gestao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dados iniciais pedidos pelo utilizador
INSERT INTO "niveis_gestao" ("id", "nome", "updated_at") VALUES
    (1, 'BUD', CURRENT_TIMESTAMP),
    (2, 'BUM', CURRENT_TIMESTAMP),
    (3, 'Team Leader', CURRENT_TIMESTAMP);
