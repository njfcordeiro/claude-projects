import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { CatalogoRegisto } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/form';
import { CatalogoRecordModal } from '../components/catalogo/CatalogoRecordModal';

/** Ecrã genérico de administração de dados — cobre todas as tabelas de `CATALOGO_REGISTRY` (backend) sem código por tabela. ADMIN_RH only. */
export function CatalogoPage() {
  const queryClient = useQueryClient();
  const { data: meta, isLoading: metaLoading } = useQuery({ queryKey: ['catalogo-meta'], queryFn: endpoints.catalogoMeta });
  const [tabelaAtiva, setTabelaAtiva] = useState<string | null>(null);
  const [modal, setModal] = useState<{ registo: CatalogoRegisto | null } | null>(null);
  const [mensagemImportacao, setMensagemImportacao] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabela = meta?.find((t) => t.tabela === (tabelaAtiva ?? meta?.[0]?.tabela));

  const { data: linhas, isLoading: linhasLoading } = useQuery({
    queryKey: ['catalogo', tabela?.tabela],
    queryFn: () => endpoints.catalogoListar(tabela!.tabela),
    enabled: !!tabela,
  });

  const eliminar = useMutation({
    mutationFn: (identidade: CatalogoRegisto) => endpoints.catalogoEliminar(tabela!.tabela, identidade),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo', tabela?.tabela] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível eliminar.'),
  });

  const importar = useMutation({
    mutationFn: (file: File) => endpoints.catalogoImportar(tabela!.tabela, file),
    onSuccess: (resumo) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', tabela?.tabela] });
      setMensagemImportacao(
        `Importação concluída: ${resumo.criados} criados, ${resumo.atualizados} atualizados` +
          (resumo.erros.length ? `, ${resumo.erros.length} erro(s): ${resumo.erros.slice(0, 3).join(' | ')}` : '.'),
      );
    },
    onError: (err) => setMensagemImportacao(err instanceof ApiError ? err.message : 'Não foi possível importar o ficheiro.'),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importar.mutate(file);
  }

  function identidadeDe(registo: CatalogoRegisto): CatalogoRegisto {
    const chave: CatalogoRegisto = {};
    for (const campo of tabela!.identityFields) chave[campo] = registo[campo];
    return chave;
  }

  if (metaLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (!meta || !tabela) return <p className="text-sm text-fiori-error">Não foi possível carregar as tabelas de catálogo.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fiori-text">Gestão de Dados</h1>
        <p className="text-sm text-fiori-text-secondary">Criar, editar, eliminar e importar/exportar as tabelas de catálogo.</p>
      </div>

      <div className="flex gap-4">
        <nav className="w-56 shrink-0 space-y-0.5">
          {meta.map((t) => (
            <button
              key={t.tabela}
              type="button"
              onClick={() => {
                setTabelaAtiva(t.tabela);
                setMensagemImportacao(null);
              }}
              className={`block w-full rounded px-3 py-2 text-left text-sm ${
                t.tabela === tabela.tabela ? 'bg-fiori-primary-bg font-medium text-fiori-primary' : 'text-fiori-text hover:bg-fiori-canvas'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <Card
            title={tabela.label}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => endpoints.catalogoExportar(tabela.tabela)}>
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
                <Button onClick={() => setModal({ registo: null })}>
                  <span className="flex items-center gap-1.5">
                    <Plus size={14} /> Nova entrada
                  </span>
                </Button>
              </div>
            }
          >
            {mensagemImportacao && (
              <p className="mb-3 rounded border border-fiori-border bg-fiori-canvas p-2 text-sm text-fiori-text">{mensagemImportacao}</p>
            )}

            {linhasLoading ? (
              <p className="text-sm text-fiori-text-secondary">A carregar…</p>
            ) : (
              <DataTable
                data={linhas ?? []}
                getRowKey={(r) => tabela.identityFields.map((c) => String(r[c])).join('|')}
                columns={[
                  ...tabela.campos.map((c) => ({
                    key: c.key,
                    header: c.label,
                    render: (r: CatalogoRegisto) =>
                      c.tipo === 'boolean' ? (r[c.key] ? 'Sim' : 'Não') : c.tipo === 'relation' ? String(r[`${c.key}Label`] ?? r[c.key] ?? '—') : String(r[c.key] ?? '—'),
                  })),
                  {
                    key: '__acoes',
                    header: '',
                    render: (r: CatalogoRegisto) => (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setModal({ registo: r })} className="text-fiori-text-secondary hover:text-fiori-primary" aria-label="Editar">
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Eliminar este registo?')) eliminar.mutate(identidadeDe(r));
                          }}
                          className="text-fiori-text-secondary hover:text-fiori-error"
                          aria-label="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      </div>

      {modal && <CatalogoRecordModal tabelaDef={tabela} registoInicial={modal.registo} onClose={() => setModal(null)} />}
    </div>
  );
}
