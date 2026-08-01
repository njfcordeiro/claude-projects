import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { CertificacaoAtual, ConflitoResponse } from '../../types/api';
import { Modal } from '../ui/Modal';
import { Button, Field, Input } from '../ui/form';

interface Props {
  colaboradorId: number;
  certificacaoId: string;
  certificacaoNome: string;
  onClose: () => void;
  onSuccess: () => void;
}

function paraInputDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

/** Cria ou edita a certificação de um colaborador — mesmo padrão de locking otimista do AvaliarCompetenciaModal, mas por `version` em vez de `baseAssessmentId`. */
export function EditarCertificacaoModal({ colaboradorId, certificacaoId, certificacaoNome, onClose, onSuccess }: Props) {
  const [base, setBase] = useState<CertificacaoAtual | null | undefined>(undefined);
  const [falhaAoCarregar, setFalhaAoCarregar] = useState<string | null>(null);
  const [dataObtencao, setDataObtencao] = useState('');
  const [dataValidade, setDataValidade] = useState('');
  const [conflito, setConflito] = useState<ConflitoResponse<CertificacaoAtual> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarEstadoAtual() {
    setConflito(null);
    setFalhaAoCarregar(null);
    setBase(undefined);
    try {
      const atual = await endpoints.certificacaoAtual(colaboradorId, certificacaoId);
      setBase(atual);
      setDataObtencao(paraInputDate(atual?.dataObtencao));
      setDataValidade(paraInputDate(atual?.dataValidade));
    } catch (err) {
      setFalhaAoCarregar(err instanceof ApiError ? err.message : 'Não foi possível carregar o estado atual.');
    }
  }

  useEffect(() => {
    carregarEstadoAtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorId, certificacaoId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      await endpoints.upsertCertificacao(colaboradorId, certificacaoId, {
        dataObtencao: dataObtencao || undefined,
        dataValidade: dataValidade || undefined,
        version: base?.version,
      });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflito(err.body as ConflitoResponse<CertificacaoAtual>);
      } else {
        setErro(err instanceof ApiError ? err.message : 'Não foi possível gravar a certificação.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Certificação: ${certificacaoNome}`} onClose={onClose}>
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
                  Validade atual no servidor:{' '}
                  <strong>{conflito.current.dataValidade ? new Date(conflito.current.dataValidade).toLocaleDateString('pt-PT') : '—'}</strong>
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

          <Field label="Data de obtenção">
            <Input type="date" value={dataObtencao} onChange={(e) => setDataObtencao(e.target.value)} disabled={!!conflito} />
          </Field>
          <Field label="Data de validade">
            <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} disabled={!!conflito} />
          </Field>

          {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !!conflito}>
              {submitting ? 'A gravar…' : 'Gravar certificação'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
