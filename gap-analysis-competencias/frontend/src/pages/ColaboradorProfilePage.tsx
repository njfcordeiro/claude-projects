import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Badge } from '../components/ui/Badge';
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
        <Card title="Perfil atual vs. exigido">
          <PerfilRadarChart lobs={gap.lobs} />
        </Card>
      )}

      {gap && gap.lobs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="LOBs" className="lg:col-span-1">
            <div className="space-y-1">
              {gap.lobs.map((l) => (
                <button
                  key={l.lobId}
                  type="button"
                  onClick={() => setLobSelecionada(l.lobId)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                    lobSelecionada === l.lobId ? 'bg-fiori-primary-bg text-fiori-primary' : 'hover:bg-fiori-canvas'
                  }`}
                >
                  <span>{l.lobNome}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-fiori-text-secondary">{l.prontidaoPercentual}%</span>
                    {l.atingido ? <Badge status="success">Atingida</Badge> : <Badge status="warning">Gap</Badge>}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Detalhe da LOB" className="lg:col-span-2">
            {lobSelecionada ? (
              <LobGapDetail colaboradorId={colaboradorId} lobId={lobSelecionada} />
            ) : (
              <p className="text-sm text-fiori-text-secondary">Seleciona uma LOB à esquerda para ver competências, certificações e sugestões.</p>
            )}
          </Card>
        </div>
      )}

      <PdiSection colaboradorId={colaboradorId} />
    </div>
  );
}
