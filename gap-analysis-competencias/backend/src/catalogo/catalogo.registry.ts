import { NotFoundException } from '@nestjs/common';

/**
 * Registo estático das tabelas de catálogo/referência administráveis pelo
 * ecrã genérico "Gestão de Dados" (frontend `CatalogoPage`). Cada entrada
 * descreve o suficiente para o `CatalogoService`/`CatalogoController`
 * fazerem list/create/update/delete/export/import sem código por tabela —
 * e para o frontend gerar o formulário/tabela sem código por tabela também
 * (via `GET /catalogo/meta`).
 *
 * Deliberadamente fora deste registo (têm fluxo próprio, não duplicar):
 * Colaborador (CRUD dedicado em `colaboradores`), ColaboradorCompetencia
 * (histórico append-only), ColaboradorCertificacao (locking otimista
 * próprio), User (AdminPage/UsersModule).
 *
 * `identityFields`: colunas usadas para encontrar uma linha existente em
 * update/delete e no upsert de importação. Para tabelas de junção sem PK
 * própria (ex. `cargo-progressao`) ou com PK autoincrement mas identidade
 * de negócio composta (ex. `certificacao-requisitos`), usa-se a chave
 * `@@unique`/`@@id` composta do schema Prisma — nunca o autoincrement.
 */

export type CatalogoTipoCampo = 'string' | 'int' | 'boolean' | 'relation';

export interface CatalogoCampoDef {
  key: string;
  label: string;
  tipo: CatalogoTipoCampo;
  obrigatorio: boolean;
  /** Só para tipo 'relation': chave da tabela do registo a usar como opções do <select>. */
  relatedTable?: string;
  /** Só para tipo 'relation': nome do accessor de include no Prisma Client (ex. 'carreira' para 'carreiraId'). */
  relationAccessor?: string;
}

export interface CatalogoTabelaDef {
  tabela: string;
  label: string;
  /** Nome do delegate no PrismaClient (ex. 'direcao' para prisma.direcao.*). */
  delegate: string;
  campos: CatalogoCampoDef[];
  identityFields: string[];
}

function campo(
  key: string,
  label: string,
  tipo: CatalogoTipoCampo,
  obrigatorio = true,
  extra?: Partial<CatalogoCampoDef>,
): CatalogoCampoDef {
  return { key, label, tipo, obrigatorio, ...extra };
}

export const CATALOGO_REGISTRY: CatalogoTabelaDef[] = [
  {
    tabela: 'direcoes',
    label: 'Direções',
    delegate: 'direcao',
    identityFields: ['id'],
    campos: [
      campo('id', 'ID', 'int'),
      campo('nome', 'Nome', 'string'),
      campo('relevante', 'Relevante', 'boolean', false),
    ],
  },
  {
    tabela: 'areas',
    label: 'Áreas',
    delegate: 'area',
    identityFields: ['id'],
    campos: [
      campo('id', 'ID', 'int'),
      campo('nome', 'Nome', 'string'),
      campo('relevante', 'Relevante', 'boolean', false),
    ],
  },
  {
    tabela: 'nucleos',
    label: 'Núcleos',
    delegate: 'nucleo',
    identityFields: ['id'],
    campos: [
      campo('id', 'ID', 'int'),
      campo('nome', 'Nome', 'string'),
      campo('relevante', 'Relevante', 'boolean', false),
    ],
  },
  {
    tabela: 'nucleo-areas',
    label: 'Áreas por Núcleo',
    delegate: 'nucleoArea',
    identityFields: ['nucleoId', 'areaId'],
    campos: [
      campo('nucleoId', 'Núcleo', 'relation', true, { relatedTable: 'nucleos', relationAccessor: 'nucleo' }),
      campo('areaId', 'Área', 'relation', true, { relatedTable: 'areas', relationAccessor: 'area' }),
    ],
  },
  {
    tabela: 'niveis-gestao',
    label: 'Níveis de Gestão',
    delegate: 'nivelGestao',
    identityFields: ['id'],
    campos: [campo('id', 'ID', 'int'), campo('nome', 'Nome', 'string')],
  },
  {
    tabela: 'locais-trabalho',
    label: 'Locais de Trabalho',
    delegate: 'localTrabalho',
    identityFields: ['id'],
    campos: [campo('id', 'ID', 'int'), campo('nome', 'Nome', 'string')],
  },
  {
    tabela: 'grupos-carreira',
    label: 'Grupos de Carreira',
    delegate: 'grupoCarreira',
    identityFields: ['id'],
    campos: [campo('id', 'Código', 'string'), campo('nome', 'Nome', 'string')],
  },
  {
    tabela: 'carreiras',
    label: 'Carreiras',
    delegate: 'carreira',
    identityFields: ['id'],
    campos: [
      campo('id', 'Código', 'string'),
      campo('nome', 'Nome', 'string'),
      campo('relevante', 'Relevante', 'boolean', false),
      campo('grupoCarreiraId', 'Grupo', 'relation', false, { relatedTable: 'grupos-carreira', relationAccessor: 'grupoCarreira' }),
    ],
  },
  {
    tabela: 'categorias',
    label: 'Categorias',
    delegate: 'categoria',
    identityFields: ['id'],
    campos: [campo('id', 'Código', 'string'), campo('nome', 'Nome', 'string')],
  },
  {
    tabela: 'cargos',
    label: 'Cargos',
    delegate: 'cargo',
    identityFields: ['id'],
    campos: [
      campo('id', 'Código', 'string'),
      campo('nome', 'Nome', 'string'),
      campo('carreiraId', 'Carreira', 'relation', true, { relatedTable: 'carreiras', relationAccessor: 'carreira' }),
      campo('categoriaId', 'Categoria', 'relation', true, { relatedTable: 'categorias', relationAccessor: 'categoria' }),
      campo('anosExperienciaMinimo', 'Anos de experiência mínimo', 'int', false),
      campo('lobsExigidos', 'LOBs exigidos', 'int', false),
      campo('relevante', 'Relevante', 'boolean', false),
      campo('relevanteCarreira', 'Relevante para a carreira', 'boolean', false),
    ],
  },
  {
    tabela: 'cargo-progressao',
    label: 'Progressão de cargos',
    delegate: 'cargoProgressao',
    identityFields: ['cargoId', 'proximoCargoId'],
    campos: [
      campo('cargoId', 'Cargo', 'relation', true, { relatedTable: 'cargos', relationAccessor: 'cargo' }),
      campo('proximoCargoId', 'Próximo cargo', 'relation', true, { relatedTable: 'cargos', relationAccessor: 'proximoCargo' }),
    ],
  },
  {
    tabela: 'niveis',
    label: 'Níveis',
    delegate: 'nivel',
    identityFields: ['id'],
    campos: [campo('id', 'ID', 'int'), campo('nome', 'Nome', 'string'), campo('descricao', 'Descrição', 'string')],
  },
  {
    tabela: 'competencias',
    label: 'Competências',
    delegate: 'competencia',
    identityFields: ['id'],
    campos: [
      campo('id', 'ID', 'int'),
      campo('nome', 'Nome', 'string'),
      campo('areaId', 'Área', 'relation', true, { relatedTable: 'areas', relationAccessor: 'area' }),
    ],
  },
  {
    tabela: 'certificacoes',
    label: 'Certificações',
    delegate: 'certificacao',
    identityFields: ['id'],
    campos: [campo('id', 'Código', 'string'), campo('nome', 'Nome', 'string')],
  },
  {
    tabela: 'certificacao-requisitos',
    label: 'Requisitos de competência das certificações',
    delegate: 'certificacaoRequisitoCompetencia',
    identityFields: ['certificacaoId', 'competenciaId'],
    campos: [
      campo('certificacaoId', 'Certificação', 'relation', true, { relatedTable: 'certificacoes', relationAccessor: 'certificacao' }),
      campo('competenciaId', 'Competência', 'relation', true, { relatedTable: 'competencias', relationAccessor: 'competencia' }),
      campo('nivelId', 'Nível exigido', 'relation', true, { relatedTable: 'niveis', relationAccessor: 'nivel' }),
    ],
  },
  {
    tabela: 'formacoes',
    label: 'Formações',
    delegate: 'formacao',
    identityFields: ['id'],
    campos: [
      campo('id', 'ID', 'int'),
      campo('nome', 'Nome', 'string'),
      campo('areaId', 'Área', 'relation', true, { relatedTable: 'areas', relationAccessor: 'area' }),
      campo('duracaoHoras', 'Duração (horas)', 'int', false),
    ],
  },
  {
    tabela: 'formacao-requisitos',
    label: 'Requisitos de competência das formações',
    delegate: 'formacaoRequisitoCompetencia',
    identityFields: ['formacaoId', 'competenciaId'],
    campos: [
      campo('formacaoId', 'Formação', 'relation', true, { relatedTable: 'formacoes', relationAccessor: 'formacao' }),
      campo('competenciaId', 'Competência', 'relation', true, { relatedTable: 'competencias', relationAccessor: 'competencia' }),
      campo('nivelId', 'Nível oferecido', 'relation', true, { relatedTable: 'niveis', relationAccessor: 'nivel' }),
    ],
  },
  {
    tabela: 'projetos',
    label: 'Projetos',
    delegate: 'projeto',
    identityFields: ['id'],
    campos: [
      campo('id', 'ID', 'int'),
      campo('nome', 'Nome', 'string'),
      campo('areaId', 'Área', 'relation', false, { relatedTable: 'areas', relationAccessor: 'area' }),
      campo('descricao', 'Descrição', 'string', false),
    ],
  },
  {
    tabela: 'projeto-vertentes',
    label: 'Vertentes de projeto',
    delegate: 'projetoVertente',
    identityFields: ['projetoId', 'competenciaId'],
    campos: [
      campo('projetoId', 'Projeto', 'relation', true, { relatedTable: 'projetos', relationAccessor: 'projeto' }),
      campo('competenciaId', 'Competência', 'relation', true, { relatedTable: 'competencias', relationAccessor: 'competencia' }),
      campo('nome', 'Nome da vertente', 'string'),
    ],
  },
  {
    tabela: 'lobs',
    label: 'LOBs',
    delegate: 'lob',
    identityFields: ['id'],
    campos: [
      campo('id', 'ID', 'int'),
      campo('nome', 'Nome', 'string'),
      campo('areaId', 'Área', 'relation', true, { relatedTable: 'areas', relationAccessor: 'area' }),
      campo('pontosMinimos', 'Pontos mínimos', 'int'),
    ],
  },
  {
    tabela: 'lob-requisitos-competencia',
    label: 'Requisitos de competência das LOBs',
    delegate: 'lobRequisitoCompetencia',
    identityFields: ['lobId', 'competenciaId'],
    campos: [
      campo('lobId', 'LOB', 'relation', true, { relatedTable: 'lobs', relationAccessor: 'lob' }),
      campo('competenciaId', 'Competência', 'relation', true, { relatedTable: 'competencias', relationAccessor: 'competencia' }),
      campo('obrigatorio', 'Obrigatório', 'boolean'),
      campo('pontos', 'Pontos', 'int'),
      campo('nivelMinimoId', 'Nível mínimo', 'relation', true, { relatedTable: 'niveis', relationAccessor: 'nivelMinimo' }),
    ],
  },
  {
    tabela: 'lob-requisitos-certificacao',
    label: 'Requisitos de certificação das LOBs',
    delegate: 'lobRequisitoCertificacao',
    identityFields: ['lobId', 'certificacaoId'],
    campos: [
      campo('lobId', 'LOB', 'relation', true, { relatedTable: 'lobs', relationAccessor: 'lob' }),
      campo('certificacaoId', 'Certificação', 'relation', true, { relatedTable: 'certificacoes', relationAccessor: 'certificacao' }),
      campo('obrigatorio', 'Obrigatório', 'boolean'),
    ],
  },
  {
    tabela: 'lob-recomendacoes',
    label: 'Recomendações de LOB por colaborador',
    delegate: 'colaboradorLobRecomendacao',
    identityFields: ['colaboradorId', 'lobId'],
    campos: [
      // Colaborador não está no registo genérico (CRUD próprio) — aqui é só o ID numérico, sem <select>.
      campo('colaboradorId', 'ID do colaborador', 'int'),
      campo('lobId', 'LOB', 'relation', true, { relatedTable: 'lobs', relationAccessor: 'lob' }),
      campo('proprio', 'Própria', 'boolean', false),
      campo('bud', 'BUD', 'boolean', false),
      campo('auto', 'Auto', 'boolean', false),
    ],
  },
];

export function encontrarTabela(tabela: string): CatalogoTabelaDef {
  const def = CATALOGO_REGISTRY.find((t) => t.tabela === tabela);
  if (!def) {
    throw new NotFoundException(`Tabela de catálogo desconhecida: ${tabela}`);
  }
  return def;
}
