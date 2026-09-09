import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../../api/endpoints';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/form';
import { NivelPill } from '../gap/NivelPill';

/**
 * Perfil de Competências Comportamentais de um Cargo à escolha (pedido do
 * utilizador) — por omissão o cargo atual do colaborador, mas qualquer
 * outro pode ser escolhido para ver o que falta atingir aí. Ecrã apenas de
 * visualização: conjuga as Competências Comportamentais do colaborador
 * (secção ao lado) com o Perfil de Competências do Cargo selecionado —
 * mesmo motor (GapAnalysisService.avaliarColaboradorPerfilCargo) que
 * PdiService.gerarParaCargoAtual/...ProximoCargo já usa, mas sem gerar
 * nada, só mostrar o gap.
 */
export function PerfilCargoComportamentalSection({ colaboradorId, cargoAtualId }: { colaboradorId: number; cargoAtualId: string | null }) {
  const [cargoId, setCargoId] = useState(cargoAtualId ?? '');
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });
  const { data, isLoading, error } = useQuery({
    queryKey: ['gap-perfil-cargo', colaboradorId, cargoId],
    queryFn: () => endpoints.gapPerfilCargo(colaboradorId, cargoId),
    enabled: !!cargoId,
  });

  return (
    <Card
      title="Perfil de Competências Comportamentais por Cargo"
      action={
        <div className="no-print">
          <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className="w-auto">
            <option value="">— selecionar cargo —</option>
            {(cargos ?? []).map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.nome)}
                {String(c.id) === cargoAtualId ? ' (cargo atual)' : ''}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      {!cargoId ? (
        <p className="text-sm text-fiori-text-secondary">
          {cargoAtualId ? 'A carregar cargo atual…' : 'Este colaborador não tem cargo atribuído — escolhe um cargo para comparar.'}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A calcular…</p>
      ) : error || !data ? (
        <p className="text-sm text-fiori-error">Não foi possível calcular o perfil deste cargo.</p>
      ) : data.competencias.length === 0 ? (
        <p className="text-sm text-fiori-text-secondary">
          O cargo "{data.cargoNome}" ainda não tem Perfil de Competências definido em Gestão de Dados.
        </p>
      ) : (
        <div className="space-y-2">
          {data.competencias.map((c) => (
            <div key={c.competenciaId} className="flex items-center justify-between gap-3 rounded border border-fiori-border p-3">
              <span className="text-sm font-medium text-fiori-text">{c.competenciaNome}</span>
              <div className="flex shrink-0 items-center gap-3">
                <NivelPill atual={c.nivelAtual} exigido={c.nivelExigido} />
                {c.cumprido ? <Badge status="success">Cumprido</Badge> : <Badge status="error">Gap</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
