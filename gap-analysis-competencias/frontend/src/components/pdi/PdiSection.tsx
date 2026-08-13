import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Plus, Sparkles, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { EstadoPdi, PdiItem } from '../../types/api';
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
 * "Gerar sugestões para LOB" (pedido do utilizador) — escolha manual da LOB
 * alvo, ao contrário do botão "Gerar sugestões" (que escolhe automaticamente
 * pela recomendação do BUD, senão pela sugestão do sistema mais próxima).
 * Só lista LOBs da própria Área do colaborador — o backend valida o mesmo.
 */
function GerarParaLobModal({
  colaboradorId,
  areaId,
  onClose,
}: {
  colaboradorId: number;
  areaId: number | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [lobId, setLobId] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data: lobs } = useQuery({ queryKey: ['lobs'], queryFn: endpoints.lobs });
  const lobsDaArea = (lobs ?? []).filter((l) => l.areaId === areaId);

  const gerar = useMutation({
    mutationFn: () => endpoints.pdiGerarParaLob(colaboradorId, { lobId: Number(lobId) }),
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['pdi', colaboradorId] });
      onClose();
      if (resultado.criados === 0) window.alert('Sem gaps novos para sugerir — a LOB escolhida já está coberta pelo PDI atual.');
    },
    onError: (err) => setErro(err instanceof ApiError ? err.message : 'Não foi possível gerar sugestões para esta LOB.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!lobId) return;
    setErro(null);
    gerar.mutate();
  }

  return (
    <Modal title="Gerar sugestões para LOB" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="LOB">
          <Select value={lobId} onChange={(e) => setLobId(e.target.value)} autoFocus>
            <option value="">— selecionar —</option>
            {lobsDaArea.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </Select>
        </Field>
        {lobsDaArea.length === 0 && (
          <p className="mb-3 text-sm text-fiori-text-secondary">Sem LOBs definidas para a área deste colaborador.</p>
        )}
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={gerar.isPending || !lobId}>
            {gerar.isPending ? 'A gerar…' : 'Gerar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ItemPdi({
  item,
  onAtualizar,
  onEliminar,
}: {
  item: PdiItem;
  onAtualizar: (estado: EstadoPdi) => void;
  onEliminar: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-fiori-border p-3">
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
        <Select value={item.estado} onChange={(e) => onAtualizar(e.target.value as EstadoPdi)} className="w-auto">
          {(Object.keys(ESTADO_LABEL) as EstadoPdi[]).map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_LABEL[estado]}
            </option>
          ))}
        </Select>
        <button type="button" onClick={onEliminar} className="text-fiori-text-secondary hover:text-fiori-error" aria-label="Remover">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * PDI (Plano de Desenvolvimento Individual) — pedido do utilizador:
 * "criação automática... com base nos gaps, sugerindo formações". As
 * sugestões vêm do backend e visam sempre UMA ÚNICA LOB por geração:
 * "Gerar sugestões" (PdiService.gerar) escolhe-a automaticamente — a
 * recomendada pelo BUD, senão a sugestão do sistema mais próxima de ser
 * atingida; "Gerar sugestões para LOB" (PdiService.gerarParaLobEscolhida)
 * deixa escolher manualmente, só entre as LOBs da própria Área do
 * colaborador. Aqui mostra-se a checklist, separada em 3 grupos por origem
 * (pedido do utilizador: "quero ver em primeiro as competências das lobs
 * recomendadas pelo BUD e depois recomendadas pelo sistema; as
 * restantes... ficam à parte") — a classificação cruza item.lobId com os
 * objetivos de LOB atuais, nunca com texto guardado, por isso segue sempre
 * o estado mais recente dos objetivos.
 */
export function PdiSection({ colaboradorId }: { colaboradorId: number }) {
  const queryClient = useQueryClient();
  const { data: itens, isLoading } = useQuery({ queryKey: ['pdi', colaboradorId], queryFn: () => endpoints.pdiListar(colaboradorId) });
  const { data: objetivos } = useQuery({ queryKey: ['objetivos-lob', colaboradorId], queryFn: () => endpoints.objetivosLob(colaboradorId) });
  const { data: colaborador } = useQuery({ queryKey: ['colaborador', colaboradorId], queryFn: () => endpoints.colaborador(colaboradorId) });
  const [aAdicionar, setAAdicionar] = useState(false);
  const [aGerarParaLob, setAGerarParaLob] = useState(false);

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

  const eliminarSugestoes = useMutation({
    mutationFn: () => endpoints.pdiEliminarSugestoes(colaboradorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pdi', colaboradorId] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível eliminar as sugestões.'),
  });

  const temSugestoes = (itens ?? []).some((i) => i.origem === 'AUTOMATICO');

  return (
    <Card
      title="Plano de Desenvolvimento Individual"
      action={
        <div className="flex flex-wrap gap-2 no-print">
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
          <Button variant="secondary" onClick={() => setAGerarParaLob(true)}>
            <span className="flex items-center gap-1.5">
              <ListChecks size={14} /> Gerar sugestões para LOB
            </span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm('Eliminar todas as competências/certificações sugeridas? Os itens adicionados manualmente não são afetados.')) {
                eliminarSugestoes.mutate();
              }
            }}
            disabled={eliminarSugestoes.isPending || !temSugestoes}
          >
            <span className="flex items-center gap-1.5">
              <Trash2 size={14} /> {eliminarSugestoes.isPending ? 'A eliminar…' : 'Eliminar sugestões'}
            </span>
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      ) : !itens || itens.length === 0 ? (
        <p className="text-sm text-fiori-text-secondary">
          Ainda sem itens de PDI. Clica em "Gerar sugestões" para criar um plano a partir dos gaps deste colaborador, ou "Adicionar"
          para escolher manualmente.
        </p>
      ) : (
        (() => {
          const budLobIds = new Set((objetivos?.bud ?? []).map((o) => o.lobId));
          const autoLobIds = new Set((objetivos?.auto ?? []).map((o) => o.lobId));
          const grupoBud = itens.filter((i) => i.lobId !== null && budLobIds.has(i.lobId));
          const grupoSistema = itens.filter((i) => i.lobId !== null && !budLobIds.has(i.lobId) && autoLobIds.has(i.lobId));
          const grupoOutras = itens.filter((i) => i.lobId === null || (!budLobIds.has(i.lobId) && !autoLobIds.has(i.lobId)));

          // Pedido do utilizador: dentro de BUD/Sistema, sub-agrupar por LOB
          // objetivo — "Outras" não tem LOB objetivo por definição, fica plana.
          function porLob(lista: PdiItem[]) {
            const mapa = new Map<string, PdiItem[]>();
            for (const item of lista) {
              const nome = item.lob?.nome ?? 'Sem LOB';
              if (!mapa.has(nome)) mapa.set(nome, []);
              mapa.get(nome)!.push(item);
            }
            return Array.from(mapa.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([lobNome, subItens]) => ({ lobNome, itens: subItens }));
          }

          const grupos: { titulo: string; subgrupos: { lobNome: string | null; itens: PdiItem[] }[] }[] = [
            { titulo: 'Recomendadas pelo BUD', subgrupos: porLob(grupoBud) },
            { titulo: 'Sugeridas pelo sistema', subgrupos: porLob(grupoSistema) },
            { titulo: 'Outras competências', subgrupos: grupoOutras.length > 0 ? [{ lobNome: null, itens: grupoOutras }] : [] },
          ].filter((g) => g.subgrupos.length > 0);

          return (
            <div className="space-y-5">
              {grupos.map((grupo) => (
                <div key={grupo.titulo}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">{grupo.titulo}</p>
                  <div className="space-y-3">
                    {grupo.subgrupos.map((sub) => (
                      <div key={sub.lobNome ?? '_'}>
                        {sub.lobNome !== null && (
                          <p className="mb-1.5 border-l-2 border-fiori-primary pl-2 text-xs font-semibold text-fiori-primary">
                            LOB: {sub.lobNome}
                          </p>
                        )}
                        <div className="space-y-2">
                          {sub.itens.map((item) => (
                            <ItemPdi
                              key={item.id}
                              item={item}
                              onAtualizar={(estado) => atualizar.mutate({ itemId: item.id, estado })}
                              onEliminar={() => {
                                if (window.confirm('Remover este item do PDI?')) eliminar.mutate(item.id);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {aAdicionar && <AdicionarPdiItemModal colaboradorId={colaboradorId} onClose={() => setAAdicionar(false)} />}
      {aGerarParaLob && (
        <GerarParaLobModal colaboradorId={colaboradorId} areaId={colaborador?.areaId ?? null} onClose={() => setAGerarParaLob(false)} />
      )}
    </Card>
  );
}
