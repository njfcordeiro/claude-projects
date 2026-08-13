-- CreateTable
CREATE TABLE "configuracao_prontidao" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "peso_competencias" INTEGER NOT NULL DEFAULT 40,
    "peso_certificacoes" INTEGER NOT NULL DEFAULT 40,
    "peso_pontos" INTEGER NOT NULL DEFAULT 20,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "configuracao_prontidao_pkey" PRIMARY KEY ("id")
);
