import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { EstadoPdi } from '../../types/api';
import { Card } from '../ui/Card';
import { Badge, BadgeStatus } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Button, Field, Select } from '../ui/form';

const ESTADO_LABEL: Record<EstadoPdi, string> = { PENDENTE: 'Pendente', EM_CURSO: 'Em curso', CONCLUIDO: 'Concluído' };
const ESTADO_BADGE: Record<EstadoPdi, BadgeStatus> = { PENDENTE: 'warning', EM_CURSO: 'info', CONCLUIDO: 'success' };

type TipoPdiManual = 'competencia' | 'certificacao';

/** Adicionar manualmente uma Competência ou Certificação ao PDI — pedido do utilizador: "deve ser possível adicionar... manualmente". */
function AdicionarPdiItemModal({ colaboradorId, onClose }: { colaboradorId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoPdiManual>('competencia');
  const [itemId, setItemId] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data: competencias } = useQuery({
    queryKey: ['catalogo', 'competencias'],
    queryFn: () => endpoints.catalogoListar('competencias'),
  });
  const { data: certificacoes } = useQuery({
    queryKey: ['catalogo', 'certificacoes'],
    queryFn: () => endpoints.catalogoListar('certificacoes'),
  });
  const opcoes = tipo === 'competencia' ? (competencias ?? []) : (certificacoes ?? []);

  const adicionar = useMutation({
    mutationFn: () =>
      endpoints.pdiCriar(
        colaboradorId,
        tipo === 'competencia' ? { competenciaId: Number(itemId) } : { certificacaoId: itemId },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdi', colaboradorId] });
      onClose();
    },
    onError: (err) => setErro(err instanceof ApiError ? err.message : 'Não foi possível adicionar este item.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!itemId) return;
    setErro(null);
    adicionar.mutate();
  }

  return (
    <Modal title="Adicionar ao PDI" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Tipo">
          <Select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoPdiManual);
              setItemId('');
            }}
          >
            <option value="competencia">Competência</option>
            <option value="certificacao">Certificação</option>
          </Select>
        </Field>
        <Field label={tipo === 'competencia' ? 'Competência' : 'Certificação'}>
          <Select value={itemId} onChange={(e) => setItemId(e.target.value)} autoFocus>
            <option value="">— selecionar —</option>
            {opcoes.map((o) => (
              <option key={String(o.id)} value={String(o.id)}>
                {String(o.nome)}
              </option>
            ))}
          </Select>
        </Field>
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={adicionar.isPending || !itemId}>
            {adicionar.isPending ? 'A adicionar…' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * PDI (Plano de Desenvolvimento Individual) — pedido do utilizador:
 * "criação automática... com base nos gaps, sugerindo formações". As
 * sugestões vêm do backend (PdiService.gerar, que reutiliza o motor de gap
 * já existente e visa sempre uma única LOB por chamada — a "Próxima LOB"
 * do colaborador se preenchida, senão a LOB da sua Área mais perto de
 * atingir) — aqui só se mostra a checklist, permite marcar progresso,
 * eliminar itens (gerados ou manuais) e adicionar manualmente.
 */
export function PdiSection({ colaboradorId }: { colaboradorId: number }) {
  const queryClient = useQueryClient();
  const { data: itens, isLoading } = useQuery({ queryKey: ['pdi', colaboradorId], queryFn: () => endpoints.pdiListar(colaboradorId) });
  const { data: objetivos } = useQuery({ queryKey: ['objetivos-lob', colaboradorId], queryFn: () => endpoints.objetivosLob(colaboradorId) });
  const [aAdicionar, setAAdicionar] = useState(false);

  const gerar = useMutation({
    mutationFn: () => endpoints.pdiGerar(colaboradorId),
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['pdi', colaboradorId] });
      if (resultado.criados === 0) window.alert('Sem gaps novos para sugerir — a LOB alvo já está coberta pelo PDI atual.');
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
        <div className="flex gap-2 no-print">
          <Button variant="secondary" onClick={() => setAAdicionar(true)}>
            <span className="flex items-center gap-1.5">
              <Plus size={14} /> Adicionar
            </span>
          </Button>
          <Button variant="secondary" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} /> {gerar.isPending ? 'A gerar…' : 'Gerar sugestões'}
            </span>
          </Button>
        </div>
      }
    >
      {objetivos && (objetivos.auto.length > 0 || objetivos.bud.length > 0) && (
        <p className="mb-3 text-xs text-fiori-text-secondary">
          Baseado em {objetivos.auto.length + objetivos.bud.length} objetivo{objetivos.auto.length + objetivos.bud.length === 1 ? '' : 's'} de LOB
          atual{objetivos.auto.length + objetivos.bud.length === 1 ? '' : 'is'}:{' '}
          {[...objetivos.auto.map((o) => `${o.lobNome} (sistema)`), ...objetivos.bud.map((o) => `${o.lobNome} (BUD)`)].join(', ')}.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      ) : !itens || itens.length === 0 ? (
        <p className="text-sm text-fiori-text-secondary">
          Ainda sem itens de PDI. Clica em "Gerar sugestões" para criar um plano a partir dos gaps deste colaborador, ou "Adicionar"
          para escolher manualmente.
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
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge status={ESTADO_BADGE[item.estado]}>{ESTADO_LABEL[item.estado]}</Badge>
                  {item.origem === 'MANUAL' && <Badge status="neutral">Manual</Badge>}
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

      {aAdicionar && <AdicionarPdiItemModal colaboradorId={colaboradorId} onClose={() => setAAdicionar(false)} />}
    </Card>
  );
}
