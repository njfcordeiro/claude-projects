import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { Select } from '../components/ui/form';
import { CatalogoRegisto } from '../types/api';

/**
 * Candidatos a uma carreira (ex. Arquiteto): colaboradores fora dessa
 * carreira, ordenados por proximidade ao cargo de entrada mais acessível —
 * ver GapAnalysisService.sugerirCandidatosCarreira no backend.
 */
export function CandidatosPage() {
  const navigate = useNavigate();
  const { data: carreiras } = useQuery({ queryKey: ['catalogo', 'carreiras'], queryFn: () => endpoints.catalogoListar('carreiras') });
  const [carreiraId, setCarreiraId] = useState<string | null>(null);

  useEffect(() => {
    if (carreiraId || !carreiras || carreiras.length === 0) return;
    const arquiteto = carreiras.find((c) => /arquitet|architect/i.test(String(c.nome ?? '')));
    setCarreiraId(String((arquiteto ?? carreiras[0]).id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carreiras]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['candidatos', carreiraId],
    queryFn: () => endpoints.candidatos(carreiraId!),
    enabled: !!carreiraId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Candidatos a carreira</h1>
          <p className="text-sm text-fiori-text-secondary">
            Colaboradores fora da carreira escolhida, ordenados por proximidade ao cargo de entrada mais acessível.
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <Card>
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block font-medium text-fiori-text">Carreira</span>
          <Select value={carreiraId ?? ''} onChange={(e) => setCarreiraId(e.target.value)}>
            {(carreiras ?? []).map((c: CatalogoRegisto) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.nome)}
              </option>
            ))}
          </Select>
        </label>
      </Card>

      {isLoading && <p className="text-sm text-fiori-text-secondary">A calcular…</p>}
      {error && <p className="text-sm text-fiori-error">Não foi possível carregar os candidatos.</p>}

      {data && (
        <Card title={`Candidatos a ${data.carreiraNome}`}>
          <p className="mb-3 text-sm text-fiori-text-secondary">
            Cargo de entrada mais acessível: <strong>{data.cargoEntradaNome ?? '—'}</strong> ({data.lobsExigidosEntrada} LOBs exigidas)
          </p>
          <DataTable
            data={data.candidatos}
            getRowKey={(c) => c.colaboradorId}
            onRowClick={(c) => navigate(`/colaboradores/${c.colaboradorId}`)}
            searchPlaceholder="Pesquisar por nome, direção, cargo atual…"
            emptyMessage="Sem candidatos fora desta carreira."
            columns={[
              { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
              {
                key: 'direcao',
                header: 'Direção',
                render: (c) => c.direcaoNome ?? '—',
                sortValue: (c) => c.direcaoNome ?? '',
                searchValue: (c) => c.direcaoNome ?? '',
              },
              { key: 'cargoAtual', header: 'Cargo atual', render: (c) => c.cargoNome, sortValue: (c) => c.cargoNome },
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
              { key: 'gap', header: 'Gap', render: (c) => c.gap, sortValue: (c) => c.gap },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
