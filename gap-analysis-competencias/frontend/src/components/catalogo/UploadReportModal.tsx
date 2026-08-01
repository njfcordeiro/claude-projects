import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/form';
import { ResumoImportacao } from '../../types/api';

interface Props {
  resumo: ResumoImportacao;
  onClose: () => void;
}

/**
 * Relatório visual pós-upload (pedido do utilizador): sucesso claro,
 * avisos de auto-criação de registos relacionados (LOB/Formação/...) e
 * erros críticos linha-a-linha — nunca só um texto genérico.
 */
export function UploadReportModal({ resumo, onClose }: Props) {
  const semErros = resumo.erros.length === 0;

  return (
    <Modal title="Resultado da importação" onClose={onClose}>
      <div className="space-y-4">
        <div className={`flex items-start gap-2 rounded border p-3 text-sm ${semErros ? 'border-fiori-success bg-fiori-success-bg' : 'border-fiori-warning bg-fiori-warning-bg'}`}>
          {semErros ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-fiori-success" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-fiori-warning" />}
          <p className="text-fiori-text">
            <span className="font-medium">{semErros ? 'Sucesso!' : 'Importação concluída com avisos.'}</span>{' '}
            {resumo.criados} registo{resumo.criados === 1 ? '' : 's'} criado{resumo.criados === 1 ? '' : 's'}, {resumo.atualizados}{' '}
            atualizado{resumo.atualizados === 1 ? '' : 's'}.
          </p>
        </div>

        {resumo.avisos.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fiori-text">
              <AlertTriangle size={14} className="text-fiori-warning" /> Avisos ({resumo.avisos.length})
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-fiori-border bg-fiori-canvas p-2 text-xs text-fiori-text">
              {resumo.avisos.map((a, i) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          </div>
        )}

        {resumo.erros.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fiori-error">
              <XCircle size={14} /> Erros críticos ({resumo.erros.length}) — linhas não importadas
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-fiori-error bg-fiori-error-bg p-2 text-xs text-fiori-text">
              {resumo.erros.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
