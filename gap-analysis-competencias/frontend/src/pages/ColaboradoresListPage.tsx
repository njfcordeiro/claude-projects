import { FormEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { ColaboradorResumo, CreateColaboradorInput, ResumoImportacao, UpdateColaboradorInput } from '../types/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { PrintButton } from '../components/ui/PrintButton';
import { Button, Field, Input, Select } from '../components/ui/form';
import { UploadReportModal } from '../components/catalogo/UploadReportModal';

type FiltroRelevancia = 'todos' | 'relevantes' | 'outros';
type FiltroEstado = 'todos' | 'ativos' | 'inativos';
type Agrupamento = 'nenhum' | 'direcao' | 'area' | 'nucleo';

function ehRelevante(c: ColaboradorResumo): boolean {
  return c.direcaoRelevante || c.areaRelevante || c.nucleoRelevante;
}

/** Opções de filtro derivadas dos próprios colaboradores (só o que existe realmente aparece), ordenadas por nome. */
function opcoesDistintas(pares: [id: number | string | null, nome: string | null][]): { id: string; nome: string }[] {
  const mapa = new Map<string, string>();
  for (const [id, nome] of pares) {
    if (id != null && nome != null) mapa.set(String(id), nome);
  }
  return Array.from(mapa.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

function construirColunas(
  eliminar: (id: number) => void,
  editar: (c: ColaboradorResumo) => void,
): DataTableColumn<ColaboradorResumo>[] {
  return [
    { key: 'id', header: 'ID', render: (c) => c.id, sortValue: (c) => c.id },
    { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
    {
      key: 'estado',
      header: 'Estado',
      render: (c) => (c.ativo ? <Badge status="success">Ativo</Badge> : <Badge status="neutral">Inativo</Badge>),
      sortValue: (c) => (c.ativo ? 1 : 0),
      searchValue: (c) => (c.ativo ? 'ativo' : 'inativo'),
    },
    { key: 'cargo', header: 'Cargo', render: (c) => c.cargoNome ?? '—', sortValue: (c) => c.cargoNome ?? '', searchValue: (c) => c.cargoNome ?? '' },
    { key: 'direcao', header: 'Direção', render: (c) => c.direcaoNome ?? '—', sortValue: (c) => c.direcaoNome ?? '', searchValue: (c) => c.direcaoNome ?? '' },
    { key: 'area', header: 'Área', render: (c) => c.areaNome ?? '—', sortValue: (c) => c.areaNome ?? '', searchValue: (c) => c.areaNome ?? '' },
    { key: 'nucleo', header: 'Núcleo', render: (c) => c.nucleoNome ?? '—', sortValue: (c) => c.nucleoNome ?? '', searchValue: (c) => c.nucleoNome ?? '' },
    {
      key: 'gestor',
      header: 'Gestor',
      render: (c) => (c.managerId ? `${c.managerId} · ${c.managerNome ?? '—'}` : '—'),
      searchValue: (c) => c.managerNome ?? '',
      sortValue: (c) => c.managerNome ?? '',
    },
    {
      key: 'admissao',
      header: 'Admissão',
      render: (c) => (c.dataAdmissao ? new Date(c.dataAdmissao).toLocaleDateString('pt-PT') : '—'),
      sortValue: (c) => c.dataAdmissao ?? '',
    },
    {
      key: 'proximaLob',
      header: 'Próxima LOB',
      render: (c) => c.proximaLobNome ?? '—',
      sortValue: (c) => c.proximaLobNome ?? '',
      searchValue: (c) => c.proximaLobNome ?? '',
    },
    {
      key: 'nivelGestao',
      header: 'Nível de Gestão',
      render: (c) => c.nivelGestaoNome ?? '—',
      sortValue: (c) => c.nivelGestaoNome ?? '',
      searchValue: (c) => c.nivelGestaoNome ?? '',
    },
    {
      key: 'localTrabalho',
      header: 'Local de Trabalho',
      render: (c) => c.localTrabalhoNome ?? '—',
      sortValue: (c) => c.localTrabalhoNome ?? '',
      searchValue: (c) => c.localTrabalhoNome ?? '',
    },
    {
      key: '__acoes',
      header: '',
      render: (c: ColaboradorResumo) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              editar(c);
            }}
            className="no-print text-fiori-text-secondary hover:text-fiori-primary"
            aria-label="Editar"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Eliminar ${c.nome}?`)) eliminar(c.id);
            }}
            className="no-print text-fiori-text-secondary hover:text-fiori-error"
            aria-label="Eliminar"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];
}

/** Restrito a ADMIN_RH/VIEWER (RolesGuard do backend em GET /colaboradores). */
export function ColaboradoresListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const [modalAberto, setModalAberto] = useState(false);
  const [colaboradorEmEdicao, setColaboradorEmEdicao] = useState<ColaboradorResumo | null>(null);
  const [relatorioImportacao, setRelatorioImportacao] = useState<ResumoImportacao | null>(null);
  const [filtro, setFiltro] = useState<FiltroRelevancia>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('nenhum');
  const [filtroDirecaoId, setFiltroDirecaoId] = useState('');
  const [filtroAreaId, setFiltroAreaId] = useState('');
  const [filtroNucleoId, setFiltroNucleoId] = useState('');
  // Chegada a partir de "Evolução de Carreiras" (clicar num Cargo) — pré-seleciona esse Cargo.
  const [filtroCargoId, setFiltroCargoId] = useState((location.state as { cargoId?: string } | null)?.cargoId ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eliminar = useMutation({
    mutationFn: (id: number) => endpoints.eliminarColaborador(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['colaboradores'] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível eliminar.'),
  });

  const importar = useMutation({
    mutationFn: (file: File) => endpoints.colaboradoresImportar(file),
    onSuccess: (resumo) => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      setRelatorioImportacao(resumo);
    },
    onError: (err) =>
      setRelatorioImportacao({ criados: 0, atualizados: 0, erros: [err instanceof ApiError ? err.message : 'Não foi possível importar o ficheiro.'] }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importar.mutate(file);
  }

  const opcoesDirecao = useMemo(() => opcoesDistintas((data ?? []).map((c) => [c.direcaoId, c.direcaoNome])), [data]);
  const opcoesArea = useMemo(() => opcoesDistintas((data ?? []).map((c) => [c.areaId, c.areaNome])), [data]);
  const opcoesNucleo = useMemo(() => opcoesDistintas((data ?? []).map((c) => [c.nucleoId, c.nucleoNome])), [data]);
  const opcoesCargo = useMemo(() => opcoesDistintas((data ?? []).map((c) => [c.cargoId, c.cargoNome])), [data]);

  const dadosFiltrados = useMemo(() => {
    let base = data ?? [];
    if (filtro === 'relevantes') base = base.filter(ehRelevante);
    else if (filtro === 'outros') base = base.filter((c) => !ehRelevante(c));
    if (filtroEstado === 'ativos') base = base.filter((c) => c.ativo);
    else if (filtroEstado === 'inativos') base = base.filter((c) => !c.ativo);
    if (filtroDirecaoId) base = base.filter((c) => String(c.direcaoId) === filtroDirecaoId);
    if (filtroAreaId) base = base.filter((c) => String(c.areaId) === filtroAreaId);
    if (filtroNucleoId) base = base.filter((c) => String(c.nucleoId) === filtroNucleoId);
    if (filtroCargoId) base = base.filter((c) => c.cargoId === filtroCargoId);
    return base;
  }, [data, filtro, filtroEstado, filtroDirecaoId, filtroAreaId, filtroNucleoId, filtroCargoId]);

  const grupos = useMemo(() => {
    if (agrupamento === 'nenhum') return null;
    const chaveDe = (c: ColaboradorResumo) =>
      agrupamento === 'direcao' ? c.direcaoNome : agrupamento === 'area' ? c.areaNome : c.nucleoNome;
    const semLabel =
      agrupamento === 'direcao' ? 'Sem direção' : agrupamento === 'area' ? 'Sem área' : 'Sem núcleo';

    const mapa = new Map<string, ColaboradorResumo[]>();
    for (const c of dadosFiltrados) {
      const chave = chaveDe(c) ?? semLabel;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(c);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => {
      if (a === semLabel) return 1;
      if (b === semLabel) return -1;
      return a.localeCompare(b);
    });
  }, [dadosFiltrados, agrupamento]);

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar os colaboradores.</p>;

  const colunas = construirColunas(eliminar.mutate, setColaboradorEmEdicao);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-fiori-text">Colaboradores</h1>
        <div className="flex flex-wrap gap-2 no-print">
          <PrintButton label="Imprimir" />
          <Button variant="secondary" onClick={() => endpoints.colaboradoresExportar()}>
            <span className="flex items-center gap-1.5">
              <Download size={14} /> Download
            </span>
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importar.isPending}>
            <span className="flex items-center gap-1.5">
              <Upload size={14} /> {importar.isPending ? 'A importar…' : 'Upload'}
            </span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
          <Button onClick={() => setModalAberto(true)}>
            <span className="flex items-center gap-1.5">
              <Plus size={15} /> Novo colaborador
            </span>
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Mostrar</p>
            <div className="flex gap-1 rounded bg-fiori-canvas p-0.5">
              {([
                ['todos', 'Todos'],
                ['relevantes', 'Relevantes'],
                ['outros', 'Outros'],
              ] as [FiltroRelevancia, string][]).map(([valor, label]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setFiltro(valor)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    filtro === valor ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Estado</p>
            <div className="flex gap-1 rounded bg-fiori-canvas p-0.5">
              {([
                ['todos', 'Todos'],
                ['ativos', 'Ativos'],
                ['inativos', 'Inativos'],
              ] as [FiltroEstado, string][]).map(([valor, label]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setFiltroEstado(valor)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    filtroEstado === valor ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Agrupar por</p>
            <div className="flex gap-1 rounded bg-fiori-canvas p-0.5">
              {([
                ['nenhum', 'Nenhum'],
                ['direcao', 'Direção'],
                ['area', 'Área'],
                ['nucleo', 'Núcleo'],
              ] as [Agrupamento, string][]).map(([valor, label]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setAgrupamento(valor)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    agrupamento === valor ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Direção</p>
            <Select value={filtroDirecaoId} onChange={(e) => setFiltroDirecaoId(e.target.value)} className="w-auto">
              <option value="">Todas</option>
              {opcoesDirecao.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Área</p>
            <Select value={filtroAreaId} onChange={(e) => setFiltroAreaId(e.target.value)} className="w-auto">
              <option value="">Todas</option>
              {opcoesArea.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Núcleo</p>
            <Select value={filtroNucleoId} onChange={(e) => setFiltroNucleoId(e.target.value)} className="w-auto">
              <option value="">Todos</option>
              {opcoesNucleo.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Cargo</p>
            <Select value={filtroCargoId} onChange={(e) => setFiltroCargoId(e.target.value)} className="w-auto">
              <option value="">Todos</option>
              {opcoesCargo.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {grupos ? (
        <div className="space-y-4">
          {grupos.map(([nomeGrupo, colaboradoresGrupo]) => (
            <Card key={nomeGrupo} title={`${nomeGrupo} (${colaboradoresGrupo.length})`}>
              <DataTable
                data={colaboradoresGrupo}
                getRowKey={(c) => c.id}
                onRowClick={(c) => navigate(`/colaboradores/${c.id}`)}
                searchPlaceholder="Pesquisar por nome ou cargo…"
                columns={colunas}
              />
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <DataTable
            data={dadosFiltrados}
            getRowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/colaboradores/${c.id}`)}
            initialSearch={searchParams.get('q') ?? ''}
            searchPlaceholder="Pesquisar por nome ou cargo…"
            columns={colunas}
          />
        </Card>
      )}

      {modalAberto && <CriarColaboradorModal onClose={() => setModalAberto(false)} />}
      {colaboradorEmEdicao && (
        <EditarColaboradorModal colaborador={colaboradorEmEdicao} onClose={() => setColaboradorEmEdicao(null)} />
      )}
      {relatorioImportacao && <UploadReportModal resumo={relatorioImportacao} onClose={() => setRelatorioImportacao(null)} />}
    </div>
  );
}

/** Todos os campos editáveis do colaborador (pedido do utilizador: "todos os campos possíveis"), como strings de formulário — convertidos aos tipos certos só no submit de cada modal. */
interface ValoresColaborador {
  nome: string;
  cargoId: string;
  direcaoId: string;
  areaId: string;
  nucleoId: string;
  carreiraId: string;
  categoriaId: string;
  managerId: string;
  proximaLobId: string;
  nivelGestaoId: string;
  localTrabalhoId: string;
  dataAdmissao: string;
  /** 'true' | 'false' — string por uniformidade com o resto do formulário, convertido a boolean só no submit. */
  ativo: string;
}

const VALORES_VAZIOS: ValoresColaborador = {
  nome: '',
  cargoId: '',
  direcaoId: '',
  areaId: '',
  nucleoId: '',
  carreiraId: '',
  categoriaId: '',
  managerId: '',
  proximaLobId: '',
  nivelGestaoId: '',
  localTrabalhoId: '',
  dataAdmissao: '',
  ativo: 'true',
};

/** Conjunto de campos partilhado pelos modais de criar/editar colaborador — evita duplicar 9 <Select>/<Input> em cada um. */
function ColaboradorCamposEditor({
  valores,
  onChange,
}: {
  valores: ValoresColaborador;
  onChange: <K extends keyof ValoresColaborador>(campo: K, valor: string) => void;
}) {
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });
  const { data: direcoes } = useQuery({ queryKey: ['catalogo', 'direcoes'], queryFn: () => endpoints.catalogoListar('direcoes') });
  const { data: areas } = useQuery({ queryKey: ['catalogo', 'areas'], queryFn: () => endpoints.catalogoListar('areas') });
  const { data: nucleos } = useQuery({ queryKey: ['catalogo', 'nucleos'], queryFn: () => endpoints.catalogoListar('nucleos') });
  const { data: carreiras } = useQuery({ queryKey: ['catalogo', 'carreiras'], queryFn: () => endpoints.catalogoListar('carreiras') });
  const { data: categorias } = useQuery({ queryKey: ['catalogo', 'categorias'], queryFn: () => endpoints.catalogoListar('categorias') });
  const { data: lobs } = useQuery({ queryKey: ['lobs'], queryFn: () => endpoints.lobs() });
  const { data: niveisGestao } = useQuery({ queryKey: ['catalogo', 'niveis-gestao'], queryFn: () => endpoints.catalogoListar('niveis-gestao') });
  const { data: locaisTrabalho } = useQuery({
    queryKey: ['catalogo', 'locais-trabalho'],
    queryFn: () => endpoints.catalogoListar('locais-trabalho'),
  });

  return (
    <>
      <Field label="Nome">
        <Input value={valores.nome} onChange={(e) => onChange('nome', e.target.value)} required autoFocus />
      </Field>
      <Field label="Cargo">
        <Select value={valores.cargoId} onChange={(e) => onChange('cargoId', e.target.value)}>
          <option value="">— selecionar —</option>
          {(cargos ?? []).map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {String(c.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Direção">
        <Select value={valores.direcaoId} onChange={(e) => onChange('direcaoId', e.target.value)}>
          <option value="">— selecionar —</option>
          {(direcoes ?? []).map((d) => (
            <option key={String(d.id)} value={String(d.id)}>
              {String(d.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Área">
        <Select value={valores.areaId} onChange={(e) => onChange('areaId', e.target.value)}>
          <option value="">— selecionar —</option>
          {(areas ?? []).map((a) => (
            <option key={String(a.id)} value={String(a.id)}>
              {String(a.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Núcleo">
        <Select value={valores.nucleoId} onChange={(e) => onChange('nucleoId', e.target.value)}>
          <option value="">— selecionar —</option>
          {(nucleos ?? []).map((n) => (
            <option key={String(n.id)} value={String(n.id)}>
              {String(n.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Carreira">
        <Select value={valores.carreiraId} onChange={(e) => onChange('carreiraId', e.target.value)}>
          <option value="">— selecionar —</option>
          {(carreiras ?? []).map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {String(c.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Categoria">
        <Select value={valores.categoriaId} onChange={(e) => onChange('categoriaId', e.target.value)}>
          <option value="">— selecionar —</option>
          {(categorias ?? []).map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {String(c.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="ID do gestor">
        <Input type="number" value={valores.managerId} onChange={(e) => onChange('managerId', e.target.value)} />
      </Field>
      <Field label="Próxima LOB">
        <Select value={valores.proximaLobId} onChange={(e) => onChange('proximaLobId', e.target.value)}>
          <option value="">— nenhuma —</option>
          {(lobs ?? []).map((l) => (
            <option key={l.id} value={String(l.id)}>
              {l.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nível de gestão">
        <Select value={valores.nivelGestaoId} onChange={(e) => onChange('nivelGestaoId', e.target.value)}>
          <option value="">— nenhum —</option>
          {(niveisGestao ?? []).map((n) => (
            <option key={String(n.id)} value={String(n.id)}>
              {String(n.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Local de trabalho">
        <Select value={valores.localTrabalhoId} onChange={(e) => onChange('localTrabalhoId', e.target.value)}>
          <option value="">— nenhum —</option>
          {(locaisTrabalho ?? []).map((l) => (
            <option key={String(l.id)} value={String(l.id)}>
              {String(l.nome)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Data de admissão">
        <Input type="date" value={valores.dataAdmissao} onChange={(e) => onChange('dataAdmissao', e.target.value)} />
      </Field>
      <Field label="Estado">
        <Select value={valores.ativo} onChange={(e) => onChange('ativo', e.target.value)}>
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </Select>
      </Field>
    </>
  );
}

function CriarColaboradorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [id, setId] = useState('');
  const [valores, setValores] = useState<ValoresColaborador>(VALORES_VAZIOS);
  const [erro, setErro] = useState<string | null>(null);

  function onChange<K extends keyof ValoresColaborador>(campo: K, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  const criar = useMutation({
    mutationFn: () => {
      const dto: CreateColaboradorInput = {
        id: Number(id),
        nome: valores.nome,
        cargoId: valores.cargoId || undefined,
        direcaoId: valores.direcaoId ? Number(valores.direcaoId) : undefined,
        areaId: valores.areaId ? Number(valores.areaId) : undefined,
        nucleoId: valores.nucleoId ? Number(valores.nucleoId) : undefined,
        carreiraId: valores.carreiraId || undefined,
        categoriaId: valores.categoriaId || undefined,
        managerId: valores.managerId ? Number(valores.managerId) : undefined,
        proximaLobId: valores.proximaLobId ? Number(valores.proximaLobId) : undefined,
        nivelGestaoId: valores.nivelGestaoId ? Number(valores.nivelGestaoId) : undefined,
        localTrabalhoId: valores.localTrabalhoId ? Number(valores.localTrabalhoId) : undefined,
        dataAdmissao: valores.dataAdmissao || undefined,
        ativo: valores.ativo === 'true',
      };
      return endpoints.criarColaborador(dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      onClose();
    },
    onError: (err) => setErro(err instanceof ApiError ? err.message : 'Não foi possível criar o colaborador.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    criar.mutate();
  }

  return (
    <Modal title="Novo colaborador" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="ID">
          <Input type="number" value={id} onChange={(e) => setId(e.target.value)} required />
        </Field>
        <ColaboradorCamposEditor valores={valores} onChange={onChange} />
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? 'A criar…' : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Edita um colaborador existente — mesmo padrão de locking otimista por `version` das restantes escritas (ver EditarProximaLobModal na ficha do colaborador). */
function EditarColaboradorModal({ colaborador, onClose }: { colaborador: ColaboradorResumo; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<ValoresColaborador>({
    nome: colaborador.nome,
    cargoId: colaborador.cargoId ?? '',
    direcaoId: colaborador.direcaoId != null ? String(colaborador.direcaoId) : '',
    areaId: colaborador.areaId != null ? String(colaborador.areaId) : '',
    nucleoId: colaborador.nucleoId != null ? String(colaborador.nucleoId) : '',
    carreiraId: colaborador.carreiraId ?? '',
    categoriaId: colaborador.categoriaId ?? '',
    managerId: colaborador.managerId != null ? String(colaborador.managerId) : '',
    proximaLobId: colaborador.proximaLobId != null ? String(colaborador.proximaLobId) : '',
    nivelGestaoId: colaborador.nivelGestaoId != null ? String(colaborador.nivelGestaoId) : '',
    localTrabalhoId: colaborador.localTrabalhoId != null ? String(colaborador.localTrabalhoId) : '',
    dataAdmissao: colaborador.dataAdmissao ?? '',
    ativo: colaborador.ativo ? 'true' : 'false',
  });
  const [erro, setErro] = useState<string | null>(null);

  function onChange<K extends keyof ValoresColaborador>(campo: K, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  const guardar = useMutation({
    mutationFn: () => {
      const dto: UpdateColaboradorInput = {
        nome: valores.nome,
        cargoId: valores.cargoId || undefined,
        direcaoId: valores.direcaoId ? Number(valores.direcaoId) : undefined,
        areaId: valores.areaId ? Number(valores.areaId) : undefined,
        nucleoId: valores.nucleoId ? Number(valores.nucleoId) : undefined,
        carreiraId: valores.carreiraId || undefined,
        categoriaId: valores.categoriaId || undefined,
        managerId: valores.managerId ? Number(valores.managerId) : undefined,
        proximaLobId: valores.proximaLobId ? Number(valores.proximaLobId) : null,
        nivelGestaoId: valores.nivelGestaoId ? Number(valores.nivelGestaoId) : null,
        localTrabalhoId: valores.localTrabalhoId ? Number(valores.localTrabalhoId) : null,
        dataAdmissao: valores.dataAdmissao || undefined,
        ativo: valores.ativo === 'true',
        version: colaborador.version,
      };
      return endpoints.atualizarColaborador(colaborador.id, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['colaborador', colaborador.id] });
      onClose();
    },
    onError: (err) =>
      setErro(
        err instanceof ApiError && err.status === 409
          ? 'Este colaborador foi alterado por outra pessoa entretanto — fecha e reabre para ver os dados atuais.'
          : err instanceof ApiError
            ? err.message
            : 'Não foi possível gravar.',
      ),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    guardar.mutate();
  }

  return (
    <Modal title={`Editar: ${colaborador.nome}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="ID">
          <Input value={colaborador.id} disabled />
        </Field>
        <ColaboradorCamposEditor valores={valores} onChange={onChange} />
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
