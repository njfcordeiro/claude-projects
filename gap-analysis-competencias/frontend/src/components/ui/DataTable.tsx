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

      <div className="overflow-x-auto rounded border border-fiori-border bg-fiori-surface">
        <table className="fiori-table">
          <thead>
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
      <p className="mt-1 text-xs text-fiori-text-secondary">
        {dadosOrdenados.length} de {data.length} resultado{data.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}
