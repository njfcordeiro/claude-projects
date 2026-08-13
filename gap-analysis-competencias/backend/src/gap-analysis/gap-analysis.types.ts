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

/**
 * Pesos do cálculo de prontidão (pedido do utilizador), em pontos
 * percentuais, sempre a somar 100 — validado em
 * ConfiguracaoProntidaoService.atualizar, nunca dentro do motor puro.
 * Configuração global (não por LOB), lida de `ConfiguracaoProntidao`
 * (singleton, id=1).
 */
export interface PesosProntidao {
  pesoCompetencias: number;
  pesoCertificacoes: number;
  pesoPontos: number;
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
  /** 0-100 — média ponderada (ver PesosProntidao) de 3 rácios: competências
   *  obrigatórias cumpridas, certificações obrigatórias cumpridas e pontos
   *  obtidos/mínimos (capado a 100%). Cada rácio só atinge 1 quando esse
   *  critério está totalmente cumprido, por isso prontidaoPercentual === 100
   *  ⇔ atingido === true — nunca diverge. */
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

/**
 * Vertente de Projeto candidata para subir de nível numa competência —
 * diferente de Formação/Certificação (que levam a um nível X fixo), uma
 * vertente concluída dá sempre +1 nível (capado ao nível máximo da
 * escala). Só aparecem vertentes de projetos em que o colaborador ainda
 * não participou (cada projeto só conta uma vez).
 */
export interface ProjetoVertenteCandidata {
  projetoId: number;
  projetoNome: string;
  vertenteId: number;
  vertenteNome: string;
}

export interface SugestoesCompetencia {
  formacoes: FormacaoCandidata[];
  certificacoes: CertificacaoCandidata[];
  projetos: ProjetoVertenteCandidata[];
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
  /** Nº de competências obrigatórias exigidas por esta LOB. */
  competenciasObrigatoriasTotal: number;
  /** Nº dessas competências obrigatórias que o colaborador não cumpre (nível abaixo do exigido). */
  competenciasObrigatoriasEmFalta: number;
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
  direcaoId: number | null;
  direcaoNome: string | null;
  areaId: number | null;
  areaNome: string | null;
  nucleoId: number | null;
  nucleoNome: string | null;
  cargoId: string;
  cargoNome: string;
  carreiraId: string | null;
  carreiraNome: string | null;
  nivelGestaoNome: string | null;
  localTrabalhoNome: string | null;
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
  porNivelGestao: ResumoGrupoDashboard[];
  porLocalTrabalho: ResumoGrupoDashboard[];
  coberturaArquitetos: CoberturaArquitetos[];
  colaboradores: ResumoColaboradorDashboard[];
  /** Frases de insight geradas a partir dos agregados acima — ver GapAnalysisService.gerarInsights. */
  insights: string[];
  competenciasCriticas: CompetenciaCritica[];
  colaboradoresEmRiscoFuga: ColaboradorEmRisco[];
}

/** Uma linha por par (colaborador, Cargo-alvo) — ver GapAnalysisService.sugerirCandidatosCarreira/sugerirCandidatosPorColaborador. */
export interface CandidatoCarreira {
  colaboradorId: number;
  nome: string;
  direcaoId: number | null;
  direcaoNome: string | null;
  areaId: number | null;
  areaNome: string | null;
  nucleoId: number | null;
  nucleoNome: string | null;
  cargoAtualId: string;
  cargoAtualNome: string;
  /** Cargo para o qual este colaborador é candidato (predecessor direto em cargo_progressao). */
  proximoCargoId: string;
  proximoCargoNome: string;
  /** Carreira do próximo cargo — só relevante na vista "por colaborador", onde as linhas de uma mesma pessoa podem pertencer a carreiras diferentes. */
  proximoCargoCarreiraId: string | null;
  proximoCargoCarreiraNome: string | null;
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

/**
 * Resposta de `GET /gap-analysis/candidatos/por-colaborador` — todas as
 * progressões de cargo possíveis, em todas as carreiras, para cada
 * colaborador (não filtrado a uma carreira). Ordenada por nome do
 * colaborador para que as várias linhas da mesma pessoa fiquem contíguas
 * (o frontend agrupa-as visualmente numa única célula por pessoa).
 */
export interface CandidatosPorColaboradorResponse {
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
  direcaoNome: string | null;
  areaNome: string | null;
  nucleoNome: string | null;
  /** Chave = String(coluna.id). Dimensão 'lob': prontidaoPercentual 0-100. Dimensão 'competencia': nivelId atual 0-5. */
  valores: Record<string, number>;
}

export interface SkillMatrixResponse {
  dimensao: DimensaoSkillMatrix;
  colunas: SkillMatrixColuna[];
  linhas: SkillMatrixLinha[];
}

// --- Evolução de Carreiras (mapa de progressão de cargos) ----------------

/** Um Cargo do catálogo, com a Carreira/Categoria a que pertence e agregados da população atual (colaboradores ativos que respeitam `filtros`). */
export interface CargoEvolucao {
  cargoId: string;
  cargoNome: string;
  carreiraId: string;
  carreiraNome: string;
  carreiraRelevante: boolean;
  categoriaId: string;
  categoriaNome: string;
  /** Nº de colaboradores atualmente neste cargo (0 se nenhum). */
  totalColaboradores: number;
  /** Média de prontidaoMedia dos colaboradores deste cargo — 0 se totalColaboradores for 0. */
  prontidaoMedia: number;
}

/** Uma seta cargo_progressao — pode ligar cargos de Carreiras diferentes (ver GapAnalysisService.sugerirCandidatosPorColaborador). */
export interface ProgressaoCargo {
  cargoId: string;
  proximoCargoId: string;
}

/** Resposta de `GET /gap-analysis/evolucao-carreiras` — TODOS os Cargos e progressões do catálogo (a topologia não é filtrada), só os agregados por Cargo respeitam `filtros`/RBAC. */
export interface EvolucaoCarreirasResponse {
  cargos: CargoEvolucao[];
  progressoes: ProgressaoCargo[];
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
