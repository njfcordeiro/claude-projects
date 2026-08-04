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
  areaId: number;
  areaNome: string;
  pontosObtidos: number;
  pontosMinimos: number;
  prontidaoPercentual: number;
  atingido: boolean;
  /** Todas as competências obrigatórias desta LOB estão cumpridas. */
  competenciasObrigatoriasCumpridas: boolean;
  /** pontosObtidos >= pontosMinimos (independente de obrigatórias). */
  pontosMinimosCumpridos: boolean;
  /** Nº de certificações obrigatórias exigidas por esta LOB. */
  certificacoesObrigatoriasTotal: number;
  /** Nº dessas certificações obrigatórias que o colaborador não cumpre (em falta ou expirada). */
  certificacoesObrigatoriasEmFalta: number;
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
  carreiraNome: string | null;
  lobsExigidos: number;
  lobsAtingidos: number;
  gap: number;
  prontidaoMedia: number;
  /** Prontidão (0-100) da Próxima LOB do colaborador — null se não tiver Próxima LOB definida. */
  prontidaoProximaLob: number | null;
  dataAdmissao: string | null;
}

export interface ResumoGrupoDashboard {
  grupo: string;
  totalColaboradores: number;
  /** % do total de colaboradores neste universo (organização inteira ou equipa do MANAGER) — "peso" do grupo. */
  percentualDoTotal: number;
  prontidaoMedia: number;
  emRisco: number;
}

/**
 * Cobertura de Arquitetos por Área/Núcleo (regras pedidas pelo utilizador,
 * ver docs no ecrã "Como Funciona"): 1 Arquiteto por cada 10 colaboradores,
 * mínimo de 1 por área/núcleo com 10 ou mais colaboradores, áreas/núcleos
 * com menos de 10 não entram em défice (contam com apoio transversal).
 */
export interface CoberturaArquitetos {
  /** null = Área sem nenhum Núcleo associado (tabela nucleo_areas) — linha com o total da Área inteira. */
  nucleoNome: string | null;
  areaNome: string;
  /** Colaboradores cujo areaId E nucleoId apontam exatamente para este par (interseção, não só a Área). */
  totalColaboradores: number;
  arquitetos: number;
  exigidos: number;
  defice: number;
  excesso: number;
}

export interface DashboardResponse {
  totalColaboradores: number;
  prontidaoMediaGeral: number;
  colaboradoresEmRisco: number;
  porDirecao: ResumoGrupoDashboard[];
  porArea: ResumoGrupoDashboard[];
  porNucleo: ResumoGrupoDashboard[];
  porCargo: ResumoGrupoDashboard[];
  porCarreira: ResumoGrupoDashboard[];
  coberturaArquitetos: CoberturaArquitetos[];
  colaboradores: ResumoColaboradorDashboard[];
  /** Frases de insight geradas a partir dos agregados acima — ver GapAnalysisService.gerarInsights. */
  insights: string[];
  competenciasCriticas: CompetenciaCritica[];
  colaboradoresEmRiscoFuga: ColaboradorEmRisco[];
}

/** Uma linha por par (colaborador, Cargo-alvo) — ver GapAnalysisService.sugerirCandidatosCarreira. */
export interface CandidatoCarreira {
  colaboradorId: number;
  nome: string;
  direcaoNome: string | null;
  areaNome: string | null;
  nucleoNome: string | null;
  cargoAtualId: string;
  cargoAtualNome: string;
  /** Cargo para o qual este colaborador é candidato (predecessor direto em cargo_progressao). */
  proximoCargoId: string;
  proximoCargoNome: string;
  lobsAtingidos: number;
  /** lobsExigidos do próximoCargo. */
  lobsExigidos: number;
  gap: number;
  /** Prontidão (0-100) da Próxima LOB do colaborador — null se não tiver Próxima LOB definida. */
  prontidao: number | null;
  /** Anos desde dataAdmissao, arredondado a 1 casa decimal — null se dataAdmissao não estiver preenchida. */
  anosExperiencia: number | null;
  /** anosExperiencia cumpre o anosExperienciaMinimo do próximoCargo. */
  aptoAntiguidade: boolean;
  /** lobsAtingidos >= lobsExigidos do próximoCargo. */
  aptoLobs: boolean;
  /** aptoAntiguidade E aptoLobs. */
  apto: boolean;
}

/** Resposta de `GET /gap-analysis/candidatos` — uma linha por (colaborador, Cargo-alvo), ordenadas por proximidade. */
export interface CandidatosCarreiraResponse {
  carreiraId: string;
  carreiraNome: string;
  candidatos: CandidatoCarreira[];
}

// --- Skill Matrix (heatmap colaboradores × LOBs/competências) ------------

export type DimensaoSkillMatrix = 'lob' | 'competencia';

export interface SkillMatrixColuna {
  id: number;
  nome: string;
  areaId: number;
  areaNome: string;
  /** Só presente na dimensão 'competencia' — LOBs que exigem esta competência (usado no filtro "por LOB"). */
  lobIds?: number[];
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
