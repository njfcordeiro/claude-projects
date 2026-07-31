import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../../api/endpoints';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { NivelPill } from './NivelPill';
import { SugestoesLista } from './SugestoesLista';

/** Relatório completo de uma LOB para um colaborador — competências e certificações, com sugestões para os gaps. */
export function LobGapDetail({ colaboradorId, lobId }: { colaboradorId: number; lobId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gap-lob', colaboradorId, lobId],
    queryFn: () => endpoints.gapLob(colaboradorId, lobId),
  });

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
    </div>
  );
}
