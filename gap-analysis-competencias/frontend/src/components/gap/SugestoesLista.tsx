import { Award, Clock, GraduationCap, Puzzle } from 'lucide-react';
import { CertificacaoCandidata, FormacaoCandidata, ProjetoVertenteCandidata } from '../../types/api';

/** Sugestões de formação/certificação/projeto para fechar uma lacuna — já vêm ordenadas por relevância do backend (formações/certificações); projetos não têm ordem própria, cada um dá sempre +1 nível. */
export function SugestoesLista({
  formacoes,
  certificacoes,
  projetos = [],
  onRegistrarProjeto,
}: {
  formacoes: FormacaoCandidata[];
  certificacoes: CertificacaoCandidata[];
  projetos?: ProjetoVertenteCandidata[];
  onRegistrarProjeto?: (vertente: ProjetoVertenteCandidata) => void;
}) {
  if (formacoes.length === 0 && certificacoes.length === 0 && projetos.length === 0) {
    return <p className="text-xs italic text-fiori-text-secondary">Sem formações, certificações ou projetos associados no catálogo.</p>;
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
      {projetos.map((p) => (
        <button
          key={`p-${p.vertenteId}`}
          type="button"
          onClick={() => onRegistrarProjeto?.(p)}
          disabled={!onRegistrarProjeto}
          title={`Vertente "${p.vertenteNome}" do projeto "${p.projetoNome}" — sobe +1 nível`}
          className="inline-flex items-center gap-1.5 rounded border border-[#C9A900] bg-[#FFFBF0] px-2 py-1 text-xs text-fiori-text disabled:cursor-default"
        >
          <Puzzle size={12} className="text-[#8A6D00]" />
          {p.projetoNome} <span className="text-fiori-text-secondary">— {p.vertenteNome} (+1 nível)</span>
        </button>
      ))}
    </div>
  );
}
