import { api, downloadFile } from './client';
import {
  AtribuirCertificacaoInput,
  AtribuirCompetenciaInput,
  CandidatosCarreiraResponse,
  CandidatosPorColaboradorResponse,
  CatalogoRegisto,
  CatalogoTabelaMeta,
  CertificacaoAtual,
  ColaboradorResumo,
  CreateAvaliacaoInput,
  CreateColaboradorInput,
  CreatePdiItemInput,
  DashboardResponse,
  DimensaoSkillMatrix,
  EliminarSugestoesPdiResponse,
  EvolucaoCarreirasResponse,
  FiltrosEvolucaoCarreiras,
  FiltrosOrganizacionais,
  FormacaoResumo,
  GerarPdiParaLobInput,
  GerarPdiParaProximoCargoInput,
  GerarPdiResponse,
  LobDetalhe,
  LobResumo,
  MeResponse,
  ObjetivosLobResponse,
  PapelUtilizador,
  ParticipacaoProjeto,
  PdiItem,
  PesosProntidao,
  ProjetoVertenteDetalhe,
  RegistarParticipacaoProjetoInput,
  RelatorioGapCargo,
  RelatorioGapLob,
  ResumoAtribuicao,
  ResumoImportacao,
  ResumoImportacaoNiveis,
  SenhaTemporariaResponse,
  SkillMatrixResponse,
  UltimaAvaliacao,
  UpdateColaboradorInput,
  UpdatePdiItemInput,
  UpsertCertificacaoInput,
  UsuarioResumo,
} from '../types/api';

export const endpoints = {
  me: () => api.get<MeResponse>('/auth/me'),

  colaboradores: () => api.get<ColaboradorResumo[]>('/colaboradores'),
  colaborador: (id: number) => api.get<ColaboradorResumo>(`/colaboradores/${id}`),
  criarColaborador: (dto: CreateColaboradorInput) => api.post<ColaboradorResumo>('/colaboradores', dto),
  atualizarColaborador: (id: number, dto: UpdateColaboradorInput) => api.patch<ColaboradorResumo>(`/colaboradores/${id}`, dto),
  eliminarColaborador: (id: number) => api.delete<void>(`/colaboradores/${id}`),
  colaboradoresExportar: () => downloadFile('/colaboradores/export', 'colaboradores.xlsx'),
  colaboradoresImportar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm<ResumoImportacao>('/colaboradores/import', form);
  },

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
  reinicializarPasswordUtilizador: (id: number) => api.post<SenhaTemporariaResponse>(`/users/${id}/reset-password`),

  candidatos: (carreiraId: string, cargoId?: string) =>
    api.get<CandidatosCarreiraResponse>(
      `/gap-analysis/candidatos?carreiraId=${encodeURIComponent(carreiraId)}${cargoId ? `&cargoId=${encodeURIComponent(cargoId)}` : ''}`,
    ),
  candidatosPorColaborador: () => api.get<CandidatosPorColaboradorResponse>('/gap-analysis/candidatos/por-colaborador'),

  // --- Configuração de prontidão (pesos globais) -----------------------------
  configuracaoProntidao: () => api.get<PesosProntidao>('/gap-analysis/configuracao-prontidao'),
  atualizarConfiguracaoProntidao: (dto: PesosProntidao) => api.patch<PesosProntidao>('/gap-analysis/configuracao-prontidao', dto),

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

  // --- Assistente de atribuição em massa -----------------------------------
  atribuirCompetencia: (dto: AtribuirCompetenciaInput) => api.post<ResumoAtribuicao>('/atribuicoes/competencias', dto),
  atribuirCertificacao: (dto: AtribuirCertificacaoInput) => api.post<ResumoAtribuicao>('/atribuicoes/certificacoes', dto),

  // --- PDI ------------------------------------------------------------------
  pdiListar: (colaboradorId: number) => api.get<PdiItem[]>(`/colaboradores/${colaboradorId}/pdi`),
  pdiGerar: (colaboradorId: number) => api.post<GerarPdiResponse>(`/colaboradores/${colaboradorId}/pdi/gerar`),
  pdiGerarParaLob: (colaboradorId: number, dto: GerarPdiParaLobInput) =>
    api.post<GerarPdiResponse>(`/colaboradores/${colaboradorId}/pdi/gerar-para-lob`, dto),
  pdiGerarParaCargoAtual: (colaboradorId: number) =>
    api.post<GerarPdiResponse>(`/colaboradores/${colaboradorId}/pdi/gerar-para-cargo-atual`, {}),
  pdiGerarParaProximoCargo: (colaboradorId: number, dto: GerarPdiParaProximoCargoInput) =>
    api.post<GerarPdiResponse>(`/colaboradores/${colaboradorId}/pdi/gerar-para-proximo-cargo`, dto),
  pdiCriar: (colaboradorId: number, dto: CreatePdiItemInput) => api.post<PdiItem>(`/colaboradores/${colaboradorId}/pdi`, dto),
  pdiAtualizar: (colaboradorId: number, itemId: number, dto: UpdatePdiItemInput) =>
    api.patch<PdiItem>(`/colaboradores/${colaboradorId}/pdi/${itemId}`, dto),
  pdiEliminar: (colaboradorId: number, itemId: number) => api.delete<void>(`/colaboradores/${colaboradorId}/pdi/${itemId}`),
  pdiEliminarSugestoes: (colaboradorId: number) =>
    api.delete<EliminarSugestoesPdiResponse>(`/colaboradores/${colaboradorId}/pdi/sugestoes`),

  // --- Objetivos de LOB -------------------------------------------------------
  objetivosLob: (colaboradorId: number) => api.get<ObjetivosLobResponse>(`/colaboradores/${colaboradorId}/objetivos-lob`),
  adicionarObjetivoLob: (colaboradorId: number, lobId: number) =>
    api.post<ObjetivosLobResponse>(`/colaboradores/${colaboradorId}/objetivos-lob`, { lobId }),
  removerObjetivoLob: (colaboradorId: number, lobId: number) =>
    api.delete<ObjetivosLobResponse>(`/colaboradores/${colaboradorId}/objetivos-lob/${lobId}`),

  // --- Participação em Projetos -------------------------------------------
  projetosListar: (colaboradorId: number) => api.get<ParticipacaoProjeto[]>(`/colaboradores/${colaboradorId}/projetos`),
  projetosRegistarParticipacao: (colaboradorId: number, dto: RegistarParticipacaoProjetoInput) =>
    api.post<ParticipacaoProjeto>(`/colaboradores/${colaboradorId}/projetos`, dto),
  projetosEliminarParticipacao: (colaboradorId: number, projetoId: number) =>
    api.delete<void>(`/colaboradores/${colaboradorId}/projetos/${projetoId}`),
  projetoVertentes: (projetoId: number) => api.get<ProjetoVertenteDetalhe[]>(`/projetos/${projetoId}/vertentes`),

  // --- Skill Matrix -----------------------------------------------------------
  skillMatrix: (dimensao: DimensaoSkillMatrix, filtros: FiltrosOrganizacionais = {}) => {
    const params = new URLSearchParams({ dimensao });
    if (filtros.direcaoId) params.set('direcaoId', String(filtros.direcaoId));
    if (filtros.areaId) params.set('areaId', String(filtros.areaId));
    if (filtros.nucleoId) params.set('nucleoId', String(filtros.nucleoId));
    if (filtros.cargoId) params.set('cargoId', filtros.cargoId);
    return api.get<SkillMatrixResponse>(`/gap-analysis/skill-matrix?${params.toString()}`);
  },
  evolucaoCarreiras: (filtros: FiltrosEvolucaoCarreiras = {}) => {
    const params = new URLSearchParams();
    if (filtros.direcaoId) params.set('direcaoId', String(filtros.direcaoId));
    if (filtros.areaId) params.set('areaId', String(filtros.areaId));
    if (filtros.nucleoId) params.set('nucleoId', String(filtros.nucleoId));
    if (filtros.grupoCarreiraId) params.set('grupoCarreiraId', filtros.grupoCarreiraId);
    const query = params.toString();
    return api.get<EvolucaoCarreirasResponse>(`/gap-analysis/evolucao-carreiras${query ? `?${query}` : ''}`);
  },
  skillMatrixExportar: (filtros: FiltrosOrganizacionais = {}, competenciaIds?: number[]) => {
    const params = new URLSearchParams();
    if (filtros.direcaoId) params.set('direcaoId', String(filtros.direcaoId));
    if (filtros.areaId) params.set('areaId', String(filtros.areaId));
    if (filtros.nucleoId) params.set('nucleoId', String(filtros.nucleoId));
    if (filtros.cargoId) params.set('cargoId', filtros.cargoId);
    if (competenciaIds && competenciaIds.length > 0) params.set('competenciaIds', competenciaIds.join(','));
    const query = params.toString();
    return downloadFile(`/gap-analysis/skill-matrix/export${query ? `?${query}` : ''}`, 'niveis-competencia.xlsx');
  },
  skillMatrixImportar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm<ResumoImportacaoNiveis>('/gap-analysis/skill-matrix/import', form);
  },
};
