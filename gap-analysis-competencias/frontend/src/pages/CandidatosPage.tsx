import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { Select } from '../components/ui/form';
import { CandidatoCarreira, CatalogoRegisto } from '../types/api';

const TODOS_OS_CARGOS = '';

function textoElegibilidade(c: CandidatoCarreira): string {
  if (c.apto) return 'Apto';
  const motivos: string[] = [];
  if (!c.aptoAntiguidade) motivos.push('Antiguidade insuficiente');
  if (!c.aptoLobs) motivos.push('LOBs insuficientes');
  return motivos.join(' · ');
}

/**
 * Candidatos a uma carreira (ex. Arquiteto): para cada Cargo-alvo (ou todos
 * os Cargos da carreira), os colaboradores cujo Cargo atual é um
 * predecessor direto desse Cargo em "Progressão de Cargos" — ver
 * GapAnalysisService.sugerirCandidatosCarreira no backend.
 */
export function CandidatosPage() {
  const navigate = useNavigate();
  const { data: carreiras } = useQuery({ queryKey: ['catalogo', 'carreiras'], queryFn: () => endpoints.catalogoListar('carreiras') });
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });
  const [carreiraId, setCarreiraId] = useState<string | null>(null);
  const [cargoId, setCargoId] = useState<string>(TODOS_OS_CARGOS);

  useEffect(() => {
    if (carreiraId || !carreiras || carreiras.length === 0) return;
    const arquiteto = carreiras.find((c) => /arquitet|architect/i.test(String(c.nome ?? '')));
    setCarreiraId(String((arquiteto ?? carreiras[0]).id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carreiras]);

  const cargosDaCarreira = useMemo(
    () => (cargos ?? []).filter((c) => String(c.carreiraId ?? '') === carreiraId),
    [cargos, carreiraId],
  );

  function handleCarreiraChange(novoId: string) {
    setCarreiraId(novoId);
    setCargoId(TODOS_OS_CARGOS);
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['candidatos', carreiraId, cargoId],
    queryFn: () => endpoints.candidatos(carreiraId!, cargoId || undefined),
    enabled: !!carreiraId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Candidatos a carreira</h1>
          <p className="text-sm text-fiori-text-secondary">
            Colaboradores cujo Cargo atual é um predecessor direto (Progressão de Cargos) do Cargo escolhido.
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-4">
          <label className="block max-w-xs text-sm">
            <span className="mb-1 block font-medium text-fiori-text">Carreira</span>
            <Select value={carreiraId ?? ''} onChange={(e) => handleCarreiraChange(e.target.value)}>
              {(carreiras ?? []).map((c: CatalogoRegisto) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.nome)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block max-w-xs text-sm">
            <span className="mb-1 block font-medium text-fiori-text">Cargo</span>
            <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
              <option value={TODOS_OS_CARGOS}>Todos os cargos</option>
              {cargosDaCarreira.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.nome)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {isLoading && <p className="text-sm text-fiori-text-secondary">A calcular…</p>}
      {error && <p className="text-sm text-fiori-error">Não foi possível carregar os candidatos.</p>}

      {data && (
        <Card title={`Candidatos a ${data.carreiraNome}`}>
          <DataTable
            data={data.candidatos}
            getRowKey={(c) => `${c.colaboradorId}::${c.proximoCargoId}`}
            onRowClick={(c) => navigate(`/colaboradores/${c.colaboradorId}`)}
            searchPlaceholder="Pesquisar por nome, direção, cargo atual…"
            emptyMessage="Sem candidatos para este cargo/carreira."
            columns={[
              { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
              {
                key: 'direcao',
                header: 'Direção',
                render: (c) => c.direcaoNome ?? '—',
                sortValue: (c) => c.direcaoNome ?? '',
                searchValue: (c) => c.direcaoNome ?? '',
              },
              { key: 'cargoAtual', header: 'Cargo atual', render: (c) => c.cargoAtualNome, sortValue: (c) => c.cargoAtualNome },
              {
                key: 'proximoCargo',
                header: 'Próximo cargo',
                render: (c) => c.proximoCargoNome,
                sortValue: (c) => c.proximoCargoNome,
              },
              {
                key: 'prontidao',
                header: 'Prontidão',
                render: (c) => (c.prontidao !== null ? `${c.prontidao}%` : '—'),
                sortValue: (c) => c.prontidao ?? -1,
              },
              {
                key: 'lobs',
                header: 'LOBs atingidas',
                render: (c) => `${c.lobsAtingidos} / ${c.lobsExigidos}`,
                sortValue: (c) => c.lobsAtingidos,
              },
              { key: 'gap', header: 'Gap', render: (c) => c.gap, sortValue: (c) => c.gap },
              {
                key: 'antiguidade',
                header: 'Antiguidade',
                render: (c) => (c.anosExperiencia !== null ? `${c.anosExperiencia} anos` : '—'),
                sortValue: (c) => c.anosExperiencia ?? -1,
              },
              {
                key: 'elegibilidade',
                header: 'Elegibilidade',
                render: (c) =>
                  c.apto ? <Badge status="success">Apto</Badge> : <Badge status="warning">{textoElegibilidade(c)}</Badge>,
                sortValue: (c) => (c.apto ? 1 : 0),
                searchValue: (c) => textoElegibilidade(c).toLowerCase(),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
