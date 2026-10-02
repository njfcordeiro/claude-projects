-- Posição da Categoria na escala de senioridade (ver comentário no schema.prisma).
-- Nullable: Categorias existentes ficam sem ordem até serem preenchidas em Gestão de Dados.
ALTER TABLE "categorias" ADD COLUMN "ordem" INTEGER;
