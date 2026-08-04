import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';
import { DimensaoSkillMatrix, SkillMatrixColuna, SkillMatrixLinha } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { Checkbox, Select } from '../components/ui/form';

/** Interpolação sequencial de UMA cor de magnitude (t=0 claro → t=1 fiori-primary escuro) — nunca um arco-íris para uma única métrica. */
const CLARO = [245, 250, 255];
const ESCURO = [0, 75, 141];

function corCelula(t: number): { background: string; color: string } {
  const clamped = Math.max(0, Math.min(1, t));
  const [r, g, b] = CLARO.map((c0, i) => Math.round(c0 + (ESCURO[i] - c0) * clamped));
  return { background: `rgb(${r},${g},${b})`, color: clamped > 0.55 ? '#FFFFFF' : '#1D2D3E' };
}

/** Botão que abre um popover com checkboxes — usado para "escolher uma ou duas LOBs/competências" sem depender de <select multiple>. */
function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: number; nome: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  function alternar(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className={`rounded border px-3 py-1.5 text-left text-sm ${selected.length > 0 ? 'border-fiori-primary text-fiori-primary' : 'border-fiori-border text-fiori-text'} bg-fiori-surface`}
      >
        {selected.length === 0 ? label : `${label}: ${selected.length}`}
      </button>
      {aberto && (
        <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-fiori-border bg-fiori-surface p-2 shadow-fiori">
          {options.length === 0 && <p className="px-2 py-1 text-xs text-fiori-text-secondary">Sem opções.</p>}
          {options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-fiori-canvas">
              <Checkbox checked={selected.includes(o.id)} onChange={() => alternar(o.id)} />
              {o.nome}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Heatmap Colaboradores × LOBs/Competências (pedido do utilizador: "matrizes de competências visuais"). ADMIN_RH/MANAGER/VIEWER. */
export function SkillMatrixPage() {
  const navigate = useNavigate();
  const [dimensao, setDimensao] = useState<DimensaoSkillMatrix>('lob');
  const [direcaoId, setDirecaoId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [nucleoId, setNucleoId] = useState('');
  const [cargoId, setCargoId] = useState('');

  // Filtros de COLUNAS (quais LOBs/competências aparecem) — independentes dos filtros de linhas acima.
  // Um só destes pode estar ativo de cada vez por separador (pedido do utilizador).
  const [colAreaId, setColAreaId] = useState('');
  const [colLobIds, setColLobIds] = useState<number[]>([]);
  const [colLobIdComp, setColLobIdComp] = useState('');
  const [colCompetenciaIds, setColCompetenciaIds] = useState<number[]>([]);

  function mudarDimensao(nova: DimensaoSkillMatrix) {
    setDimensao(nova);
    setColAreaId('');
    setColLobIds([]);
    setColLobIdComp('');
    setColCompetenciaIds([]);
  }

  const { data: direcoes } = useQuery({ queryKey: ['catalogo', 'direcoes'], queryFn: () => endpoints.catalogoListar('direcoes') });
  const { data: areas } = useQuery({ queryKey: ['catalogo', 'areas'], queryFn: () => endpoints.catalogoListar('areas') });
  const { data: nucleos } = useQuery({ queryKey: ['catalogo', 'nucleos'], queryFn: () => endpoints.catalogoListar('nucleos') });
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });
  const { data: lobs } = useQuery({ queryKey: ['lobs'], queryFn: () => endpoints.lobs() });
  const { data: competenciasCatalogo } = useQuery({
    queryKey: ['catalogo', 'competencias'],
    queryFn: () => endpoints.catalogoListar('competencias'),
  });

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
  const colunasBrutas = useMemo(() => data?.colunas ?? [], [data]);

  const colunasFiltradas = useMemo<SkillMatrixColuna[]>(() => {
    if (dimensao === 'lob') {
      if (colAreaId) return colunasBrutas.filter((c) => c.areaId === Number(colAreaId));
      if (colLobIds.length > 0) return colunasBrutas.filter((c) => colLobIds.includes(c.id));
      return colunasBrutas;
    }
    if (colAreaId) return colunasBrutas.filter((c) => c.areaId === Number(colAreaId));
    if (colLobIdComp) return colunasBrutas.filter((c) => (c.lobIds ?? []).includes(Number(colLobIdComp)));
    if (colCompetenciaIds.length > 0) return colunasBrutas.filter((c) => colCompetenciaIds.includes(c.id));
    return colunasBrutas;
  }, [colunasBrutas, dimensao, colAreaId, colLobIds, colLobIdComp, colCompetenciaIds]);

  const colunas: DataTableColumn<SkillMatrixLinha>[] = [
    { key: 'nome', header: 'Colaborador', render: (l) => l.nome, sortValue: (l) => l.nome },
    ...colunasFiltradas.map((col) => ({
      key: String(col.id),
      header: col.nome,
      group: dimensao === 'lob' ? col.areaNome : undefined,
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
              onClick={() => mudarDimensao('lob')}
              className={`rounded px-2.5 py-1 text-xs font-medium ${dimensao === 'lob' ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'}`}
            >
              Por LOB
            </button>
            <button
              type="button"
              onClick={() => mudarDimensao('competencia')}
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

      <Card title="Colunas">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-fiori-text-secondary">
            {dimensao === 'lob' ? 'Mostrar LOBs de uma Área, ou escolher LOBs específicas:' : 'Mostrar colunas de uma Área, de uma LOB, ou Competências específicas:'}
          </span>
          <Select
            value={colAreaId}
            onChange={(e) => {
              setColAreaId(e.target.value);
              setColLobIds([]);
              setColLobIdComp('');
              setColCompetenciaIds([]);
            }}
            className="w-auto"
          >
            <option value="">Área (todas)</option>
            {(areas ?? []).map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.nome)}
              </option>
            ))}
          </Select>

          {dimensao === 'lob' ? (
            <MultiSelectPopover
              label="LOBs específicas"
              options={colunasBrutas.map((c) => ({ id: c.id, nome: c.nome }))}
              selected={colLobIds}
              onChange={(ids) => {
                setColLobIds(ids);
                setColAreaId('');
              }}
            />
          ) : (
            <>
              <Select
                value={colLobIdComp}
                onChange={(e) => {
                  setColLobIdComp(e.target.value);
                  setColAreaId('');
                  setColCompetenciaIds([]);
                }}
                className="w-auto"
              >
                <option value="">LOB (todas)</option>
                {(lobs ?? []).map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.nome}
                  </option>
                ))}
              </Select>
              <MultiSelectPopover
                label="Competências específicas"
                options={(competenciasCatalogo ?? []).map((c) => ({ id: Number(c.id), nome: String(c.nome) }))}
                selected={colCompetenciaIds}
                onChange={(ids) => {
                  setColCompetenciaIds(ids);
                  setColAreaId('');
                  setColLobIdComp('');
                }}
              />
            </>
          )}
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
            cardOnMobile={false}
          />
        )}
      </Card>
    </div>
  );
}
