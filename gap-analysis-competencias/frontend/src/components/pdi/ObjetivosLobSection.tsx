import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Trash2, UserCheck } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { ObjetivoLob } from '../../types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button, Select } from '../ui/form';

function LinhaObjetivo({ objetivo, onRemover }: { objetivo: ObjetivoLob; onRemover?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0" style={{ borderBottom: '1px solid rgba(217,217,217,.6)' }}>
      <span className="w-36 shrink-0 truncate text-sm font-medium text-fiori-text">{objetivo.lobNome}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-fiori-canvas">
        <div className="h-full rounded-full bg-fiori-primary" style={{ width: `${objetivo.prontidaoPercentual}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fiori-text-secondary">{objetivo.prontidaoPercentual}%</span>
      {onRemover ? (
        <button type="button" onClick={onRemover} className="shrink-0 text-fiori-text-secondary hover:text-fiori-error no-print" aria-label="Remover objetivo">
          <Trash2 size={15} />
        </button>
      ) : (
        <Badge status="info">Sistema</Badge>
      )}
    </div>
  );
}

/**
 * "Objetivos de LOB" — pedido do utilizador: até 3 LOBs da área do
 * colaborador (ainda não atingidas, pela maior % de cumprimento) contam
 * como objetivo automático; qualquer LOB recomendada pelo BUD (gestor
 * direto) ou ADMIN_RH também passa a ser objetivo. O PDI (ver PdiSection)
 * gera sugestões a partir da união destes objetivos.
 */
export function ObjetivosLobSection({ colaboradorId }: { colaboradorId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [novaLobId, setNovaLobId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['objetivos-lob', colaboradorId],
    queryFn: () => endpoints.objetivosLob(colaboradorId),
  });
  const { data: lobs } = useQuery({ queryKey: ['lobs'], queryFn: endpoints.lobs });

  // RBAC fino de verdade fica no backend (ColaboradoresService.podeEditar) — aqui é só para esconder os controlos.
  const podeRecomendar = user?.role === 'ADMIN_RH' || user?.role === 'MANAGER';

  const adicionar = useMutation({
    mutationFn: (lobId: number) => endpoints.adicionarObjetivoLob(colaboradorId, lobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objetivos-lob', colaboradorId] });
      setNovaLobId('');
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível recomendar esta LOB.'),
  });

  const remover = useMutation({
    mutationFn: (lobId: number) => endpoints.removerObjetivoLob(colaboradorId, lobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objetivos-lob', colaboradorId] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível remover este objetivo.'),
  });

  if (isLoading || !data) {
    return (
      <Card title="Objetivos de LOB">
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      </Card>
    );
  }

  const budLobIds = new Set(data.bud.map((o) => o.lobId));
  const lobsDisponiveis = (lobs ?? []).filter((l) => !budLobIds.has(l.id));

  return (
    <Card
      title="Objetivos de LOB"
      action={
        <span className="text-xs text-fiori-text-secondary">
          {data.auto.length} {data.auto.length === 1 ? 'sugestão do sistema' : 'sugestões do sistema'}
          {data.bud.length > 0 && ` + ${data.bud.length} recomendada${data.bud.length === 1 ? '' : 's'} pelo BUD`}
        </span>
      }
    >
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">
          <Target size={13} /> Sugestões do sistema (até 3, área do colaborador, ainda não atingidas)
        </p>
        {data.auto.length === 0 ? (
          <p className="text-sm text-fiori-text-secondary">Sem LOBs por atingir na área deste colaborador.</p>
        ) : (
          <div>
            {data.auto.map((o) => (
              <LinhaObjetivo key={o.lobId} objetivo={o} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">
          <UserCheck size={13} /> Recomendadas pelo BUD
        </p>
        {data.bud.length === 0 ? (
          <p className="text-sm text-fiori-text-secondary">Nenhuma LOB recomendada manualmente.</p>
        ) : (
          <div>
            {data.bud.map((o) => (
              <LinhaObjetivo key={o.lobId} objetivo={o} onRemover={podeRecomendar ? () => remover.mutate(o.lobId) : undefined} />
            ))}
          </div>
        )}

        {podeRecomendar && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-fiori-border pt-3 no-print">
            <Select value={novaLobId} onChange={(e) => setNovaLobId(e.target.value)} className="max-w-xs">
              <option value="">Escolher LOB para recomendar…</option>
              {lobsDisponiveis.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              disabled={!novaLobId || adicionar.isPending}
              onClick={() => adicionar.mutate(Number(novaLobId))}
            >
              + Adicionar
            </Button>
          </div>
        )}
        {podeRecomendar && (
          <p className="mt-2 text-xs text-fiori-text-secondary">
            Uma LOB recomendada pelo BUD não precisa de pertencer à área do colaborador.
          </p>
        )}
      </div>
    </Card>
  );
}
