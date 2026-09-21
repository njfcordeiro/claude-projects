import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import { ajudaDoEcra } from '../../lib/ajudaEcras';

/**
 * Ícone de ajuda contextual — pedido do utilizador: "cria ajudas nos
 * vários ecrãs, em que os utilizadores carreguem num ícone e detalhe o
 * que se faz e como funciona no ecrã que a pessoa está a ver". O
 * conteúdo vem de `AJUDA_ECRAS` (partilhado com a página "Como Funciona",
 * para nunca haver duas versões do mesmo texto).
 */
export function AjudaContextual({ ecraId }: { ecraId: string }) {
  const [aberto, setAberto] = useState(false);
  const ajuda = ajudaDoEcra(ecraId);
  if (!ajuda) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1 rounded-full p-1 text-fiori-text-secondary hover:bg-fiori-canvas hover:text-fiori-primary no-print"
        aria-label={`Ajuda: ${ajuda.titulo}`}
        title="O que é este ecrã e como funciona"
      >
        <HelpCircle size={18} />
      </button>
      {aberto && (
        <Modal title={ajuda.titulo} onClose={() => setAberto(false)}>
          <div className="space-y-3">
            {ajuda.paragrafos.map((p, i) => (
              <p key={i} className="text-sm text-fiori-text-secondary">
                {p}
              </p>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
