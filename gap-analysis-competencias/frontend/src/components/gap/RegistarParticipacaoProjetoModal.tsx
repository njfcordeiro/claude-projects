import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button, Checkbox } from '../ui/form';

interface Props {
  colaboradorId: number;
  projetoId: number;
  projetoNome: string;
  vertenteIdInicial: number;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Regista participação num Projeto — pedido do utilizador: um colaborador
 * só participa num dado projeto uma vez, mas escolhe, nessa participação,
 * em quais vertentes participou (mínimo 1). Aberto a partir de uma
 * sugestão de vertente específica (`vertenteIdInicial` vem pré-marcada),
 * mas mostra todas as vertentes do projeto para o caso de o colaborador
 * ter feito mais do que uma.
 */
export function RegistarParticipacaoProjetoModal({ colaboradorId, projetoId, projetoNome, vertenteIdInicial, onClose, onSuccess }: Props) {
  const { data: vertentes, isLoading } = useQuery({
    queryKey: ['projeto-vertentes', projetoId],
    queryFn: () => endpoints.projetoVertentes(projetoId),
  });
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set([vertenteIdInicial]));
  const [erro, setErro] = useState<string | null>(null);

  const registar = useMutation({
    mutationFn: () => endpoints.projetosRegistarParticipacao(colaboradorId, { projetoId, vertenteIds: Array.from(selecionadas) }),
    onSuccess: () => onSuccess(),
    onError: (err) => setErro(err instanceof ApiError ? err.message : 'Não foi possível registar a participação.'),
  });

  function alternar(vertenteId: number) {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(vertenteId)) nova.delete(vertenteId);
      else nova.add(vertenteId);
      return nova;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selecionadas.size === 0) return;
    setErro(null);
    registar.mutate();
  }

  return (
    <Modal title={`Registar participação: ${projetoNome}`} onClose={onClose}>
      {isLoading || !vertentes ? (
        <p className="text-sm text-fiori-text-secondary">A carregar vertentes…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="mb-3 text-xs text-fiori-text-secondary">
            Escolhe em quais vertentes deste projeto o colaborador participou (mínimo uma). Cada vertente marcada sobe 1 nível na sua
            competência, capado ao nível máximo da escala. Este projeto só pode ser registado uma vez.
          </p>
          <div className="mb-4 space-y-2">
            {vertentes.map((v) => (
              <label key={v.id} className="flex items-center gap-2 rounded border border-fiori-border p-2 text-sm">
                <Checkbox checked={selecionadas.has(v.id)} onChange={() => alternar(v.id)} />
                <span>
                  {v.nome} <span className="text-fiori-text-secondary">— {v.competencia.nome}</span>
                </span>
              </label>
            ))}
          </div>

          {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={registar.isPending || selecionadas.size === 0}>
              {registar.isPending ? 'A registar…' : 'Registar participação'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
