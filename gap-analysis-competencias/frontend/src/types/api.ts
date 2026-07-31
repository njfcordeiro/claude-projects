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
  direcaoId: number | null;
  nucleoId: number | null;
  areaId: number | null;
  managerId: number | null;
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
  cargoId: string;
  cargoNome: string;
  lobsExigidos: number;
  lobsAtingidos: number;
  gap: number;
  prontidaoMedia: number;
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
  colaboradores: ResumoColaboradorDashboard[];
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
