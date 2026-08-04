import { FormEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { ColaboradorResumo, ResumoImportacao } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { PrintButton } from '../components/ui/PrintButton';
import { Button, Field, Input, Select } from '../components/ui/form';
import { UploadReportModal } from '../components/catalogo/UploadReportModal';

type FiltroRelevancia = 'todos' | 'relevantes' | 'outros';
type Agrupamento = 'nenhum' | 'direcao' | 'area' | 'nucleo';

function ehRelevante(c: ColaboradorResumo): boolean {
  return c.direcaoRelevante || c.areaRelevante || c.nucleoRelevante;
}

function construirColunas(
  navigate: (path: string) => void,
  eliminar: (id: number) => void,
): DataTableColumn<ColaboradorResumo>[] {
  return [
    { key: 'id', header: 'ID', render: (c) => c.id, sortValue: (c) => c.id },
    { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
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
      key: '__acoes',
      header: '',
      render: (c: ColaboradorResumo) => (
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
      ),
    },
  ];
}

/** Restrito a ADMIN_RH/VIEWER (RolesGuard do backend em GET /colaboradores). */
export function ColaboradoresListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const [modalAberto, setModalAberto] = useState(false);
  const [relatorioImportacao, setRelatorioImportacao] = useState<ResumoImportacao | null>(null);
  const [filtro, setFiltro] = useState<FiltroRelevancia>('todos');
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('nenhum');
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
      setRelatorioImportacao({ criados: 0, atualizados: 0, avisos: [], erros: [err instanceof ApiError ? err.message : 'Não foi possível importar o ficheiro.'] }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importar.mutate(file);
  }

  const dadosFiltrados = useMemo(() => {
    const base = data ?? [];
    if (filtro === 'relevantes') return base.filter(ehRelevante);
    if (filtro === 'outros') return base.filter((c) => !ehRelevante(c));
    return base;
  }, [data, filtro]);

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

  const colunas = construirColunas(navigate, eliminar.mutate);

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
      {relatorioImportacao && <UploadReportModal resumo={relatorioImportacao} onClose={() => setRelatorioImportacao(null)} />}
    </div>
  );
}

function CriarColaboradorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });
  const { data: direcoes } = useQuery({ queryKey: ['catalogo', 'direcoes'], queryFn: () => endpoints.catalogoListar('direcoes') });
  const [id, setId] = useState('');
  const [nome, setNome] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [direcaoId, setDirecaoId] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: () =>
      endpoints.criarColaborador({
        id: Number(id),
        nome,
        cargoId: cargoId || undefined,
        direcaoId: direcaoId ? Number(direcaoId) : undefined,
      }),
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
          <Input type="number" value={id} onChange={(e) => setId(e.target.value)} required autoFocus />
        </Field>
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>
        <Field label="Cargo">
          <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
            <option value="">— selecionar —</option>
            {(cargos ?? []).map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.nome)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Direção">
          <Select value={direcaoId} onChange={(e) => setDirecaoId(e.target.value)}>
            <option value="">— selecionar —</option>
            {(direcoes ?? []).map((d) => (
              <option key={String(d.id)} value={String(d.id)}>
                {String(d.nome)}
              </option>
            ))}
          </Select>
        </Field>
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
