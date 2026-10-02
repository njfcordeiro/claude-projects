-- Override manual do "Próximo Cargo" de um colaborador — presença da linha
-- É o override; sem linha, o valor é sempre derivado ao vivo de
-- CargoProgressao (ver ProximoCargoService).
CREATE TABLE "colaborador_proximo_cargo" (
    "colaborador_id" INTEGER NOT NULL,
    "cargo_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "colaborador_proximo_cargo_pkey" PRIMARY KEY ("colaborador_id")
);

ALTER TABLE "colaborador_proximo_cargo"
    ADD CONSTRAINT "colaborador_proximo_cargo_colaborador_id_fkey"
    FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "colaborador_proximo_cargo"
    ADD CONSTRAINT "colaborador_proximo_cargo_cargo_id_fkey"
    FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
