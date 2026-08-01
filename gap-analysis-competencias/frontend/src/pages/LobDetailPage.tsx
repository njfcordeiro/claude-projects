import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';

export function LobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const lobId = Number(id);
  const { data, isLoading, error } = useQuery({ queryKey: ['lob', lobId], queryFn: () => endpoints.lob(lobId) });

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error || !data) return <p className="text-sm text-fiori-error">LOB não encontrada.</p>;

  return (
    <div className="space-y-4">
      <Link to="/lobs" className="flex items-center gap-1 text-sm text-fiori-primary hover:underline">
        <ChevronLeft size={14} /> Voltar a LOBs
      </Link>

      <Card>
        <h1 className="text-xl font-semibold text-fiori-text">{data.nome}</h1>
        <p className="text-sm text-fiori-text-secondary">
          Área {data.areaNome} · {data.pontosMinimos} pontos mínimos
        </p>
      </Card>

      <Card title="Requisitos de competência">
        <table className="fiori-table">
          <thead>
            <tr>
              <th>Competência</th>
              <th>Nível mínimo</th>
              <th>Pontos</th>
              <th>Obrigatório</th>
            </tr>
          </thead>
          <tbody>
            {data.requisitosCompetencia.map((r) => (
              <tr key={r.competenciaId}>
                <td>{r.competenciaNome}</td>
                <td>{r.nivelMinimoNome}</td>
                <td>{r.pontos}</td>
                <td>{r.obrigatorio ? <Tag>Sim</Tag> : <span className="text-fiori-text-secondary">Não</span>}</td>
              </tr>
            ))}
            {data.requisitosCompetencia.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-fiori-text-secondary">
                  Sem requisitos de competência definidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Requisitos de certificação">
        <table className="fiori-table">
          <thead>
            <tr>
              <th>Certificação</th>
              <th>Obrigatório</th>
            </tr>
          </thead>
          <tbody>
            {data.requisitosCertificacao.map((r) => (
              <tr key={r.certificacaoId}>
                <td>{r.certificacaoNome}</td>
                <td>{r.obrigatorio ? <Tag>Sim</Tag> : <span className="text-fiori-text-secondary">Não</span>}</td>
              </tr>
            ))}
            {data.requisitosCertificacao.length === 0 && (
              <tr>
                <td colSpan={2} className="py-4 text-center text-fiori-text-secondary">
                  Sem requisitos de certificação definidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
