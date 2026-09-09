import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../../api/endpoints';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { CompetenciaComportamentalColaborador } from '../../types/api';

const COLUNAS: DataTableColumn<CompetenciaComportamentalColaborador>[] = [
  { key: 'nome', header: 'Competência', render: (c) => c.competenciaNome, sortValue: (c) => c.competenciaNome },
  {
    key: 'area',
    header: 'Área',
    render: (c) => c.areaNome,
    sortValue: (c) => c.areaNome,
    searchValue: (c) => c.areaNome,
  },
  {
    key: 'nivel',
    header: 'Nível atual',
    render: (c) =>
      c.nivelNome ? (
        <Badge status="info">{c.nivelNome}</Badge>
      ) : (
        <span className="text-fiori-text-secondary">Não avaliada</span>
      ),
    sortValue: (c) => c.nivelId ?? -1,
    searchValue: (c) => c.nivelNome ?? '',
  },
];

/**
 * "Competências Comportamentais" (pedido do utilizador: "um ecrã com as
 * competências comportamentais que o colaborador tem") — mostra sempre o
 * catálogo inteiro de Competências de tipo Comportamental, com o nível
 * atual do colaborador ou "Não avaliada", mesmo princípio do Quadro de
 * LOBs (mostrar tudo, não só o que já está preenchido).
 */
export function CompetenciasComportamentaisSection({ colaboradorId }: { colaboradorId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['competencias-comportamentais', colaboradorId],
    queryFn: () => endpoints.competenciasComportamentais(colaboradorId),
  });

  return (
    <Card title="Competências Comportamentais">
      {isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-fiori-text-secondary">Ainda não há Competências marcadas como Comportamentais em Gestão de Dados.</p>
      ) : (
        <DataTable
          data={data}
          getRowKey={(c) => c.competenciaId}
          searchPlaceholder="Pesquisar por competência ou área…"
          emptyMessage="Sem competências comportamentais."
          columns={COLUNAS}
        />
      )}
    </Card>
  );
}
