-- CreateEnum
CREATE TYPE "papel_utilizador" AS ENUM ('ADMIN_RH', 'MANAGER', 'EMPLOYEE', 'VIEWER');

-- CreateEnum
CREATE TYPE "origem_avaliacao" AS ENUM ('SELF', 'MANAGER', 'FORMAL', '360', 'importado_excel');

-- CreateEnum
CREATE TYPE "ambito_analise" AS ENUM ('EMPRESA', 'DIRECAO', 'AREA', 'CARGO', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "estado_analise" AS ENUM ('draft', 'completed');

-- CreateEnum
CREATE TYPE "operacao_auditoria" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "direcoes" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nucleos" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nucleos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carreiras" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carreiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "carreira_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "anos_experiencia_minimo" INTEGER,
    "lobs_exigidos" INTEGER,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "relevante_carreira" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_progressao" (
    "cargo_id" TEXT NOT NULL,
    "proximo_cargo_id" TEXT NOT NULL,

    CONSTRAINT "cargo_progressao_pkey" PRIMARY KEY ("cargo_id","proximo_cargo_id")
);

-- CreateTable
CREATE TABLE "niveis" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "niveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencias" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "area_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificacoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificacao_requisito_competencia" (
    "id" SERIAL NOT NULL,
    "certificacao_id" TEXT NOT NULL,
    "competencia_id" INTEGER NOT NULL,
    "nivel_id" INTEGER NOT NULL,

    CONSTRAINT "certificacao_requisito_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formacoes" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "area_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formacao_requisito_competencia" (
    "id" SERIAL NOT NULL,
    "formacao_id" INTEGER NOT NULL,
    "competencia_id" INTEGER NOT NULL,
    "nivel_id" INTEGER NOT NULL,

    CONSTRAINT "formacao_requisito_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lobs" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "area_id" INTEGER NOT NULL,
    "pontos_minimos" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lob_requisito_competencia" (
    "id" SERIAL NOT NULL,
    "lob_id" INTEGER NOT NULL,
    "competencia_id" INTEGER NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL,
    "pontos" INTEGER NOT NULL,
    "nivel_minimo_id" INTEGER NOT NULL,

    CONSTRAINT "lob_requisito_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lob_requisito_certificacao" (
    "id" SERIAL NOT NULL,
    "lob_id" INTEGER NOT NULL,
    "certificacao_id" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL,

    CONSTRAINT "lob_requisito_certificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "papel_utilizador" NOT NULL,
    "colaborador_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "carreira_id" TEXT,
    "categoria_id" TEXT,
    "cargo_id" TEXT,
    "direcao_id" INTEGER,
    "nucleo_id" INTEGER,
    "area_id" INTEGER,
    "manager_id" INTEGER,
    "e_bum" BOOLEAN NOT NULL DEFAULT false,
    "data_admissao" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_competencia" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "competencia_id" INTEGER NOT NULL,
    "nivel_id" INTEGER NOT NULL,
    "data_avaliacao" DATE NOT NULL,
    "avaliado_por" INTEGER,
    "origem" "origem_avaliacao" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaborador_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_certificacao" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "certificacao_id" TEXT NOT NULL,
    "data_obtencao" DATE,
    "data_validade" DATE,
    "anexo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_certificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_lob_recomendacao" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "lob_id" INTEGER NOT NULL,
    "proprio" BOOLEAN NOT NULL DEFAULT false,
    "bud" BOOLEAN NOT NULL DEFAULT false,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colaborador_lob_recomendacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_analysis_runs" (
    "id" SERIAL NOT NULL,
    "scope_type" "ambito_analise" NOT NULL,
    "scope_direcao_id" INTEGER,
    "scope_cargo_id" TEXT,
    "scope_colaborador_id" INTEGER,
    "run_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "status" "estado_analise" NOT NULL DEFAULT 'draft',

    CONSTRAINT "gap_analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_analysis_lob_results" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "lob_id" INTEGER NOT NULL,
    "pontos_obtidos" INTEGER NOT NULL,
    "pontos_minimos" INTEGER NOT NULL,
    "atingido" BOOLEAN NOT NULL,
    "obrigatorios_em_falta" INTEGER NOT NULL,

    CONSTRAINT "gap_analysis_lob_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_analysis_cargo_results" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "cargo_id" TEXT NOT NULL,
    "lobs_exigidos" INTEGER NOT NULL,
    "lobs_atingidos" INTEGER NOT NULL,
    "gap" INTEGER NOT NULL,

    CONSTRAINT "gap_analysis_cargo_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "operation" "operacao_auditoria" NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "changed_by" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "direcoes_nome_key" ON "direcoes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "areas_nome_key" ON "areas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "nucleos_nome_key" ON "nucleos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "niveis_nome_key" ON "niveis"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "competencias_nome_key" ON "competencias"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "certificacao_requisito_competencia_certificacao_id_competen_key" ON "certificacao_requisito_competencia"("certificacao_id", "competencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "formacao_requisito_competencia_formacao_id_competencia_id_key" ON "formacao_requisito_competencia"("formacao_id", "competencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "lob_requisito_competencia_lob_id_competencia_id_key" ON "lob_requisito_competencia"("lob_id", "competencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "lob_requisito_certificacao_lob_id_certificacao_id_key" ON "lob_requisito_certificacao"("lob_id", "certificacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_colaborador_id_key" ON "users"("colaborador_id");

-- CreateIndex
CREATE INDEX "colaborador_competencia_colaborador_id_competencia_id_data__idx" ON "colaborador_competencia"("colaborador_id", "competencia_id", "data_avaliacao");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_certificacao_colaborador_id_certificacao_id_key" ON "colaborador_certificacao"("colaborador_id", "certificacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_lob_recomendacao_colaborador_id_lob_id_key" ON "colaborador_lob_recomendacao"("colaborador_id", "lob_id");

-- CreateIndex
CREATE INDEX "gap_analysis_lob_results_run_id_colaborador_id_idx" ON "gap_analysis_lob_results"("run_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "gap_analysis_cargo_results_run_id_colaborador_id_idx" ON "gap_analysis_cargo_results"("run_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "audit_log_table_name_record_id_idx" ON "audit_log"("table_name", "record_id");

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_carreira_id_fkey" FOREIGN KEY ("carreira_id") REFERENCES "carreiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_progressao" ADD CONSTRAINT "cargo_progressao_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_progressao" ADD CONSTRAINT "cargo_progressao_proximo_cargo_id_fkey" FOREIGN KEY ("proximo_cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencias" ADD CONSTRAINT "competencias_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacao_requisito_competencia" ADD CONSTRAINT "certificacao_requisito_competencia_certificacao_id_fkey" FOREIGN KEY ("certificacao_id") REFERENCES "certificacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacao_requisito_competencia" ADD CONSTRAINT "certificacao_requisito_competencia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificacao_requisito_competencia" ADD CONSTRAINT "certificacao_requisito_competencia_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formacoes" ADD CONSTRAINT "formacoes_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formacao_requisito_competencia" ADD CONSTRAINT "formacao_requisito_competencia_formacao_id_fkey" FOREIGN KEY ("formacao_id") REFERENCES "formacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formacao_requisito_competencia" ADD CONSTRAINT "formacao_requisito_competencia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formacao_requisito_competencia" ADD CONSTRAINT "formacao_requisito_competencia_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobs" ADD CONSTRAINT "lobs_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lob_requisito_competencia" ADD CONSTRAINT "lob_requisito_competencia_lob_id_fkey" FOREIGN KEY ("lob_id") REFERENCES "lobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lob_requisito_competencia" ADD CONSTRAINT "lob_requisito_competencia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lob_requisito_competencia" ADD CONSTRAINT "lob_requisito_competencia_nivel_minimo_id_fkey" FOREIGN KEY ("nivel_minimo_id") REFERENCES "niveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lob_requisito_certificacao" ADD CONSTRAINT "lob_requisito_certificacao_lob_id_fkey" FOREIGN KEY ("lob_id") REFERENCES "lobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lob_requisito_certificacao" ADD CONSTRAINT "lob_requisito_certificacao_certificacao_id_fkey" FOREIGN KEY ("certificacao_id") REFERENCES "certificacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_carreira_id_fkey" FOREIGN KEY ("carreira_id") REFERENCES "carreiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_direcao_id_fkey" FOREIGN KEY ("direcao_id") REFERENCES "direcoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_nucleo_id_fkey" FOREIGN KEY ("nucleo_id") REFERENCES "nucleos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_competencia" ADD CONSTRAINT "colaborador_competencia_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_competencia" ADD CONSTRAINT "colaborador_competencia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_competencia" ADD CONSTRAINT "colaborador_competencia_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_competencia" ADD CONSTRAINT "colaborador_competencia_avaliado_por_fkey" FOREIGN KEY ("avaliado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_certificacao" ADD CONSTRAINT "colaborador_certificacao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_certificacao" ADD CONSTRAINT "colaborador_certificacao_certificacao_id_fkey" FOREIGN KEY ("certificacao_id") REFERENCES "certificacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_lob_recomendacao" ADD CONSTRAINT "colaborador_lob_recomendacao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_lob_recomendacao" ADD CONSTRAINT "colaborador_lob_recomendacao_lob_id_fkey" FOREIGN KEY ("lob_id") REFERENCES "lobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_runs" ADD CONSTRAINT "gap_analysis_runs_scope_direcao_id_fkey" FOREIGN KEY ("scope_direcao_id") REFERENCES "direcoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_runs" ADD CONSTRAINT "gap_analysis_runs_scope_cargo_id_fkey" FOREIGN KEY ("scope_cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_runs" ADD CONSTRAINT "gap_analysis_runs_scope_colaborador_id_fkey" FOREIGN KEY ("scope_colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_runs" ADD CONSTRAINT "gap_analysis_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_lob_results" ADD CONSTRAINT "gap_analysis_lob_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "gap_analysis_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_lob_results" ADD CONSTRAINT "gap_analysis_lob_results_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_lob_results" ADD CONSTRAINT "gap_analysis_lob_results_lob_id_fkey" FOREIGN KEY ("lob_id") REFERENCES "lobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_cargo_results" ADD CONSTRAINT "gap_analysis_cargo_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "gap_analysis_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_cargo_results" ADD CONSTRAINT "gap_analysis_cargo_results_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_analysis_cargo_results" ADD CONSTRAINT "gap_analysis_cargo_results_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Histórico e auditoria (docs/01-modelo-dados.md, secção 5)
-- ============================================================================

-- Secção 5.1: "nível atual" de uma competência = avaliação mais recente por
-- (colaborador, competência), nunca um UPDATE em colaborador_competencia.
CREATE VIEW "colaborador_competencia_atual" AS
SELECT DISTINCT ON (colaborador_id, competencia_id)
    id, colaborador_id, competencia_id, nivel_id, data_avaliacao, avaliado_por, origem, created_at
FROM "colaborador_competencia"
ORDER BY colaborador_id, competencia_id, data_avaliacao DESC, id DESC;

-- Secção 5.3: trigger genérico de auditoria (old/new em JSONB), reutilizado
-- pelas tabelas mutáveis identificadas no documento: colaboradores, cargos,
-- lob_requisito_competencia, lob_requisito_certificacao, certificacoes, users.
--
-- `changed_by` só fica preenchido se a aplicação definir, na mesma transação,
-- a GUC de sessão `app.current_user_id` (ex.: `SELECT set_config
-- ('app.current_user_id', $1, true)` antes de cada operação autenticada).
-- Sem isso, fica NULL (ex.: seed/import inicial a correr como sistema).
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS trigger AS $$
DECLARE
    v_old jsonb;
    v_new jsonb;
    v_record_id text;
    v_changed_by integer;
BEGIN
    v_changed_by := NULLIF(current_setting('app.current_user_id', true), '')::integer;

    IF (TG_OP = 'INSERT') THEN
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id::text;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id::text;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old := to_jsonb(OLD);
        v_record_id := OLD.id::text;
    END IF;

    INSERT INTO "audit_log" (table_name, record_id, operation, old_data, new_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, v_record_id, TG_OP::"operacao_auditoria", v_old, v_new, v_changed_by, now());

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "colaboradores"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "cargos"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "lob_requisito_competencia"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "lob_requisito_certificacao"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "certificacoes"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "users"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
