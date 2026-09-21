import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { AvaliacaoFormacao, DadosFormacaoConcluidaColaborador, FiltrosOrganizacionais } from '../../types/api';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import { Button, Field, Input, Select } from '../ui/form';
import { Modal } from '../ui/Modal';
import { FiltrosOrganizacao } from './FiltrosOrganizacao';

const AVALIACAO_LABEL: Record<AvaliacaoFormacao, string> = { APROVADO: 'Aprovado', REPROVADO: 'Reprovado', FALTOU: 'Faltou' };

/** Adicionar (linha=null) ou editar uma participação em Formação — reaproveita os endpoints da ficha do colaborador (Histórico de Formação). */
function ModalFormacaoConcluida({
  linha,
  onClose,
  onSuccess,
}: {
  linha: DadosFormacaoConcluidaColaborador | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [colaboradorId, setColaboradorId] = useState(linha ? String(linha.colaboradorId) : '');
  const [formacaoId, setFormacaoId] = useState(linha ? String(linha.formacaoId) : '');
  const [dataConclusao, setDataConclusao] = useState(linha ? linha.dataConclusao.slice(0, 10) : '');
  const [horasFormacao, setHorasFormacao] = useState(linha ? String(linha.horasFormacao) : '');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoFormacao>(linha?.avaliacao ?? 'APROVADO');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: colaboradores } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const { data: formacoes } = useQuery({ queryKey: ['catalogo', 'formacoes'], queryFn: () => endpoints.catalogoListar('formacoes') });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      const dto = { formacaoId: Number(formacaoId), dataConclusao, horasFormacao: horasFormacao ? Number(horasFormacao) : undefined, avaliacao };
      if (linha) {
        await endpoints.formacoesConcluidasAtualizar(Number(colaboradorId), linha.id, dto);
      } else {
        await endpoints.formacoesConcluidasCriar(Number(colaboradorId), dto);
      }
      onSuccess();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={linha ? 'Editar participação' : 'Nova participação'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Colaborador *">
          <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} disabled={!!linha} required autoFocus={!linha}>
            <option value="">— selecionar —</option>
            {(colaboradores ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Formação *">
          <Select value={formacaoId} onChange={(e) => setFormacaoId(e.target.value)} disabled={!!linha} required>
            <option value="">— selecionar —</option>
            {(formacoes ?? []).map((f) => (
              <option key={String(f.id)} value={String(f.id)}>
                {String(f.nome)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data de conclusão *">
          <Input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} required autoFocus={!!linha} />
        </Field>
        <Field label="Horas de formação">
          <Input type="number" min={0} value={horasFormacao} onChange={(e) => setHorasFormacao(e.target.value)} />
        </Field>
        <Field label="Avaliação *">
          <Select value={avaliacao} onChange={(e) => setAvaliacao(e.target.value as AvaliacaoFormacao)} required>
            {Object.entries(AVALIACAO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !colaboradorId || !formacaoId || !dataConclusao}>
            {submitting ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Grelha do Histórico de Formação dos colaboradores — pedido do
 * utilizador: "também deve ser listada a tabela... e que permita editar,
 * adicionar, remover os dados".
 */
export function GrelhaFormacoesConcluidas() {
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState<FiltrosOrganizacionais>({});
  const [modal, setModal] = useState<{ linha: DadosFormacaoConcluidaColaborador | null } | null>(null);

  const { data: linhas, isLoading } = useQuery({
    queryKey: ['dados-colaboradores', 'formacoes-concluidas', filtros],
    queryFn: () => endpoints.dadosColaboradoresListar<DadosFormacaoConcluidaColaborador>('formacoes-concluidas', filtros),
  });

  function invalidarEfechar() {
    queryClient.invalidateQueries({ queryKey: ['dados-colaboradores', 'formacoes-concluidas'] });
    setModal(null);
  }

  const eliminar = useMutation({
    mutationFn: (linha: DadosFormacaoConcluidaColaborador) => endpoints.formacoesConcluidasEliminar(linha.colaboradorId, linha.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dados-colaboradores', 'formacoes-concluidas'] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível eliminar.'),
  });

  return (
    <Card
      title="Histórico de formação dos colaboradores"
      action={
        <Button onClick={() => setModal({ linha: null })}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Nova participação
          </span>
        </Button>
      }
    >
      <div className="mb-4">
        <FiltrosOrganizacao filtros={filtros} onChange={setFiltros} />
      </div>
      {isLoading ? (
        <p className="text-sm text-fiori-text-secondary">A carregar…</p>
      ) : (
        <DataTable
          data={linhas ?? []}
          getRowKey={(l) => l.id}
          onRowClick={(l) => setModal({ linha: l })}
          searchPlaceholder="Pesquisar por colaborador ou formação…"
          columns={[
            {
              key: 'colaborador',
              header: 'Colaborador',
              render: (l) => l.colaboradorNome,
              searchValue: (l) => l.colaboradorNome,
              sortValue: (l) => l.colaboradorNome,
            },
            {
              key: 'formacao',
              header: 'Formação',
              render: (l) => l.formacaoNome,
              searchValue: (l) => l.formacaoNome,
              sortValue: (l) => l.formacaoNome,
            },
            {
              key: 'conclusao',
              header: 'Data de conclusão',
              render: (l) => new Date(l.dataConclusao).toLocaleDateString('pt-PT'),
              sortValue: (l) => l.dataConclusao,
            },
            { key: 'horas', header: 'Horas', render: (l) => l.horasFormacao, sortValue: (l) => l.horasFormacao },
            { key: 'avaliacao', header: 'Avaliação', render: (l) => AVALIACAO_LABEL[l.avaliacao], sortValue: (l) => l.avaliacao },
            {
              key: '__acoes',
              header: '',
              render: (l) => (
                <div className="flex justify-end no-print">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Eliminar esta participação?')) eliminar.mutate(l);
                    }}
                    className="text-fiori-text-secondary hover:text-fiori-error"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
      {modal && <ModalFormacaoConcluida linha={modal.linha} onClose={() => setModal(null)} onSuccess={invalidarEfechar} />}
    </Card>
  );
}
