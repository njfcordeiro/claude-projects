/**
 * Tipos do motor de comparação de gap. `nivel`/`nivelExigido`/`nivelMinimo`
 * são sempre o `niveis.id` (0-5) — a escala já É a magnitude comparável,
 * não precisa de um campo "valor" separado (ver docs/01-modelo-dados.md
 * secção 3, tabela `niveis`).
 */

export interface RequisitoCompetenciaInput {
  competenciaId: number;
  competenciaNome: string;
  obrigatorio: boolean;
  pontos: number;
  nivelMinimo: number;
}

export interface RequisitoCertificacaoInput {
  certificacaoId: string;
  certificacaoNome: string;
  obrigatorio: boolean;
}

export interface CertificacaoColaboradorInput {
  dataValidade: Date | null;
  dataObtencao: Date | null;
}

export interface GapCompetencia {
  competenciaId: number;
  competenciaNome: string;
  obrigatorio: boolean;
  nivelExigido: number;
  nivelAtual: number;
  pontosPossiveis: number;
  pontosObtidos: number;
  cumprido: boolean;
}

export interface GapCertificacao {
  certificacaoId: string;
  certificacaoNome: string;
  obrigatorio: boolean;
  possui: boolean;
  valida: boolean;
  dataValidade: Date | null;
  cumprido: boolean;
}

export interface ResultadoGapLob {
  lobId: number;
  lobNome: string;
  pontosObtidos: number;
  pontosMinimos: number;
  /** 0-100, capado — pontosObtidos/pontosMinimos. Não implica `atingido`
   *  sozinho: um obrigatório em falta bloqueia mesmo com 100%. */
  prontidaoPercentual: number;
  atingido: boolean;
  obrigatoriosEmFalta: number;
  competencias: GapCompetencia[];
  certificacoes: GapCertificacao[];
}

export interface FormacaoCandidata {
  formacaoId: number;
  formacaoNome: string;
  /** Nível que a formação leva o colaborador a atingir nesta competência. */
  nivelOferecido: number;
  duracaoHoras: number | null;
}

export interface CertificacaoCandidata {
  certificacaoId: string;
  certificacaoNome: string;
  /** Nível que a certificação valida nesta competência. */
  nivelOferecido: number;
  jaPossui: boolean;
}

export interface SugestoesCompetencia {
  formacoes: FormacaoCandidata[];
  certificacoes: CertificacaoCandidata[];
}

export interface RelatorioGapCompetencia extends GapCompetencia {
  /** Só populado quando `cumprido === false`. */
  sugestoes: SugestoesCompetencia;
}

/**
 * Não há um "requisito" único que cubra uma certificação em falta — a
 * própria certificação É o requisito. A preparação indireta possível
 * (dado o catálogo) é reforçar as competências que essa certificação
 * valida (via `certificacao_requisito_competencia`).
 */
export interface PreparacaoCertificacao {
  competenciaId: number;
  competenciaNome: string;
  nivelValidado: number;
  formacoesRecomendadas: FormacaoCandidata[];
}

export interface RelatorioGapCertificacao extends GapCertificacao {
  /** Só populado quando `cumprido === false`. */
  preparacao: PreparacaoCertificacao[];
}

export interface RelatorioGapLob {
  lobId: number;
  lobNome: string;
  pontosObtidos: number;
  pontosMinimos: number;
  prontidaoPercentual: number;
  atingido: boolean;
  obrigatoriosEmFalta: number;
  competencias: RelatorioGapCompetencia[];
  certificacoes: RelatorioGapCertificacao[];
}

export interface ResumoGapLob {
  lobId: number;
  lobNome: string;
  pontosObtidos: number;
  pontosMinimos: number;
  prontidaoPercentual: number;
  atingido: boolean;
}

export interface RelatorioGapCargo {
  colaboradorId: number;
  cargoId: string;
  cargoNome: string;
  lobsExigidos: number;
  lobsAtingidos: number;
  gap: number;
  lobs: ResumoGapLob[];
}

export interface ResumoColaboradorDashboard {
  colaboradorId: number;
  nome: string;
  direcaoNome: string | null;
  areaNome: string | null;
  nucleoNome: string | null;
  cargoId: string;
  cargoNome: string;
  carreiraId: string | null;
  lobsExigidos: number;
  lobsAtingidos: number;
  gap: number;
  prontidaoMedia: number;
  dataAdmissao: string | null;
}

export interface ResumoGrupoDashboard {
  grupo: string;
  totalColaboradores: number;
  prontidaoMedia: number;
  emRisco: number;
}

export interface DashboardResponse {
  totalColaboradores: number;
  prontidaoMediaGeral: number;
  colaboradoresEmRisco: number;
  porDirecao: ResumoGrupoDashboard[];
  porArea: ResumoGrupoDashboard[];
  porNucleo: ResumoGrupoDashboard[];
  porCargo: ResumoGrupoDashboard[];
  colaboradores: ResumoColaboradorDashboard[];
  /** Frases de insight geradas a partir dos agregados acima — ver GapAnalysisService.gerarInsights. */
  insights: string[];
  competenciasCriticas: CompetenciaCritica[];
  colaboradoresEmRiscoFuga: ColaboradorEmRisco[];
}

/** Resposta de `GET /gap-analysis/candidatos` — colaboradores fora da carreira-alvo, ordenados por proximidade. */
export interface CandidatosCarreiraResponse {
  carreiraId: string;
  carreiraNome: string;
  cargoEntradaId: string | null;
  cargoEntradaNome: string | null;
  lobsExigidosEntrada: number;
  candidatos: ResumoColaboradorDashboard[];
}

// --- Skill Matrix (heatmap colaboradores × LOBs/competências) ------------

export type DimensaoSkillMatrix = 'lob' | 'competencia';

export interface SkillMatrixColuna {
  id: number;
  nome: string;
}

export interface SkillMatrixLinha {
  colaboradorId: number;
  nome: string;
  /** Chave = String(coluna.id). Dimensão 'lob': prontidaoPercentual 0-100. Dimensão 'competencia': nivelId atual 0-5. */
  valores: Record<string, number>;
}

export interface SkillMatrixResponse {
  dimensao: DimensaoSkillMatrix;
  colunas: SkillMatrixColuna[];
  linhas: SkillMatrixLinha[];
}

export interface FiltrosOrganizacionais {
  direcaoId?: number;
  areaId?: number;
  nucleoId?: number;
  cargoId?: string;
}

// --- Insights automáticos e risco de fuga de talento (dashboard) ---------

export interface CompetenciaCritica {
  competenciaId: number;
  competenciaNome: string;
  colaboradoresEmFalta: number;
}

export interface ColaboradorEmRisco {
  colaboradorId: number;
  nome: string;
  cargoNome: string;
  prontidaoMedia: number;
  anosNoCargoAtual: number;
  motivo: string;
}
