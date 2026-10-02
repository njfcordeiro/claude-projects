import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { DadosPlanoDesenvolvimentoColaborador, EstadoPdi, FiltrosOrganizacionais } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import { Button, Field, Select } from '../ui/form';
import { Modal } from '../ui/Modal';
import { FiltrosOrganizacao } from './FiltrosOrganizacao';

const ESTADO_LABEL: Record<EstadoPdi, string> = { PENDENTE: 'Pendente', EM_CURSO: 'Em curso', CONCLUIDO: 'Concluído' };

/**
 * Adicionar um item de PDI — reaproveita endpoints.pdiCriar (mesmo motor da
 * ficha do colaborador: valida que o id indicado existe na tabela certa
 * consoante "Competência ou Certificação", e que uma Competência tem sempre
 * nível-alvo). Só "adicionar" aqui — editar uma linha existente só permite
 * mudar o Estado (inline na grelha, ver abaixo), igual ao que o utilizador
 * pediu para o round-trip de ficheiro.
 */
function ModalPlanoDesenvolvimento({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [colaboradorId, setColaboradorId] = useState('');
  const [tipoAlvo, setTipoAlvo] = useState<'COMPETENCIA' | 'CERTIFICACAO'>('COMPETENCIA');
  const [itemId, setItemId] = useState('');
  const [nivelEsperadoId, setNivelEsperadoId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: colaboradores } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const { data: competencias } = useQuery({
    queryKey: ['catalogo', 'competencias'],
    queryFn: () => endpoints.catalogoListar('competencias'),
    enabled: tipoAlvo === 'COMPETENCIA',
  });
  const { data: certificacoes } = useQuery({
    queryKey: ['catalogo', 'certificacoes'],
    queryFn: () => endpoints.catalogoListar('certificacoes'),
    enabled: tipoAlvo === 'CERTIFICACAO',
  });
  const competenciaSelecionada = (competencias ?? []).find((c) => String(c.id) === itemId);
  // A escala de níveis (Técnica/Comportamental) é sempre a da competência escolhida — pedido do utilizador.
  const tabelaNiveis = competenciaSelecionada?.tipo === 'COMPORTAMENTAL' ? 'niveis-comportamentais' : 'niveis-tecnicos';
  const { data: niveis } = useQuery({
    queryKey: ['catalogo', tabelaNiveis],
    queryFn: () => endpoints.catalogoListar(tabelaNiveis),
    enabled: tipoAlvo === 'COMPETENCIA' && !!competenciaSelecionada,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      await endpoints.pdiCriar(
        Number(colaboradorId),
        tipoAlvo === 'COMPETENCIA' ? { competenciaId: Number(itemId), nivelAlvoId: Number(nivelEsperadoId) } : { certificacaoId: itemId },
      );
      onSuccess();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar.');
    } finally {
      setSubmitting(false);
    }
  }

  const podeSubmeter = !!colaboradorId && !!itemId && (tipoAlvo === 'CERTIFICACAO' || !!nivelEsperadoId);

  return (
    <Modal title="Adicionar item de PDI" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Colaborador *">
          <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} required autoFocus>
            <option value="">— selecionar —</option>
            {(colaboradores ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Competência ou Certificação *">
          <Select
            value={tipoAlvo}
            onChange={(e) => {
              setTipoAlvo(e.target.value as 'COMPETENCIA' | 'CERTIFICACAO');
              setItemId('');
              setNivelEsperadoId('');
            }}
          >
            <option value="COMPETENCIA">Competência</option>
            <option value="CERTIFICACAO">Certificação</option>
          </Select>
        </Field>
        <Field label={tipoAlvo === 'COMPETENCIA' ? 'Competência *' : 'Certificação *'}>
          <Select
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              setNivelEsperadoId('');
            }}
            required
          >
            <option value="">— selecionar —</option>
            {tipoAlvo === 'COMPETENCIA'
              ? (competencias ?? []).map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.nome)} ({c.tipo === 'COMPORTAMENTAL' ? 'Comportamental' : 'Técnica'})
                  </option>
                ))
              : (certificacoes ?? []).map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.nome)}
                  </option>
                ))}
          </Select>
        </Field>
        {tipoAlvo === 'COMPETENCIA' && competenciaSelecionada && (
          <Field label="Nível esperado *">
            <Select value={nivelEsperadoId} onChange={(e) => setNivelEsperadoId(e.target.value)} required>
              <option value="">— selecionar —</option>
              {(niveis ?? [])
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id))
                .map((n) => (
                  <option key={String(n.id)} value={String(n.id)}>
                    {String(n.id)} — {String(n.nome)}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !podeSubmeter}>
            {submitting ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Grelha "Planos de Desenvolvimento Individual" (pedido do utilizador) —
 * uma linha por item de PDI de qualquer colaborador, com os campos da
 * pessoa (Nome/Área/Direção/Núcleo/Cargo atual/Próximo Cargo/LOB Prevista)
 * só de leitura (herdados, nunca editados aqui) e "Nível atual"/"Formação
 * sugerida"/"Nível transmitido" calculados pelo backend. A única edição
 * direta na grelha é o Estado (reaproveita endpoints.pdiAtualizar, mesmo
 * motor da ficha do colaborador) — tal como no ficheiro de Excel, mudar
 * qualquer outro campo de uma linha existente não é suportado aqui; para
 * isso usa-se a ficha do colaborador ou cria-se uma linha nova.
 */
export function GrelhaPlanosDesenvolvimento() {
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState<FiltrosOrganizacionais>({});
  const [modalAberto, setModalAberto] = useState(false);

  const { data: linhas, isLoading } = useQuery({
    queryKey: ['dados-colaboradores', 'planos-desenvolvimento', filtros],
    queryFn: () => endpoints.dadosColaboradoresListar<DadosPlanoDesenvolvimentoColaborador>('planos-desenvolvimento', filtros),
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['dados-colaboradores', 'planos-desenvolvimento'] });
  }

  const atualizarEstado = useMutation({
    mutationFn: ({ linha, estado }: { linha: DadosPlanoDesenvolvimentoColaborador; estado: EstadoPdi }) =>
      endpoints.pdiAtualizar(linha.colaboradorId, linha.id, { estado }),
    onSuccess: invalidar,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível atualizar o estado.'),
  });

  const eliminar = useMutation({
    mutationFn: (linha: DadosPlanoDesenvolvimentoColaborador) => endpoints.pdiEliminar(linha.colaboradorId, linha.id),
    onSuccess: invalidar,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível eliminar.'),
  });

  return (
    <Card
      title="Planos de Desenvolvimento Individual"
      action={
        <Button onClick={() => setModalAberto(true)}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Adicionar item
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
          searchPlaceholder="Pesquisar por colaborador, competência ou certificação…"
          columns={[
            {
              key: 'colaborador',
              header: 'Colaborador',
              render: (l) => l.colaboradorNome,
              searchValue: (l) => l.colaboradorNome,
              sortValue: (l) => l.colaboradorNome,
            },
            {
              key: 'organizacao',
              header: 'Direção / Área / Núcleo',
              render: (l) => `${l.direcaoNome ?? '—'} / ${l.areaNome ?? '—'} / ${l.nucleoNome ?? '—'}`,
            },
            { key: 'cargoAtual', header: 'Cargo atual', render: (l) => l.cargoAtualNome ?? '—' },
            { key: 'proximoCargo', header: 'Próximo Cargo', render: (l) => l.proximoCargoNome ?? '—' },
            { key: 'lobPrevista', header: 'LOB Prevista', render: (l) => l.lobPrevistaNome ?? '—' },
            {
              key: 'item',
              header: 'Competência / Certificação',
              render: (l) => (
                <span className="flex items-center gap-1.5">
                  {l.itemNome}
                  <Badge status={l.tipoAlvo === 'COMPETENCIA' ? 'info' : 'neutral'}>
                    {l.tipoAlvo === 'COMPETENCIA' ? 'Competência' : 'Certificação'}
                  </Badge>
                </span>
              ),
              searchValue: (l) => l.itemNome,
              sortValue: (l) => l.itemNome,
            },
            {
              key: 'tipo',
              header: 'Tipo',
              render: (l) => (l.tipoCompetencia === 'COMPORTAMENTAL' ? 'Comportamental' : l.tipoCompetencia === 'TECNICA' ? 'Técnica' : 'N/A'),
            },
            { key: 'nivelAtual', header: 'Nível atual', render: (l) => l.nivelAtualNome ?? 'N/A' },
            { key: 'nivelEsperado', header: 'Nível esperado', render: (l) => l.nivelEsperadoNome ?? 'N/A' },
            { key: 'formacaoSugerida', header: 'Formação sugerida', render: (l) => l.formacaoSugeridaNome ?? 'N/A' },
            { key: 'nivelTransmitido', header: 'Nível transmitido', render: (l) => l.nivelTransmitidoNome ?? '—' },
            {
              key: 'estado',
              header: 'Estado',
              render: (l) => (
                <Select
                  value={l.estado}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => atualizarEstado.mutate({ linha: l, estado: e.target.value as EstadoPdi })}
                  className="w-auto"
                >
                  {(Object.keys(ESTADO_LABEL) as EstadoPdi[]).map((estado) => (
                    <option key={estado} value={estado}>
                      {ESTADO_LABEL[estado]}
                    </option>
                  ))}
                </Select>
              ),
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
                      if (window.confirm(`Eliminar este item do PDI de ${l.colaboradorNome}?`)) eliminar.mutate(l);
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
      {modalAberto && (
        <ModalPlanoDesenvolvimento
          onClose={() => setModalAberto(false)}
          onSuccess={() => {
            invalidar();
            setModalAberto(false);
          }}
        />
      )}
    </Card>
  );
}
