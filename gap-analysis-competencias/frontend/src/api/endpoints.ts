import { api, downloadFile } from './client';
import {
  CandidatosCarreiraResponse,
  CatalogoRegisto,
  CatalogoTabelaMeta,
  CertificacaoAtual,
  ColaboradorResumo,
  CreateAvaliacaoInput,
  CreateColaboradorInput,
  DashboardResponse,
  FormacaoResumo,
  LobDetalhe,
  LobResumo,
  MeResponse,
  PapelUtilizador,
  RelatorioGapCargo,
  RelatorioGapLob,
  ResumoImportacao,
  UltimaAvaliacao,
  UpsertCertificacaoInput,
  UsuarioResumo,
} from '../types/api';

export const endpoints = {
  me: () => api.get<MeResponse>('/auth/me'),

  colaboradores: () => api.get<ColaboradorResumo[]>('/colaboradores'),
  colaborador: (id: number) => api.get<ColaboradorResumo>(`/colaboradores/${id}`),
  criarColaborador: (dto: CreateColaboradorInput) => api.post<ColaboradorResumo>('/colaboradores', dto),
  eliminarColaborador: (id: number) => api.delete<void>(`/colaboradores/${id}`),

  // Escrita com locking otimista (Prompt 5) — ver docs/02-arquitetura-tecnica.md secção 4.5.
  ultimaAvaliacao: (colaboradorId: number, competenciaId: number) =>
    api.get<UltimaAvaliacao | null>(`/colaboradores/${colaboradorId}/competencias/${competenciaId}/ultima-avaliacao`),
  criarAvaliacao: (colaboradorId: number, dto: CreateAvaliacaoInput) =>
    api.post(`/colaboradores/${colaboradorId}/competencias`, dto),
  certificacaoAtual: (colaboradorId: number, certificacaoId: string) =>
    api.get<CertificacaoAtual | null>(`/colaboradores/${colaboradorId}/certificacoes/${certificacaoId}`),
  upsertCertificacao: (colaboradorId: number, certificacaoId: string, dto: UpsertCertificacaoInput) =>
    api.put(`/colaboradores/${colaboradorId}/certificacoes/${certificacaoId}`, dto),

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

  candidatos: (carreiraId: string) =>
    api.get<CandidatosCarreiraResponse>(`/gap-analysis/candidatos?carreiraId=${encodeURIComponent(carreiraId)}`),

  // --- Catálogo genérico (Gestão de Dados) --------------------------------
  catalogoMeta: () => api.get<CatalogoTabelaMeta[]>('/catalogo/meta'),
  catalogoListar: (tabela: string) => api.get<CatalogoRegisto[]>(`/catalogo/${tabela}`),
  catalogoCriar: (tabela: string, dados: CatalogoRegisto) => api.post<CatalogoRegisto>(`/catalogo/${tabela}`, dados),
  catalogoAtualizar: (tabela: string, dados: CatalogoRegisto) => api.patch<CatalogoRegisto>(`/catalogo/${tabela}`, dados),
  catalogoEliminar: (tabela: string, identidade: CatalogoRegisto) => api.delete<void>(`/catalogo/${tabela}`, identidade),
  catalogoExportar: (tabela: string) => downloadFile(`/catalogo/${tabela}/export`, `${tabela}.xlsx`),
  catalogoImportar: (tabela: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm<ResumoImportacao>(`/catalogo/${tabela}/import`, form);
  },
};
