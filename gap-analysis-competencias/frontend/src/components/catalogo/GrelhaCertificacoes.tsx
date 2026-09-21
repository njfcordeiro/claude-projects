import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { DadosCertificacaoColaborador, FiltrosOrganizacionais } from '../../types/api';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import { Button, Field, Input, Select } from '../ui/form';
import { Modal } from '../ui/Modal';
import { FiltrosOrganizacao } from './FiltrosOrganizacao';

/** Adicionar (linha=null) ou editar uma certificação existente — reaproveita endpoints.upsertCertificacao (mesmo motor da ficha do colaborador, com locking otimista). */
function ModalCertificacao({
  linha,
  onClose,
  onSuccess,
}: {
  linha: DadosCertificacaoColaborador | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [colaboradorId, setColaboradorId] = useState(linha ? String(linha.colaboradorId) : '');
  const [certificacaoId, setCertificacaoId] = useState(linha ? linha.certificacaoId : '');
  const [dataObtencao, setDataObtencao] = useState(linha ? linha.dataObtencao.slice(0, 10) : '');
  const [dataValidade, setDataValidade] = useState(linha?.dataValidade ? linha.dataValidade.slice(0, 10) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: colaboradores } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const { data: certificacoes } = useQuery({ queryKey: ['catalogo', 'certificacoes'], queryFn: () => endpoints.catalogoListar('certificacoes') });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      await endpoints.upsertCertificacao(Number(colaboradorId), certificacaoId, {
        dataObtencao,
        dataValidade: dataValidade || null,
        version: linha?.version,
      });
      onSuccess();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={linha ? 'Editar certificação' : 'Nova certificação'} onClose={onClose}>
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
        <Field label="Certificação *">
          <Select value={certificacaoId} onChange={(e) => setCertificacaoId(e.target.value)} disabled={!!linha} required>
            <option value="">— selecionar —</option>
            {(certificacoes ?? []).map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.nome)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data de obtenção *">
          <Input type="date" value={dataObtencao} onChange={(e) => setDataObtencao(e.target.value)} required autoFocus={!!linha} />
        </Field>
        <Field label="Data de validade">
          <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
        </Field>
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !colaboradorId || !certificacaoId || !dataObtencao}>
            {submitting ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Grelha de certificações dos colaboradores — pedido do utilizador:
 * "também deve ser listada a tabela... e que permita editar, adicionar,
 * remover os dados". "Remover" limpa a data de obtenção, que (Task #11)
 * já faz a linha desaparecer da base de dados — nunca uma linha "vazia".
 */
export function GrelhaCertificacoes() {
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState<FiltrosOrganizacionais>({});
  const [modal, setModal] = useState<{ linha: DadosCertificacaoColaborador | null } | null>(null);

  const { data: linhas, isLoading } = useQuery({
    queryKey: ['dados-colaboradores', 'certificacoes', filtros],
    queryFn: () => endpoints.dadosColaboradoresListar<DadosCertificacaoColaborador>('certificacoes', filtros),
  });

  function invalidarEfechar() {
    queryClient.invalidateQueries({ queryKey: ['dados-colaboradores', 'certificacoes'] });
    setModal(null);
  }

  const eliminar = useMutation({
    mutationFn: (linha: DadosCertificacaoColaborador) =>
      endpoints.upsertCertificacao(linha.colaboradorId, linha.certificacaoId, { dataObtencao: null, version: linha.version }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dados-colaboradores', 'certificacoes'] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível eliminar.'),
  });

  return (
    <Card
      title="Certificações dos colaboradores"
      action={
        <Button onClick={() => setModal({ linha: null })}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Nova certificação
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
          getRowKey={(l) => `${l.colaboradorId}-${l.certificacaoId}`}
          onRowClick={(l) => setModal({ linha: l })}
          searchPlaceholder="Pesquisar por colaborador ou certificação…"
          columns={[
            {
              key: 'colaborador',
              header: 'Colaborador',
              render: (l) => l.colaboradorNome,
              searchValue: (l) => l.colaboradorNome,
              sortValue: (l) => l.colaboradorNome,
            },
            {
              key: 'certificacao',
              header: 'Certificação',
              render: (l) => l.certificacaoNome,
              searchValue: (l) => l.certificacaoNome,
              sortValue: (l) => l.certificacaoNome,
            },
            {
              key: 'obtencao',
              header: 'Data de obtenção',
              render: (l) => new Date(l.dataObtencao).toLocaleDateString('pt-PT'),
              sortValue: (l) => l.dataObtencao,
            },
            {
              key: 'validade',
              header: 'Data de validade',
              render: (l) => (l.dataValidade ? new Date(l.dataValidade).toLocaleDateString('pt-PT') : '—'),
              sortValue: (l) => l.dataValidade ?? '',
            },
            {
              key: '__acoes',
              header: '',
              render: (l) => (
                <div className="flex justify-end no-print">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Eliminar esta certificação?')) eliminar.mutate(l);
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
      {modal && <ModalCertificacao linha={modal.linha} onClose={() => setModal(null)} onSuccess={invalidarEfechar} />}
    </Card>
  );
}
