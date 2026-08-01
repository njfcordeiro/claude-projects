import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';
import { DimensaoSkillMatrix, SkillMatrixLinha } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { Select } from '../components/ui/form';

/** Interpolação sequencial de UMA cor de magnitude (t=0 claro → t=1 fiori-primary escuro) — nunca um arco-íris para uma única métrica. */
const CLARO = [245, 250, 255];
const ESCURO = [0, 75, 141];

function corCelula(t: number): { background: string; color: string } {
  const clamped = Math.max(0, Math.min(1, t));
  const [r, g, b] = CLARO.map((c0, i) => Math.round(c0 + (ESCURO[i] - c0) * clamped));
  return { background: `rgb(${r},${g},${b})`, color: clamped > 0.55 ? '#FFFFFF' : '#1D2D3E' };
}

/** Heatmap Colaboradores × LOBs/Competências (pedido do utilizador: "matrizes de competências visuais"). ADMIN_RH/MANAGER/VIEWER. */
export function SkillMatrixPage() {
  const navigate = useNavigate();
  const [dimensao, setDimensao] = useState<DimensaoSkillMatrix>('lob');
  const [direcaoId, setDirecaoId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [nucleoId, setNucleoId] = useState('');
  const [cargoId, setCargoId] = useState('');

  const { data: direcoes } = useQuery({ queryKey: ['catalogo', 'direcoes'], queryFn: () => endpoints.catalogoListar('direcoes') });
  const { data: areas } = useQuery({ queryKey: ['catalogo', 'areas'], queryFn: () => endpoints.catalogoListar('areas') });
  const { data: nucleos } = useQuery({ queryKey: ['catalogo', 'nucleos'], queryFn: () => endpoints.catalogoListar('nucleos') });
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });

  const filtros = {
    direcaoId: direcaoId ? Number(direcaoId) : undefined,
    areaId: areaId ? Number(areaId) : undefined,
    nucleoId: nucleoId ? Number(nucleoId) : undefined,
    cargoId: cargoId || undefined,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['skill-matrix', dimensao, filtros],
    queryFn: () => endpoints.skillMatrix(dimensao, filtros),
  });

  const maxValor = dimensao === 'lob' ? 100 : 5;

  const colunas: DataTableColumn<SkillMatrixLinha>[] = [
    { key: 'nome', header: 'Colaborador', render: (l) => l.nome, sortValue: (l) => l.nome },
    ...(data?.colunas ?? []).map((col) => ({
      key: String(col.id),
      header: col.nome,
      sortValue: (l: SkillMatrixLinha) => l.valores[String(col.id)] ?? 0,
      render: (l: SkillMatrixLinha) => {
        const valor = l.valores[String(col.id)] ?? 0;
        const estilo = corCelula(valor / maxValor);
        return (
          <span
            className="inline-block w-full rounded px-2 py-1 text-center text-xs font-medium"
            style={{ background: estilo.background, color: estilo.color }}
          >
            {dimensao === 'lob' ? `${valor}%` : valor}
          </span>
        );
      },
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Skill Matrix</h1>
          <p className="text-sm text-fiori-text-secondary">
            {dimensao === 'lob' ? 'Prontidão (%) de cada colaborador por LOB.' : 'Nível atual (0-5) de cada colaborador por competência.'}
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded bg-fiori-canvas p-0.5">
            <button
              type="button"
              onClick={() => setDimensao('lob')}
              className={`rounded px-2.5 py-1 text-xs font-medium ${dimensao === 'lob' ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'}`}
            >
              Por LOB
            </button>
            <button
              type="button"
              onClick={() => setDimensao('competencia')}
              className={`rounded px-2.5 py-1 text-xs font-medium ${dimensao === 'competencia' ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'}`}
            >
              Por Competência
            </button>
          </div>
          <Select value={direcaoId} onChange={(e) => setDirecaoId(e.target.value)} className="w-auto">
            <option value="">Direção (todas)</option>
            {(direcoes ?? []).map((d) => (
              <option key={String(d.id)} value={String(d.id)}>
                {String(d.nome)}
              </option>
            ))}
          </Select>
          <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="w-auto">
            <option value="">Área (todas)</option>
            {(areas ?? []).map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.nome)}
              </option>
            ))}
          </Select>
          <Select value={nucleoId} onChange={(e) => setNucleoId(e.target.value)} className="w-auto">
            <option value="">Núcleo (todos)</option>
            {(nucleos ?? []).map((n) => (
              <option key={String(n.id)} value={String(n.id)}>
                {String(n.nome)}
              </option>
            ))}
          </Select>
          <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className="w-auto">
            <option value="">Cargo (todos)</option>
            {(cargos ?? []).map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.nome)}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-fiori-text-secondary">A carregar…</p>
        ) : error ? (
          <p className="text-sm text-fiori-error">Não foi possível carregar a skill matrix.</p>
        ) : !data || data.linhas.length === 0 ? (
          <p className="text-sm text-fiori-text-secondary">Sem colaboradores para os filtros selecionados.</p>
        ) : (
          <DataTable
            data={data.linhas}
            getRowKey={(l) => l.colaboradorId}
            onRowClick={(l) => navigate(`/colaboradores/${l.colaboradorId}`)}
            searchPlaceholder="Pesquisar por colaborador…"
            columns={colunas}
          />
        )}
      </Card>
    </div>
  );
}
