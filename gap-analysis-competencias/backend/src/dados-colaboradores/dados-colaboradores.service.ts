import { BadRequestException, Injectable } from '@nestjs/common';
import { AvaliacaoFormacao, TipoDesenvolvimento } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { FormacoesConcluidasService } from '../formacoes-concluidas/formacoes-concluidas.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ehMarcaDelete } from '../catalogo/catalogo.service';

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
  ) {}

  // --- Competências técnicas / comportamentais ------------------------------

  async exportarCompetencias(tipo: TipoDesenvolvimento): Promise<Buffer> {
    const linhas = await this.prisma.$queryRaw<
      { colaborador_id: number; colaborador_nome: string; competencia_id: number; competencia_nome: string; nivel_id: number; nivel_nome: string }[]
    >`
      SELECT c.id AS colaborador_id, c.nome AS colaborador_nome, comp.id AS competencia_id, comp.nome AS competencia_nome,
             a.nivel_id, n.nome AS nivel_nome
      FROM colaboradores c
      JOIN colaborador_competencia_atual a ON a.colaborador_id = c.id
      JOIN competencias comp ON comp.id = a.competencia_id
      JOIN niveis n ON n.id = a.nivel_id
      WHERE comp.tipo = ${tipo}::tipo_desenvolvimento
      ORDER BY c.nome, comp.nome
    `;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('competencias');
    sheet.addRow(['colaboradorId', 'Colaborador', 'competenciaId', 'Competência', 'nivelId', 'Nível — nome atual', 'DELETE']);
    for (const l of linhas) {
      sheet.addRow([l.colaborador_id, l.colaborador_nome, l.competencia_id, l.competencia_nome, l.nivel_id, l.nivel_nome, null]);
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

  async exportarCertificacoes(): Promise<Buffer> {
    const linhas = await this.prisma.colaboradorCertificacao.findMany({
      include: { colaborador: { select: { nome: true } }, certificacao: { select: { nome: true } } },
      orderBy: [{ colaborador: { nome: 'asc' } }, { certificacao: { nome: 'asc' } }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('certificacoes');
    sheet.addRow(['colaboradorId', 'Colaborador', 'certificacaoId', 'Certificação', 'dataObtencao', 'dataValidade', 'anexoUrl', 'DELETE']);
    for (const l of linhas) {
      sheet.addRow([
        l.colaboradorId,
        l.colaborador.nome,
        l.certificacaoId,
        l.certificacao.nome,
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

  async exportarFormacoesConcluidas(): Promise<Buffer> {
    const linhas = await this.prisma.colaboradorFormacao.findMany({
      include: { colaborador: { select: { nome: true } }, formacao: { select: { nome: true } } },
      orderBy: [{ colaborador: { nome: 'asc' } }, { dataConclusao: 'desc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('formacoes-concluidas');
    sheet.addRow(['id', 'colaboradorId', 'Colaborador', 'formacaoId', 'Formação', 'dataConclusao', 'horasFormacao', 'avaliacao', 'DELETE']);
    for (const l of linhas) {
      sheet.addRow([
        l.id,
        l.colaboradorId,
        l.colaborador.nome,
        l.formacaoId,
        l.formacao.nome,
        l.dataConclusao.toISOString().slice(0, 10),
        l.horasFormacao,
        l.avaliacao,
        null,
      ]);
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
}
