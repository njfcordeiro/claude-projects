import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { LobGapDetail } from '../components/gap/LobGapDetail';
import { PerfilRadarChart } from '../components/gap/PerfilRadarChart';
import { PdiSection } from '../components/pdi/PdiSection';

/**
 * Ficha do colaborador: competências/certificações e % de prontidão para
 * o cargo. Organizado por LOB (não há requisitos de competência "soltos"
 * fora do contexto de uma LOB neste modelo — ver docs/01-modelo-dados.md
 * secção 2) — seleciona uma LOB para ver o detalhe completo.
 */
export function ColaboradorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const colaboradorId = Number(id);
  const [lobSelecionada, setLobSelecionada] = useState<number | null>(null);

  const colaboradorQuery = useQuery({
    queryKey: ['colaborador', colaboradorId],
    queryFn: () => endpoints.colaborador(colaboradorId),
  });
  const gapQuery = useQuery({
    queryKey: ['gap-cargo', colaboradorId],
    queryFn: () => endpoints.gapCargo(colaboradorId),
  });

  if (colaboradorQuery.isLoading || gapQuery.isLoading) {
    return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  }
  if (colaboradorQuery.error) {
    return <p className="text-sm text-fiori-error">Não foi possível carregar este colaborador (sem acesso ou não existe).</p>;
  }

  const colaborador = colaboradorQuery.data;
  const gap = gapQuery.data;
  // Colaborador sem cargo atribuído: backend devolve 400 nesse caso — mostrar isso na página em vez de rebentar.
  const semCargo = gapQuery.error !== null && !gapQuery.isLoading;

  const prontidaoMedia = gap && gap.lobs.length > 0
    ? Math.round(gap.lobs.reduce((soma, l) => soma + l.prontidaoPercentual, 0) / gap.lobs.length)
    : 0;

  // As LOBs já vêm ordenadas com as da área do colaborador primeiro (ver
  // GapAnalysisService.avaliarColaboradorCargo) — aqui só filtramos para
  // ter os dois conjuntos dos dois gráficos pedidos.
  const lobsDaArea = colaborador?.areaId != null ? (gap?.lobs.filter((l) => l.areaId === colaborador.areaId) ?? []) : [];

  return (
    <div className="space-y-6">
      <Card
        action={
          <div className="no-print">
            <PrintButton label="Imprimir ficha" />
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-6">
          {gap && <ProgressRing percentual={prontidaoMedia} label="Prontidão para o cargo" />}
          <div>
            <h1 className="text-xl font-semibold text-fiori-text">{colaborador?.nome}</h1>
            <p className="text-sm text-fiori-text-secondary">
              {gap ? gap.cargoNome : colaborador?.cargoId ?? 'Sem cargo atribuído'}
            </p>
            {gap && (
              <p className="mt-1 text-sm">
                <span className="font-medium text-fiori-text">{gap.lobsAtingidos}</span>
                <span className="text-fiori-text-secondary"> de {gap.lobsExigidos} LOBs exigidas atingidas</span>
                {gap.gap === 0 ? <Badge status="success">Pronto</Badge> : <Badge status="warning">Gap de {gap.gap}</Badge>}
              </p>
            )}
          </div>
        </div>
        {semCargo && (
          <p className="mt-3 text-sm text-fiori-text-secondary">
            Este colaborador não tem cargo atribuído — não é possível calcular a prontidão para um cargo.
          </p>
        )}
      </Card>

      {gap && gap.lobs.length >= 3 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={`Perfil atual vs. exigido — Área${colaborador?.areaNome ? ` (${colaborador.areaNome})` : ''}`}>
            {lobsDaArea.length >= 3 ? (
              <PerfilRadarChart lobs={lobsDaArea} />
            ) : (
              <p className="text-sm text-fiori-text-secondary">
                {colaborador?.areaId == null
                  ? 'Colaborador sem área atribuída.'
                  : 'Menos de 3 LOBs nesta área — sem dados suficientes para o gráfico.'}
              </p>
            )}
          </Card>
          <Card title="Perfil atual vs. exigido — Todas as LOBs">
            <PerfilRadarChart lobs={gap.lobs} />
          </Card>
        </div>
      )}

      {gap && gap.lobs.length > 0 && (
        <div className="space-y-4">
          <Card title="LOBs">
            <DataTable
              data={gap.lobs}
              getRowKey={(l) => l.lobId}
              onRowClick={(l) => setLobSelecionada(l.lobId)}
              searchPlaceholder="Pesquisar por LOB…"
              columns={[
                {
                  key: 'lob',
                  header: 'LOB',
                  render: (l) => (
                    <span className={lobSelecionada === l.lobId ? 'font-medium text-fiori-primary' : 'text-fiori-text'}>
                      {l.lobNome}
                    </span>
                  ),
                  sortValue: (l) => l.lobNome,
                },
                {
                  key: 'competencias',
                  header: 'Competências',
                  render: (l) => (
                    <div className="space-y-0.5 text-xs">
                      <div className={l.competenciasObrigatoriasCumpridas ? 'text-fiori-success' : 'text-fiori-error'}>
                        {l.competenciasObrigatoriasCumpridas ? 'Obrigatórias cumpridas' : 'Obrigatórias em falta'}
                      </div>
                      <div className={l.pontosMinimosCumpridos ? 'text-fiori-success' : 'text-fiori-error'}>
                        Pontos: {l.pontosObtidos}/{l.pontosMinimos}
                      </div>
                    </div>
                  ),
                  sortValue: (l) => (l.competenciasObrigatoriasCumpridas && l.pontosMinimosCumpridos ? 1 : 0),
                  searchValue: (l) => (l.competenciasObrigatoriasCumpridas ? 'obrigatórias cumpridas' : 'obrigatórias em falta'),
                },
                {
                  key: 'certificacoes',
                  header: 'Certificações',
                  render: (l) =>
                    l.certificacoesObrigatoriasTotal === 0 ? (
                      <span className="text-xs text-fiori-text-secondary">Sem obrigatórias</span>
                    ) : (
                      <div className="text-xs">
                        <span className={l.certificacoesObrigatoriasEmFalta === 0 ? 'text-fiori-success' : 'text-fiori-error'}>
                          {l.certificacoesObrigatoriasTotal - l.certificacoesObrigatoriasEmFalta}/{l.certificacoesObrigatoriasTotal} obrigatórias
                        </span>
                        {l.certificacoesObrigatoriasEmFalta > 0 && (
                          <span className="ml-1 text-fiori-error">({l.certificacoesObrigatoriasEmFalta} em falta)</span>
                        )}
                      </div>
                    ),
                  sortValue: (l) => l.certificacoesObrigatoriasEmFalta,
                  searchValue: (l) => (l.certificacoesObrigatoriasEmFalta > 0 ? 'em falta' : 'obrigatórias cumpridas'),
                },
                {
                  key: 'total',
                  header: 'Total',
                  render: (l) => (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-fiori-text-secondary">{l.prontidaoPercentual}%</span>
                      {l.atingido ? <Badge status="success">Atingida</Badge> : <Badge status="warning">Gap</Badge>}
                    </div>
                  ),
                  sortValue: (l) => (l.atingido ? 1 : 0),
                  searchValue: (l) => (l.atingido ? 'atingida' : 'gap'),
                },
              ]}
            />
          </Card>

          <Card title="Detalhe da LOB">
            {lobSelecionada ? (
              <LobGapDetail colaboradorId={colaboradorId} lobId={lobSelecionada} />
            ) : (
              <p className="text-sm text-fiori-text-secondary">Seleciona uma LOB no quadro acima para ver competências, certificações e sugestões.</p>
            )}
          </Card>
        </div>
      )}

      <PdiSection colaboradorId={colaboradorId} />
    </div>
  );
}
