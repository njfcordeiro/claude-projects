import { FormEvent, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { ColaboradorResumo, ResumoImportacao } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { PrintButton } from '../components/ui/PrintButton';
import { Button, Field, Input, Select } from '../components/ui/form';
import { UploadReportModal } from '../components/catalogo/UploadReportModal';

/** Restrito a ADMIN_RH/VIEWER (RolesGuard do backend em GET /colaboradores). */
export function ColaboradoresListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const [modalAberto, setModalAberto] = useState(false);
  const [relatorioImportacao, setRelatorioImportacao] = useState<ResumoImportacao | null>(null);
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

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar os colaboradores.</p>;

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
            {
              key: '__acoes',
              header: '',
              render: (c: ColaboradorResumo) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Eliminar ${c.nome}?`)) eliminar.mutate(c.id);
                  }}
                  className="no-print text-fiori-text-secondary hover:text-fiori-error"
                  aria-label="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              ),
            },
          ]}
        />
      </Card>

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
