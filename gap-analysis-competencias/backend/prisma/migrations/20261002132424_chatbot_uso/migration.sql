-- Um registo por pergunta feita ao chatbot de ajuda — controlo de custo
-- (limite diário por utilizador + corta-circuito diário global).
CREATE TABLE "chatbot_uso" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_uso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chatbot_uso_user_id_data_idx" ON "chatbot_uso"("user_id", "data");
CREATE INDEX "chatbot_uso_data_idx" ON "chatbot_uso"("data");

ALTER TABLE "chatbot_uso"
    ADD CONSTRAINT "chatbot_uso_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
