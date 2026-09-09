import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { AvaliacaoFormacao, ColaboradorFormacao } from '../../types/api';
import { Card } from '../ui/Card';
import { Badge, BadgeStatus } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { Button, Field, Input, Select } from '../ui/form';

const AVALIACAO_LABEL: Record<AvaliacaoFormacao, string> = { APROVADO: 'Aprovado', REPROVADO: 'Reprovado', FALTOU: 'Faltou' };
const AVALIACAO_BADGE: Record<AvaliacaoFormacao, BadgeStatus> = { APROVADO: 'success', REPROVADO: 'error', FALTOU: 'warning' };

function paraInputDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Registar/editar uma participação numa Formação (pedido do utilizador).
 * `horasFormacao` propõe por omissão a duração da Formação escolhida
 * (catálogo), mas é sempre editável manualmente — só se aplica ao criar; ao
 * editar um registo já existente, o valor já gravado é que é a base. Subir
 * a Avaliação para "Aprovado" aplica (no backend, idempotente) os níveis de
 * competência que a Formação transmite, mas só se superiores ao nível
 * atual — nunca ao contrário.
 */
function FormacaoConcluidaModal({
  colaboradorId,
  registo,
  onClose,
}: {
  colaboradorId: number;
  registo: ColaboradorFormacao | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: formacoes } = useQuery({ queryKey: ['formacoes'], queryFn: endpoints.formacoes });
  const [formacaoId, setFormacaoId] = useState(registo ? String(registo.formacaoId) : '');
  const [dataConclusao, setDataConclusao] = useState(registo ? paraInputDate(registo.dataConclusao) : '');
  const [horasFormacao, setHorasFormacao] = useState(registo ? String(registo.horasFormacao) : '');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoFormacao | ''>(registo?.avaliacao ?? '');
  const [erro, setErro] = useState<string | null>(null);

  // Ao escolher a Formação num registo novo, propõe a duração do catálogo como valor inicial das horas.
  function aoEscolherFormacao(id: string) {
    setFormacaoId(id);
    if (!registo && horasFormacao === '') {
      const f = (formacoes ?? []).find((f) => String(f.id) === id);
      if (f?.duracaoHoras != null) setHorasFormacao(String(f.duracaoHoras));
    }
  }

  const gravar = useMutation({
    mutationFn: () =>
      registo
        ? endpoints.formacoesConcluidasAtualizar(colaboradorId, registo.id, {
            dataConclusao,
            horasFormacao: Number(horasFormacao),
            avaliacao: avaliacao as AvaliacaoFormacao,
          })
        : endpoints.formacoesConcluidasCriar(colaboradorId, {
            formacaoId: Number(formacaoId),
            dataConclusao,
            horasFormacao: horasFormacao ? Number(horasFormacao) : undefined,
            avaliacao: avaliacao as AvaliacaoFormacao,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formacoes-concluidas', colaboradorId] });
      queryClient.invalidateQueries({ queryKey: ['gap-cargo', colaboradorId] });
      queryClient.invalidateQueries({ queryKey: ['competencias-comportamentais', colaboradorId] });
      onClose();
    },
    onError: (err) => setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar este registo.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formacaoId || !dataConclusao || !avaliacao) return;
    setErro(null);
    gravar.mutate();
  }

  return (
    <Modal title={registo ? 'Editar formação concluída' : 'Registar formação concluída'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Formação">
          <Select value={formacaoId} onChange={(e) => aoEscolherFormacao(e.target.value)} disabled={!!registo} autoFocus={!registo}>
            <option value="">— selecionar —</option>
            {(formacoes ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data de conclusão">
          <Input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
        </Field>
        <Field label="Horas de formação">
          <Input type="number" min={0} value={horasFormacao} onChange={(e) => setHorasFormacao(e.target.value)} />
        </Field>
        <Field label="Avaliação">
          <Select value={avaliacao} onChange={(e) => setAvaliacao(e.target.value as AvaliacaoFormacao)}>
            <option value="">— selecionar —</option>
            {(Object.keys(AVALIACAO_LABEL) as AvaliacaoFormacao[]).map((a) => (
              <option key={a} value={a}>
                {AVALIACAO_LABEL[a]}
              </option>
            ))}
          </Select>
        </Field>
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={gravar.isPending || !formacaoId || !dataConclusao || !avaliacao}>
            {gravar.isPending ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Histórico de formação do colaborador (pedido do utilizador) — cada linha
 * é uma participação numa Formação, com Data de conclusão, Horas e
 * Avaliação (Aprovado/Reprovado/Faltou). Ao contrário das Certificações
 * (um estado "atual" por certificação), o mesmo colaborador pode repetir a
 * mesma Formação (ex. Reprovado e depois repete).
 */
export function FormacoesConcluidasSection({ colaboradorId }: { colaboradorId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [aRegistar, setARegistar] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ColaboradorFormacao | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['formacoes-concluidas', colaboradorId],
    queryFn: () => endpoints.formacoesConcluidasListar(colaboradorId),
  });

  const podeEditar = user?.role === 'ADMIN_RH' || user?.role === 'MANAGER';

  const remover = useMutation({
    mutationFn: (id: number) => endpoints.formacoesConcluidasEliminar(colaboradorId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['formacoes-concluidas', colaboradorId] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível remover este registo.'),
  });

  return (
    <Card
      title="Histórico de Formação"
      action={
        podeEditar ? (
          <div className="no-print">
            <Button variant="secondary" onClick={() => setARegistar(true)}>
              <span className="flex items-center gap-1.5">
                <Plus size={14} /> Registar formação concluída
              </span>
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-fiori-text-secondary">Ainda sem formações registadas para este colaborador.</p>
      ) : (
        <DataTable
          data={data}
          getRowKey={(r) => r.id}
          searchPlaceholder="Pesquisar por formação…"
          columns={[
            { key: 'formacao', header: 'Formação', render: (r) => r.formacao.nome, sortValue: (r) => r.formacao.nome, searchValue: (r) => r.formacao.nome },
            {
              key: 'data',
              header: 'Data de conclusão',
              render: (r) => new Date(r.dataConclusao).toLocaleDateString('pt-PT'),
              sortValue: (r) => r.dataConclusao,
            },
            { key: 'horas', header: 'Horas', render: (r) => <span className="tabular-nums">{r.horasFormacao}</span>, sortValue: (r) => r.horasFormacao },
            {
              key: 'avaliacao',
              header: 'Avaliação',
              render: (r) => <Badge status={AVALIACAO_BADGE[r.avaliacao]}>{AVALIACAO_LABEL[r.avaliacao]}</Badge>,
              sortValue: (r) => r.avaliacao,
              searchValue: (r) => AVALIACAO_LABEL[r.avaliacao],
            },
            ...(podeEditar
              ? [
                  {
                    key: 'acoes',
                    header: '',
                    render: (r: ColaboradorFormacao) => (
                      <div className="flex shrink-0 items-center justify-end gap-2 no-print">
                        <button
                          type="button"
                          onClick={() => setEmEdicao(r)}
                          className="text-fiori-text-secondary hover:text-fiori-primary"
                          aria-label="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remover o registo de "${r.formacao.nome}"?`)) remover.mutate(r.id);
                          }}
                          className="text-fiori-text-secondary hover:text-fiori-error"
                          aria-label="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {aRegistar && <FormacaoConcluidaModal colaboradorId={colaboradorId} registo={null} onClose={() => setARegistar(false)} />}
      {emEdicao && <FormacaoConcluidaModal colaboradorId={colaboradorId} registo={emEdicao} onClose={() => setEmEdicao(null)} />}
    </Card>
  );
}
