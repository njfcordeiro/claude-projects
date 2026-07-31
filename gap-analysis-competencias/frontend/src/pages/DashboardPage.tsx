import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { KpiTile } from '../components/ui/KpiTile';
import { ReadinessBarChart } from '../components/ui/ReadinessBarChart';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';

/** Visão geral de gaps por equipa/categoria (docs Prompt 4). ADMIN_RH/VIEWER veem a organização; MANAGER só a sua equipa. */
export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: endpoints.dashboard });

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar o dashboard.</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fiori-text">Dashboard</h1>
        <p className="text-sm text-fiori-text-secondary">
          {user?.role === 'MANAGER' ? 'Prontidão da tua equipa direta para os respetivos cargos.' : 'Prontidão de toda a organização para os respetivos cargos.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile label="Colaboradores avaliados" value={data.totalColaboradores} />
        <KpiTile
          label="Prontidão média"
          value={`${data.prontidaoMediaGeral}%`}
          tone={data.prontidaoMediaGeral >= 60 ? 'success' : 'warning'}
        />
        <KpiTile
          label="Em risco (gap > 0)"
          value={data.colaboradoresEmRisco}
          tone={data.colaboradoresEmRisco > 0 ? 'warning' : 'success'}
          hint="Colaboradores sem as LOBs exigidas pelo cargo atingidas"
        />
      </div>

      <Card title="Prontidão média por direção">
        <ReadinessBarChart
          dados={data.porDirecao.map((g) => ({
            grupo: g.grupo,
            prontidaoMedia: g.prontidaoMedia,
            totalColaboradores: g.totalColaboradores,
            emRisco: g.emRisco,
          }))}
        />
      </Card>

      <Card title="Colaboradores">
        <DataTable
          data={data.colaboradores}
          getRowKey={(c) => c.colaboradorId}
          onRowClick={(c) => navigate(`/colaboradores/${c.colaboradorId}`)}
          searchPlaceholder="Pesquisar por nome, direção, cargo…"
          columns={[
            { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
            {
              key: 'direcao',
              header: 'Direção',
              render: (c) => c.direcaoNome ?? '—',
              sortValue: (c) => c.direcaoNome ?? '',
              searchValue: (c) => c.direcaoNome ?? '',
            },
            { key: 'cargo', header: 'Cargo', render: (c) => c.cargoNome, sortValue: (c) => c.cargoNome },
            {
              key: 'prontidao',
              header: 'Prontidão',
              render: (c) => `${c.prontidaoMedia}%`,
              sortValue: (c) => c.prontidaoMedia,
            },
            {
              key: 'lobs',
              header: 'LOBs atingidas',
              render: (c) => `${c.lobsAtingidos} / ${c.lobsExigidos}`,
              sortValue: (c) => c.lobsAtingidos,
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (c) =>
                c.gap === 0 ? (
                  <Badge status="success">Pronto</Badge>
                ) : (
                  <Badge status="warning">Gap de {c.gap}</Badge>
                ),
              searchValue: (c) => (c.gap === 0 ? 'pronto' : 'gap'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
