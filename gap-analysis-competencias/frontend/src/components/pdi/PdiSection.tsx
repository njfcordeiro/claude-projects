import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { EstadoPdi } from '../../types/api';
import { Card } from '../ui/Card';
import { Badge, BadgeStatus } from '../ui/Badge';
import { Button, Select } from '../ui/form';

const ESTADO_LABEL: Record<EstadoPdi, string> = { PENDENTE: 'Pendente', EM_CURSO: 'Em curso', CONCLUIDO: 'Concluído' };
const ESTADO_BADGE: Record<EstadoPdi, BadgeStatus> = { PENDENTE: 'warning', EM_CURSO: 'info', CONCLUIDO: 'success' };

/**
 * PDI (Plano de Desenvolvimento Individual) — pedido do utilizador:
 * "criação automática... com base nos gaps, sugerindo formações". As
 * sugestões vêm do backend (PdiService.gerar, que reutiliza o motor de gap
 * já existente) — aqui só se mostra a checklist e permite marcar progresso.
 */
export function PdiSection({ colaboradorId }: { colaboradorId: number }) {
  const queryClient = useQueryClient();
  const { data: itens, isLoading } = useQuery({ queryKey: ['pdi', colaboradorId], queryFn: () => endpoints.pdiListar(colaboradorId) });

  const gerar = useMutation({
    mutationFn: () => endpoints.pdiGerar(colaboradorId),
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['pdi', colaboradorId] });
      if (resultado.criados === 0) window.alert('Sem gaps novos — o PDI já cobre tudo o que foi detetado até agora.');
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível gerar o PDI.'),
  });

  const atualizar = useMutation({
    mutationFn: ({ itemId, estado }: { itemId: number; estado: EstadoPdi }) => endpoints.pdiAtualizar(colaboradorId, itemId, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pdi', colaboradorId] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível atualizar este item.'),
  });

  const eliminar = useMutation({
    mutationFn: (itemId: number) => endpoints.pdiEliminar(colaboradorId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pdi', colaboradorId] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível remover este item.'),
  });

  return (
    <Card
      title="Plano de Desenvolvimento Individual"
      action={
        <div className="no-print">
          <Button variant="secondary" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} /> {gerar.isPending ? 'A gerar…' : 'Gerar sugestões'}
            </span>
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      ) : !itens || itens.length === 0 ? (
        <p className="text-sm text-fiori-text-secondary">
          Ainda sem itens de PDI. Clica em "Gerar sugestões" para criar um plano a partir dos gaps deste colaborador.
        </p>
      ) : (
        <div className="space-y-2">
          {itens.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded border border-fiori-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fiori-text">{item.descricao}</p>
                {item.formacao && (
                  <p className="mt-1 text-xs text-fiori-text-secondary">
                    Formação sugerida: <span className="font-medium">{item.formacao.nome}</span>
                    {item.formacao.duracaoHoras ? ` (${item.formacao.duracaoHoras}h)` : ''}
                  </p>
                )}
                <div className="mt-1.5">
                  <Badge status={ESTADO_BADGE[item.estado]}>{ESTADO_LABEL[item.estado]}</Badge>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 no-print">
                <Select
                  value={item.estado}
                  onChange={(e) => atualizar.mutate({ itemId: item.id, estado: e.target.value as EstadoPdi })}
                  className="w-auto"
                >
                  {(Object.keys(ESTADO_LABEL) as EstadoPdi[]).map((estado) => (
                    <option key={estado} value={estado}>
                      {ESTADO_LABEL[estado]}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Remover este item do PDI?')) eliminar.mutate(item.id);
                  }}
                  className="text-fiori-text-secondary hover:text-fiori-error"
                  aria-label="Remover"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
