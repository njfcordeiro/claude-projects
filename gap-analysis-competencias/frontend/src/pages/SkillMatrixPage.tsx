import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, Pencil, Upload, XCircle } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { DimensaoSkillMatrix, ResumoImportacaoNiveis, SkillMatrixColuna, SkillMatrixLinha } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { Button, Checkbox, Field, Select } from '../components/ui/form';
import { Modal } from '../components/ui/Modal';
import { AvaliarCompetenciaModal } from '../components/gap/AvaliarCompetenciaModal';
import { useAuth } from '../auth/useAuth';

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
        className={`w-full rounded border px-3 py-1.5 text-left text-sm ${selected.length > 0 ? 'border-fiori-primary text-fiori-primary' : 'border-fiori-border text-fiori-text'} bg-fiori-surface`}
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

/** Relatório pós-upload dos níveis de competência — mesmo espírito visual de UploadReportModal, adaptado ao formato "processadas/criadas/semAlteracao". */
function RelatorioNiveisModal({ resumo, onClose }: { resumo: ResumoImportacaoNiveis; onClose: () => void }) {
  const semErros = resumo.erros.length === 0;
  return (
    <Modal title="Resultado da importação de níveis" onClose={onClose}>
      <div className="space-y-4">
        <div
          className={`flex items-start gap-2 rounded border p-3 text-sm ${semErros ? 'border-fiori-success bg-fiori-success-bg' : 'border-fiori-warning bg-fiori-warning-bg'}`}
        >
          {semErros ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-fiori-success" />
          ) : (
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-fiori-warning" />
          )}
          <p className="text-fiori-text">
            <span className="font-medium">{semErros ? 'Sucesso!' : 'Importação concluída com avisos.'}</span> {resumo.processadas} linha
            {resumo.processadas === 1 ? '' : 's'} processada{resumo.processadas === 1 ? '' : 's'}: {resumo.criadas} avaliaç
            {resumo.criadas === 1 ? 'ão criada' : 'ões criadas'}, {resumo.semAlteracao} sem alteração face ao nível atual.
          </p>
        </div>

        {resumo.erros.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fiori-error">
              <XCircle size={14} /> Erros ({resumo.erros.length}) — linhas não gravadas
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-fiori-error bg-fiori-error-bg p-2 text-xs text-fiori-text">
              {resumo.erros.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

type Agrupamento = 'nenhum' | 'direcao' | 'area' | 'nucleo' | 'nucleoArea';

const LABEL_AGRUPAMENTO: Record<Agrupamento, string> = {
  nenhum: 'Nenhum',
  direcao: 'Direção',
  area: 'Área',
  nucleo: 'Núcleo',
  nucleoArea: 'Núcleo + Área',
};

function chaveDeGrupo(l: SkillMatrixLinha, agrupamento: Agrupamento): string | null {
  if (agrupamento === 'direcao') return l.direcaoNome;
  if (agrupamento === 'area') return l.areaNome;
  if (agrupamento === 'nucleo') return l.nucleoNome;
  if (agrupamento === 'nucleoArea') {
    if (!l.nucleoNome && !l.areaNome) return null;
    return `${l.nucleoNome ?? 'Sem núcleo'} / ${l.areaNome ?? 'Sem área'}`;
  }
  return null;
}

/** Heatmap Colaboradores × LOBs/Competências (pedido do utilizador: "matrizes de competências visuais"). ADMIN_RH/MANAGER/VIEWER. */
export function SkillMatrixPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const podeEditarNiveis = user?.role === 'ADMIN_RH' || user?.role === 'MANAGER';
  const [dimensao, setDimensao] = useState<DimensaoSkillMatrix>('lob');
  const [direcaoId, setDirecaoId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [nucleoId, setNucleoId] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('nenhum');

  // Filtros de COLUNAS (quais LOBs/competências aparecem) — independentes dos filtros de linhas acima.
  // Um só destes pode estar ativo de cada vez por separador (pedido do utilizador).
  const [colAreaId, setColAreaId] = useState('');
  const [colLobIds, setColLobIds] = useState<number[]>([]);
  const [colLobIdComp, setColLobIdComp] = useState('');
  const [colCompetenciaIds, setColCompetenciaIds] = useState<number[]>([]);

  const [celulaEmEdicao, setCelulaEmEdicao] = useState<{ colaboradorId: number; competenciaId: number; competenciaNome: string } | null>(
    null,
  );
  const [relatorioNiveis, setRelatorioNiveis] = useState<ResumoImportacaoNiveis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const importarNiveis = useMutation({
    mutationFn: (file: File) => endpoints.skillMatrixImportar(file),
    onSuccess: (resumo) => {
      queryClient.invalidateQueries({ queryKey: ['skill-matrix'] });
      setRelatorioNiveis(resumo);
    },
    onError: (err) =>
      setRelatorioNiveis({
        processadas: 0,
        criadas: 0,
        semAlteracao: 0,
        erros: [err instanceof ApiError ? err.message : 'Não foi possível importar o ficheiro.'],
      }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importarNiveis.mutate(file);
  }

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
    { key: 'id', header: 'ID', render: (l) => l.colaboradorId, sortValue: (l) => l.colaboradorId },
    { key: 'nome', header: 'Colaborador', render: (l) => l.nome, sortValue: (l) => l.nome },
    ...colunasFiltradas.map((col) => ({
      key: String(col.id),
      header: col.nome,
      group: dimensao === 'lob' ? col.areaNome : undefined,
      sortValue: (l: SkillMatrixLinha) => l.valores[String(col.id)] ?? 0,
      render: (l: SkillMatrixLinha) => {
        const valor = l.valores[String(col.id)] ?? 0;
        const estilo = corCelula(valor / maxValor);
        const editavel = dimensao === 'competencia' && podeEditarNiveis;
        return (
          <span
            className={`inline-flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-center text-xs font-medium ${editavel ? 'cursor-pointer hover:ring-1 hover:ring-fiori-primary' : ''}`}
            style={{ background: estilo.background, color: estilo.color }}
            onClick={
              editavel
                ? (e) => {
                    e.stopPropagation();
                    setCelulaEmEdicao({ colaboradorId: l.colaboradorId, competenciaId: col.id, competenciaNome: col.nome });
                  }
                : undefined
            }
            title={editavel ? 'Clicar para alterar o nível' : undefined}
          >
            {dimensao === 'lob' ? `${valor}%` : valor}
            {editavel && <Pencil size={10} className="opacity-60" />}
          </span>
        );
      },
    })),
  ];

  const grupos = useMemo(() => {
    if (agrupamento === 'nenhum' || !data) return null;
    const semLabel = `Sem ${LABEL_AGRUPAMENTO[agrupamento].toLowerCase()}`;
    const mapa = new Map<string, SkillMatrixLinha[]>();
    for (const l of data.linhas) {
      const chave = chaveDeGrupo(l, agrupamento) ?? semLabel;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(l);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => {
      if (a === semLabel) return 1;
      if (b === semLabel) return -1;
      return a.localeCompare(b);
    });
  }, [data, agrupamento]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Skill Matrix</h1>
          <p className="text-sm text-fiori-text-secondary">
            {dimensao === 'lob' ? 'Prontidão (%) de cada colaborador por LOB.' : 'Nível atual (0-5) de cada colaborador por competência.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          {dimensao === 'competencia' && podeEditarNiveis && (
            <>
              <Button
                variant="secondary"
                onClick={() => endpoints.skillMatrixExportar(filtros, colunasFiltradas.map((c) => c.id))}
              >
                <span className="flex items-center gap-1.5">
                  <Download size={14} /> Download níveis
                </span>
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importarNiveis.isPending}>
                <span className="flex items-center gap-1.5">
                  <Upload size={14} /> {importarNiveis.isPending ? 'A importar…' : 'Upload níveis'}
                </span>
              </Button>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
            </>
          )}
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Ver">
          <div className="space-y-3">
            <div className="flex gap-1 rounded bg-fiori-canvas p-0.5">
              <button
                type="button"
                onClick={() => mudarDimensao('lob')}
                className={`flex-1 rounded px-2.5 py-1 text-xs font-medium ${dimensao === 'lob' ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'}`}
              >
                Por LOB
              </button>
              <button
                type="button"
                onClick={() => mudarDimensao('competencia')}
                className={`flex-1 rounded px-2.5 py-1 text-xs font-medium ${dimensao === 'competencia' ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'}`}
              >
                Por Competência
              </button>
            </div>
            <Field label="Agrupar colaboradores por">
              <Select value={agrupamento} onChange={(e) => setAgrupamento(e.target.value as Agrupamento)}>
                {(Object.keys(LABEL_AGRUPAMENTO) as Agrupamento[]).map((a) => (
                  <option key={a} value={a}>
                    {LABEL_AGRUPAMENTO[a]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Filtrar colaboradores">
          <div className="space-y-3">
            <Field label="Direção">
              <Select value={direcaoId} onChange={(e) => setDirecaoId(e.target.value)}>
                <option value="">Todas</option>
                {(direcoes ?? []).map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {String(d.nome)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Área">
              <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">Todas</option>
                {(areas ?? []).map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {String(a.nome)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Núcleo">
              <Select value={nucleoId} onChange={(e) => setNucleoId(e.target.value)}>
                <option value="">Todos</option>
                {(nucleos ?? []).map((n) => (
                  <option key={String(n.id)} value={String(n.id)}>
                    {String(n.nome)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cargo">
              <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
                <option value="">Todos</option>
                {(cargos ?? []).map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.nome)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Colunas">
          <div className="space-y-3">
            <p className="text-xs text-fiori-text-secondary">
              {dimensao === 'lob'
                ? 'Mostrar as LOBs de uma Área, ou escolher LOBs específicas — só um filtro de cada vez.'
                : 'Mostrar as competências de uma Área, de uma LOB, ou escolher competências específicas — só um filtro de cada vez.'}
            </p>
            <Field label="Área">
              <Select
                value={colAreaId}
                onChange={(e) => {
                  setColAreaId(e.target.value);
                  setColLobIds([]);
                  setColLobIdComp('');
                  setColCompetenciaIds([]);
                }}
              >
                <option value="">Todas</option>
                {(areas ?? []).map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {String(a.nome)}
                  </option>
                ))}
              </Select>
            </Field>

            {dimensao === 'lob' ? (
              <Field label="LOBs específicas">
                <MultiSelectPopover
                  label="LOBs específicas"
                  options={colunasBrutas.map((c) => ({ id: c.id, nome: c.nome }))}
                  selected={colLobIds}
                  onChange={(ids) => {
                    setColLobIds(ids);
                    setColAreaId('');
                  }}
                />
              </Field>
            ) : (
              <>
                <Field label="LOB">
                  <Select
                    value={colLobIdComp}
                    onChange={(e) => {
                      setColLobIdComp(e.target.value);
                      setColAreaId('');
                      setColCompetenciaIds([]);
                    }}
                  >
                    <option value="">Todas</option>
                    {(lobs ?? []).map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.nome}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Competências específicas">
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
                </Field>
              </>
            )}
          </div>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <p className="text-sm text-fiori-text-secondary">A carregar…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="text-sm text-fiori-error">Não foi possível carregar a skill matrix.</p>
        </Card>
      ) : !data || data.linhas.length === 0 ? (
        <Card>
          <p className="text-sm text-fiori-text-secondary">Sem colaboradores para os filtros selecionados.</p>
        </Card>
      ) : grupos ? (
        <div className="space-y-4">
          {grupos.map(([nomeGrupo, linhasGrupo]) => (
            <Card key={nomeGrupo} title={`${nomeGrupo} (${linhasGrupo.length})`}>
              <DataTable
                data={linhasGrupo}
                getRowKey={(l) => l.colaboradorId}
                onRowClick={(l) => navigate(`/colaboradores/${l.colaboradorId}`)}
                searchPlaceholder="Pesquisar por colaborador…"
                columns={colunas}
                cardOnMobile={false}
              />
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <DataTable
            data={data.linhas}
            getRowKey={(l) => l.colaboradorId}
            onRowClick={(l) => navigate(`/colaboradores/${l.colaboradorId}`)}
            searchPlaceholder="Pesquisar por colaborador…"
            columns={colunas}
            cardOnMobile={false}
          />
        </Card>
      )}

      {celulaEmEdicao && (
        <AvaliarCompetenciaModal
          colaboradorId={celulaEmEdicao.colaboradorId}
          competenciaId={celulaEmEdicao.competenciaId}
          competenciaNome={celulaEmEdicao.competenciaNome}
          onClose={() => setCelulaEmEdicao(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['skill-matrix'] });
            setCelulaEmEdicao(null);
          }}
        />
      )}

      {relatorioNiveis && <RelatorioNiveisModal resumo={relatorioNiveis} onClose={() => setRelatorioNiveis(null)} />}
    </div>
  );
}
