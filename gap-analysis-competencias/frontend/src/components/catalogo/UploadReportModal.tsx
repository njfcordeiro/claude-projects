import { CheckCircle2, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/form';
import { ResumoImportacao } from '../../types/api';

interface Props {
  resumo: ResumoImportacao;
  onClose: () => void;
}

/**
 * Relatório visual pós-upload: sucesso claro, ou lista de erros críticos —
 * o import é tudo-ou-nada (ver `ColaboradoresService`/`CatalogoService`
 * `importar`), por isso quando há erros nenhuma linha do ficheiro foi
 * gravada, nem as válidas.
 */
export function UploadReportModal({ resumo, onClose }: Props) {
  const semErros = resumo.erros.length === 0;

  return (
    <Modal title="Resultado da importação" onClose={onClose}>
      <div className="space-y-4">
        <div className={`flex items-start gap-2 rounded border p-3 text-sm ${semErros ? 'border-fiori-success bg-fiori-success-bg' : 'border-fiori-error bg-fiori-error-bg'}`}>
          {semErros ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-fiori-success" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-fiori-error" />}
          <p className="text-fiori-text">
            {semErros ? (
              <>
                <span className="font-medium">Sucesso!</span> {resumo.criados} registo{resumo.criados === 1 ? '' : 's'} criado
                {resumo.criados === 1 ? '' : 's'}, {resumo.atualizados} atualizado{resumo.atualizados === 1 ? '' : 's'}.
              </>
            ) : (
              <>
                <span className="font-medium">Importação falhada — nenhuma linha foi gravada.</span> Corrige os erros abaixo no
                ficheiro e volta a submetê-lo.
              </>
            )}
          </p>
        </div>

        {resumo.erros.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fiori-error">
              <XCircle size={14} /> Erros ({resumo.erros.length})
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
