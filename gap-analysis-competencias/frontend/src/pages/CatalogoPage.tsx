import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { CatalogoRegisto, ResumoImportacao } from '../types/api';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/form';
import { PrintButton } from '../components/ui/PrintButton';
import { CatalogoRecordModal } from '../components/catalogo/CatalogoRecordModal';
import { CatalogoCelula } from '../components/catalogo/CatalogoCelula';
import { UploadReportModal } from '../components/catalogo/UploadReportModal';

/**
 * Export/import em massa dos dados históricos/avaliação dos colaboradores
 * (pedido do utilizador) — deliberadamente FORA de `CATALOGO_REGISTRY`:
 * cada uma tem uma regra de escrita própria (append-only, locking otimista,
 * subida automática de nível — ver DadosColaboradoresService no backend)
 * que a grelha genérica de edição célula-a-célula não modela. Por isso só
 * oferecem Download/Upload aqui, sem tabela editável nem "Nova entrada" —
 * a edição continua a viver nos ecrãs próprios (ficha do colaborador).
 */
const DADOS_COLABORADORES_ITENS: { chave: string; label: string; descricao: string }[] = [
  {
    chave: 'competencias-tecnicas',
    label: 'Competências técnicas dos colaboradores',
    descricao: 'Nível atual de cada colaborador em cada competência Técnica. Reimportar só regista uma nova avaliação quando o nível muda.',
  },
  {
    chave: 'competencias-comportamentais',
    label: 'Competências comportamentais dos colaboradores',
    descricao: 'Nível atual de cada colaborador em cada competência Comportamental. Mesma regra de reimportação da tabela acima.',
  },
  {
    chave: 'certificacoes',
    label: 'Certificações dos colaboradores',
    descricao: 'Estado de cada certificação por colaborador (data de obtenção, validade, anexo). Reimportar atualiza o registo existente.',
  },
  {
    chave: 'formacoes-concluidas',
    label: 'Histórico de formação dos colaboradores',
    descricao: 'Participações em Formações (data, horas, avaliação). Com "id" preenchido atualiza o registo; em branco cria um novo.',
  },
];

const PREFIXO_ESPECIAL = 'especial:';

/** Bloco de Download/Upload para uma das tabelas especiais acima — sem grelha, sem criar/eliminar linha a linha. */
function DadosColaboradorEspecialCard({ item }: { item: (typeof DADOS_COLABORADORES_ITENS)[number] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [relatorio, setRelatorio] = useState<ResumoImportacao | null>(null);

  const importar = useMutation({
    mutationFn: (file: File) => endpoints.dadosColaboradoresImportar(item.chave, file),
    onSuccess: (resumo) => setRelatorio(resumo),
    onError: (err) =>
      setRelatorio({ criados: 0, atualizados: 0, erros: [err instanceof ApiError ? err.message : 'Não foi possível importar o ficheiro.'] }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importar.mutate(file);
  }

  return (
    <Card
      title={item.label}
      action={
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="secondary" onClick={() => endpoints.dadosColaboradoresExportar(item.chave)}>
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
        </div>
      }
    >
      <p className="text-sm text-fiori-text-secondary">{item.descricao}</p>
      {relatorio && (
        <UploadReportModal resumo={relatorio} onClose={() => setRelatorio(null)} />
      )}
    </Card>
  );
}

/**
 * Ecrã genérico de administração de dados — cobre todas as tabelas de
 * `CATALOGO_REGISTRY` (backend) sem código por tabela. ADMIN_RH only.
 * Edição estilo Excel: clica numa célula para editar e grava ao sair do
 * campo — o modal "Nova entrada" fica só para criar registos novos.
 */
export function CatalogoPage() {
  const queryClient = useQueryClient();
  const { data: meta, isLoading: metaLoading } = useQuery({ queryKey: ['catalogo-meta'], queryFn: endpoints.catalogoMeta });
  const [selecaoAtiva, setSelecaoAtiva] = useState<string | null>(null);
  const [modal, setModal] = useState<{ registo: CatalogoRegisto | null } | null>(null);
  const [relatorioImportacao, setRelatorioImportacao] = useState<ResumoImportacao | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selecao = selecaoAtiva ?? meta?.[0]?.tabela ?? null;
  const itemEspecial = selecao?.startsWith(PREFIXO_ESPECIAL)
    ? DADOS_COLABORADORES_ITENS.find((i) => `${PREFIXO_ESPECIAL}${i.chave}` === selecao)
    : undefined;
  const tabela = itemEspecial ? undefined : meta?.find((t) => t.tabela === selecao);

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

  const atualizarCampo = useMutation({
    mutationFn: (dados: CatalogoRegisto) => endpoints.catalogoAtualizar(tabela!.tabela, dados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo', tabela?.tabela] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível gravar esta alteração.'),
  });

  const importar = useMutation({
    mutationFn: (file: File) => endpoints.catalogoImportar(tabela!.tabela, file),
    onSuccess: (resumo) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', tabela?.tabela] });
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

  function identidadeDe(registo: CatalogoRegisto): CatalogoRegisto {
    const chave: CatalogoRegisto = {};
    for (const campo of tabela!.identityFields) chave[campo] = registo[campo];
    return chave;
  }

  function selecionar(chave: string) {
    setSelecaoAtiva(chave);
    setRelatorioImportacao(null);
  }

  if (metaLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (!meta) return <p className="text-sm text-fiori-error">Não foi possível carregar as tabelas de catálogo.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fiori-text">Gestão de Dados</h1>
        <p className="text-sm text-fiori-text-secondary">Criar, editar, eliminar e importar/exportar as tabelas de catálogo.</p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav className="flex gap-1.5 overflow-x-auto pb-1 md:block md:w-56 md:shrink-0 md:space-y-0.5 md:overflow-visible md:pb-0">
          {meta.map((t) => (
            <button
              key={t.tabela}
              type="button"
              onClick={() => selecionar(t.tabela)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm md:block md:w-full md:whitespace-normal md:rounded md:px-3 md:py-2 md:text-left ${
                t.tabela === tabela?.tabela ? 'bg-fiori-primary-bg font-medium text-fiori-primary' : 'text-fiori-text hover:bg-fiori-canvas'
              }`}
            >
              {t.label}
            </button>
          ))}
          <p className="mt-3 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary md:mt-4">
            Dados de colaboradores
          </p>
          {DADOS_COLABORADORES_ITENS.map((item) => (
            <button
              key={item.chave}
              type="button"
              onClick={() => selecionar(`${PREFIXO_ESPECIAL}${item.chave}`)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm md:block md:w-full md:whitespace-normal md:rounded md:px-3 md:py-2 md:text-left ${
                itemEspecial?.chave === item.chave ? 'bg-fiori-primary-bg font-medium text-fiori-primary' : 'text-fiori-text hover:bg-fiori-canvas'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {itemEspecial ? (
            <DadosColaboradorEspecialCard item={itemEspecial} />
          ) : !tabela ? (
            <p className="text-sm text-fiori-error">Não foi possível carregar esta tabela.</p>
          ) : (
            <Card
              title={tabela.label}
              action={
                <div className="flex flex-wrap gap-2 no-print">
                  <PrintButton label="Imprimir" />
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
              {linhasLoading ? (
                <p className="text-sm text-fiori-text-secondary">A carregar…</p>
              ) : (
                <DataTable
                  data={linhas ?? []}
                  getRowKey={(r) => tabela.identityFields.map((c) => String(r[c])).join('|')}
                  onRowClick={(r) => setModal({ registo: r })}
                  columns={[
                    ...tabela.campos.map((c) => ({
                      key: c.key,
                      header: c.label,
                      render: (r: CatalogoRegisto) => (
                        <CatalogoCelula
                          campo={c}
                          registo={r}
                          editavel={!tabela.identityFields.includes(c.key)}
                          onSalvar={async (novoValor) => {
                            await atualizarCampo.mutateAsync({ ...identidadeDe(r), [c.key]: novoValor });
                          }}
                        />
                      ),
                      searchValue: (r: CatalogoRegisto) =>
                        c.tipo === 'relation' ? String(r[`${c.key}Label`] ?? r[c.key] ?? '') : String(r[c.key] ?? ''),
                      sortValue: (r: CatalogoRegisto): string | number => {
                        if (c.tipo === 'relation') return String(r[`${c.key}Label`] ?? r[c.key] ?? '');
                        if (c.tipo === 'boolean') return r[c.key] ? 1 : 0;
                        if (c.tipo === 'int') return Number(r[c.key] ?? 0);
                        return String(r[c.key] ?? '');
                      },
                    })),
                    {
                      key: '__acoes',
                      header: '',
                      render: (r: CatalogoRegisto) => (
                        <div className="flex justify-end no-print">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
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
          )}
        </div>
      </div>

      {modal && tabela && <CatalogoRecordModal tabelaDef={tabela} registoInicial={modal.registo} onClose={() => setModal(null)} />}
      {relatorioImportacao && <UploadReportModal resumo={relatorioImportacao} onClose={() => setRelatorioImportacao(null)} />}
    </div>
  );
}
