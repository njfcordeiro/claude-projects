-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "local_trabalho_id" INTEGER;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_local_trabalho_id_fkey" FOREIGN KEY ("local_trabalho_id") REFERENCES "locais_trabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dados iniciais pedidos pelo utilizador
INSERT INTO "locais_trabalho" ("id", "nome", "updated_at") VALUES
    (1, 'AMT Centro', CURRENT_TIMESTAMP),
    (2, 'AMT Norte', CURRENT_TIMESTAMP),
    (3, 'AMT Madeira', CURRENT_TIMESTAMP),
    (4, 'HIVE S.Miguel', CURRENT_TIMESTAMP);
