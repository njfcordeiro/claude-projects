-- Prompt 5: colaborador_certificacao e colaborador_competencia passaram a
-- ser editáveis via API (PUT /colaboradores/:id/certificacoes/:certId,
-- POST /colaboradores/:id/competencias). "Todas as alterações devem ficar
-- registadas em log de auditoria" — o trigger genérico já existente
-- (audit_trigger_fn(), ver migração inicial) só cobria colaboradores,
-- cargos, lob_requisito_competencia, lob_requisito_certificacao,
-- certificacoes e users. Falta:
--
-- - colaborador_certificacao: agora mutável (UPDATE via locking otimista)
--   — sem isto, uma alteração de validade não ficava rastreada.
-- - colaborador_competencia: é append-only por desenho (nunca UPDATE/
--   DELETE, cada avaliação já é o seu próprio registo histórico
--   permanente — ver docs/01-modelo-dados.md secção 5.1), por isso o
--   trigger só vai gravar INSERTs aqui. Não é redundante: dá uma trilha
--   de auditoria única e consultável (audit_log) em vez de obrigar quem
--   audita a saber que também tem de olhar para esta tabela em separado.

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON "colaborador_certificacao"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger AFTER INSERT ON "colaborador_competencia"
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
