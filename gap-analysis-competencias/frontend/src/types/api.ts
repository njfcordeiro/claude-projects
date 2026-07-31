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
