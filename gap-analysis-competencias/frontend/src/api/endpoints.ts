import { api } from './client';
import {
  ColaboradorResumo,
  DashboardResponse,
  FormacaoResumo,
  LobDetalhe,
  LobResumo,
  MeResponse,
  PapelUtilizador,
  RelatorioGapCargo,
  RelatorioGapLob,
  UsuarioResumo,
} from '../types/api';

export const endpoints = {
  me: () => api.get<MeResponse>('/auth/me'),

  colaboradores: () => api.get<ColaboradorResumo[]>('/colaboradores'),
  colaborador: (id: number) => api.get<ColaboradorResumo>(`/colaboradores/${id}`),

  dashboard: () => api.get<DashboardResponse>('/gap-analysis/dashboard'),
  gapCargo: (colaboradorId: number) => api.get<RelatorioGapCargo>(`/gap-analysis/colaboradores/${colaboradorId}/cargo`),
  gapLob: (colaboradorId: number, lobId: number) =>
    api.get<RelatorioGapLob>(`/gap-analysis/colaboradores/${colaboradorId}/lobs/${lobId}`),

  lobs: () => api.get<LobResumo[]>('/lobs'),
  lob: (id: number) => api.get<LobDetalhe>(`/lobs/${id}`),

  formacoes: () => api.get<FormacaoResumo[]>('/formacoes'),

  users: () => api.get<UsuarioResumo[]>('/users'),
  createUser: (dto: { email: string; password: string; role: PapelUtilizador; colaboradorId?: number }) =>
    api.post<UsuarioResumo>('/users', dto),
  updateUser: (id: number, dto: { role?: PapelUtilizador; isActive?: boolean }) =>
    api.patch<UsuarioResumo>(`/users/${id}`, dto),
};
