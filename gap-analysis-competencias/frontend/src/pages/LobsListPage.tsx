import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';

/** Ecrã de gestão de LOBs (requisitos) — leitura por agora, ver docs/02-arquitetura-tecnica.md secção 8 para CRUD completo. */
export function LobsListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['lobs'], queryFn: endpoints.lobs });

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar as LOBs.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fiori-text">LOBs</h1>
        <p className="text-sm text-fiori-text-secondary">Linhas de negócio e os seus requisitos de competência/certificação.</p>
      </div>
      <Card>
        <DataTable
          data={data ?? []}
          getRowKey={(l) => l.id}
          onRowClick={(l) => navigate(`/lobs/${l.id}`)}
          searchPlaceholder="Pesquisar por nome ou área…"
          columns={[
            { key: 'nome', header: 'Nome', render: (l) => l.nome, sortValue: (l) => l.nome },
            { key: 'area', header: 'Área', render: (l) => l.areaNome, sortValue: (l) => l.areaNome },
            { key: 'pontos', header: 'Pontos mínimos', render: (l) => l.pontosMinimos, sortValue: (l) => l.pontosMinimos },
            {
              key: 'requisitos',
              header: 'Requisitos',
              render: (l) => `${l.totalRequisitosCompetencia} competências · ${l.totalRequisitosCertificacao} certificações`,
            },
          ]}
        />
      </Card>
    </div>
  );
}
