import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { DadosCompetenciaColaborador, FiltrosOrganizacionais } from '../../types/api';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import { Button, Field, Select } from '../ui/form';
import { Modal } from '../ui/Modal';
import { FiltrosOrganizacao } from './FiltrosOrganizacao';

interface Props {
  tipo: 'TECNICA' | 'COMPORTAMENTAL';
}

/** Adicionar (linha=null) ou registar nova avaliação para uma linha existente — reaproveita endpoints.criarAvaliacao (mesmo motor da ficha do colaborador, com locking otimista). */
function ModalCompetencia({
  tipo,
  linha,
  onClose,
  onSuccess,
}: {
  tipo: 'TECNICA' | 'COMPORTAMENTAL';
  linha: DadosCompetenciaColaborador | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [colaboradorId, setColaboradorId] = useState(linha ? String(linha.colaboradorId) : '');
  const [competenciaId, setCompetenciaId] = useState(linha ? String(linha.competenciaId) : '');
  const [nivelId, setNivelId] = useState(linha ? String(linha.nivelId) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: colaboradores } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const { data: competencias } = useQuery({ queryKey: ['catalogo', 'competencias'], queryFn: () => endpoints.catalogoListar('competencias') });
  const tabelaNiveis = tipo === 'COMPORTAMENTAL' ? 'niveis-comportamentais' : 'niveis-tecnicos';
  const { data: niveis } = useQuery({ queryKey: ['catalogo', tabelaNiveis], queryFn: () => endpoints.catalogoListar(tabelaNiveis) });
  const opcoesCompetencia = (competencias ?? []).filter((c) => c.tipo === tipo);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      const atual = await endpoints.ultimaAvaliacao(Number(colaboradorId), Number(competenciaId));
      await endpoints.criarAvaliacao(Number(colaboradorId), {
        competenciaId: Number(competenciaId),
        nivelId: Number(nivelId),
        baseAssessmentId: atual?.id ?? null,
      });
      onSuccess();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={linha ? 'Registar nova avaliação' : 'Nova avaliação'} onClose={onClose}>
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
        <Field label="Competência *">
          <Select value={competenciaId} onChange={(e) => setCompetenciaId(e.target.value)} disabled={!!linha} required>
            <option value="">— selecionar —</option>
            {opcoesCompetencia.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.nome)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nível *">
          <Select value={nivelId} onChange={(e) => setNivelId(e.target.value)} required autoFocus={!!linha}>
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
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !colaboradorId || !competenciaId || !nivelId}>
            {submitting ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Grelha de competências (técnicas ou comportamentais) dos colaboradores —
 * pedido do utilizador: "também deve ser listada a tabela, com filtros...
 * e que permita editar, adicionar, remover os dados". Reaproveita sempre os
 * mesmos endpoints da ficha individual do colaborador (nunca um caminho de
 * escrita paralelo) — "editar" é registar uma nova avaliação (histórico
 * append-only); "remover" só está disponível para Comportamentais, mesma
 * regra já aplicada em toda a app.
 */
export function GrelhaCompetencias({ tipo }: Props) {
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState<FiltrosOrganizacionais>({});
  const [modal, setModal] = useState<{ linha: DadosCompetenciaColaborador | null } | null>(null);
  const chave = tipo === 'TECNICA' ? 'competencias-tecnicas' : 'competencias-comportamentais';

  const { data: linhas, isLoading } = useQuery({
    queryKey: ['dados-colaboradores', chave, filtros],
    queryFn: () => endpoints.dadosColaboradoresListar<DadosCompetenciaColaborador>(chave, filtros),
  });

  function invalidarEfechar() {
    queryClient.invalidateQueries({ queryKey: ['dados-colaboradores', chave] });
    setModal(null);
  }

  const eliminar = useMutation({
    mutationFn: (linha: DadosCompetenciaColaborador) => endpoints.eliminarCompetenciaColaborador(linha.colaboradorId, linha.competenciaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dados-colaboradores', chave] }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível eliminar.'),
  });

  return (
    <Card
      title={tipo === 'TECNICA' ? 'Competências técnicas dos colaboradores' : 'Competências comportamentais dos colaboradores'}
      action={
        <Button onClick={() => setModal({ linha: null })}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Nova avaliação
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
          getRowKey={(l) => `${l.colaboradorId}-${l.competenciaId}`}
          onRowClick={(l) => setModal({ linha: l })}
          searchPlaceholder="Pesquisar por colaborador ou competência…"
          columns={[
            {
              key: 'colaborador',
              header: 'Colaborador',
              render: (l) => l.colaboradorNome,
              searchValue: (l) => l.colaboradorNome,
              sortValue: (l) => l.colaboradorNome,
            },
            {
              key: 'competencia',
              header: 'Competência',
              render: (l) => l.competenciaNome,
              searchValue: (l) => l.competenciaNome,
              sortValue: (l) => l.competenciaNome,
            },
            { key: 'nivel', header: 'Nível', render: (l) => `${l.nivelId} — ${l.nivelNome}`, sortValue: (l) => l.nivelId },
            {
              key: 'data',
              header: 'Última avaliação',
              render: (l) => new Date(l.dataAvaliacao).toLocaleDateString('pt-PT'),
              sortValue: (l) => l.dataAvaliacao,
            },
            {
              key: '__acoes',
              header: '',
              render: (l) =>
                tipo === 'COMPORTAMENTAL' ? (
                  <div className="flex justify-end no-print">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Eliminar esta avaliação?')) eliminar.mutate(l);
                      }}
                      className="text-fiori-text-secondary hover:text-fiori-error"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null,
            },
          ]}
        />
      )}
      {modal && <ModalCompetencia tipo={tipo} linha={modal.linha} onClose={() => setModal(null)} onSuccess={invalidarEfechar} />}
    </Card>
  );
}
