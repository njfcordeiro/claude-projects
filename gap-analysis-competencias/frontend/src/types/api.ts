// Tipos espelhando os DTOs/respostas do backend (backend/src). Mantidos
// manualmente por agora — gerar a partir do Swagger (`/api/docs-json`) é
// um próximo passo razoável quando a API tiver mais módulos.

export type PapelUtilizador = 'ADMIN_RH' | 'MANAGER' | 'EMPLOYEE' | 'VIEWER';

export interface LoginResponse {
  accessToken: string;
}

export interface MeResponse {
  id: number;
  email: string;
  role: PapelUtilizador;
  colaboradorId: number | null;
  colaborador: { id: number; nome: string; cargoId: string | null } | null;
}

export interface ColaboradorResumo {
  id: number;
  nome: string;
  cargoId: string | null;
  cargoNome: string | null;
  direcaoId: number | null;
  direcaoNome: string | null;
  direcaoRelevante: boolean;
  areaId: number | null;
  areaNome: string | null;
  areaRelevante: boolean;
  nucleoId: number | null;
  nucleoNome: string | null;
  nucleoRelevante: boolean;
  carreiraId: string | null;
  categoriaId: string | null;
  managerId: number | null;
  managerNome: string | null;
  proximaLobId: number | null;
  proximaLobNome: string | null;
  nivelGestaoId: number | null;
  nivelGestaoNome: string | null;
  localTrabalhoId: number | null;
  localTrabalhoNome: string | null;
  /** Formato AAAA-MM-DD, null se não preenchida. */
  dataAdmissao: string | null;
  /** Inativos são excluídos de toda a análise agregada (Dashboard, Skill Matrix, Candidatos, ...). */
  ativo: boolean;
  /** Nº de subordinados diretos ainda ativos — usado para alertar quando este colaborador está inativo mas ainda é gestor de gente ativa. */
  subordinadosAtivos: number;
  /** Locking otimista — ver docs/02-arquitetura-tecnica.md secção 4.5. */
  version: number;
}

export interface CreateColaboradorInput {
  id: number;
  nome: string;
  cargoId?: string;
  direcaoId?: number;
  nucleoId?: number;
  areaId?: number;
  carreiraId?: string;
  categoriaId?: string;
  managerId?: number;
  proximaLobId?: number;
  nivelGestaoId?: number;
  localTrabalhoId?: number;
  dataAdmissao?: string;
  ativo?: boolean;
}

export interface UpdateColaboradorInput {
  nome?: string;
  cargoId?: string;
  direcaoId?: number;
  nucleoId?: number;
  areaId?: number;
  carreiraId?: string;
  categoriaId?: string;
  managerId?: number;
  dataAdmissao?: string;
  proximaLobId?: number | null;
  nivelGestaoId?: number | null;
  localTrabalhoId?: number | null;
  ativo?: boolean;
  version: number;
}

// --- Escrita com locking otimista (Prompt 5) ------------------------------

export interface UltimaAvaliacao {
  id: number;
  nivel_id: number;
  data_avaliacao: string;
  origem: string;
}

export interface CertificacaoAtual {
  id: number;
  colaboradorId: number;
  certificacaoId: string;
  dataObtencao: string | null;
  dataValidade: string | null;
  anexoUrl: string | null;
  version: number;
}

export interface CreateAvaliacaoInput {
  competenciaId: number;
  nivelId: number;
  baseAssessmentId: number | null;
  origem?: 'MANAGER' | 'FORMAL' | 'AVALIACAO_360';
}

export interface UpsertCertificacaoInput {
  dataObtencao?: string;
  dataValidade?: string;
  anexoUrl?: string;
  version?: number;
}

/** Corpo de uma resposta 409 — ver ApiError.body em api/client.ts. */
export interface ConflitoResponse<T> {
  message: string;
  current: T | null;
}

// --- Motor de gap (backend/src/gap-analysis/gap-analysis.types.ts) -------

export interface FormacaoCandidata {
  formacaoId: number;
  formacaoNome: string;
  nivelOferecido: number;
  duracaoHoras: number | null;
}

export interface CertificacaoCandidata {
  certificacaoId: string;
  certificacaoNome: string;
  nivelOferecido: number;
  jaPossui: boolean;
}

export interface RelatorioGapCompetencia {
  competenciaId: number;
  competenciaNome: string;
  obrigatorio: boolean;
  nivelExigido: number;
  nivelAtual: number;
  pontosPossiveis: number;
  pontosObtidos: number;
  cumprido: boolean;
  sugestoes: { formacoes: FormacaoCandidata[]; certificacoes: CertificacaoCandidata[] };
}

export interface PreparacaoCertificacao {
  competenciaId: number;
  competenciaNome: string;
  nivelValidado: number;
  formacoesRecomendadas: FormacaoCandidata[];
}

export interface RelatorioGapCertificacao {
  certificacaoId: string;
  certificacaoNome: string;
  obrigatorio: boolean;
  possui: boolean;
  valida: boolean;
  dataValidade: string | null;
  cumprido: boolean;
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
  competenciasObrigatoriasCumpridas: boolean;
  pontosMinimosCumpridos: boolean;
  certificacoesObrigatoriasTotal: number;
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

export interface ResumoGrupoDashboard {
  grupo: string;
  totalColaboradores: number;
  /** % do total de colaboradores neste universo (organização ou equipa do MANAGER) — "peso" do grupo. */
  percentualDoTotal: number;
  prontidaoMedia: number;
  emRisco: number;
}

export interface CoberturaArquitetos {
  /** null = Área sem nenhum Núcleo associado — linha com o total da Área inteira. */
  nucleoNome: string | null;
  areaNome: string;
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
  insights: string[];
  competenciasCriticas: CompetenciaCritica[];
  colaboradoresEmRiscoFuga: ColaboradorEmRisco[];
}

export interface CandidatoCarreira {
  colaboradorId: number;
  nome: string;
  direcaoNome: string | null;
  areaNome: string | null;
  nucleoNome: string | null;
  cargoAtualId: string;
  cargoAtualNome: string;
  proximoCargoId: string;
  proximoCargoNome: string;
  lobsAtingidos: number;
  lobsExigidos: number;
  gap: number;
  prontidao: number | null;
  anosExperiencia: number | null;
  aptoAntiguidade: boolean;
  aptoLobs: boolean;
  apto: boolean;
}

export interface CandidatosCarreiraResponse {
  carreiraId: string;
  carreiraNome: string;
  candidatos: CandidatoCarreira[];
}

// --- Catálogo genérico (backend/src/catalogo) -----------------------------

export type CatalogoTipoCampo = 'string' | 'int' | 'boolean' | 'relation';

export interface CatalogoCampoDef {
  key: string;
  label: string;
  tipo: CatalogoTipoCampo;
  obrigatorio: boolean;
  relatedTable?: string;
  relationAccessor?: string;
}

export interface CatalogoTabelaMeta {
  tabela: string;
  label: string;
  campos: CatalogoCampoDef[];
  identityFields: string[];
}

export type CatalogoRegisto = Record<string, string | number | boolean | null>;

export interface ResumoImportacao {
  criados: number;
  atualizados: number;
  avisos: string[];
  erros: string[];
}

export interface ResumoImportacaoNiveis {
  processadas: number;
  criadas: number;
  semAlteracao: number;
  erros: string[];
}

// --- Assistente de atribuição em massa (backend/src/atribuicoes) ---------

export interface AtribuirCompetenciaInput {
  colaboradorIds: number[];
  competenciaId: number;
  nivelId: number;
  dataAvaliacao?: string;
}

export interface AtribuirCertificacaoInput {
  colaboradorIds: number[];
  certificacaoId: string;
  dataObtencao?: string;
  dataValidade?: string;
}

export interface ResumoAtribuicao {
  processados: number;
  criados: number;
  atualizados: number;
  erros: string[];
}

// --- PDI (backend/src/pdi) -------------------------------------------------

export type EstadoPdi = 'PENDENTE' | 'EM_CURSO' | 'CONCLUIDO';
export type OrigemPdi = 'AUTOMATICO' | 'MANUAL';

export interface PdiItem {
  id: number;
  colaboradorId: number;
  competenciaId: number | null;
  certificacaoId: string | null;
  formacaoId: number | null;
  descricao: string;
  estado: EstadoPdi;
  origem: OrigemPdi;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  competencia: { nome: string } | null;
  certificacao: { nome: string } | null;
  formacao: { nome: string; duracaoHoras: number | null } | null;
}

export interface GerarPdiResponse {
  criados: number;
  itens: PdiItem[];
}

export interface UpdatePdiItemInput {
  estado?: EstadoPdi;
  notas?: string;
}

export interface CreatePdiItemInput {
  competenciaId?: number;
  certificacaoId?: string;
}

// --- Skill Matrix (backend/src/gap-analysis) ------------------------------

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

// --- Catálogo (backend/src/lobs, backend/src/formacoes) -------------------

export interface LobResumo {
  id: number;
  nome: string;
  areaNome: string;
  pontosMinimos: number;
  totalRequisitosCompetencia: number;
  totalRequisitosCertificacao: number;
}

export interface LobDetalhe {
  id: number;
  nome: string;
  areaNome: string;
  pontosMinimos: number;
  requisitosCompetencia: {
    competenciaId: number;
    competenciaNome: string;
    obrigatorio: boolean;
    pontos: number;
    nivelMinimoId: number;
    nivelMinimoNome: string;
  }[];
  requisitosCertificacao: { certificacaoId: string; certificacaoNome: string; obrigatorio: boolean }[];
}

export interface FormacaoResumo {
  id: number;
  nome: string;
  areaNome: string;
  duracaoHoras: number | null;
  competenciasDesenvolvidas: string[];
}

// --- Administração (backend/src/users) ------------------------------------

export interface SenhaTemporariaResponse {
  senhaTemporaria: string;
}

export interface UsuarioResumo {
  id: number;
  email: string;
  role: PapelUtilizador;
  isActive: boolean;
  colaboradorId: number | null;
  lastLoginAt: string | null;
  createdAt: string;
  colaborador: { id: number; nome: string } | null;
}
