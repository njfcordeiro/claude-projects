import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button, Select } from '../ui/form';
import { AvaliarCompetenciaModal } from '../gap/AvaliarCompetenciaModal';

/**
 * "Competências Comportamentais" (pedido do utilizador: um ecrã com as
 * competências comportamentais que o colaborador tem, editável — adicionar,
 * remover, editar o nível). Ao contrário do Quadro de LOBs, não mostra o
 * catálogo inteiro com "Não avaliada": só o que foi mesmo atribuído a este
 * colaborador, porque a atribuição em si é manual (pedido do utilizador:
 * "não deves assumir por defeito que as pessoas teem as competencias
 * comportamentais todas"). Reaproveita AvaliarCompetenciaModal (mesmo
 * componente de avaliação de competências Técnicas) tanto para adicionar
 * como para editar o nível — a única operação nova aqui é remover, que o
 * modal de avaliação não faz (ver eliminarCompetenciaColaborador).
 */
export function CompetenciasComportamentaisSection({ colaboradorId }: { colaboradorId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [novaCompetenciaId, setNovaCompetenciaId] = useState('');
  const [competenciaEmEdicao, setCompetenciaEmEdicao] = useState<{ id: number; nome: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['competencias-comportamentais', colaboradorId],
    queryFn: () => endpoints.competenciasComportamentais(colaboradorId),
  });
  const { data: catalogo } = useQuery({ queryKey: ['catalogo', 'competencias'], queryFn: () => endpoints.catalogoListar('competencias') });

  // RBAC fino de verdade fica no backend (ColaboradoresService.podeEditar) — aqui é só para esconder os controlos.
  const podeEditar = user?.role === 'ADMIN_RH' || user?.role === 'MANAGER';

  const remover = useMutation({
    mutationFn: (competenciaId: number) => endpoints.eliminarCompetenciaColaborador(colaboradorId, competenciaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competencias-comportamentais', colaboradorId] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível remover esta competência.'),
  });

  const atribuidasIds = new Set((data ?? []).map((c) => c.competenciaId));
  const disponiveis = (catalogo ?? [])
    .filter((c) => c.tipo === 'COMPORTAMENTAL' && !atribuidasIds.has(Number(c.id)))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  function adicionar() {
    const c = disponiveis.find((d) => String(d.id) === novaCompetenciaId);
    if (!c) return;
    setCompetenciaEmEdicao({ id: Number(c.id), nome: String(c.nome) });
  }

  return (
    <Card title="Competências Comportamentais">
      {isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-fiori-text-secondary">Ainda sem competências Comportamentais atribuídas a este colaborador.</p>
      ) : (
        <div>
          {data.map((c) => (
            <div
              key={c.competenciaId}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              style={{ borderBottom: '1px solid rgba(217,217,217,.6)' }}
            >
              <span className="flex-1 truncate text-sm font-medium text-fiori-text">{c.competenciaNome}</span>
              <Badge status="info">{c.nivelNome}</Badge>
              {podeEditar && (
                <div className="flex shrink-0 items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => setCompetenciaEmEdicao({ id: c.competenciaId, nome: c.competenciaNome })}
                    className="text-fiori-text-secondary hover:text-fiori-primary"
                    aria-label="Editar nível"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remover "${c.competenciaNome}" das competências comportamentais deste colaborador?`)) {
                        remover.mutate(c.competenciaId);
                      }
                    }}
                    className="text-fiori-text-secondary hover:text-fiori-error"
                    aria-label="Remover competência"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {podeEditar && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-fiori-border pt-3 no-print">
          <Select value={novaCompetenciaId} onChange={(e) => setNovaCompetenciaId(e.target.value)} className="max-w-xs">
            <option value="">Escolher competência a adicionar…</option>
            {disponiveis.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.nome)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={!novaCompetenciaId} onClick={adicionar}>
            + Adicionar
          </Button>
        </div>
      )}

      {competenciaEmEdicao && (
        <AvaliarCompetenciaModal
          colaboradorId={colaboradorId}
          competenciaId={competenciaEmEdicao.id}
          competenciaNome={competenciaEmEdicao.nome}
          onClose={() => setCompetenciaEmEdicao(null)}
          onSuccess={() => {
            setCompetenciaEmEdicao(null);
            setNovaCompetenciaId('');
            queryClient.invalidateQueries({ queryKey: ['competencias-comportamentais', colaboradorId] });
          }}
        />
      )}
    </Card>
  );
}
