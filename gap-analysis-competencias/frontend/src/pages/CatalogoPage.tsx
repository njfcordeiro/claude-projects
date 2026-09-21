import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, Plus, Trash2, Upload } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { CatalogoRegisto, ResumoImportacao } from '../types/api';
import { Card } from '../components/ui/Card';
import { AjudaContextual } from '../components/ui/AjudaContextual';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/form';
import { PrintButton } from '../components/ui/PrintButton';
import { CatalogoRecordModal } from '../components/catalogo/CatalogoRecordModal';
import { CatalogoCelula } from '../components/catalogo/CatalogoCelula';
import { UploadReportModal } from '../components/catalogo/UploadReportModal';
import { GrelhaCompetencias } from '../components/catalogo/GrelhaCompetencias';
import { GrelhaCertificacoes } from '../components/catalogo/GrelhaCertificacoes';
import { GrelhaFormacoesConcluidas } from '../components/catalogo/GrelhaFormacoesConcluidas';

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

/**
 * Grupos expansíveis (pedido do utilizador: "segmenta as opções em
 * grupos... que podem ser expandidos", replicando o mesmo padrão já usado
 * para "Dados de colaborador") — a lista de tabelas de `CATALOGO_REGISTRY`
 * já vai em 23+, uma lista plana deixou de ser fácil de perceber. Puramente
 * de apresentação (frontend): não implica nenhuma alteração ao registo do
 * backend. Uma tabela nova no registo que não seja adicionada aqui cai
 * automaticamente no grupo "Outras", nunca desaparece da navegação.
 */
interface GrupoCatalogo {
  id: string;
  label: string;
  tabelas: string[];
}
const GRUPOS_CATALOGO: GrupoCatalogo[] = [
  { id: 'organizacao', label: 'Estrutura Organizacional', tabelas: ['direcoes', 'areas', 'nucleos', 'nucleo-areas', 'niveis-gestao', 'locais-trabalho'] },
  { id: 'carreiras', label: 'Carreiras e Cargos', tabelas: ['grupos-carreira', 'carreiras', 'categorias', 'cargos', 'cargo-progressao', 'cargo-requisito-competencia'] },
  { id: 'escalas', label: 'Escalas e Competências', tabelas: ['niveis-tecnicos', 'niveis-comportamentais', 'competencias'] },
  { id: 'certificacoes', label: 'Certificações', tabelas: ['certificacoes', 'certificacao-requisitos'] },
  { id: 'formacoes', label: 'Formações', tabelas: ['formacoes', 'formacao-requisitos'] },
  { id: 'projetos', label: 'Projetos', tabelas: ['projetos', 'projeto-vertentes'] },
  { id: 'lobs', label: 'LOBs', tabelas: ['lobs', 'lob-requisitos-competencia', 'lob-requisitos-certificacao', 'lob-recomendacoes'] },
];

/**
 * Bloco de Download/Upload (para operações em massa) para uma das tabelas
 * especiais acima, seguido da grelha própria de edição linha-a-linha
 * (pedido do utilizador: "também deve ser listada a tabela... e que
 * permita editar, adicionar, remover os dados").
 */
function DadosColaboradorEspecialCard({ item }: { item: (typeof DADOS_COLABORADORES_ITENS)[number] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [relatorio, setRelatorio] = useState<ResumoImportacao | null>(null);

  const importar = useMutation({
    mutationFn: (file: File) => endpoints.dadosColaboradoresImportar(item.chave, file),
    onSuccess: (resumo) => setRelatorio(resumo),
    onError: (err) =>
      setRelatorio({ criados: 0, atualizados: 0, eliminados: 0, erros: [err instanceof ApiError ? err.message : 'Não foi possível importar o ficheiro.'] }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importar.mutate(file);
  }

  return (
    <div className="space-y-4">
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
        {relatorio && <UploadReportModal resumo={relatorio} onClose={() => setRelatorio(null)} />}
      </Card>

      {item.chave === 'competencias-tecnicas' && <GrelhaCompetencias tipo="TECNICA" />}
      {item.chave === 'competencias-comportamentais' && <GrelhaCompetencias tipo="COMPORTAMENTAL" />}
      {item.chave === 'certificacoes' && <GrelhaCertificacoes />}
      {item.chave === 'formacoes-concluidas' && <GrelhaFormacoesConcluidas />}
    </div>
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

  // Tabelas do registo ainda não atribuídas a nenhum GRUPOS_CATALOGO caem
  // aqui — nunca desaparecem da navegação, mesmo que o registo cresça sem
  // este mapa ser atualizado.
  const tabelasAgrupadas = new Set(GRUPOS_CATALOGO.flatMap((g) => g.tabelas));
  const outras = (meta ?? []).filter((t) => !tabelasAgrupadas.has(t.tabela)).map((t) => t.tabela);
  const grupos: GrupoCatalogo[] = [
    ...GRUPOS_CATALOGO,
    ...(outras.length > 0 ? [{ id: 'outras', label: 'Outras', tabelas: outras }] : []),
    { id: 'dados-colaboradores', label: 'Dados de Colaboradores', tabelas: DADOS_COLABORADORES_ITENS.map((i) => `${PREFIXO_ESPECIAL}${i.chave}`) },
  ];
  const grupoDaSelecao = grupos.find((g) => selecao && g.tabelas.includes(selecao))?.id ?? grupos[0]?.id;
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(() => new Set(grupoDaSelecao ? [grupoDaSelecao] : []));
  function alternarGrupo(id: string) {
    setGruposAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

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
      setRelatorioImportacao({ criados: 0, atualizados: 0, eliminados: 0, erros: [err instanceof ApiError ? err.message : 'Não foi possível importar o ficheiro.'] }),
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
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-fiori-text">
          Gestão de Dados
          <AjudaContextual ecraId="gestao-dados" />
        </h1>
        <p className="text-sm text-fiori-text-secondary">Criar, editar, eliminar e importar/exportar as tabelas de catálogo.</p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav className="flex flex-col gap-1 md:w-64 md:shrink-0">
          {grupos.map((g) => {
            const aberto = gruposAbertos.has(g.id);
            return (
              <div key={g.id}>
                <button
                  type="button"
                  onClick={() => alternarGrupo(g.id)}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary hover:bg-fiori-canvas"
                >
                  {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {g.label}
                </button>
                {aberto && (
                  <div className="space-y-0.5 py-0.5 pl-2">
                    {g.tabelas.map((chave) => {
                      const label =
                        meta.find((t) => t.tabela === chave)?.label ??
                        DADOS_COLABORADORES_ITENS.find((i) => `${PREFIXO_ESPECIAL}${i.chave}` === chave)?.label ??
                        chave;
                      const ativo = chave === selecao;
                      return (
                        <button
                          key={chave}
                          type="button"
                          onClick={() => selecionar(chave)}
                          className={`block w-full rounded px-3 py-1.5 text-left text-sm ${
                            ativo ? 'bg-fiori-primary-bg font-medium text-fiori-primary' : 'text-fiori-text hover:bg-fiori-canvas'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
