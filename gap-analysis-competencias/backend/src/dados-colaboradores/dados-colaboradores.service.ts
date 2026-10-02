import { BadRequestException, Injectable } from '@nestjs/common';
import { AvaliacaoFormacao, EstadoPdi, Prisma, TipoDesenvolvimento } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { FormacoesConcluidasService } from '../formacoes-concluidas/formacoes-concluidas.service';
import { PdiService } from '../pdi/pdi.service';
import { ProximoCargoService } from '../pdi/proximo-cargo.service';
import { GapAnalysisService } from '../gap-analysis/gap-analysis.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ehMarcaDelete } from '../catalogo/catalogo.service';
import { FiltrosOrganizacionais } from '../gap-analysis/gap-analysis.types';

const ESTADO_LABEL: Record<EstadoPdi, string> = { PENDENTE: 'Pendente', EM_CURSO: 'Em Curso', CONCLUIDO: 'Concluído' };

export interface ResumoImportacaoDados {
  criados: number;
  atualizados: number;
  eliminados: number;
  erros: string[];
}

const ler = (linha: ExcelJS.Row, idx: number): unknown => {
  const v = linha.getCell(idx).value;
  return v && typeof v === 'object' && 'result' in v ? (v as { result: unknown }).result : v;
};

function indiceColuna(cabecalho: (string | null)[], nome: string): number {
  const i = cabecalho.findIndex((h) => h === nome);
  if (i === -1) throw new BadRequestException(`Ficheiro sem a coluna obrigatória "${nome}".`);
  return i;
}

function cabecalhoDe(sheet: ExcelJS.Worksheet): (string | null)[] {
  return (sheet.getRow(1).values as unknown[]).map((v) => (v == null ? null : String(v).trim()));
}

function carregarPrimeiraFolha(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  return workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer).then(() => {
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Ficheiro sem folhas.');
    return sheet;
  });
}

/**
 * Exportar/importar em massa os dados históricos/avaliação dos
 * colaboradores (pedido do utilizador: Competências técnicas/
 * comportamentais, Certificações, Histórico de Formação) — deliberadamente
 * fora do `CATALOGO_REGISTRY` genérico (ver comentário em
 * catalogo.registry.ts): cada uma destas tabelas tem uma regra de escrita
 * própria (append-only, locking otimista, ou subida automática de nível)
 * que o motor genérico de create/update/delete não modela. Para não
 * duplicar essa lógica, cada linha do ficheiro é aplicada através do
 * mesmo método de serviço já usado pelos ecrãs individuais
 * (ColaboradoresService.criarAvaliacao/upsertCertificacao,
 * FormacoesConcluidasService.criar/atualizar) — o import é sempre
 * "como se alguém tivesse gravado esta linha manualmente", nunca um
 * caminho de escrita paralelo.
 */
@Injectable()
export class DadosColaboradoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
    private readonly formacoesConcluidas: FormacoesConcluidasService,
    private readonly pdi: PdiService,
    private readonly proximoCargo: ProximoCargoService,
    private readonly gapAnalysis: GapAnalysisService,
  ) {}

  // --- Competências técnicas / comportamentais ------------------------------

  /**
   * IDs de colaboradores que cumprem os filtros organizacionais (os mesmos
   * usados noutros ecrãs de colaboradores — Direção/Área/Núcleo/Cargo,
   * pedido do utilizador) — `null` quando não há filtro nenhum, para os
   * chamadores saberem que não precisam de restringir a query.
   */
  private async idsColaboradoresFiltrados(filtros: FiltrosOrganizacionais): Promise<number[] | null> {
    if (!filtros.direcaoId && !filtros.areaId && !filtros.nucleoId && !filtros.cargoId) return null;
    const colaboradores = await this.prisma.colaborador.findMany({
      where: {
        ...(filtros.direcaoId ? { direcaoId: filtros.direcaoId } : {}),
        ...(filtros.areaId ? { areaId: filtros.areaId } : {}),
        ...(filtros.nucleoId ? { nucleoId: filtros.nucleoId } : {}),
        ...(filtros.cargoId ? { cargoId: filtros.cargoId } : {}),
      },
      select: { id: true },
    });
    return colaboradores.map((c) => c.id);
  }

  /**
   * Grelha da Gestão de Dados (pedido do utilizador: "também deve ser
   * listada a tabela... e que permita editar, adicionar, remover") — os
   * mesmos dados do export, em JSON, com os mesmos filtros organizacionais
   * usados noutros ecrãs de colaboradores.
   */
  async listarCompetencias(tipo: TipoDesenvolvimento, filtros: FiltrosOrganizacionais) {
    const ids = await this.idsColaboradoresFiltrados(filtros);
    if (ids !== null && ids.length === 0) return [];
    const linhas = await this.prisma.$queryRaw<
      {
        colaborador_id: number;
        colaborador_nome: string;
        competencia_id: number;
        competencia_nome: string;
        nivel_id: number;
        nivel_nome: string;
        data_avaliacao: Date;
      }[]
    >`
      SELECT c.id AS colaborador_id, c.nome AS colaborador_nome, comp.id AS competencia_id, comp.nome AS competencia_nome,
             a.nivel_id, n.nome AS nivel_nome, a.data_avaliacao
      FROM colaboradores c
      JOIN colaborador_competencia_atual a ON a.colaborador_id = c.id
      JOIN competencias comp ON comp.id = a.competencia_id
      JOIN niveis n ON n.tipo = comp.tipo AND n.id = a.nivel_id
      WHERE comp.tipo = ${tipo}::tipo_desenvolvimento
      ${ids !== null ? Prisma.sql`AND c.id = ANY(${ids})` : Prisma.empty}
      ORDER BY c.nome, comp.nome
    `;
    return linhas.map((l) => ({
      colaboradorId: l.colaborador_id,
      colaboradorNome: l.colaborador_nome,
      competenciaId: l.competencia_id,
      competenciaNome: l.competencia_nome,
      nivelId: l.nivel_id,
      nivelNome: l.nivel_nome,
      dataAvaliacao: l.data_avaliacao,
    }));
  }

  async exportarCompetencias(tipo: TipoDesenvolvimento): Promise<Buffer> {
    const linhas = await this.listarCompetencias(tipo, {});

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('competencias');
    sheet.addRow(['colaboradorId', 'Colaborador', 'competenciaId', 'Competência', 'nivelId', 'Nível — nome atual', 'DELETE']);
    for (const l of linhas) {
      sheet.addRow([l.colaboradorId, l.colaboradorNome, l.competenciaId, l.competenciaNome, l.nivelId, l.nivelNome, null]);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Cada linha vira uma nova avaliação (append-only, origem FORMAL) só se o
   * nível pedido for diferente do nível atual — reaproveita
   * ColaboradoresService.criarAvaliacao (mesmo motor de conflito otimista
   * do ecrã de avaliação individual, por isso não há caminho para
   * corromper o histórico mesmo em importações concorrentes).
   *
   * "DELETE" (pedido do utilizador) só é honrado para Comportamentais —
   * reaproveita ColaboradoresService.eliminarCompetencia, a mesma exceção
   * deliberada ao histórico append-only já usada na ficha do colaborador.
   * Técnicas nunca perdem histórico, mesmo por aqui — a linha fica em erro.
   */
  async importarCompetencias(tipo: TipoDesenvolvimento, buffer: Buffer, user: AuthenticatedUser): Promise<ResumoImportacaoDados> {
    const sheet = await carregarPrimeiraFolha(buffer);
    const cabecalho = cabecalhoDe(sheet);
    const idxColaborador = indiceColuna(cabecalho, 'colaboradorId');
    const idxCompetencia = indiceColuna(cabecalho, 'competenciaId');
    const idxNivel = indiceColuna(cabecalho, 'nivelId');
    const idxDelete = cabecalho.findIndex((h) => h === 'DELETE');

    const resumo: ResumoImportacaoDados = { criados: 0, atualizados: 0, eliminados: 0, erros: [] };
    for (let r = 2; r <= sheet.rowCount; r++) {
      const linha = sheet.getRow(r);
      if (linha.values == null || (Array.isArray(linha.values) && linha.values.length === 0)) continue;
      const colaboradorIdRaw = ler(linha, idxColaborador);
      const competenciaIdRaw = ler(linha, idxCompetencia);
      const nivelIdRaw = ler(linha, idxNivel);
      if (colaboradorIdRaw == null || competenciaIdRaw == null) continue;

      const colaboradorId = Number(colaboradorIdRaw);
      const competenciaId = Number(competenciaIdRaw);
      const marcaDelete = idxDelete !== -1 && ehMarcaDelete(linha.getCell(idxDelete).value);
      try {
        const competencia = await this.prisma.competencia.findUnique({ where: { id: competenciaId } });
        if (!competencia) throw new Error(`competência ${competenciaId} não encontrada.`);
        if (competencia.tipo !== tipo) {
          throw new Error(`competência ${competenciaId} ("${competencia.nome}") não é do tipo ${tipo === 'TECNICA' ? 'Técnica' : 'Comportamental'}.`);
        }

        if (marcaDelete) {
          if (tipo === 'TECNICA') {
            throw new Error('não é possível eliminar avaliações de competências técnicas — o histórico é sempre append-only.');
          }
          await this.colaboradores.eliminarCompetencia(colaboradorId, competenciaId, user);
          resumo.eliminados++;
          continue;
        }

        if (nivelIdRaw == null) continue;
        const nivelId = Number(nivelIdRaw);
        const atual = await this.colaboradores.obterUltimaAvaliacao(colaboradorId, competenciaId, user);
        if (atual?.nivel_id === nivelId) continue;

        await this.colaboradores.criarAvaliacao(colaboradorId, { competenciaId, nivelId, baseAssessmentId: atual?.id ?? null }, user);
        resumo.criados++;
      } catch (err) {
        resumo.erros.push(`Linha ${r}: ${err instanceof Error ? err.message : 'erro desconhecido.'}`);
      }
    }
    return resumo;
  }

  // --- Certificações ---------------------------------------------------------

  async listarCertificacoes(filtros: FiltrosOrganizacionais) {
    const ids = await this.idsColaboradoresFiltrados(filtros);
    if (ids !== null && ids.length === 0) return [];
    const linhas = await this.prisma.colaboradorCertificacao.findMany({
      where: ids !== null ? { colaboradorId: { in: ids } } : undefined,
      include: { colaborador: { select: { nome: true } }, certificacao: { select: { nome: true } } },
      orderBy: [{ colaborador: { nome: 'asc' } }, { certificacao: { nome: 'asc' } }],
    });
    return linhas.map((l) => ({
      colaboradorId: l.colaboradorId,
      colaboradorNome: l.colaborador.nome,
      certificacaoId: l.certificacaoId,
      certificacaoNome: l.certificacao.nome,
      dataObtencao: l.dataObtencao,
      dataValidade: l.dataValidade,
      anexoUrl: l.anexoUrl,
      version: l.version,
    }));
  }

  async exportarCertificacoes(): Promise<Buffer> {
    const linhas = await this.listarCertificacoes({});

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('certificacoes');
    sheet.addRow(['colaboradorId', 'Colaborador', 'certificacaoId', 'Certificação', 'dataObtencao', 'dataValidade', 'anexoUrl', 'DELETE']);
    for (const l of linhas) {
      sheet.addRow([
        l.colaboradorId,
        l.colaboradorNome,
        l.certificacaoId,
        l.certificacaoNome,
        l.dataObtencao.toISOString().slice(0, 10),
        l.dataValidade ? l.dataValidade.toISOString().slice(0, 10) : null,
        l.anexoUrl ?? null,
        null,
      ]);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Cria ou atualiza por (colaboradorId, certificacaoId) — reaproveita
   * ColaboradoresService.upsertCertificacao lendo primeiro a `version`
   * atual (se já existir), para continuar a respeitar o locking otimista
   * mesmo em bloco: uma edição concorrente de outra pessoa durante a
   * importação faz essa linha falhar com 409 em vez de a sobrescrever.
   * Célula vazia em dataObtencao — ou "DELETE" marcado (pedido do
   * utilizador) — elimina a linha (mesma semântica de
   * upsertCertificacao: sem data de obtenção não há certificação a
   * registar, ver Task #11).
   */
  async importarCertificacoes(buffer: Buffer, user: AuthenticatedUser): Promise<ResumoImportacaoDados> {
    const sheet = await carregarPrimeiraFolha(buffer);
    const cabecalho = cabecalhoDe(sheet);
    const idxColaborador = indiceColuna(cabecalho, 'colaboradorId');
    const idxCertificacao = indiceColuna(cabecalho, 'certificacaoId');
    const idxDataObtencao = indiceColuna(cabecalho, 'dataObtencao');
    const idxDataValidade = indiceColuna(cabecalho, 'dataValidade');
    const idxAnexoUrl = cabecalho.findIndex((h) => h === 'anexoUrl');
    const idxDelete = cabecalho.findIndex((h) => h === 'DELETE');

    const resumo: ResumoImportacaoDados = { criados: 0, atualizados: 0, eliminados: 0, erros: [] };
    for (let r = 2; r <= sheet.rowCount; r++) {
      const linha = sheet.getRow(r);
      if (linha.values == null || (Array.isArray(linha.values) && linha.values.length === 0)) continue;
      const colaboradorIdRaw = ler(linha, idxColaborador);
      const certificacaoIdRaw = ler(linha, idxCertificacao);
      if (colaboradorIdRaw == null || certificacaoIdRaw == null) continue;

      const colaboradorId = Number(colaboradorIdRaw);
      const certificacaoId = String(certificacaoIdRaw);
      const marcaDelete = idxDelete !== -1 && ehMarcaDelete(linha.getCell(idxDelete).value);
      const dataObtencaoRaw = marcaDelete ? null : ler(linha, idxDataObtencao);
      const dataValidadeRaw = ler(linha, idxDataValidade);
      const anexoUrlRaw = idxAnexoUrl === -1 ? null : ler(linha, idxAnexoUrl);
      try {
        const atual = await this.colaboradores.obterCertificacaoAtual(colaboradorId, certificacaoId, user);
        await this.colaboradores.upsertCertificacao(
          colaboradorId,
          certificacaoId,
          {
            dataObtencao: dataObtencaoRaw ? new Date(dataObtencaoRaw as string | Date).toISOString().slice(0, 10) : null,
            dataValidade: dataValidadeRaw ? new Date(dataValidadeRaw as string | Date).toISOString().slice(0, 10) : null,
            anexoUrl: anexoUrlRaw ? String(anexoUrlRaw) : undefined,
            version: atual?.version,
          },
          user,
        );
        if (!atual) {
          if (dataObtencaoRaw) resumo.criados++;
        } else if (!dataObtencaoRaw) {
          resumo.eliminados++;
        } else {
          resumo.atualizados++;
        }
      } catch (err) {
        resumo.erros.push(`Linha ${r}: ${err instanceof Error ? err.message : 'erro desconhecido.'}`);
      }
    }
    return resumo;
  }

  // --- Histórico de Formação ---------------------------------------------------

  async listarFormacoesConcluidas(filtros: FiltrosOrganizacionais) {
    const ids = await this.idsColaboradoresFiltrados(filtros);
    if (ids !== null && ids.length === 0) return [];
    const linhas = await this.prisma.colaboradorFormacao.findMany({
      where: ids !== null ? { colaboradorId: { in: ids } } : undefined,
      include: { colaborador: { select: { nome: true } }, formacao: { select: { nome: true } } },
      orderBy: [{ colaborador: { nome: 'asc' } }, { dataConclusao: 'desc' }],
    });
    return linhas.map((l) => ({
      id: l.id,
      colaboradorId: l.colaboradorId,
      colaboradorNome: l.colaborador.nome,
      formacaoId: l.formacaoId,
      formacaoNome: l.formacao.nome,
      dataConclusao: l.dataConclusao,
      horasFormacao: l.horasFormacao,
      avaliacao: l.avaliacao,
    }));
  }

  async exportarFormacoesConcluidas(): Promise<Buffer> {
    const linhas = await this.listarFormacoesConcluidas({});

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('formacoes-concluidas');
    sheet.addRow(['id', 'colaboradorId', 'Colaborador', 'formacaoId', 'Formação', 'dataConclusao', 'horasFormacao', 'avaliacao', 'DELETE']);
    for (const l of linhas) {
      sheet.addRow([l.id, l.colaboradorId, l.colaboradorNome, l.formacaoId, l.formacaoNome, l.dataConclusao.toISOString().slice(0, 10), l.horasFormacao, l.avaliacao, null]);
    }

    const opcoes = workbook.addWorksheet('Opções — Avaliação');
    opcoes.addRow(['valor']);
    for (const v of Object.values(AvaliacaoFormacao)) opcoes.addRow([v]);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * `id` presente e já existente → atualiza (FormacoesConcluidasService.
   * atualizar); `id` ausente/em branco, ou presente mas não encontrado →
   * cria um novo registo (FormacoesConcluidasService.criar) — mesma regra
   * "cria se não existir" de ColaboradoresService.importar. A subida de
   * nível de competência quando `avaliacao = APROVADO` acontece dentro
   * desses métodos (idempotente), nunca duplicada aqui. "DELETE" (pedido
   * do utilizador) exige `id` — elimina esse registo em vez de o criar/
   * atualizar.
   */
  async importarFormacoesConcluidas(buffer: Buffer, user: AuthenticatedUser): Promise<ResumoImportacaoDados> {
    const sheet = await carregarPrimeiraFolha(buffer);
    const cabecalho = cabecalhoDe(sheet);
    const idxId = cabecalho.findIndex((h) => h === 'id');
    const idxColaborador = indiceColuna(cabecalho, 'colaboradorId');
    const idxFormacao = indiceColuna(cabecalho, 'formacaoId');
    const idxData = indiceColuna(cabecalho, 'dataConclusao');
    const idxHoras = indiceColuna(cabecalho, 'horasFormacao');
    const idxAvaliacao = indiceColuna(cabecalho, 'avaliacao');
    const idxDelete = cabecalho.findIndex((h) => h === 'DELETE');

    const resumo: ResumoImportacaoDados = { criados: 0, atualizados: 0, eliminados: 0, erros: [] };
    for (let r = 2; r <= sheet.rowCount; r++) {
      const linha = sheet.getRow(r);
      if (linha.values == null || (Array.isArray(linha.values) && linha.values.length === 0)) continue;
      const colaboradorIdRaw = ler(linha, idxColaborador);
      const idRaw = idxId === -1 ? null : ler(linha, idxId);
      if (colaboradorIdRaw == null) continue;
      const colaboradorId = Number(colaboradorIdRaw);

      if (idxDelete !== -1 && ehMarcaDelete(linha.getCell(idxDelete).value)) {
        try {
          if (idRaw == null) throw new Error('"id" obrigatório para eliminar (DELETE).');
          await this.formacoesConcluidas.eliminar(colaboradorId, Number(idRaw), user);
          resumo.eliminados++;
        } catch (err) {
          resumo.erros.push(`Linha ${r}: ${err instanceof Error ? err.message : 'erro desconhecido.'}`);
        }
        continue;
      }

      const formacaoIdRaw = ler(linha, idxFormacao);
      const dataRaw = ler(linha, idxData);
      const horasRaw = ler(linha, idxHoras);
      const avaliacaoRaw = ler(linha, idxAvaliacao);
      if (formacaoIdRaw == null || dataRaw == null || avaliacaoRaw == null) continue;

      const avaliacao = String(avaliacaoRaw).trim().toUpperCase() as AvaliacaoFormacao;
      try {
        if (!Object.values(AvaliacaoFormacao).includes(avaliacao)) {
          throw new Error(`avaliação inválida: "${avaliacaoRaw}" (tem de ser ${Object.values(AvaliacaoFormacao).join('/')}).`);
        }
        const dataConclusao = new Date(dataRaw as string | Date).toISOString().slice(0, 10);
        const horasFormacao = horasRaw != null ? Number(horasRaw) : undefined;

        const idExistente = idRaw != null ? Number(idRaw) : null;
        const existente = idExistente
          ? await this.prisma.colaboradorFormacao.findFirst({ where: { id: idExistente, colaboradorId } })
          : null;

        if (existente) {
          await this.formacoesConcluidas.atualizar(colaboradorId, existente.id, { dataConclusao, horasFormacao, avaliacao }, user);
          resumo.atualizados++;
        } else {
          await this.formacoesConcluidas.criar(
            colaboradorId,
            { formacaoId: Number(formacaoIdRaw), dataConclusao, horasFormacao, avaliacao },
            user,
          );
          resumo.criados++;
        }
      } catch (err) {
        resumo.erros.push(`Linha ${r}: ${err instanceof Error ? err.message : 'erro desconhecido.'}`);
      }
    }
    return resumo;
  }

  // --- Planos de Desenvolvimento Individual -----------------------------------

  private normalizarTipoAlvo(valor: unknown): 'COMPETENCIA' | 'CERTIFICACAO' {
    const texto = String(valor).trim().toUpperCase();
    if (texto.startsWith('COMPET')) return 'COMPETENCIA';
    if (texto.startsWith('CERTIF')) return 'CERTIFICACAO';
    throw new Error(`"tipoAlvo" inválido: "${valor}" (tem de ser "Competência" ou "Certificação").`);
  }

  /** Aceita tanto o valor bruto do enum como o rótulo em português (com ou sem acento) exportado por `exportarPlanosDesenvolvimento`. */
  private normalizarEstado(valor: unknown): EstadoPdi {
    const texto = String(valor)
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (texto === 'PENDENTE' || texto === 'EM_CURSO' || texto === 'CONCLUIDO') return texto as EstadoPdi;
    throw new Error(`"estado" inválido: "${valor}" (tem de ser Pendente, Em Curso ou Concluído).`);
  }

  /**
   * Grelha "Planos de Desenvolvimento Individual" (pedido do utilizador) —
   * uma linha por item de PDI (PdiItem), com os campos do colaborador
   * (Nome/Área/Direção/Núcleo/Cargo atual/Próximo Cargo/LOB Prevista)
   * herdados e sempre derivados ao vivo (nunca guardados nesta tabela —
   * ver ProximoCargoService/GapAnalysisService.obterProximaLobEmLote), e
   * "Nível atual"/"Formação sugerida"/"Nível transmitido" calculados a
   * partir do estado atual do colaborador e do que o próprio PdiItem já
   * tem gravado (`formacaoId`) — nunca recalculados a partir do zero, para
   * mostrarem exatamente a mesma sugestão que o colaborador vê na sua
   * ficha. "Tipo de competência", "Nível atual", "Nível esperado" e
   * "Formação sugerida" ficam "N/A" em linhas de Certificação (pedido do
   * utilizador) — uma certificação não tem escala de nível própria. "Nível
   * transmitido" aplica-se às duas: para Competência é o nível que a
   * formação gravada no item transmite NESSA competência
   * (FormacaoRequisitoCompetencia); para Certificação, quando valida
   * exatamente uma competência, é o nível que essa certificação transmite
   * (CertificacaoRequisitoCompetencia) — fica em branco se a certificação
   * validar nenhuma ou mais que uma competência (não há um único valor
   * para mostrar).
   */
  async listarPlanosDesenvolvimento(filtros: FiltrosOrganizacionais) {
    const ids = await this.idsColaboradoresFiltrados(filtros);
    if (ids !== null && ids.length === 0) return [];

    const itens = await this.prisma.pdiItem.findMany({
      where: ids !== null ? { colaboradorId: { in: ids } } : undefined,
      include: {
        colaborador: {
          select: {
            nome: true,
            direcao: { select: { nome: true } },
            area: { select: { nome: true } },
            nucleo: { select: { nome: true } },
            cargo: { select: { nome: true } },
          },
        },
        competencia: { select: { id: true, nome: true, tipo: true } },
        certificacao: { select: { id: true, nome: true } },
        formacao: { select: { nome: true } },
      },
      orderBy: [{ colaborador: { nome: 'asc' } }, { id: 'asc' }],
    });
    if (itens.length === 0) return [];

    const colaboradorIds = Array.from(new Set(itens.map((i) => i.colaboradorId)));
    const competenciaIds = itens.map((i) => i.competenciaId).filter((v): v is number => v !== null);
    const [proximosCargos, proximasLobs, niveisAtuais, niveis, formacaoRequisitos, certificacaoRequisitos] = await Promise.all([
      this.proximoCargo.resolverEmLote(colaboradorIds),
      this.gapAnalysis.obterProximaLobEmLote(colaboradorIds),
      this.prisma.$queryRaw<{ colaborador_id: number; competencia_id: number; nivel_id: number }[]>`
        SELECT colaborador_id, competencia_id, nivel_id FROM colaborador_competencia_atual
        WHERE colaborador_id = ANY(${colaboradorIds}) AND competencia_id = ANY(${competenciaIds.length > 0 ? competenciaIds : [-1]})
      `,
      this.prisma.nivel.findMany(),
      this.prisma.formacaoRequisitoCompetencia.findMany(),
      this.prisma.certificacaoRequisitoCompetencia.findMany({ include: { competencia: { select: { tipo: true } } } }),
    ]);

    const nivelAtualPorChave = new Map(niveisAtuais.map((l) => [`${l.colaborador_id}:${l.competencia_id}`, l.nivel_id]));
    const nomeNivelPorChave = new Map(niveis.map((n) => [`${n.tipo}:${n.id}`, n.nome]));
    const nivelTransmitidoFormacao = new Map(formacaoRequisitos.map((f) => [`${f.formacaoId}:${f.competenciaId}`, f.nivelId]));
    const requisitosPorCertificacao = new Map<string, { nivelId: number; tipo: TipoDesenvolvimento }[]>();
    for (const req of certificacaoRequisitos) {
      if (!requisitosPorCertificacao.has(req.certificacaoId)) requisitosPorCertificacao.set(req.certificacaoId, []);
      requisitosPorCertificacao.get(req.certificacaoId)!.push({ nivelId: req.nivelId, tipo: req.competencia.tipo });
    }

    return itens.map((item) => {
      const ehCompetencia = item.competenciaId !== null;
      const tipoCompetencia = ehCompetencia ? item.competencia!.tipo : null;
      const proximoCargo = proximosCargos.get(item.colaboradorId)?.resolvido ?? null;
      const lobPrevista = proximasLobs.get(item.colaboradorId) ?? null;

      const nivelAtualId = ehCompetencia ? (nivelAtualPorChave.get(`${item.colaboradorId}:${item.competenciaId}`) ?? 0) : null;
      const nivelAtualNome = ehCompetencia ? (nomeNivelPorChave.get(`${tipoCompetencia}:${nivelAtualId}`) ?? String(nivelAtualId)) : null;
      const nivelEsperadoNome =
        ehCompetencia && item.nivelAlvoId !== null ? (nomeNivelPorChave.get(`${tipoCompetencia}:${item.nivelAlvoId}`) ?? String(item.nivelAlvoId)) : null;

      let nivelTransmitidoId: number | null = null;
      let nivelTransmitidoNome: string | null = null;
      if (ehCompetencia && item.formacaoId !== null) {
        nivelTransmitidoId = nivelTransmitidoFormacao.get(`${item.formacaoId}:${item.competenciaId}`) ?? null;
        if (nivelTransmitidoId !== null) nivelTransmitidoNome = nomeNivelPorChave.get(`${tipoCompetencia}:${nivelTransmitidoId}`) ?? String(nivelTransmitidoId);
      } else if (!ehCompetencia) {
        const candidatos = requisitosPorCertificacao.get(item.certificacaoId!) ?? [];
        if (candidatos.length === 1) {
          nivelTransmitidoId = candidatos[0].nivelId;
          nivelTransmitidoNome = nomeNivelPorChave.get(`${candidatos[0].tipo}:${candidatos[0].nivelId}`) ?? String(candidatos[0].nivelId);
        }
      }

      return {
        id: item.id,
        colaboradorId: item.colaboradorId,
        colaboradorNome: item.colaborador.nome,
        direcaoNome: item.colaborador.direcao?.nome ?? null,
        areaNome: item.colaborador.area?.nome ?? null,
        nucleoNome: item.colaborador.nucleo?.nome ?? null,
        cargoAtualNome: item.colaborador.cargo?.nome ?? null,
        proximoCargoNome: proximoCargo?.cargoNome ?? null,
        lobPrevistaNome: lobPrevista?.lobNome ?? null,
        tipoAlvo: ehCompetencia ? ('COMPETENCIA' as const) : ('CERTIFICACAO' as const),
        tipoCompetencia,
        itemId: ehCompetencia ? item.competenciaId! : item.certificacaoId!,
        itemNome: ehCompetencia ? item.competencia!.nome : item.certificacao!.nome,
        nivelAtualId,
        nivelAtualNome,
        nivelEsperadoId: item.nivelAlvoId,
        nivelEsperadoNome,
        formacaoSugeridaNome: ehCompetencia ? (item.formacao?.nome ?? null) : null,
        nivelTransmitidoId,
        nivelTransmitidoNome,
        estado: item.estado,
      };
    });
  }

  async exportarPlanosDesenvolvimento(filtros: FiltrosOrganizacionais): Promise<Buffer> {
    const linhas = await this.listarPlanosDesenvolvimento(filtros);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('planos-desenvolvimento');
    sheet.addRow([
      'id',
      'colaboradorId',
      'Nome',
      'Direção',
      'Área',
      'Núcleo',
      'Cargo atual',
      'Próximo Cargo',
      'LOB Prevista',
      'tipoAlvo',
      'Tipo de competência',
      'itemId',
      'Competência/Certificação',
      'nivelAtualId',
      'Nível atual',
      'nivelEsperadoId',
      'Nível esperado',
      'Formação sugerida',
      'nivelTransmitidoId',
      'Nível transmitido',
      'estado',
      'DELETE',
    ]);
    for (const l of linhas) {
      sheet.addRow([
        l.id,
        l.colaboradorId,
        l.colaboradorNome,
        l.direcaoNome,
        l.areaNome,
        l.nucleoNome,
        l.cargoAtualNome,
        l.proximoCargoNome,
        l.lobPrevistaNome,
        l.tipoAlvo === 'COMPETENCIA' ? 'Competência' : 'Certificação',
        l.tipoCompetencia === 'TECNICA' ? 'Técnica' : l.tipoCompetencia === 'COMPORTAMENTAL' ? 'Comportamental' : 'N/A',
        l.itemId,
        l.itemNome,
        l.nivelAtualId ?? 'N/A',
        l.nivelAtualNome ?? 'N/A',
        l.nivelEsperadoId ?? 'N/A',
        l.nivelEsperadoNome ?? 'N/A',
        l.formacaoSugeridaNome ?? 'N/A',
        l.nivelTransmitidoId,
        l.nivelTransmitidoNome,
        ESTADO_LABEL[l.estado],
        null,
      ]);
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Round-trip reaproveitando sempre PdiService (nunca um caminho de
   * escrita paralelo — mesmo princípio das outras 3 tabelas desta classe):
   * "DELETE" elimina (PdiService.eliminar, exige `id`); `id` preenchido e
   * encontrado só permite alterar o `estado` (pedido do utilizador —
   * qualquer outra alteração a uma linha existente é ignorada); `id` em
   * branco cria uma linha nova (PdiService.criar, que já valida o par
   * competência/nível-alvo OU certificação, e que o id indicado existe).
   */
  async importarPlanosDesenvolvimento(buffer: Buffer, user: AuthenticatedUser): Promise<ResumoImportacaoDados> {
    const sheet = await carregarPrimeiraFolha(buffer);
    const cabecalho = cabecalhoDe(sheet);
    const idxId = cabecalho.findIndex((h) => h === 'id');
    const idxColaborador = indiceColuna(cabecalho, 'colaboradorId');
    const idxTipoAlvo = cabecalho.findIndex((h) => h === 'tipoAlvo');
    const idxItemId = cabecalho.findIndex((h) => h === 'itemId');
    const idxNivelEsperado = cabecalho.findIndex((h) => h === 'nivelEsperadoId');
    const idxEstado = cabecalho.findIndex((h) => h === 'estado');
    const idxDelete = cabecalho.findIndex((h) => h === 'DELETE');

    const resumo: ResumoImportacaoDados = { criados: 0, atualizados: 0, eliminados: 0, erros: [] };
    for (let r = 2; r <= sheet.rowCount; r++) {
      const linha = sheet.getRow(r);
      if (linha.values == null || (Array.isArray(linha.values) && linha.values.length === 0)) continue;
      const idRaw = idxId === -1 ? null : ler(linha, idxId);
      const colaboradorIdRaw = ler(linha, idxColaborador);
      if (colaboradorIdRaw == null && idRaw == null) continue;

      try {
        if (idxDelete !== -1 && ehMarcaDelete(linha.getCell(idxDelete).value)) {
          if (idRaw == null) throw new Error('"id" obrigatório para eliminar (DELETE).');
          if (colaboradorIdRaw == null) throw new Error('"colaboradorId" obrigatório.');
          await this.pdi.eliminar(Number(colaboradorIdRaw), Number(idRaw), user);
          resumo.eliminados++;
          continue;
        }

        const idExistente = idRaw != null ? Number(idRaw) : null;
        const estadoRaw = idxEstado === -1 ? null : ler(linha, idxEstado);

        if (idExistente != null) {
          if (colaboradorIdRaw == null) throw new Error('"colaboradorId" obrigatório.');
          if (estadoRaw == null) continue;
          const estado = this.normalizarEstado(estadoRaw);
          await this.pdi.atualizar(Number(colaboradorIdRaw), idExistente, { estado }, user);
          resumo.atualizados++;
          continue;
        }

        if (colaboradorIdRaw == null) throw new Error('"colaboradorId" obrigatório.');
        const tipoAlvoRaw = idxTipoAlvo === -1 ? null : ler(linha, idxTipoAlvo);
        if (tipoAlvoRaw == null) throw new Error('"tipoAlvo" obrigatório ("Competência" ou "Certificação").');
        const itemIdRaw = idxItemId === -1 ? null : ler(linha, idxItemId);
        if (itemIdRaw == null) throw new Error('"itemId" obrigatório (id da Competência ou da Certificação).');

        const tipoAlvo = this.normalizarTipoAlvo(tipoAlvoRaw);
        const nivelEsperadoRaw = idxNivelEsperado === -1 ? null : ler(linha, idxNivelEsperado);
        const dto =
          tipoAlvo === 'COMPETENCIA'
            ? { competenciaId: Number(itemIdRaw), nivelAlvoId: nivelEsperadoRaw != null ? Number(nivelEsperadoRaw) : undefined }
            : { certificacaoId: String(itemIdRaw) };

        const criado = await this.pdi.criar(Number(colaboradorIdRaw), dto, user);
        if (estadoRaw != null) {
          const estado = this.normalizarEstado(estadoRaw);
          if (estado !== EstadoPdi.PENDENTE) await this.pdi.atualizar(Number(colaboradorIdRaw), criado.id, { estado }, user);
        }
        resumo.criados++;
      } catch (err) {
        resumo.erros.push(`Linha ${r}: ${err instanceof Error ? err.message : 'erro desconhecido.'}`);
      }
    }
    return resumo;
  }
}
