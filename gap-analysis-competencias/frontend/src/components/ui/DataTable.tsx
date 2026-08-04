import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Se omitido, a coluna não é ordenável. */
  sortValue?: (row: T) => string | number;
  /** Usado pela pesquisa de texto livre quando `render` não é uma string simples. */
  searchValue?: (row: T) => string;
  /** Rótulo de agrupamento — colunas consecutivas com o mesmo grupo ganham uma linha de cabeçalho extra com colspan (ex.: LOBs agrupadas por Área). */
  group?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Pré-preenche a pesquisa (ex.: vinda da pesquisa global do ShellBar). */
  initialSearch?: string;
  /**
   * Abaixo de md, as linhas passam de <tr> tabular para cartões empilhados
   * (label:valor por campo) — melhor para telemóvel do que scroll horizontal.
   * Desliga para tabelas largas onde "cartão por linha" não faz sentido
   * (ex.: Skill Matrix, com uma coluna por LOB/competência) — essas mantêm
   * scroll horizontal em todos os tamanhos de ecrã.
   */
  cardOnMobile?: boolean;
}

/** Tabela densa com filtro por texto e ordenação por coluna — estilo Fiori (ver index.css .fiori-table). */
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  searchPlaceholder = 'Pesquisar…',
  emptyMessage = 'Sem resultados.',
  initialSearch = '',
  cardOnMobile = true,
}: DataTableProps<T>) {
  const [termo, setTermo] = useState(initialSearch);
  const [ordenacao, setOrdenacao] = useState<{ chave: string; direcao: 'asc' | 'desc' } | null>(null);

  const dadosFiltrados = useMemo(() => {
    if (!termo.trim()) return data;
    const termoLower = termo.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const texto = col.searchValue ? col.searchValue(row) : String(col.render(row) ?? '');
        return texto.toLowerCase().includes(termoLower);
      }),
    );
  }, [data, termo, columns]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenacao) return dadosFiltrados;
    const coluna = columns.find((c) => c.key === ordenacao.chave);
    if (!coluna?.sortValue) return dadosFiltrados;
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...dadosFiltrados].sort((a, b) => {
      const va = coluna.sortValue!(a);
      const vb = coluna.sortValue!(b);
      return va < vb ? -sinal : va > vb ? sinal : 0;
    });
  }, [dadosFiltrados, ordenacao, columns]);

  function alternarOrdenacao(chave: string) {
    setOrdenacao((atual) => {
      if (atual?.chave !== chave) return { chave, direcao: 'asc' };
      if (atual.direcao === 'asc') return { chave, direcao: 'desc' };
      return null;
    });
  }

  // Colunas com header (a maioria) mostram-se como "label: valor" no cartão;
  // colunas sem header (tipicamente uma coluna final de ícones de ação) vão
  // para uma faixa de ações no fundo do cartão, sem label.
  const colunasComLabel = columns.filter((c) => c.header.trim() !== '');
  const colunasSemLabel = columns.filter((c) => c.header.trim() === '');

  // Linha de cabeçalho de grupo (ex.: Área acima das LOBs) — funde colunas
  // consecutivas com o mesmo `group` num único <th colSpan>.
  const temGrupos = columns.some((c) => c.group);
  const gruposDeCabecalho: { label: string; span: number }[] = [];
  if (temGrupos) {
    for (const col of columns) {
      const label = col.group ?? '';
      const ultimo = gruposDeCabecalho[gruposDeCabecalho.length - 1];
      if (ultimo && ultimo.label === label) ultimo.span += 1;
      else gruposDeCabecalho.push({ label, span: 1 });
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded border border-fiori-border bg-fiori-surface px-3 py-1.5">
        <Search size={16} className="text-fiori-text-secondary" aria-hidden="true" />
        <input
          type="text"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full border-none bg-transparent text-sm text-fiori-text outline-none placeholder:text-fiori-text-secondary"
        />
      </div>

      <div className={`overflow-x-auto rounded border border-fiori-border bg-fiori-surface ${cardOnMobile ? 'hidden md:block' : ''}`}>
        <table className="fiori-table">
          <thead>
            {temGrupos && (
              <tr>
                {gruposDeCabecalho.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.span}
                    className={`text-center ${g.label ? 'border-l border-fiori-border/70' : ''}`}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {columns.map((col) => (
                <th key={col.key}>
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => alternarOrdenacao(col.key)}
                      className="inline-flex items-center gap-1 hover:text-fiori-primary"
                    >
                      {col.header}
                      {ordenacao?.chave === col.key ? (
                        ordenacao.direcao === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dadosOrdenados.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-fiori-text-secondary">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {dadosOrdenados.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cardOnMobile && (
        <div className="space-y-2 md:hidden">
          {dadosOrdenados.length === 0 && (
            <p className="rounded border border-fiori-border bg-fiori-surface py-6 text-center text-sm text-fiori-text-secondary">
              {emptyMessage}
            </p>
          )}
          {dadosOrdenados.map((row) => (
            <div
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`rounded border border-fiori-border bg-fiori-surface p-3 ${onRowClick ? 'cursor-pointer active:bg-fiori-canvas' : ''}`}
            >
              {colunasComLabel.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0">
                  <span className="shrink-0 text-fiori-text-secondary">{col.header}</span>
                  <span className="text-right text-fiori-text">{col.render(row)}</span>
                </div>
              ))}
              {colunasSemLabel.length > 0 && (
                <div className="mt-1 flex justify-end gap-2 border-t border-fiori-border/70 pt-2">
                  {colunasSemLabel.map((col) => (
                    <span key={col.key}>{col.render(row)}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-1 text-xs text-fiori-text-secondary">
        {dadosOrdenados.length} de {data.length} resultado{data.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}
