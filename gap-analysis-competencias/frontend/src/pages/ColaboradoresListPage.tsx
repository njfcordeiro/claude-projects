import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';

/** Restrito a ADMIN_RH/VIEWER (RolesGuard do backend em GET /colaboradores). */
export function ColaboradoresListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar os colaboradores.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-fiori-text">Colaboradores</h1>
      <Card>
        <DataTable
          data={data ?? []}
          getRowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/colaboradores/${c.id}`)}
          initialSearch={searchParams.get('q') ?? ''}
          searchPlaceholder="Pesquisar por nome ou cargo…"
          columns={[
            { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
            { key: 'cargo', header: 'Cargo', render: (c) => c.cargoId ?? '—', sortValue: (c) => c.cargoId ?? '' },
            { key: 'manager', header: 'Gestor (ID)', render: (c) => c.managerId ?? '—' },
          ]}
        />
      </Card>
    </div>
  );
}
