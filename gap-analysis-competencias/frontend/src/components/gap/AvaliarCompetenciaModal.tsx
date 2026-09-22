import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { ConflitoResponse, UltimaAvaliacao } from '../../types/api';
import { Modal } from '../ui/Modal';
import { Button, Field, Select } from '../ui/form';

interface Props {
  colaboradorId: number;
  competenciaId: number;
  competenciaNome: string;
  /** Determina a escala de níveis (Técnica/Comportamental) a mostrar — pedido do utilizador: escala automática conforme o tipo da competência. */
  competenciaTipo: 'TECNICA' | 'COMPORTAMENTAL';
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Avalia uma competência. Lê SEMPRE o estado atual mesmo antes de mostrar
 * o formulário (não reaproveita valores já em cache) e envia esse id como
 * `baseAssessmentId` — se outra pessoa tiver avaliado entretanto, o
 * backend recusa com 409 e mostramos o valor atual em vez de o
 * sobrescrever às cegas (docs/02-arquitetura-tecnica.md secção 4.5).
 */
export function AvaliarCompetenciaModal({ colaboradorId, competenciaId, competenciaNome, competenciaTipo, onClose, onSuccess }: Props) {
  const tabelaNiveis = competenciaTipo === 'COMPORTAMENTAL' ? 'niveis-comportamentais' : 'niveis-tecnicos';
  const { data: niveisBrutos } = useQuery({
    queryKey: ['catalogo', tabelaNiveis],
    queryFn: () => endpoints.catalogoListar(tabelaNiveis),
  });
  const niveis = (niveisBrutos ?? [])
    .map((n) => ({ id: Number(n.id), nome: String(n.nome) }))
    .sort((a, b) => a.id - b.id);
  const nomeDoNivel = (id: number) => niveis.find((n) => n.id === id)?.nome ?? String(id);

  const [base, setBase] = useState<UltimaAvaliacao | null | undefined>(undefined); // undefined = ainda a carregar
  const [falhaAoCarregar, setFalhaAoCarregar] = useState<string | null>(null);
  const [nivelId, setNivelId] = useState(0);
  const [conflito, setConflito] = useState<ConflitoResponse<UltimaAvaliacao> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarEstadoAtual() {
    setConflito(null);
    setFalhaAoCarregar(null);
    setBase(undefined);
    try {
      const atual = await endpoints.ultimaAvaliacao(colaboradorId, competenciaId);
      setBase(atual);
      setNivelId(atual?.nivel_id ?? 0);
    } catch (err) {
      // `base` fica undefined de propósito — não deixar submeter sem saber
      // de facto o estado atual, senão o baseAssessmentId enviado seria
      // um palpite, não uma leitura real.
      setFalhaAoCarregar(err instanceof ApiError ? err.message : 'Não foi possível carregar o estado atual.');
    }
  }

  useEffect(() => {
    carregarEstadoAtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorId, competenciaId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      await endpoints.criarAvaliacao(colaboradorId, {
        competenciaId,
        nivelId,
        baseAssessmentId: base?.id ?? null,
      });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflito(err.body as ConflitoResponse<UltimaAvaliacao>);
      } else {
        setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar a avaliação.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Avaliar: ${competenciaNome}`} onClose={onClose}>
      {base === undefined ? (
        falhaAoCarregar ? (
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-sm text-fiori-error">
              <AlertTriangle size={14} /> {falhaAoCarregar}
            </p>
            <button type="button" onClick={carregarEstadoAtual} className="flex items-center gap-1 text-sm text-fiori-primary hover:underline">
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        ) : (
          <p className="text-sm text-fiori-text-secondary">A carregar estado atual…</p>
        )
      ) : (
        <form onSubmit={handleSubmit}>
          {conflito && (
            <div className="mb-3 rounded border border-fiori-warning bg-fiori-warning-bg p-3 text-sm text-fiori-text">
              <p className="mb-2 flex items-center gap-1.5 font-medium text-fiori-warning">
                <AlertTriangle size={14} /> {conflito.message}
              </p>
              {conflito.current && (
                <p className="mb-2 text-fiori-text-secondary">
                  Nível atual no servidor: <strong>{nomeDoNivel(conflito.current.nivel_id)}</strong> (avaliado por{' '}
                  {conflito.current.origem}, em {new Date(conflito.current.data_avaliacao).toLocaleDateString('pt-PT')}).
                </p>
              )}
              <button
                type="button"
                onClick={carregarEstadoAtual}
                className="flex items-center gap-1 text-fiori-primary hover:underline"
              >
                <RefreshCw size={12} /> Atualizar e tentar novamente
              </button>
            </div>
          )}

          {!conflito && base && (
            <p className="mb-3 text-xs text-fiori-text-secondary">
              Nível atual: <strong>{nomeDoNivel(base.nivel_id)}</strong> (desde{' '}
              {new Date(base.data_avaliacao).toLocaleDateString('pt-PT')})
            </p>
          )}

          <Field label="Novo nível">
            <Select value={nivelId} onChange={(e) => setNivelId(Number(e.target.value))} disabled={!!conflito}>
              {niveis.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id} — {n.nome}
                </option>
              ))}
            </Select>
          </Field>

          {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !!conflito}>
              {submitting ? 'A gravar…' : 'Gravar avaliação'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
