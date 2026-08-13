import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge, BadgeStatus } from '../components/ui/Badge';
import { PrintButton } from '../components/ui/PrintButton';

/**
 * Referência completa do modelo de dados (backend/prisma/schema.prisma):
 * todas as tabelas, todos os campos, as ligações entre tabelas, e se cada
 * tabela está visível/editável na aplicação. Gerado manualmente a partir
 * do schema — mantém sincronizado sempre que o schema mudar. Distinto do
 * diagrama simplificado em "Como Funciona" (esse é uma introdução
 * narrativa a 14 tabelas-chave; este ecrã é a referência técnica completa
 * das 24 tabelas + enums).
 */

interface CampoTabela {
  nome: string;
  tipo: string;
  nota?: string;
}

interface TabelaModelo {
  grupo: string;
  model: string;
  tabela: string;
  campos: CampoTabela[];
  relacoes: string[];
  visibilidade: 'total' | 'parcial' | 'nenhuma';
  visibilidadeTexto: string;
}

const TABELAS: TabelaModelo[] = [
  // --- Organização ---------------------------------------------------
  {
    grupo: 'Organização',
    model: 'Direcao',
    tabela: 'direcoes',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String', nota: 'único' },
      { nome: 'relevante', tipo: 'Boolean', nota: 'default false' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N Colaborador.direcaoId', '1—N GapAnalysisRun.scopeDirecaoId (tabela não usada, ver grupo Snapshots)'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Direções" (CRUD completo, sortável). Nome/relevância aparecem na ficha e listas de Colaboradores.',
  },
  {
    grupo: 'Organização',
    model: 'Area',
    tabela: 'areas',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String', nota: 'único' },
      { nome: 'relevante', tipo: 'Boolean', nota: 'default false' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: [
      '1—N Competencia.areaId, Lob.areaId, Formacao.areaId, Colaborador.areaId',
      'N—N Nucleo (via NucleoArea)',
    ],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Áreas". Base do agrupamento "por Área" no Dashboard e da Cobertura de Arquitetos.',
  },
  {
    grupo: 'Organização',
    model: 'Nucleo',
    tabela: 'nucleos',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String', nota: 'único' },
      { nome: 'relevante', tipo: 'Boolean', nota: 'default false' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N Colaborador.nucleoId', 'N—N Area (via NucleoArea) — sem FK direta a Direcao (decisão confirmada)'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Núcleos".',
  },
  {
    grupo: 'Organização',
    model: 'NucleoArea',
    tabela: 'nucleo_areas',
    campos: [
      { nome: 'nucleoId', tipo: 'Int (PK composta)', nota: '→ Nucleo' },
      { nome: 'areaId', tipo: 'Int (PK composta)', nota: '→ Area' },
    ],
    relacoes: ['Bridge N—N entre Nucleo e Area — um Núcleo pode estar associado a várias Áreas.'],
    visibilidade: 'total',
    visibilidadeTexto:
      'Gestão de Dados → "Áreas por Núcleo". Também usada no cálculo da Cobertura de Arquitetos do Dashboard (conta colaboradores cuja Área E Núcleo batem certo com o par).',
  },
  {
    grupo: 'Organização',
    model: 'NivelGestao',
    tabela: 'niveis_gestao',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String', nota: 'único — ex. BUD, BUM, Team Leader' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N Colaborador.nivelGestaoId'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Níveis de Gestão". Editável na ficha do colaborador; dimensão de agrupamento no Dashboard e na Skill Matrix.',
  },
  {
    grupo: 'Organização',
    model: 'LocalTrabalho',
    tabela: 'locais_trabalho',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String', nota: 'único — ex. AMT Centro, HIVE S.Miguel' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N Colaborador.localTrabalhoId'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Locais de Trabalho". Editável na ficha do colaborador.',
  },
  {
    grupo: 'Organização',
    model: 'Carreira',
    tabela: 'carreiras',
    campos: [
      { nome: 'id', tipo: 'String (PK)', nota: 'código, ex. "ARC"' },
      { nome: 'nome', tipo: 'String' },
      { nome: 'relevante', tipo: 'Boolean', nota: 'default false' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N Cargo.carreiraId', '1—N Colaborador.carreiraId'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Carreiras". Selecionável no ecrã Candidatos a carreira.',
  },
  {
    grupo: 'Organização',
    model: 'Categoria',
    tabela: 'categorias',
    campos: [
      { nome: 'id', tipo: 'String (PK)', nota: 'código, ex. "PLE"' },
      { nome: 'nome', tipo: 'String' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N Cargo.categoriaId', '1—N Colaborador.categoriaId'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Categorias".',
  },
  {
    grupo: 'Organização',
    model: 'Cargo',
    tabela: 'cargos',
    campos: [
      { nome: 'id', tipo: 'String (PK)', nota: 'código, ex. "ARC_PLE"' },
      { nome: 'nome', tipo: 'String' },
      { nome: 'carreiraId', tipo: 'String', nota: '→ Carreira' },
      { nome: 'categoriaId', tipo: 'String', nota: '→ Categoria' },
      { nome: 'anosExperienciaMinimo', tipo: 'Int?' },
      { nome: 'lobsExigidos', tipo: 'Int?', nota: 'contagem simples, não lista de LOBs' },
      { nome: 'relevante / relevanteCarreira', tipo: 'Boolean', nota: 'default false' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: [
      '1—N Colaborador.cargoId',
      'N—N consigo mesmo via CargoProgressao (progressão de carreira)',
      '1—N GapAnalysisRun/GapAnalysisCargoResult (tabelas não usadas)',
    ],
    visibilidade: 'total',
    visibilidadeTexto:
      'Gestão de Dados → "Cargos". anosExperienciaMinimo determina a elegibilidade por antiguidade em Candidatos; lobsExigidos define o alvo de gap por cargo na ficha do colaborador.',
  },
  {
    grupo: 'Organização',
    model: 'CargoProgressao',
    tabela: 'cargo_progressao',
    campos: [
      { nome: 'cargoId', tipo: 'String (PK composta)', nota: '→ Cargo' },
      { nome: 'proximoCargoId', tipo: 'String (PK composta)', nota: '→ Cargo' },
    ],
    relacoes: ['Bridge — um Cargo pode ter vários "próximos cargos" possíveis (o Excel de origem tinha listas tipo "MAN_ASS|ARC_ASS").'],
    visibilidade: 'total',
    visibilidadeTexto:
      'Gestão de Dados → "Progressão de cargos". Usada para calcular dinamicamente o cargo de entrada de uma carreira (Candidatos) e a heurística de Risco de Fuga de Talento.',
  },
  {
    grupo: 'Organização',
    model: 'Nivel',
    tabela: 'niveis',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: '0–5' },
      { nome: 'nome', tipo: 'String', nota: 'único' },
      { nome: 'descricao', tipo: 'String' },
    ],
    relacoes: [
      'Escala única de proficiência partilhada por toda a app',
      '1—N CertificacaoRequisitoCompetencia, FormacaoRequisitoCompetencia, LobRequisitoCompetencia, ColaboradorCompetencia',
    ],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Níveis". Usado em todos os seletores de nível de competência da app.',
  },

  // --- Catálogo --------------------------------------------------------
  {
    grupo: 'Catálogo',
    model: 'Competencia',
    tabela: 'competencias',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String', nota: 'único' },
      { nome: 'areaId', tipo: 'Int', nota: '→ Area' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: [
      '1—N CertificacaoRequisitoCompetencia, FormacaoRequisitoCompetencia, LobRequisitoCompetencia',
      '1—N ColaboradorCompetencia (histórico de avaliações), PdiItem',
    ],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Competências".',
  },
  {
    grupo: 'Catálogo',
    model: 'Certificacao',
    tabela: 'certificacoes',
    campos: [
      { nome: 'id', tipo: 'String (PK)', nota: 'código, ex. "C_ABAPD"' },
      { nome: 'nome', tipo: 'String' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N CertificacaoRequisitoCompetencia, LobRequisitoCertificacao, ColaboradorCertificacao, PdiItem'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Certificações".',
  },
  {
    grupo: 'Catálogo',
    model: 'CertificacaoRequisitoCompetencia',
    tabela: 'certificacao_requisito_competencia',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'certificacaoId', tipo: 'String', nota: '→ Certificacao' },
      { nome: 'competenciaId', tipo: 'Int', nota: '→ Competencia' },
      { nome: 'nivelId', tipo: 'Int', nota: '→ Nivel' },
    ],
    relacoes: ['Que Competências/Níveis uma Certificação valida — único(certificacaoId, competenciaId).'],
    visibilidade: 'total',
    visibilidadeTexto:
      'Gestão de Dados → "Requisitos de competência das certificações". Usada na secção "Preparação" das certificações em falta, no detalhe da LOB.',
  },
  {
    grupo: 'Catálogo',
    model: 'Formacao',
    tabela: 'formacoes',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String' },
      { nome: 'areaId', tipo: 'Int', nota: '→ Area' },
      { nome: 'duracaoHoras', tipo: 'Int?', nota: 'nullable — formações antigas do Excel não têm' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—N FormacaoRequisitoCompetencia, PdiItem'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Formações"; ecrã dedicado "Formações".',
  },
  {
    grupo: 'Catálogo',
    model: 'FormacaoRequisitoCompetencia',
    tabela: 'formacao_requisito_competencia',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'formacaoId', tipo: 'Int', nota: '→ Formacao' },
      { nome: 'competenciaId', tipo: 'Int', nota: '→ Competencia' },
      { nome: 'nivelId', tipo: 'Int', nota: '→ Nivel' },
    ],
    relacoes: ['Que nível uma Formação oferece numa Competência — único(formacaoId, competenciaId).'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Requisitos de competência das formações". Usada nas sugestões de formação no detalhe da LOB.',
  },

  // --- LOBs --------------------------------------------------------------
  {
    grupo: 'LOBs',
    model: 'Lob',
    tabela: 'lobs',
    campos: [
      { nome: 'id', tipo: 'Int (PK)' },
      { nome: 'nome', tipo: 'String' },
      { nome: 'areaId', tipo: 'Int', nota: '→ Area' },
      { nome: 'pontosMinimos', tipo: 'Int' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: [
      '1—N LobRequisitoCompetencia, LobRequisitoCertificacao, ColaboradorLobRecomendacao, GapAnalysisLobResult',
      '1—N Colaborador.proximaLobId ("Próxima LOB" escolhida pelo colaborador)',
    ],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "LOBs"; ecrã dedicado "LOBs". É o motor de gap real da aplicação.',
  },
  {
    grupo: 'LOBs',
    model: 'LobRequisitoCompetencia',
    tabela: 'lob_requisito_competencia',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'lobId', tipo: 'Int', nota: '→ Lob' },
      { nome: 'competenciaId', tipo: 'Int', nota: '→ Competencia' },
      { nome: 'obrigatorio', tipo: 'Boolean' },
      { nome: 'pontos', tipo: 'Int' },
      { nome: 'nivelMinimoId', tipo: 'Int', nota: '→ Nivel' },
    ],
    relacoes: ['único(lobId, competenciaId).'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Requisitos de competência das LOBs". Base do cálculo de gap — visível no detalhe da LOB na ficha do colaborador.',
  },
  {
    grupo: 'LOBs',
    model: 'LobRequisitoCertificacao',
    tabela: 'lob_requisito_certificacao',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'lobId', tipo: 'Int', nota: '→ Lob' },
      { nome: 'certificacaoId', tipo: 'String', nota: '→ Certificacao' },
      { nome: 'obrigatorio', tipo: 'Boolean' },
    ],
    relacoes: ['único(lobId, certificacaoId).'],
    visibilidade: 'total',
    visibilidadeTexto: 'Gestão de Dados → "Requisitos de certificação das LOBs". Idem, visível no detalhe da LOB.',
  },

  // --- Pessoas -------------------------------------------------------------
  {
    grupo: 'Pessoas',
    model: 'User',
    tabela: 'users',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'email', tipo: 'String', nota: 'único' },
      { nome: 'passwordHash', tipo: 'String' },
      { nome: 'role', tipo: 'enum PapelUtilizador', nota: 'ADMIN_RH · MANAGER · EMPLOYEE · VIEWER' },
      { nome: 'colaboradorId', tipo: 'Int?', nota: 'único, → Colaborador' },
      { nome: 'isActive', tipo: 'Boolean', nota: 'default true' },
      { nome: 'lastLoginAt', tipo: 'DateTime?' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['1—1 Colaborador (opcional)', '1—N ColaboradorCompetencia.avaliadoPor, GapAnalysisRun, AuditLog.changedBy'],
    visibilidade: 'parcial',
    visibilidadeTexto:
      'Ecrã Administração: criar utilizador, ativar/desativar, redefinir password. passwordHash nunca é devolvido pela API. lastLoginAt não tem UI própria ainda.',
  },
  {
    grupo: 'Pessoas',
    model: 'Colaborador',
    tabela: 'colaboradores',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: '= "ID Colaborador" do Excel, não é autoincrement' },
      { nome: 'nome', tipo: 'String' },
      { nome: 'carreiraId / categoriaId / cargoId', tipo: 'String?', nota: '→ Carreira / Categoria / Cargo, onDelete Restrict' },
      { nome: 'direcaoId / nucleoId / areaId', tipo: 'Int?', nota: '→ Direcao / Nucleo / Area, onDelete Restrict' },
      { nome: 'managerId', tipo: 'Int?', nota: '→ Colaborador (auto-relação), onDelete SetNull — eliminar o gestor não bloqueia, os subordinados ficam sem gestor' },
      { nome: 'proximaLobId', tipo: 'Int?', nota: '→ Lob, onDelete Restrict — "Próxima LOB" visada pelo colaborador' },
      { nome: 'nivelGestaoId', tipo: 'Int?', nota: '→ NivelGestao, onDelete Restrict' },
      { nome: 'localTrabalhoId', tipo: 'Int?', nota: '→ LocalTrabalho, onDelete Restrict' },
      { nome: 'ativo', tipo: 'Boolean', nota: 'default true — inativos excluídos de toda a análise agregada (Dashboard, Skill Matrix, Candidatos)' },
      { nome: 'eBum', tipo: 'Boolean', nota: 'default false' },
      { nome: 'dataAdmissao', tipo: 'Date?' },
      { nome: 'createdBy / updatedBy', tipo: 'Int?' },
      { nome: 'version', tipo: 'Int', nota: 'locking otimista, incrementa a cada UPDATE' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: [
      'Entidade central — aponta para toda a Organização (Carreira/Categoria/Cargo/Direção/Núcleo/Área), para a Lob (proximaLobId), NivelGestao e LocalTrabalho',
      '1—1 User (opcional, onDelete SetNull — eliminar o colaborador não elimina a conta, só desliga a ligação), 1—N subordinados (auto-relação managerId)',
      '1—N ColaboradorCompetencia, ColaboradorCertificacao, ColaboradorLobRecomendacao, PdiItem — todas com onDelete Cascade (pertencem ao colaborador, desaparecem com ele)',
    ],
    visibilidade: 'total',
    visibilidadeTexto:
      'Ecrã Colaboradores: criar, editar (todos os campos, com locking otimista por version) e eliminar num modal a partir da lista, upload/download Excel — eliminar é sempre possível, independentemente de dados associados (ver onDelete acima). A ficha do colaborador também permite editar dataAdmissao/proximaLobId/nivelGestaoId/localTrabalhoId/ativo diretamente (ADMIN_RH) — "Anos de experiência" é calculado dinamicamente a partir de dataAdmissao, nunca guardado. createdBy/updatedBy nunca aparecem na UI.',
  },

  // --- Avaliações ------------------------------------------------------------
  {
    grupo: 'Avaliações',
    model: 'ColaboradorCompetencia',
    tabela: 'colaborador_competencia',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'colaboradorId', tipo: 'Int', nota: '→ Colaborador' },
      { nome: 'competenciaId', tipo: 'Int', nota: '→ Competencia' },
      { nome: 'nivelId', tipo: 'Int', nota: '→ Nivel' },
      { nome: 'dataAvaliacao', tipo: 'Date' },
      { nome: 'avaliadoPor', tipo: 'Int?', nota: '→ User' },
      { nome: 'origem', tipo: 'enum OrigemAvaliacao', nota: 'SELF · MANAGER · FORMAL · 360 · IMPORTADO_EXCEL' },
      { nome: 'createdAt', tipo: 'DateTime' },
    ],
    relacoes: ['Append-only — nunca UPDATE. O "nível atual" é sempre a avaliação mais recente por (colaborador, competência).'],
    visibilidade: 'total',
    visibilidadeTexto: 'Modal "Avaliar" no detalhe da LOB, na ficha do colaborador. O histórico completo não tem ecrã próprio — só o nível atual é mostrado.',
  },
  {
    grupo: 'Avaliações',
    model: 'ColaboradorCertificacao',
    tabela: 'colaborador_certificacao',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'colaboradorId', tipo: 'Int', nota: '→ Colaborador' },
      { nome: 'certificacaoId', tipo: 'String', nota: '→ Certificacao' },
      { nome: 'dataObtencao / dataValidade', tipo: 'Date?' },
      { nome: 'anexoUrl', tipo: 'String?' },
      { nome: 'version', tipo: 'Int', nota: 'locking otimista' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['único(colaboradorId, certificacaoId) — uma linha por certificação por colaborador (com UPDATE, ao contrário de ColaboradorCompetencia).'],
    visibilidade: 'parcial',
    visibilidadeTexto: 'Modal "Editar certificação" no detalhe da LOB. anexoUrl existe no modelo mas a app não tem upload de ficheiro — teria de ser preenchido por outra via.',
  },
  {
    grupo: 'Avaliações',
    model: 'ColaboradorLobRecomendacao',
    tabela: 'colaborador_lob_recomendacao',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'colaboradorId', tipo: 'Int', nota: '→ Colaborador' },
      { nome: 'lobId', tipo: 'Int', nota: '→ Lob' },
      { nome: 'proprio / bud / auto', tipo: 'Boolean', nota: 'default false' },
      { nome: 'createdAt', tipo: 'DateTime' },
    ],
    relacoes: ['único(colaboradorId, lobId).'],
    visibilidade: 'parcial',
    visibilidadeTexto:
      'Gestão de Dados → "Recomendações de LOB por colaborador" — mas o campo colaboradorId aqui é só o ID numérico, sem nome (Colaborador está fora do registo genérico de catálogo).',
  },

  // --- PDI ---------------------------------------------------------------
  {
    grupo: 'PDI',
    model: 'PdiItem',
    tabela: 'pdi_items',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'colaboradorId', tipo: 'Int', nota: '→ Colaborador' },
      { nome: 'competenciaId / certificacaoId / formacaoId', tipo: 'Int?/String?/Int?', nota: 'um destes, conforme a origem do gap, onDelete Restrict' },
      { nome: 'descricao', tipo: 'String' },
      { nome: 'estado', tipo: 'enum EstadoPdi', nota: 'PENDENTE · EM_CURSO · CONCLUIDO' },
      { nome: 'origem', tipo: 'enum OrigemPdi', nota: 'AUTOMATICO · MANUAL' },
      { nome: 'notas', tipo: 'String?' },
      { nome: 'createdBy / updatedBy', tipo: 'Int?' },
      { nome: 'createdAt / updatedAt', tipo: 'DateTime' },
    ],
    relacoes: ['Gerado a partir das lacunas do motor de gap — nunca duplica a lógica de comparação, só persiste o estado de acompanhamento.'],
    visibilidade: 'total',
    visibilidadeTexto: 'Secção "Plano de Desenvolvimento Individual" na ficha do colaborador: gerar automaticamente, mudar estado, eliminar.',
  },

  // --- Snapshots de gap analysis (não usadas) --------------------------------
  {
    grupo: 'Snapshots de gap analysis (definidas no schema, não usadas pela app)',
    model: 'GapAnalysisRun',
    tabela: 'gap_analysis_runs',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'scopeType', tipo: 'enum AmbitoAnalise', nota: 'EMPRESA · DIRECAO · AREA · CARGO · COLABORADOR' },
      { nome: 'scopeDirecaoId / scopeCargoId / scopeColaboradorId', tipo: 'opcional', nota: 'âmbito da execução' },
      { nome: 'runDate', tipo: 'DateTime', nota: 'default now()' },
      { nome: 'createdBy', tipo: 'Int', nota: '→ User' },
      { nome: 'status', tipo: 'enum EstadoAnalise', nota: 'DRAFT · COMPLETED' },
    ],
    relacoes: ['1—N GapAnalysisLobResult, GapAnalysisCargoResult'],
    visibilidade: 'nenhuma',
    visibilidadeTexto: 'Nenhum service lê ou escreve esta tabela. Reservada no schema original para reporting histórico (snapshots) — a app calcula tudo em tempo real, nunca persiste um "run".',
  },
  {
    grupo: 'Snapshots de gap analysis (definidas no schema, não usadas pela app)',
    model: 'GapAnalysisLobResult',
    tabela: 'gap_analysis_lob_results',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'runId', tipo: 'Int', nota: '→ GapAnalysisRun' },
      { nome: 'colaboradorId', tipo: 'Int', nota: '→ Colaborador' },
      { nome: 'lobId', tipo: 'Int', nota: '→ Lob' },
      { nome: 'pontosObtidos / pontosMinimos', tipo: 'Int', nota: 'pontosMinimos "congelado" no momento do snapshot' },
      { nome: 'atingido', tipo: 'Boolean' },
      { nome: 'obrigatoriosEmFalta', tipo: 'Int' },
    ],
    relacoes: [],
    visibilidade: 'nenhuma',
    visibilidadeTexto: 'Não usada.',
  },
  {
    grupo: 'Snapshots de gap analysis (definidas no schema, não usadas pela app)',
    model: 'GapAnalysisCargoResult',
    tabela: 'gap_analysis_cargo_results',
    campos: [
      { nome: 'id', tipo: 'Int (PK)', nota: 'autoincrement' },
      { nome: 'runId', tipo: 'Int', nota: '→ GapAnalysisRun' },
      { nome: 'colaboradorId', tipo: 'Int', nota: '→ Colaborador' },
      { nome: 'cargoId', tipo: 'String', nota: '→ Cargo' },
      { nome: 'lobsExigidos / lobsAtingidos / gap', tipo: 'Int' },
    ],
    relacoes: [],
    visibilidade: 'nenhuma',
    visibilidadeTexto: 'Não usada.',
  },

  // --- Auditoria -----------------------------------------------------------
  {
    grupo: 'Auditoria',
    model: 'AuditLog',
    tabela: 'audit_log',
    campos: [
      { nome: 'id', tipo: 'BigInt (PK)', nota: 'autoincrement' },
      { nome: 'tableName', tipo: 'String' },
      { nome: 'recordId', tipo: 'String' },
      { nome: 'operation', tipo: 'enum OperacaoAuditoria', nota: 'INSERT · UPDATE · DELETE' },
      { nome: 'oldData / newData', tipo: 'Json?' },
      { nome: 'changedBy', tipo: 'Int?', nota: '→ User' },
      { nome: 'changedAt', tipo: 'DateTime', nota: 'default now()' },
    ],
    relacoes: ['Genérica — não referenciada por outras tabelas, aponta para qualquer uma via tableName + recordId.'],
    visibilidade: 'nenhuma',
    visibilidadeTexto:
      'Sem ecrã de consulta. Populada automaticamente por triggers Postgres (fora do Prisma) sempre que uma escrita passa por PrismaService.runAsUser, que define app.current_user_id via set_config — é assim que changedBy é preenchido sem cada service o passar explicitamente.',
  },
];

const GRUPOS = Array.from(new Set(TABELAS.map((t) => t.grupo)));

// --- Diagrama de relações (pedido do utilizador: "verificar de forma gráfica a ligação entre as diferentes tabelas") ---------

const COR_ORG = '#0070F2'; // fiori-primary
const COR_CATALOGO = '#107E3E'; // fiori-success
const COR_HISTORICO = '#E76500'; // fiori-warning

/**
 * Ligações mais estruturantes do schema (não as ~40 FKs todas — ver nota no
 * rodapé do diagrama para o que fica de fora por legibilidade). Coordenadas
 * fixas por ser um diagrama de documentação do schema, não dados ao vivo —
 * ao contrário do gráfico em "Evolução de Carreiras", que é gerado a partir
 * do catálogo real.
 */
function DiagramaRelacoes() {
  return (
    <figure>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 1200 620"
          role="img"
          aria-label="Diagrama entidade-relação simplificado: Colaborador ao centro, ligado à Organização (Direção, Área, Núcleo, Carreira, Categoria, Cargo), ao Catálogo (Competência, Certificação, Formação, LOB) através do histórico (Avaliação, Certificação do colaborador, PDI, Utilizador)."
          style={{ width: '100%', height: 'auto', minWidth: 900 }}
        >
          <defs>
            <marker id="arrowRelacoes" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>

          <text x={20} y={24} fontSize={11} fontWeight={700} fill={COR_ORG}>
            ORGANIZAÇÃO
          </text>
          <text x={20} y={300} fontSize={11} fontWeight={700} fill={COR_CATALOGO}>
            CATÁLOGO
          </text>
          <text x={20} y={450} fontSize={11} fontWeight={700} fill={COR_HISTORICO}>
            HISTÓRICO DO COLABORADOR
          </text>

          {/* Organização -> Hub (fan) */}
          <g stroke={COR_ORG} strokeWidth={1.3} opacity={0.65} fill="none" markerEnd="url(#arrowRelacoes)">
            <line x1={100} y1={80} x2={480} y2={175} />
            <line x1={290} y1={80} x2={510} y2={172} />
            <line x1={480} y1={80} x2={545} y2={170} />
            <line x1={670} y1={80} x2={590} y2={170} />
            <line x1={860} y1={80} x2={630} y2={172} />
            <line x1={1050} y1={80} x2={665} y2={175} />
          </g>
          {/* Cargo -> Carreira / Categoria (dentro da Organização) */}
          <g stroke={COR_ORG} strokeWidth={1.3} opacity={0.65} fill="none" markerEnd="url(#arrowRelacoes)">
            <path d="M 1050 55 Q 860 5 670 55" />
            <path d="M 1050 55 Q 955 18 860 55" />
          </g>
          {/* Área -> LOB (scoping, contorna o hub) */}
          <path d="M 330 80 Q 1050 130 940 320" stroke={COR_CATALOGO} strokeWidth={1.3} fill="none" opacity={0.7} markerEnd="url(#arrowRelacoes)" />
          {/* LOB -> Competência / Certificação (requisitos) */}
          <g stroke={COR_CATALOGO} strokeWidth={1.3} opacity={0.7} fill="none" markerEnd="url(#arrowRelacoes)">
            <path d="M 890 372 Q 500 440 130 372" />
            <path d="M 890 372 Q 700 420 490 372" />
          </g>
          {/* Hub -> Histórico (fan) */}
          <g stroke={COR_HISTORICO} strokeWidth={1.3} opacity={0.7} markerEnd="url(#arrowRelacoes)">
            <line x1={520} y1={240} x2={115} y2={470} />
            <line x1={560} y1={240} x2={345} y2={470} />
            <line x1={640} y1={240} x2={575} y2={470} />
            <line x1={680} y1={240} x2={805} y2={470} />
          </g>
          {/* Item de histórico -> entidade de Catálogo a que se refere */}
          <g stroke={COR_HISTORICO} strokeWidth={1.3} opacity={0.7} markerEnd="url(#arrowRelacoes)">
            <line x1={345} y1={470} x2={150} y2={372} />
            <line x1={575} y1={470} x2={420} y2={372} />
            <line x1={805} y1={470} x2={940} y2={372} />
          </g>

          {/* Nós — Organização */}
          <g fontSize={12} fontWeight={600} textAnchor="middle">
            {[
              { x: 20, label: 'Direção' },
              { x: 210, label: 'Área' },
              { x: 400, label: 'Núcleo' },
              { x: 590, label: 'Carreira' },
              { x: 780, label: 'Categoria' },
              { x: 970, label: 'Cargo' },
            ].map((no) => (
              <g key={no.label}>
                <rect x={no.x} y={40} width={160} height={40} rx={6} fill="#FFFFFF" stroke={COR_ORG} strokeWidth={1.5} />
                <text x={no.x + 80} y={65} fill="currentColor" className="text-fiori-text">
                  {no.label}
                </text>
              </g>
            ))}
          </g>

          {/* Hub */}
          <rect x={460} y={170} width={280} height={70} rx={8} fill="#F5FAFF" stroke={COR_ORG} strokeWidth={2.2} />
          <text x={600} y={200} fontSize={14} fontWeight={700} textAnchor="middle" fill={COR_ORG}>
            Colaborador
          </text>
          <text x={600} y={220} fontSize={10.5} textAnchor="middle" fill="currentColor" className="text-fiori-text-secondary">
            entidade central
          </text>

          {/* Nós — Catálogo */}
          <g fontSize={12} fontWeight={600} textAnchor="middle">
            {[
              { x: 40, label: 'Competência' },
              { x: 310, label: 'Certificação' },
              { x: 580, label: 'Formação' },
              { x: 850, label: 'LOB', sub: 'o motor de gap' },
            ].map((no) => (
              <g key={no.label}>
                <rect x={no.x} y={326} width={180} height={46} rx={6} fill="#FFFFFF" stroke={COR_CATALOGO} strokeWidth={1.5} />
                <text x={no.x + 90} y={no.sub ? 349 : 354} fill="currentColor" className="text-fiori-text">
                  {no.label}
                </text>
                {no.sub && (
                  <text x={no.x + 90} y={364} fontSize={9.5} fontWeight={400} fill="currentColor" className="text-fiori-text-secondary">
                    {no.sub}
                  </text>
                )}
              </g>
            ))}
          </g>

          {/* Nós — Histórico */}
          <g fontSize={12} fontWeight={600} textAnchor="middle">
            {[
              { x: 20, label: 'Utilizador (User)' },
              { x: 250, label: 'Avaliação', sub: 'histórico de competência' },
              { x: 480, label: 'Certificação do colab.', sub: 'com validade' },
              { x: 710, label: 'PDI (item)' },
            ].map((no) => (
              <g key={no.label}>
                <rect x={no.x} y={470} width={190} height={46} rx={6} fill="#FFFFFF" stroke={COR_HISTORICO} strokeWidth={1.5} />
                <text x={no.x + 95} y={no.sub ? 493 : 498} fill="currentColor" className="text-fiori-text">
                  {no.label}
                </text>
                {no.sub && (
                  <text x={no.x + 95} y={507} fontSize={9.5} fontWeight={400} fill="currentColor" className="text-fiori-text-secondary">
                    {no.sub}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <figcaption className="mt-3 text-xs text-fiori-text-secondary">
        Mostra as ~15 tabelas e ligações mais estruturantes, não as ~40 chaves estrangeiras todas (essas estão listadas por tabela nos cartões
        abaixo). Simplificações: "Área" liga-se do mesmo modo a Formação e a LOB (só a ligação a Competência está desenhada); "PDI" pode
        referenciar diretamente Competência, Certificação ou Formação além de LOB (campos opcionais na mesma tabela); Projeto e Recomendação de
        LOB seguem o mesmo padrão do bloco "Histórico" mas foram omitidos para caber no diagrama.
      </figcaption>
    </figure>
  );
}

// --- Ecrã ↔ Dados ------------------------------------------------------------

const MAPA_ECRA_DADOS: { ecra: string; novo?: boolean; dados: string[]; nota?: string }[] = [
  { ecra: 'Dashboard', dados: ['Colaborador', 'Cargo', 'Direção/Área/Núcleo', 'LOB (agregado)'] },
  { ecra: 'Colaboradores', dados: ['Colaborador', 'Direção/Área/Núcleo', 'Cargo', 'Carreira', 'Categoria'] },
  { ecra: 'Candidatos', dados: ['Colaborador', 'Cargo', 'CargoProgressao', 'Carreira'] },
  { ecra: 'Evolução de Carreiras', novo: true, dados: ['Carreira', 'Cargo', 'Categoria', 'CargoProgressao', 'Colaborador (contagens)'] },
  { ecra: 'Skill Matrix', dados: ['Colaborador', 'Competência', 'LOB'] },
  {
    ecra: 'Ficha do Colaborador / PDI',
    dados: ['Colaborador', 'Avaliação', 'Certificação do colab.', 'PDI', 'LOB', 'Competência', 'Certificação', 'Formação', 'Projeto'],
  },
  { ecra: 'Gestão de Dados', dados: ['todas as tabelas de catálogo'], nota: '(Direção…Formação, LOB, Projeto)' },
  { ecra: 'Como Funciona', dados: ['ConfiguracaoProntidao'], nota: '(leitura)' },
  { ecra: 'Modelo de Dados', dados: ['todas as tabelas'], nota: '(este ecrã)' },
];

function TabelaEcraDados() {
  return (
    <div className="overflow-x-auto rounded border border-fiori-border">
      <table className="fiori-table">
        <thead>
          <tr>
            <th>Ecrã</th>
            <th>Dados principais</th>
          </tr>
        </thead>
        <tbody>
          {MAPA_ECRA_DADOS.map((linha) => (
            <tr key={linha.ecra}>
              <td className="whitespace-nowrap text-xs font-semibold text-fiori-text">
                {linha.ecra}
                {linha.novo && <span className="ml-1.5 rounded bg-fiori-primary-bg px-1.5 py-0.5 text-[10px] font-semibold text-fiori-primary">novo</span>}
              </td>
              <td className="text-xs">
                {linha.dados.map((d) => (
                  <span key={d} className="mr-1.5 mb-1 inline-block rounded-full bg-fiori-primary-bg px-2 py-0.5 text-[11px] font-medium text-fiori-primary">
                    {d}
                  </span>
                ))}
                {linha.nota && <span className="text-[11px] text-fiori-text-secondary">{linha.nota}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VISIBILIDADE_BADGE: Record<TabelaModelo['visibilidade'], { status: BadgeStatus; label: string }> = {
  total: { status: 'success', label: 'Visível' },
  parcial: { status: 'warning', label: 'Parcialmente visível' },
  nenhuma: { status: 'neutral', label: 'Não visível (interno)' },
};

export function ModeloDadosPage() {
  const [termo, setTermo] = useState('');

  const tabelasFiltradas = useMemo(() => {
    if (!termo.trim()) return TABELAS;
    const t = termo.toLowerCase();
    return TABELAS.filter(
      (tabela) =>
        tabela.model.toLowerCase().includes(t) ||
        tabela.tabela.toLowerCase().includes(t) ||
        tabela.campos.some((c) => c.nome.toLowerCase().includes(t)),
    );
  }, [termo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Modelo de Dados</h1>
          <p className="text-sm text-fiori-text-secondary">
            Referência completa de todas as tabelas do backend (backend/prisma/schema.prisma): campos, ligações entre tabelas, e se
            estão visíveis/editáveis na aplicação.
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2 rounded border border-fiori-border bg-fiori-canvas px-3 py-1.5">
          <Search size={16} className="text-fiori-text-secondary" aria-hidden="true" />
          <input
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Pesquisar por tabela ou campo…"
            className="w-full border-none bg-transparent text-sm text-fiori-text outline-none placeholder:text-fiori-text-secondary"
          />
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-fiori-text-secondary">
          <span className="flex items-center gap-1.5">
            <Badge status="success">Visível</Badge> editável/consultável diretamente na app
          </span>
          <span className="flex items-center gap-1.5">
            <Badge status="warning">Parcialmente visível</Badge> alguns campos/operações não têm UI
          </span>
          <span className="flex items-center gap-1.5">
            <Badge status="neutral">Não visível</Badge> só existe no schema/base de dados
          </span>
        </div>
      </Card>

      <Card title="Visão gráfica — como as tabelas se ligam">
        <DiagramaRelacoes />
      </Card>

      <Card title="Ecrã ↔ Dados">
        <p className="mb-3 text-sm text-fiori-text-secondary">Que tabelas cada ecrã lê ou escreve.</p>
        <TabelaEcraDados />
      </Card>

      {GRUPOS.map((grupo) => {
        const tabelasDoGrupo = tabelasFiltradas.filter((t) => t.grupo === grupo);
        if (tabelasDoGrupo.length === 0) return null;
        return (
          <div key={grupo} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fiori-text-secondary">{grupo}</h2>
            {tabelasDoGrupo.map((tabela) => {
              const badge = VISIBILIDADE_BADGE[tabela.visibilidade];
              return (
                <Card key={tabela.model}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-fiori-text">{tabela.model}</p>
                      <p className="font-mono text-xs text-fiori-text-secondary">{tabela.tabela}</p>
                    </div>
                    <Badge status={badge.status}>{badge.label}</Badge>
                  </div>

                  <div className="overflow-x-auto rounded border border-fiori-border">
                    <table className="fiori-table">
                      <thead>
                        <tr>
                          <th>Campo</th>
                          <th>Tipo</th>
                          <th>Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabela.campos.map((campo) => (
                          <tr key={campo.nome}>
                            <td className="font-mono text-xs">{campo.nome}</td>
                            <td className="font-mono text-xs text-fiori-text-secondary">{campo.tipo}</td>
                            <td className="text-xs text-fiori-text-secondary">{campo.nota ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {tabela.relacoes.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">Ligações</p>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-fiori-text-secondary">
                        {tabela.relacoes.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="mt-3 border-t border-fiori-border pt-2 text-xs text-fiori-text-secondary">{tabela.visibilidadeTexto}</p>
                </Card>
              );
            })}
          </div>
        );
      })}

      {tabelasFiltradas.length === 0 && <p className="text-sm text-fiori-text-secondary">Sem tabelas/campos a corresponder à pesquisa.</p>}
    </div>
  );
}
