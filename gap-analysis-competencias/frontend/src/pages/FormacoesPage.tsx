import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';

export function FormacoesPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['formacoes'], queryFn: endpoints.formacoes });

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar o catálogo de formações.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fiori-text">Catálogo de formações</h1>
        <p className="text-sm text-fiori-text-secondary">Formações disponíveis e as competências que desenvolvem.</p>
      </div>
      <Card>
        <DataTable
          data={data ?? []}
          getRowKey={(f) => f.id}
          searchPlaceholder="Pesquisar por nome, área ou competência…"
          columns={[
            { key: 'nome', header: 'Nome', render: (f) => f.nome, sortValue: (f) => f.nome },
            { key: 'area', header: 'Área', render: (f) => f.areaNome, sortValue: (f) => f.areaNome },
            {
              key: 'duracao',
              header: 'Duração',
              render: (f) => (f.duracaoHoras !== null ? `${f.duracaoHoras}h` : '—'),
              sortValue: (f) => f.duracaoHoras ?? -1,
            },
            {
              key: 'competencias',
              header: 'Competências desenvolvidas',
              render: (f) =>
                f.competenciasDesenvolvidas.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {f.competenciasDesenvolvidas.map((c) => (
                      <span key={c} className="rounded bg-fiori-canvas px-1.5 py-0.5 text-xs text-fiori-text-secondary">
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  '—'
                ),
              searchValue: (f) => f.competenciasDesenvolvidas.join(' '),
            },
          ]}
        />
      </Card>
    </div>
  );
}
