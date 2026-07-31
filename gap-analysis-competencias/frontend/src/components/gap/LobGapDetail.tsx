import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { NivelPill } from './NivelPill';
import { SugestoesLista } from './SugestoesLista';
import { AvaliarCompetenciaModal } from './AvaliarCompetenciaModal';
import { EditarCertificacaoModal } from './EditarCertificacaoModal';

/** Relatório completo de uma LOB para um colaborador — competências e certificações, com sugestões para os gaps. */
export function LobGapDetail({ colaboradorId, lobId }: { colaboradorId: number; lobId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['gap-lob', colaboradorId, lobId],
    queryFn: () => endpoints.gapLob(colaboradorId, lobId),
  });

  const [competenciaEmEdicao, setCompetenciaEmEdicao] = useState<{ id: number; nome: string } | null>(null);
  const [certificacaoEmEdicao, setCertificacaoEmEdicao] = useState<{ id: string; nome: string } | null>(null);

  // "Admin RH edita tudo, Gestor edita a sua equipa" — o backend reforça o
  // RBAC fino de verdade (ver ColaboradoresService.podeEditar); isto só
  // decide se mostramos o botão, é conforto de UI, não é a fronteira de
  // segurança.
  const podeEditar = user?.role === 'ADMIN_RH' || user?.role === 'MANAGER';

  function aoGuardarComSucesso() {
    queryClient.invalidateQueries({ queryKey: ['gap-lob', colaboradorId, lobId] });
    queryClient.invalidateQueries({ queryKey: ['gap-cargo', colaboradorId] });
    setCompetenciaEmEdicao(null);
    setCertificacaoEmEdicao(null);
  }

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A calcular…</p>;
  if (error || !data) return <p className="text-sm text-fiori-error">Não foi possível calcular o gap para esta LOB.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-fiori-text">
          {data.pontosObtidos} / {data.pontosMinimos} pontos
        </span>
        {data.atingido ? <Badge status="success">LOB atingida</Badge> : <Badge status="warning">{data.obrigatoriosEmFalta} obrigatório(s) em falta</Badge>}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">Competências</h3>
        <div className="space-y-2">
          {data.competencias.map((c) => (
            <div key={c.competenciaId} className="rounded border border-fiori-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fiori-text">{c.competenciaNome}</span>
                  {c.obrigatorio && <Tag>Obrigatório</Tag>}
                </div>
                <div className="flex items-center gap-3">
                  <NivelPill atual={c.nivelAtual} exigido={c.nivelExigido} />
                  <span className="text-xs text-fiori-text-secondary">
                    {c.pontosObtidos}/{c.pontosPossiveis} pts
                  </span>
                  {c.cumprido ? <Badge status="success">Cumprido</Badge> : <Badge status="error">Gap</Badge>}
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => setCompetenciaEmEdicao({ id: c.competenciaId, nome: c.competenciaNome })}
                      className="text-fiori-text-secondary hover:text-fiori-primary"
                      title="Avaliar"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>
              {!c.cumprido && (
                <div className="mt-2 border-t border-fiori-border pt-2">
                  <SugestoesLista formacoes={c.sugestoes.formacoes} certificacoes={c.sugestoes.certificacoes} />
                </div>
              )}
            </div>
          ))}
          {data.competencias.length === 0 && <p className="text-sm text-fiori-text-secondary">Sem requisitos de competência.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">Certificações</h3>
        <div className="space-y-2">
          {data.certificacoes.map((c) => (
            <div key={c.certificacaoId} className="rounded border border-fiori-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fiori-text">{c.certificacaoNome}</span>
                  {c.obrigatorio && <Tag>Obrigatório</Tag>}
                </div>
                <div className="flex items-center gap-3">
                  {c.dataValidade && (
                    <span className="text-xs text-fiori-text-secondary">
                      válida até {new Date(c.dataValidade).toLocaleDateString('pt-PT')}
                    </span>
                  )}
                  {c.cumprido ? (
                    <Badge status="success">{c.dataValidade ? 'Válida' : 'Cumprido'}</Badge>
                  ) : c.possui ? (
                    <Badge status="error">Expirada</Badge>
                  ) : (
                    <Badge status="error">Em falta</Badge>
                  )}
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => setCertificacaoEmEdicao({ id: c.certificacaoId, nome: c.certificacaoNome })}
                      className="text-fiori-text-secondary hover:text-fiori-primary"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>
              {!c.cumprido && c.preparacao.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-fiori-border pt-2">
                  <p className="text-xs text-fiori-text-secondary">Preparação (competências que esta certificação valida):</p>
                  {c.preparacao.map((p) => (
                    <div key={p.competenciaId}>
                      <p className="text-xs font-medium text-fiori-text">{p.competenciaNome}</p>
                      <SugestoesLista formacoes={p.formacoesRecomendadas} certificacoes={[]} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {data.certificacoes.length === 0 && <p className="text-sm text-fiori-text-secondary">Sem requisitos de certificação.</p>}
        </div>
      </div>

      {competenciaEmEdicao && (
        <AvaliarCompetenciaModal
          colaboradorId={colaboradorId}
          competenciaId={competenciaEmEdicao.id}
          competenciaNome={competenciaEmEdicao.nome}
          onClose={() => setCompetenciaEmEdicao(null)}
          onSuccess={aoGuardarComSucesso}
        />
      )}
      {certificacaoEmEdicao && (
        <EditarCertificacaoModal
          colaboradorId={colaboradorId}
          certificacaoId={certificacaoEmEdicao.id}
          certificacaoNome={certificacaoEmEdicao.nome}
          onClose={() => setCertificacaoEmEdicao(null)}
          onSuccess={aoGuardarComSucesso}
        />
      )}
    </div>
  );
}
