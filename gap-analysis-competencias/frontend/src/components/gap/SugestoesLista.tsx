import { Award, Clock, GraduationCap } from 'lucide-react';
import { CertificacaoCandidata, FormacaoCandidata } from '../../types/api';

/** Sugestões de formação/certificação para fechar uma lacuna — já vêm ordenadas por relevância do backend. */
export function SugestoesLista({
  formacoes,
  certificacoes,
}: {
  formacoes: FormacaoCandidata[];
  certificacoes: CertificacaoCandidata[];
}) {
  if (formacoes.length === 0 && certificacoes.length === 0) {
    return <p className="text-xs italic text-fiori-text-secondary">Sem formações ou certificações associadas no catálogo.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {formacoes.map((f) => (
        <span
          key={`f-${f.formacaoId}`}
          className="inline-flex items-center gap-1.5 rounded border border-fiori-border bg-fiori-surface px-2 py-1 text-xs text-fiori-text"
          title={`Leva ao nível ${f.nivelOferecido}`}
        >
          <GraduationCap size={12} className="text-fiori-primary" />
          {f.formacaoNome}
          {f.duracaoHoras !== null && (
            <span className="flex items-center gap-0.5 text-fiori-text-secondary">
              <Clock size={11} /> {f.duracaoHoras}h
            </span>
          )}
        </span>
      ))}
      {certificacoes.map((c) => (
        <span
          key={`c-${c.certificacaoId}`}
          className="inline-flex items-center gap-1.5 rounded border border-fiori-border bg-fiori-surface px-2 py-1 text-xs text-fiori-text"
          title={`Valida o nível ${c.nivelOferecido}`}
        >
          <Award size={12} className="text-fiori-primary" />
          {c.certificacaoNome}
          {c.jaPossui && <span className="text-fiori-text-secondary">(já possui)</span>}
        </span>
      ))}
    </div>
  );
}
