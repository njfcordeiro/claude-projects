import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cargo, OrigemAvaliacao, PapelUtilizador, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { calcularGapLob, ordenarCertificacoes, ordenarFormacoes } from './gap-analysis.logic';
import {
  CandidatoCarreira,
  CandidatosCarreiraResponse,
  CertificacaoCandidata,
  CertificacaoColaboradorInput,
  ColaboradorEmRisco,
  CoberturaArquitetos,
  CompetenciaCritica,
  DashboardResponse,
  DimensaoSkillMatrix,
  FiltrosOrganizacionais,
  FormacaoCandidata,
  PreparacaoCertificacao,
  ProjetoVertenteCandidata,
  RelatorioGapCargo,
  RelatorioGapLob,
  RequisitoCertificacaoInput,
  RequisitoCompetenciaInput,
  ResumoColaboradorDashboard,
  ResumoGapLob,
  ResumoGrupoDashboard,
  SkillMatrixResponse,
  SugestoesCompetencia,
} from './gap-analysis.types';

const LIMIAR_PRONTIDAO_RISCO_FUGA = 85;
const ANOS_MINIMOS_RISCO_FUGA = 2;
const MS_POR_ANO = 1000 * 60 * 60 * 24 * 365.25;

/**
 * Regras de cobertura de Arquitetos pedidas pelo utilizador (documentadas
 * também no ecrã "Como Funciona"):
 *   1. 1 Arquiteto por cada 10 colaboradores.
 *   2. Mínimo de 1 Arquiteto por área/núcleo com 10 ou mais colaboradores
 *      (o "ceil" do ponto 1 já garante isto sozinho, o max(1, ...) é só
 *      uma rede de segurança explícita).
 *   3. Área/núcleo com menos de 10 colaboradores não entra em défice —
 *      conta com apoio transversal de outra área/núcleo.
 */
const LIMIAR_COBERTURA_ARQUITETOS = 10;

function exigidosArquitetos(totalColaboradores: number): number {
  if (totalColaboradores < LIMIAR_COBERTURA_ARQUITETOS) return 0;
  return Math.max(1, Math.ceil(totalColaboradores / LIMIAR_COBERTURA_ARQUITETOS));
}

/** Linha da view colaborador_competencia_atual (docs/01-modelo-dados.md secção 5.1). */
interface ColaboradorCompetenciaAtualRow {
  competencia_id: number;
  nivel_id: number;
}

@Injectable()
export class GapAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
  ) {}

  async avaliarColaboradorLob(colaboradorId: number, lobId: number, user: AuthenticatedUser): Promise<RelatorioGapLob> {
    await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);

    const lob = await this.buscarLobComRequisitos(lobId);
    const [niveisAtuais, certsColaborador] = await Promise.all([
      this.buscarNiveisAtuais(colaboradorId),
      this.buscarCertificacoesColaborador(colaboradorId),
    ]);

    return this.avaliarLobParaColaborador(lob, niveisAtuais, certsColaborador, colaboradorId);
  }

  async avaliarColaboradorCargo(colaboradorId: number, user: AuthenticatedUser): Promise<RelatorioGapCargo> {
    const colaborador = await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);
    if (!colaborador.cargoId) {
      throw new BadRequestException('Este colaborador não tem cargo atribuído — não é possível calcular o gap.');
    }
    const cargo = await this.prisma.cargo.findUniqueOrThrow({ where: { id: colaborador.cargoId } });

    const [niveisAtuais, certsColaborador, todasAsLobs] = await Promise.all([
      this.buscarNiveisAtuais(colaboradorId),
      this.buscarCertificacoesColaborador(colaboradorId),
      this.prisma.lob.findMany({
        include: {
          area: { select: { nome: true } },
          requisitosCompetencia: { include: { competencia: true } },
          requisitosCertificacao: { include: { certificacao: true } },
        },
      }),
    ]);


    const lobs: ResumoGapLob[] = todasAsLobs.map((lob) => {
      const requisitosCompetencia = this.mapearRequisitosCompetencia(lob.requisitosCompetencia);
      const requisitosCertificacao = this.mapearRequisitosCertificacao(lob.requisitosCertificacao);
      const resultado = calcularGapLob(lob, requisitosCompetencia, requisitosCertificacao, niveisAtuais, certsColaborador);
      const certificacoesObrigatorias = resultado.certificacoes.filter((c) => c.obrigatorio);
      const competenciasObrigatorias = resultado.competencias.filter((c) => c.obrigatorio);
      return {
        lobId: resultado.lobId,
        lobNome: resultado.lobNome,
        areaId: lob.areaId,
        areaNome: lob.area.nome,
        pontosObtidos: resultado.pontosObtidos,
        pontosMinimos: resultado.pontosMinimos,
        prontidaoPercentual: resultado.prontidaoPercentual,
        atingido: resultado.atingido,
        competenciasObrigatoriasTotal: competenciasObrigatorias.length,
        competenciasObrigatoriasEmFalta: competenciasObrigatorias.filter((c) => !c.cumprido).length,
        pontosMinimosCumpridos: resultado.pontosObtidos >= resultado.pontosMinimos,
        certificacoesObrigatoriasTotal: certificacoesObrigatorias.length,
        certificacoesObrigatoriasEmFalta: certificacoesObrigatorias.filter((c) => !c.cumprido).length,
      };
    });

    const lobsAtingidos = lobs.filter((l) => l.atingido).length;
    const lobsExigidos = cargo.lobsExigidos ?? 0;

    // Pedido do utilizador: as LOBs da mesma área do colaborador vêm primeiro
    // (o cargo não aponta para LOBs específicas — ver nota em
    // sugerirCandidatosCarreira — por isso "prioridade" só pode ser de
    // ordenação/visualização, não de cálculo do gap).
    const lobsOrdenadas = [...lobs].sort((a, b) => {
      const aMesmaArea = a.areaId === colaborador.areaId ? 1 : 0;
      const bMesmaArea = b.areaId === colaborador.areaId ? 1 : 0;
      if (aMesmaArea !== bMesmaArea) return bMesmaArea - aMesmaArea;
      return b.prontidaoPercentual - a.prontidaoPercentual;
    });

    return {
      colaboradorId,
      cargoId: cargo.id,
      cargoNome: cargo.nome,
      lobsExigidos,
      lobsAtingidos,
      gap: Math.max(0, lobsExigidos - lobsAtingidos),
      lobs: lobsOrdenadas,
    };
  }

  /**
   * Agregação para o dashboard (Prompt 4). Não é um endpoint pessoal — é
   * gestão de equipa/organização, por isso EMPLOYEE não tem acesso (usa
   * antes a sua ficha + `/gap-analysis/colaboradores/:id/cargo`).
   * MANAGER só vê a sua equipa direta; ADMIN_RH/VIEWER vê todos.
   *
   * Todas as queries são feitas em lote (não há N+1 por colaborador) —
   * importante porque isto corre sobre a organização inteira, não um
   * colaborador de cada vez.
   */
  async obterDashboard(user: AuthenticatedUser): Promise<DashboardResponse> {
    if (user.role === PapelUtilizador.EMPLOYEE) {
      throw new ForbiddenException('O dashboard é uma vista de equipa/organização — usa a tua ficha pessoal.');
    }

    const where =
      user.role === PapelUtilizador.MANAGER
        ? { managerId: user.colaboradorId ?? -1, cargoId: { not: null } }
        : { cargoId: { not: null } };

    const { resumos, competenciasCriticas } = await this.calcularResumos(where);
    const alertasGestorInativo = await this.detectarGestoresInativosComEquipaAtiva();

    if (resumos.length === 0) {
      return {
        totalColaboradores: 0,
        prontidaoMediaGeral: 0,
        colaboradoresEmRisco: 0,
        porDirecao: [],
        porArea: [],
        porNucleo: [],
        porCargo: [],
        porCarreira: [],
        porNivelGestao: [],
        porLocalTrabalho: [],
        coberturaArquitetos: [],
        colaboradores: [],
        insights: alertasGestorInativo,
        competenciasCriticas: [],
        colaboradoresEmRiscoFuga: [],
      };
    }

    const porDirecao = this.agruparPorCampo(resumos, (r) => r.direcaoNome ?? 'Sem direção');
    const porArea = this.agruparPorCampo(resumos, (r) => r.areaNome ?? 'Sem área');
    const porNucleo = this.agruparPorCampo(resumos, (r) => r.nucleoNome ?? 'Sem núcleo');
    const porCargo = this.agruparPorCampo(resumos, (r) => r.cargoNome);
    const porCarreira = this.agruparPorCampo(resumos, (r) => r.carreiraNome ?? 'Sem carreira');
    const porNivelGestao = this.agruparPorCampo(resumos, (r) => r.nivelGestaoNome ?? 'Sem nível de gestão');
    const porLocalTrabalho = this.agruparPorCampo(resumos, (r) => r.localTrabalhoNome ?? 'Sem local de trabalho');
    const carreiraArquiteto = await this.resolverCarreiraArquiteto();
    const coberturaArquitetos = await this.calcularCoberturaArquitetosDeResumos(resumos, carreiraArquiteto?.id ?? null);
    const colaboradoresEmRiscoFuga = await this.calcularRiscoFuga(resumos);

    return {
      totalColaboradores: resumos.length,
      prontidaoMediaGeral: Math.round(resumos.reduce((soma, r) => soma + r.prontidaoMedia, 0) / resumos.length),
      colaboradoresEmRisco: resumos.filter((r) => r.gap > 0).length,
      porDirecao,
      porArea,
      porNucleo,
      porCargo,
      porCarreira,
      porNivelGestao,
      porLocalTrabalho,
      coberturaArquitetos,
      colaboradores: [...resumos].sort((a, b) => a.prontidaoMedia - b.prontidaoMedia),
      insights: [...alertasGestorInativo, ...this.gerarInsights(resumos, porDirecao, porArea, competenciasCriticas, colaboradoresEmRiscoFuga)],
      competenciasCriticas,
      colaboradoresEmRiscoFuga,
    };
  }

  /** Grelha colaboradores × LOBs (ou × competências) para o ecrã Skill Matrix — mesmo RBAC do dashboard. */
  async obterSkillMatrix(
    dimensao: DimensaoSkillMatrix,
    filtros: FiltrosOrganizacionais,
    user: AuthenticatedUser,
  ): Promise<SkillMatrixResponse> {
    if (user.role === PapelUtilizador.EMPLOYEE) {
      throw new ForbiddenException('A skill matrix é uma vista de equipa/organização — usa a tua ficha pessoal.');
    }

    const where: Prisma.ColaboradorWhereInput = {
      cargoId: { not: null },
      ativo: true,
      ...(user.role === PapelUtilizador.MANAGER ? { managerId: user.colaboradorId ?? -1 } : {}),
      ...(filtros.direcaoId ? { direcaoId: filtros.direcaoId } : {}),
      ...(filtros.areaId ? { areaId: filtros.areaId } : {}),
      ...(filtros.nucleoId ? { nucleoId: filtros.nucleoId } : {}),
      ...(filtros.cargoId ? { cargoId: filtros.cargoId } : {}),
    };

    const colaboradores = await this.prisma.colaborador.findMany({
      where,
      select: {
        id: true,
        nome: true,
        direcao: { select: { nome: true } },
        area: { select: { nome: true } },
        nucleo: { select: { nome: true } },
      },
      orderBy: { nome: 'asc' },
    });
    if (colaboradores.length === 0) return { dimensao, colunas: [], linhas: [] };
    const ids = colaboradores.map((c) => c.id);

    if (dimensao === 'lob') {
      const [niveisPorColaborador, certsPorColaborador, todasAsLobs] = await Promise.all([
        this.buscarNiveisAtuaisEmLote(ids),
        this.buscarCertificacoesEmLote(ids),
        this.prisma.lob.findMany({
          include: {
            area: true,
            requisitosCompetencia: { include: { competencia: true } },
            requisitosCertificacao: { include: { certificacao: true } },
          },
          orderBy: [{ area: { nome: 'asc' } }, { nome: 'asc' }],
        }),
      ]);

      const colunas = todasAsLobs.map((l) => ({ id: l.id, nome: l.nome, areaId: l.areaId, areaNome: l.area.nome }));
      const linhas = colaboradores.map((c) => {
        const niveisAtuais = niveisPorColaborador.get(c.id) ?? new Map();
        const certsColaborador = certsPorColaborador.get(c.id) ?? new Map();
        const valores: Record<string, number> = {};
        for (const lob of todasAsLobs) {
          const requisitosCompetencia = this.mapearRequisitosCompetencia(lob.requisitosCompetencia);
          const requisitosCertificacao = this.mapearRequisitosCertificacao(lob.requisitosCertificacao);
          const resultado = calcularGapLob(lob, requisitosCompetencia, requisitosCertificacao, niveisAtuais, certsColaborador);
          valores[String(lob.id)] = resultado.prontidaoPercentual;
        }
        return {
          colaboradorId: c.id,
          nome: c.nome,
          direcaoNome: c.direcao?.nome ?? null,
          areaNome: c.area?.nome ?? null,
          nucleoNome: c.nucleo?.nome ?? null,
          valores,
        };
      });

      return { dimensao, colunas, linhas };
    }

    const [niveisPorColaborador, competencias] = await Promise.all([
      this.buscarNiveisAtuaisEmLote(ids),
      this.prisma.competencia.findMany({
        include: { area: true, lobRequisitos: { select: { lobId: true } } },
        orderBy: [{ area: { nome: 'asc' } }, { nome: 'asc' }],
      }),
    ]);
    const colunas = competencias.map((c) => ({
      id: c.id,
      nome: c.nome,
      areaId: c.areaId,
      areaNome: c.area.nome,
      lobIds: c.lobRequisitos.map((r) => r.lobId),
    }));
    const linhas = colaboradores.map((c) => {
      const niveisAtuais = niveisPorColaborador.get(c.id) ?? new Map();
      const valores: Record<string, number> = {};
      for (const comp of competencias) {
        valores[String(comp.id)] = niveisAtuais.get(comp.id) ?? 0;
      }
      return {
        colaboradorId: c.id,
        nome: c.nome,
        direcaoNome: c.direcao?.nome ?? null,
        areaNome: c.area?.nome ?? null,
        nucleoNome: c.nucleo?.nome ?? null,
        valores,
      };
    });

    return { dimensao, colunas, linhas };
  }

  /**
   * Ficheiro de download/upload de níveis de competência (pedido do
   * utilizador, ecrã Skill Matrix) — formato "longo" (uma linha por
   * colaborador×competência), com o id e o nome/texto associado lado a
   * lado em cada coluna-chave, mais uma sheet de referência com as opções
   * válidas de Nível. Reaproveita `obterSkillMatrix('competencia', ...)`
   * para respeitar exatamente os mesmos filtros de linhas usados no ecrã;
   * `competenciaIds`, se indicado, restringe às colunas (competências)
   * atualmente visíveis no ecrã (filtro de colunas).
   */
  async exportarNiveisCompetencia(
    filtros: FiltrosOrganizacionais,
    competenciaIds: number[] | undefined,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const matriz = await this.obterSkillMatrix('competencia', filtros, user);
    const colunas =
      competenciaIds && competenciaIds.length > 0 ? matriz.colunas.filter((c) => competenciaIds.includes(c.id)) : matriz.colunas;
    const niveis = await this.prisma.nivel.findMany({ orderBy: { id: 'asc' } });
    const nomeNivel = new Map(niveis.map((n) => [n.id, n.nome]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('niveis-competencia');
    sheet.addRow(['colaboradorId', 'Colaborador', 'competenciaId', 'Competência', 'nivelId', 'Nível — nome atual']);
    for (const linha of matriz.linhas) {
      for (const col of colunas) {
        const nivelId = linha.valores[String(col.id)] ?? 0;
        sheet.addRow([linha.colaboradorId, linha.nome, col.id, col.nome, nivelId, nomeNivel.get(nivelId) ?? String(nivelId)]);
      }
    }

    const opcoes = workbook.addWorksheet('Opções — Nível');
    opcoes.addRow(['id', 'nome']);
    for (const n of niveis) opcoes.addRow([n.id, n.nome]);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Round-trip do ficheiro acima: para cada linha (colaboradorId,
   * competenciaId, nivelId), só grava uma nova avaliação (append-only,
   * origem FORMAL — mesmo padrão de `AtribuicoesService.atribuirCompetencia`)
   * se o nível pedido for diferente do nível atual, para não poluir o
   * histórico com reavaliações idênticas quando o utilizador reenvia o
   * mesmo ficheiro sem alterações. As colunas "— nome atual"/"Competência"
   * são só contexto e são ignoradas aqui (só lemos por cabeçalho exato).
   */
  async importarNiveisCompetencia(
    buffer: Buffer,
    user: AuthenticatedUser,
  ): Promise<{ processadas: number; criadas: number; semAlteracao: number; erros: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Ficheiro sem folhas.');

    const cabecalho = (sheet.getRow(1).values as unknown[]).map((v) => (v == null ? null : String(v).trim()));
    const idxColaborador = cabecalho.findIndex((h) => h === 'colaboradorId');
    const idxCompetencia = cabecalho.findIndex((h) => h === 'competenciaId');
    const idxNivel = cabecalho.findIndex((h) => h === 'nivelId');
    if (idxColaborador === -1 || idxCompetencia === -1 || idxNivel === -1) {
      throw new BadRequestException('Ficheiro sem as colunas obrigatórias: colaboradorId, competenciaId, nivelId.');
    }

    const ler = (linha: ExcelJS.Row, idx: number): unknown => {
      const v = linha.getCell(idx).value;
      return v && typeof v === 'object' && 'result' in v ? (v as { result: unknown }).result : v;
    };

    const linhasBrutas: { r: number; colaboradorId: number; competenciaId: number; nivelId: number }[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const linha = sheet.getRow(r);
      if (linha.values == null || (Array.isArray(linha.values) && linha.values.length === 0)) continue;
      const colaboradorId = ler(linha, idxColaborador);
      const competenciaId = ler(linha, idxCompetencia);
      const nivelId = ler(linha, idxNivel);
      if (colaboradorId == null || competenciaId == null || nivelId == null) continue;
      linhasBrutas.push({ r, colaboradorId: Number(colaboradorId), competenciaId: Number(competenciaId), nivelId: Number(nivelId) });
    }

    const resumo = { processadas: linhasBrutas.length, criadas: 0, semAlteracao: 0, erros: [] as string[] };
    if (linhasBrutas.length === 0) return resumo;

    const idsColaboradores = [...new Set(linhasBrutas.map((l) => l.colaboradorId))];
    const niveisAtuais = await this.buscarNiveisAtuaisEmLote(idsColaboradores);

    for (const linha of linhasBrutas) {
      try {
        if (!Number.isInteger(linha.nivelId) || linha.nivelId < 0 || linha.nivelId > 5) {
          throw new Error(`nível inválido: "${linha.nivelId}" (tem de ser um inteiro 0-5).`);
        }
        const atual = niveisAtuais.get(linha.colaboradorId)?.get(linha.competenciaId) ?? 0;
        if (atual === linha.nivelId) {
          resumo.semAlteracao++;
          continue;
        }

        await this.prisma.runAsUser(user.sub, (tx) =>
          tx.colaboradorCompetencia.create({
            data: {
              colaboradorId: linha.colaboradorId,
              competenciaId: linha.competenciaId,
              nivelId: linha.nivelId,
              dataAvaliacao: new Date(),
              avaliadoPor: user.sub,
              origem: OrigemAvaliacao.FORMAL,
            },
          }),
        );
        resumo.criadas++;
      } catch (err) {
        const mensagem =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003'
            ? 'colaborador ou competência inválidos.'
            : err instanceof Error
              ? err.message
              : 'erro desconhecido.';
        resumo.erros.push(`Linha ${linha.r}: ${mensagem}`);
      }
    }

    return resumo;
  }

  /**
   * Candidatos a uma carreira (ex. Arquiteto), com filtro opcional por
   * Cargo (pedido do utilizador). Para cada Cargo-alvo, os candidatos são
   * os colaboradores cujo Cargo ATUAL é um predecessor direto desse Cargo
   * em `cargo_progressao` (ex.: alvo "Associate Architect" → candidatos
   * com cargo atual "Senior Consultant"/"Principal Consultant", os que têm
   * uma linha `cargo_progressao` a apontar para ele). Sem `cargoId`, os
   * Cargos-alvo são TODOS os da carreira — um colaborador já dentro da
   * carreira mas num Cargo anterior (ex. "Associate Architect" candidato a
   * "Architect") também conta, porque o que importa é a relação de
   * progressão, não a Carreira atual do colaborador.
   *
   * Uma linha por par (colaborador, Cargo-alvo) — o mesmo colaborador pode
   * aparecer mais que uma vez se o seu Cargo atual progride para mais do
   * que um Cargo-alvo (mesma lógica de "uma linha por combinação" já usada
   * na Cobertura de Arquitetos).
   *
   * Elegibilidade ("Apto") exige DUAS condições, ambas em relação ao
   * Cargo-alvo dessa linha: antiguidade (`anosExperienciaMinimo` do Cargo
   * vs. anos desde `dataAdmissao` — sem essa data não é possível confirmar,
   * por isso não passa) E LOBs (lobsAtingidos >= lobsExigidos do Cargo).
   * `apto` é o critério de ordenação mais forte, antes do défice de
   * área/núcleo e do gap.
   *
   * Prontidão aqui é sempre a da "Próxima LOB" do colaborador (já
   * calculada em lote por `calcularResumos` → `prontidaoProximaLob`) —
   * nunca a média geral — porque o pedido é perceber a proximidade a essa
   * LOB específica, não ao cargo-alvo.
   */
  async sugerirCandidatosCarreira(
    carreiraId: string,
    cargoId: string | undefined,
    user: AuthenticatedUser,
  ): Promise<CandidatosCarreiraResponse> {
    if (user.role === PapelUtilizador.EMPLOYEE) {
      throw new ForbiddenException('Os candidatos são uma vista de equipa/organização — usa a tua ficha pessoal.');
    }

    const carreira = await this.prisma.carreira.findUnique({ where: { id: carreiraId } });
    if (!carreira) throw new NotFoundException(`Carreira "${carreiraId}" não encontrada.`);

    const cargosDaCarreira = await this.prisma.cargo.findMany({ where: { carreiraId } });
    let cargosAlvo = cargosDaCarreira;
    if (cargoId) {
      const cargoEscolhido = cargosDaCarreira.find((c) => c.id === cargoId);
      if (!cargoEscolhido) throw new NotFoundException(`Cargo "${cargoId}" não encontrado na carreira "${carreiraId}".`);
      cargosAlvo = [cargoEscolhido];
    }
    if (cargosAlvo.length === 0) {
      return { carreiraId: carreira.id, carreiraNome: carreira.nome, candidatos: [] };
    }

    const idsAlvo = cargosAlvo.map((c) => c.id);
    const cargosAlvoPorId = new Map(cargosAlvo.map((c) => [c.id, c]));
    const progressoes = await this.prisma.cargoProgressao.findMany({ where: { proximoCargoId: { in: idsAlvo } } });

    const alvosPorPredecessor = new Map<string, Cargo[]>();
    for (const p of progressoes) {
      const alvo = cargosAlvoPorId.get(p.proximoCargoId);
      if (!alvo) continue;
      if (!alvosPorPredecessor.has(p.cargoId)) alvosPorPredecessor.set(p.cargoId, []);
      alvosPorPredecessor.get(p.cargoId)!.push(alvo);
    }
    const idsPredecessores = Array.from(alvosPorPredecessor.keys());
    if (idsPredecessores.length === 0) {
      return { carreiraId: carreira.id, carreiraNome: carreira.nome, candidatos: [] };
    }

    const where =
      user.role === PapelUtilizador.MANAGER
        ? { managerId: user.colaboradorId ?? -1, cargoId: { in: idsPredecessores } }
        : { cargoId: { in: idsPredecessores } };

    const { resumos } = await this.calcularResumos(where);

    const agora = Date.now();
    const candidatos: CandidatoCarreira[] = [];
    for (const r of resumos) {
      for (const alvo of alvosPorPredecessor.get(r.cargoId) ?? []) {
        const lobsExigidos = alvo.lobsExigidos ?? 0;
        const anosExperienciaMinima = alvo.anosExperienciaMinimo ?? 0;
        const gap = Math.max(0, lobsExigidos - r.lobsAtingidos);
        const anosExperiencia = r.dataAdmissao ? Math.round(((agora - new Date(r.dataAdmissao).getTime()) / MS_POR_ANO) * 10) / 10 : null;
        const aptoAntiguidade = anosExperienciaMinima <= 0 || (anosExperiencia !== null && anosExperiencia >= anosExperienciaMinima);
        const aptoLobs = gap === 0;
        candidatos.push({
          colaboradorId: r.colaboradorId,
          nome: r.nome,
          direcaoNome: r.direcaoNome,
          areaNome: r.areaNome,
          nucleoNome: r.nucleoNome,
          cargoAtualId: r.cargoId,
          cargoAtualNome: r.cargoNome,
          proximoCargoId: alvo.id,
          proximoCargoNome: alvo.nome,
          lobsAtingidos: r.lobsAtingidos,
          lobsExigidos,
          gap,
          prontidao: r.prontidaoProximaLob,
          anosExperiencia,
          aptoAntiguidade,
          aptoLobs,
          apto: aptoAntiguidade && aptoLobs,
        });
      }
    }

    candidatos.sort(
      (a, b) => (b.apto ? 1 : 0) - (a.apto ? 1 : 0) || a.gap - b.gap || (b.prontidao ?? -1) - (a.prontidao ?? -1),
    );

    // Pedido do utilizador: se a carreira-alvo é a de Arquiteto, colaboradores
    // de uma combinação área/núcleo com défice de Arquitetos (ver
    // calcularCoberturaArquitetosDeResumos) passam à frente na lista de
    // candidatos, logo a seguir à elegibilidade e antes do critério de
    // gap/prontidão — a organização tem uma necessidade concreta e urgente
    // nessas áreas/núcleos.
    const carreiraArquiteto = await this.resolverCarreiraArquiteto();
    if (carreiraArquiteto && carreiraArquiteto.id === carreiraId) {
      const whereOrg =
        user.role === PapelUtilizador.MANAGER
          ? { managerId: user.colaboradorId ?? -1, cargoId: { not: null } }
          : { cargoId: { not: null } };
      const { resumos: resumosOrg } = await this.calcularResumos(whereOrg);
      const cobertura = await this.calcularCoberturaArquitetosDeResumos(resumosOrg, carreiraArquiteto.id);
      const paresEmDefice = new Set(cobertura.filter((c) => c.defice > 0).map((c) => `${c.nucleoNome ?? ''}::${c.areaNome}`));
      const emDefice = (c: CandidatoCarreira) => c.areaNome !== null && paresEmDefice.has(`${c.nucleoNome ?? ''}::${c.areaNome}`);

      candidatos.sort((a, b) => {
        const aApto = a.apto ? 1 : 0;
        const bApto = b.apto ? 1 : 0;
        if (aApto !== bApto) return bApto - aApto;
        const aPrioridade = emDefice(a) ? 1 : 0;
        const bPrioridade = emDefice(b) ? 1 : 0;
        if (aPrioridade !== bPrioridade) return bPrioridade - aPrioridade;
        return a.gap - b.gap || (b.prontidao ?? -1) - (a.prontidao ?? -1);
      });
    }

    return { carreiraId: carreira.id, carreiraNome: carreira.nome, candidatos };
  }

  /**
   * Núcleo partilhado por `obterDashboard`/`sugerirCandidatosCarreira`:
   * carrega colaboradores (com o `where` pedido) em lote e calcula
   * `lobsAtingidos`/`prontidaoMedia` sobre todas as LOBs da organização —
   * ver nota em `sugerirCandidatosCarreira` sobre porque isto não depende
   * do cargo-alvo.
   */
  /**
   * Colaboradores inativos são sempre excluídos daqui, independentemente do
   * `where` recebido — este é o método partilhado por obterDashboard,
   * sugerirCandidatosCarreira e calcularRiscoFuga/Cobertura de Arquitetos
   * (que recebem os resumos já filtrados), por isso um único ponto garante
   * que "não são considerados para análise" em todo o lado. Ver pedido do
   * utilizador.
   */
  private async calcularResumos(
    where: Prisma.ColaboradorWhereInput,
  ): Promise<{ resumos: ResumoColaboradorDashboard[]; competenciasCriticas: CompetenciaCritica[] }> {
    const colaboradores = await this.prisma.colaborador.findMany({
      where: { ...where, ativo: true },
      select: {
        id: true,
        nome: true,
        cargoId: true,
        carreiraId: true,
        dataAdmissao: true,
        proximaLobId: true,
        direcao: { select: { nome: true } },
        area: { select: { nome: true } },
        nucleo: { select: { nome: true } },
        carreira: { select: { nome: true } },
        nivelGestao: { select: { nome: true } },
        localTrabalho: { select: { nome: true } },
      },
    });

    if (colaboradores.length === 0) return { resumos: [], competenciasCriticas: [] };

    const ids = colaboradores.map((c) => c.id);
    const [niveisPorColaborador, certsPorColaborador, cargosPorId, todasAsLobs] = await Promise.all([
      this.buscarNiveisAtuaisEmLote(ids),
      this.buscarCertificacoesEmLote(ids),
      this.buscarCargosPorId(),
      this.prisma.lob.findMany({
        include: {
          requisitosCompetencia: { include: { competencia: true } },
          requisitosCertificacao: { include: { certificacao: true } },
        },
      }),
    ]);

    /**
     * Tally de competências obrigatórias em falta em toda a população —
     * alimenta "competências mais críticas" no dashboard. Guarda o SET de
     * colaboradores (não um contador incrementado por LOB): uma mesma
     * competência obrigatória pode aparecer em várias LOBs, e um colaborador
     * a quem falte essa competência conta-se UMA vez, não uma vez por LOB
     * onde ela é exigida — caso contrário "colaboradoresEmFalta" pode
     * facilmente exceder o total de colaboradores avaliados (bug
     * encontrado pelo utilizador).
     */
    const tallyCriticas = new Map<number, { nome: string; colaboradores: Set<number> }>();

    const resumos = colaboradores.map((c) => {
      const cargo = cargosPorId.get(c.cargoId!);
      const niveisAtuais = niveisPorColaborador.get(c.id) ?? new Map();
      const certsColaborador = certsPorColaborador.get(c.id) ?? new Map();

      const lobsResultados = todasAsLobs.map((lob) => {
        const requisitosCompetencia = this.mapearRequisitosCompetencia(lob.requisitosCompetencia);
        const requisitosCertificacao = this.mapearRequisitosCertificacao(lob.requisitosCertificacao);
        const resultado = calcularGapLob(lob, requisitosCompetencia, requisitosCertificacao, niveisAtuais, certsColaborador);

        for (const comp of resultado.competencias) {
          if (comp.cumprido || !comp.obrigatorio) continue;
          const atual = tallyCriticas.get(comp.competenciaId) ?? { nome: comp.competenciaNome, colaboradores: new Set<number>() };
          atual.colaboradores.add(c.id);
          tallyCriticas.set(comp.competenciaId, atual);
        }

        return resultado;
      });

      const lobsAtingidos = lobsResultados.filter((r) => r.atingido).length;
      const lobsExigidos = cargo?.lobsExigidos ?? 0;
      const prontidaoMedia = lobsResultados.length
        ? Math.round(lobsResultados.reduce((soma, r) => soma + r.prontidaoPercentual, 0) / lobsResultados.length)
        : 0;
      // Prontidão da "Próxima LOB" do colaborador (pedido do utilizador) —
      // só essa LOB conta, nunca a média geral. null se não tiver Próxima
      // LOB definida.
      const prontidaoProximaLob =
        c.proximaLobId !== null ? (lobsResultados.find((r) => r.lobId === c.proximaLobId)?.prontidaoPercentual ?? null) : null;

      return {
        colaboradorId: c.id,
        nome: c.nome,
        direcaoNome: c.direcao?.nome ?? null,
        areaNome: c.area?.nome ?? null,
        nucleoNome: c.nucleo?.nome ?? null,
        cargoId: c.cargoId!,
        cargoNome: cargo?.nome ?? c.cargoId!,
        carreiraId: c.carreiraId,
        carreiraNome: c.carreira?.nome ?? null,
        nivelGestaoNome: c.nivelGestao?.nome ?? null,
        localTrabalhoNome: c.localTrabalho?.nome ?? null,
        lobsExigidos,
        lobsAtingidos,
        gap: Math.max(0, lobsExigidos - lobsAtingidos),
        prontidaoMedia,
        prontidaoProximaLob,
        dataAdmissao: c.dataAdmissao ? c.dataAdmissao.toISOString().slice(0, 10) : null,
      };
    });

    const competenciasCriticas = Array.from(tallyCriticas.entries())
      .map(([competenciaId, v]) => ({ competenciaId, competenciaNome: v.nome, colaboradoresEmFalta: v.colaboradores.size }))
      .sort((a, b) => b.colaboradoresEmFalta - a.colaboradoresEmFalta)
      .slice(0, 5);

    return { resumos, competenciasCriticas };
  }

  /**
   * Heurística de risco de fuga de talento (não há dados de rotatividade
   * no modelo, por isso isto é um proxy explícito, não um facto medido):
   * alta prontidão (>= 85%) + pelo menos 2 anos no cargo atual + o cargo
   * atual não tem nenhuma progressão de carreira definida (`cargo_progressao`)
   * — ou seja, alguém já pronto, há tempo, sem próximo passo visível.
   */
  private async calcularRiscoFuga(resumos: ResumoColaboradorDashboard[]): Promise<ColaboradorEmRisco[]> {
    const candidatos = resumos.filter((r) => r.prontidaoMedia >= LIMIAR_PRONTIDAO_RISCO_FUGA && r.dataAdmissao !== null);
    if (candidatos.length === 0) return [];

    const cargosComProgressao = new Set(
      (await this.prisma.cargoProgressao.findMany({ select: { cargoId: true }, distinct: ['cargoId'] })).map((c) => c.cargoId),
    );

    const agora = Date.now();
    const risco: ColaboradorEmRisco[] = [];
    for (const r of candidatos) {
      const anos = (agora - new Date(r.dataAdmissao!).getTime()) / MS_POR_ANO;
      if (anos < ANOS_MINIMOS_RISCO_FUGA) continue;
      if (cargosComProgressao.has(r.cargoId)) continue;

      const anosArredondados = Math.round(anos * 10) / 10;
      risco.push({
        colaboradorId: r.colaboradorId,
        nome: r.nome,
        cargoNome: r.cargoNome,
        prontidaoMedia: r.prontidaoMedia,
        anosNoCargoAtual: anosArredondados,
        motivo: `Prontidão alta (${r.prontidaoMedia}%) há ${anosArredondados} anos no cargo, sem progressão de carreira definida a partir de "${r.cargoNome}".`,
      });
    }

    return risco.sort((a, b) => b.prontidaoMedia - a.prontidaoMedia);
  }

  /**
   * Alerta pedido pelo utilizador: "dar alertas se o colaborador inativo
   * está associado a outros colaboradores" — deteta colaboradores
   * inativos que continuam definidos como managerId de gente ainda ativa
   * (situação que a eliminação normal não cria, já que managerId fica a
   * null nesse caso — isto só acontece quando alguém é desativado sem ser
   * eliminado, e as suas equipas não foram reatribuídas). Org-wide,
   * independente do papel de quem vê o Dashboard.
   */
  private async detectarGestoresInativosComEquipaAtiva(): Promise<string[]> {
    const gestoresInativos = await this.prisma.colaborador.findMany({
      where: { ativo: false, subordinados: { some: { ativo: true } } },
      select: { nome: true, subordinados: { where: { ativo: true }, select: { nome: true } } },
    });
    return gestoresInativos.map((g) => {
      const n = g.subordinados.length;
      return `"${g.nome}" está inativo mas continua definido como gestor de ${n} colaborador${n === 1 ? '' : 'es'} ativo${n === 1 ? '' : 's'}: ${g.subordinados.map((s) => s.nome).join(', ')}.`;
    });
  }

  /** Frases de insight geradas a partir dos agregados já calculados — nunca inventa números, só lê o que já foi computado. */
  private gerarInsights(
    resumos: ResumoColaboradorDashboard[],
    porDirecao: ResumoGrupoDashboard[],
    porArea: ResumoGrupoDashboard[],
    competenciasCriticas: CompetenciaCritica[],
    emRisco: ColaboradorEmRisco[],
  ): string[] {
    const insights: string[] = [];

    const prontos = resumos.filter((r) => r.gap === 0).length;
    insights.push(
      `${prontos} de ${resumos.length} colaboradores (${Math.round((prontos / resumos.length) * 100)}%) já atingem todas as LOBs exigidas pelo respetivo cargo.`,
    );

    if (porDirecao.length > 1) {
      const pior = porDirecao[0];
      insights.push(`A direção com maior gap médio é "${pior.grupo}" (prontidão média de ${pior.prontidaoMedia}%, ${pior.emRisco} em risco).`);
    }
    if (porArea.length > 1) {
      const pior = porArea[0];
      insights.push(`A área com maior gap médio é "${pior.grupo}" (prontidão média de ${pior.prontidaoMedia}%).`);
    }

    if (competenciasCriticas.length > 0) {
      const top = competenciasCriticas[0];
      insights.push(`A competência mais crítica em falta é "${top.competenciaNome}" — obrigatória e em falta em ${top.colaboradoresEmFalta} colaborador${top.colaboradoresEmFalta === 1 ? '' : 'es'}.`);
    }

    if (emRisco.length > 0) {
      insights.push(`${emRisco.length} colaborador${emRisco.length === 1 ? '' : 'es'} identificado${emRisco.length === 1 ? '' : 's'} em risco de fuga de talento — alta prontidão sem progressão de carreira definida.`);
    }

    return insights;
  }

  // -----------------------------------------------------------------
  // Privados
  // -----------------------------------------------------------------

  private agruparPorCampo(
    resumos: ResumoColaboradorDashboard[],
    chave: (r: ResumoColaboradorDashboard) => string,
  ): ResumoGrupoDashboard[] {
    const grupos = new Map<string, ResumoColaboradorDashboard[]>();
    for (const r of resumos) {
      const k = chave(r);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(r);
    }
    return Array.from(grupos.entries())
      .map(([grupo, itens]) => ({
        grupo,
        totalColaboradores: itens.length,
        percentualDoTotal: Math.round((itens.length / resumos.length) * 100),
        prontidaoMedia: Math.round(itens.reduce((soma, i) => soma + i.prontidaoMedia, 0) / itens.length),
        emRisco: itens.filter((i) => i.gap > 0).length,
      }))
      .sort((a, b) => a.prontidaoMedia - b.prontidaoMedia);
  }

  /**
   * Resolve a Carreira "Arquiteto" por nome — não há um id fixo garantido
   * no catálogo. Aceita tanto o nome em português ("Arquiteto"/"Arquitecto")
   * como em inglês ("Architect", confirmado pelo utilizador como o nome
   * real usado no catálogo) — mesma convenção usada no frontend em
   * CandidatosPage.
   */
  private async resolverCarreiraArquiteto() {
    return this.prisma.carreira.findFirst({
      where: {
        OR: [{ nome: { contains: 'arquitet', mode: 'insensitive' } }, { nome: { contains: 'architect', mode: 'insensitive' } }],
      },
    });
  }

  /**
   * Cobertura de Arquitetos por combinação Núcleo/Área (pedido do
   * utilizador — ver regras junto a `exigidosArquitetos`). Uma linha por
   * par (tabela nucleo_areas), contando só os colaboradores que pertencem
   * a AMBOS — `Colaborador.areaId` E `Colaborador.nucleoId` a apontar
   * exatamente para essa Área e esse Núcleo (interseção, não só a Área —
   * corrigido a pedido do utilizador: "ele está a contar apenas por
   * área"). Áreas sem nenhum Núcleo associado aparecem numa linha própria
   * (nucleoNome null) com o total da Área inteira. Um colaborador cuja
   * Área tem Núcleos associados mas cujo `nucleoId` próprio não bate
   * certo com nenhum deles não é contado em nenhuma linha — é uma
   * inconsistência de dados a corrigir em Gestão de Dados, não algo para
   * a tabela adivinhar.
   */
  private async calcularCoberturaArquitetosDeResumos(
    resumos: ResumoColaboradorDashboard[],
    carreiraArquitetoId: string | null,
  ): Promise<CoberturaArquitetos[]> {
    const ehArquiteto = (r: ResumoColaboradorDashboard) => carreiraArquitetoId !== null && r.carreiraId === carreiraArquitetoId;

    const associacoes = await this.prisma.nucleoArea.findMany({
      include: { nucleo: { select: { nome: true } }, area: { select: { nome: true } } },
    });

    const calcularLinha = (nucleoNome: string | null, areaNome: string, itens: ResumoColaboradorDashboard[]): CoberturaArquitetos => {
      const totalColaboradores = itens.length;
      const arquitetos = itens.filter(ehArquiteto).length;
      const exigidos = exigidosArquitetos(totalColaboradores);
      return {
        nucleoNome,
        areaNome,
        totalColaboradores,
        arquitetos,
        exigidos,
        defice: Math.max(0, exigidos - arquitetos),
        excesso: Math.max(0, arquitetos - exigidos),
      };
    };

    const linhasPar = associacoes.map((a) =>
      calcularLinha(
        a.nucleo.nome,
        a.area.nome,
        resumos.filter((r) => r.areaNome === a.area.nome && r.nucleoNome === a.nucleo.nome),
      ),
    );

    const areasComNucleo = new Set(associacoes.map((a) => a.area.nome));
    const areasSemNucleo = new Set(resumos.filter((r) => r.areaNome && !areasComNucleo.has(r.areaNome)).map((r) => r.areaNome as string));
    const linhasSemNucleo = Array.from(areasSemNucleo).map((areaNome) =>
      calcularLinha(
        null,
        areaNome,
        resumos.filter((r) => r.areaNome === areaNome),
      ),
    );

    return [...linhasPar, ...linhasSemNucleo].sort((a, b) => b.defice - a.defice);
  }

  private async avaliarLobParaColaborador(
    lob: Awaited<ReturnType<GapAnalysisService['buscarLobComRequisitos']>>,
    niveisAtuais: Map<number, number>,
    certsColaborador: Map<string, CertificacaoColaboradorInput>,
    colaboradorId: number,
  ): Promise<RelatorioGapLob> {
    const requisitosCompetencia = this.mapearRequisitosCompetencia(lob.requisitosCompetencia);
    const requisitosCertificacao = this.mapearRequisitosCertificacao(lob.requisitosCertificacao);

    const resultado = calcularGapLob(lob, requisitosCompetencia, requisitosCertificacao, niveisAtuais, certsColaborador);

    const competencias = await Promise.all(
      resultado.competencias.map(async (gap) => ({
        ...gap,
        sugestoes: gap.cumprido
          ? { formacoes: [], certificacoes: [], projetos: [] }
          : await this.sugerirParaCompetencia(gap.competenciaId, gap.nivelAtual, gap.nivelExigido, certsColaborador, colaboradorId),
      })),
    );

    const certificacoes = await Promise.all(
      resultado.certificacoes.map(async (gap) => ({
        ...gap,
        preparacao: gap.cumprido ? [] : await this.prepararCertificacao(gap.certificacaoId, niveisAtuais, certsColaborador, colaboradorId),
      })),
    );

    return { ...resultado, competencias, certificacoes };
  }

  private async sugerirParaCompetencia(
    competenciaId: number,
    nivelAtual: number,
    nivelNecessario: number,
    certsColaborador: Map<string, CertificacaoColaboradorInput>,
    colaboradorId: number,
  ): Promise<SugestoesCompetencia> {
    const [formacoesReq, certsReq, vertentesReq, projetosParticipados] = await Promise.all([
      this.prisma.formacaoRequisitoCompetencia.findMany({ where: { competenciaId }, include: { formacao: true } }),
      this.prisma.certificacaoRequisitoCompetencia.findMany({ where: { competenciaId }, include: { certificacao: true } }),
      this.prisma.projetoVertente.findMany({ where: { competenciaId }, include: { projeto: true } }),
      this.prisma.colaboradorProjeto.findMany({ where: { colaboradorId }, select: { projetoId: true } }),
    ]);

    const formacoesCandidatas: FormacaoCandidata[] = formacoesReq.map((f) => ({
      formacaoId: f.formacao.id,
      formacaoNome: f.formacao.nome,
      nivelOferecido: f.nivelId,
      duracaoHoras: f.formacao.duracaoHoras,
    }));
    const certsCandidatas: CertificacaoCandidata[] = certsReq.map((c) => ({
      certificacaoId: c.certificacao.id,
      certificacaoNome: c.certificacao.nome,
      nivelOferecido: c.nivelId,
      jaPossui: certsColaborador.has(c.certificacao.id),
    }));

    // Um projeto só conta uma vez por colaborador (ver ProjetosService) —
    // uma vez participado, nenhuma das suas vertentes volta a ser sugerida.
    const projetosJaFeitos = new Set(projetosParticipados.map((p) => p.projetoId));
    const projetosCandidatos: ProjetoVertenteCandidata[] = vertentesReq
      .filter((v) => !projetosJaFeitos.has(v.projetoId))
      .map((v) => ({
        projetoId: v.projeto.id,
        projetoNome: v.projeto.nome,
        vertenteId: v.id,
        vertenteNome: v.nome,
      }));

    return {
      formacoes: ordenarFormacoes(formacoesCandidatas, nivelAtual, nivelNecessario),
      certificacoes: ordenarCertificacoes(certsCandidatas, nivelAtual, nivelNecessario),
      projetos: projetosCandidatos,
    };
  }

  private async prepararCertificacao(
    certificacaoId: string,
    niveisAtuais: Map<number, number>,
    certsColaborador: Map<string, CertificacaoColaboradorInput>,
    colaboradorId: number,
  ): Promise<PreparacaoCertificacao[]> {
    const competenciasValidadas = await this.prisma.certificacaoRequisitoCompetencia.findMany({
      where: { certificacaoId },
      include: { competencia: true },
    });

    return Promise.all(
      competenciasValidadas.map(async (c) => {
        const nivelAtual = niveisAtuais.get(c.competenciaId) ?? 0;
        const { formacoes } = await this.sugerirParaCompetencia(c.competenciaId, nivelAtual, c.nivelId, certsColaborador, colaboradorId);
        return {
          competenciaId: c.competenciaId,
          competenciaNome: c.competencia.nome,
          nivelValidado: c.nivelId,
          formacoesRecomendadas: formacoes,
        };
      }),
    );
  }

  private async buscarLobComRequisitos(lobId: number) {
    const lob = await this.prisma.lob.findUnique({
      where: { id: lobId },
      include: {
        requisitosCompetencia: { include: { competencia: true } },
        requisitosCertificacao: { include: { certificacao: true } },
      },
    });
    if (!lob) throw new NotFoundException(`LOB ${lobId} não encontrada.`);
    return lob;
  }

  private mapearRequisitosCompetencia(
    requisitos: { competenciaId: number; competencia: { nome: string }; obrigatorio: boolean; pontos: number; nivelMinimoId: number }[],
  ): RequisitoCompetenciaInput[] {
    return requisitos.map((r) => ({
      competenciaId: r.competenciaId,
      competenciaNome: r.competencia.nome,
      obrigatorio: r.obrigatorio,
      pontos: r.pontos,
      nivelMinimo: r.nivelMinimoId,
    }));
  }

  private mapearRequisitosCertificacao(
    requisitos: { certificacaoId: string; certificacao: { nome: string }; obrigatorio: boolean }[],
  ): RequisitoCertificacaoInput[] {
    return requisitos.map((r) => ({
      certificacaoId: r.certificacaoId,
      certificacaoNome: r.certificacao.nome,
      obrigatorio: r.obrigatorio,
    }));
  }

  /** Nível atual de cada competência do colaborador — via a view colaborador_competencia_atual (docs/01-modelo-dados.md secção 5.1). */
  private async buscarNiveisAtuais(colaboradorId: number): Promise<Map<number, number>> {
    const linhas = await this.prisma.$queryRaw<ColaboradorCompetenciaAtualRow[]>`
      SELECT competencia_id, nivel_id
      FROM colaborador_competencia_atual
      WHERE colaborador_id = ${colaboradorId}
    `;
    return new Map(linhas.map((l) => [l.competencia_id, l.nivel_id]));
  }

  private async buscarCertificacoesColaborador(colaboradorId: number): Promise<Map<string, CertificacaoColaboradorInput>> {
    const registos = await this.prisma.colaboradorCertificacao.findMany({ where: { colaboradorId } });
    return new Map(registos.map((r) => [r.certificacaoId, { dataValidade: r.dataValidade, dataObtencao: r.dataObtencao }]));
  }

  /** Versão em lote de buscarNiveisAtuais — uma query para N colaboradores, não N queries. */
  private async buscarNiveisAtuaisEmLote(colaboradorIds: number[]): Promise<Map<number, Map<number, number>>> {
    const linhas = await this.prisma.$queryRaw<(ColaboradorCompetenciaAtualRow & { colaborador_id: number })[]>`
      SELECT colaborador_id, competencia_id, nivel_id
      FROM colaborador_competencia_atual
      WHERE colaborador_id = ANY(${colaboradorIds})
    `;
    const porColaborador = new Map<number, Map<number, number>>();
    for (const l of linhas) {
      if (!porColaborador.has(l.colaborador_id)) porColaborador.set(l.colaborador_id, new Map());
      porColaborador.get(l.colaborador_id)!.set(l.competencia_id, l.nivel_id);
    }
    return porColaborador;
  }

  /** Versão em lote de buscarCertificacoesColaborador. */
  private async buscarCertificacoesEmLote(
    colaboradorIds: number[],
  ): Promise<Map<number, Map<string, CertificacaoColaboradorInput>>> {
    const registos = await this.prisma.colaboradorCertificacao.findMany({
      where: { colaboradorId: { in: colaboradorIds } },
    });
    const porColaborador = new Map<number, Map<string, CertificacaoColaboradorInput>>();
    for (const r of registos) {
      if (!porColaborador.has(r.colaboradorId)) porColaborador.set(r.colaboradorId, new Map());
      porColaborador.get(r.colaboradorId)!.set(r.certificacaoId, { dataValidade: r.dataValidade, dataObtencao: r.dataObtencao });
    }
    return porColaborador;
  }

  private async buscarCargosPorId(): Promise<Map<string, { nome: string; lobsExigidos: number | null }>> {
    const cargos = await this.prisma.cargo.findMany({ select: { id: true, nome: true, lobsExigidos: true } });
    return new Map(cargos.map((c) => [c.id, { nome: c.nome, lobsExigidos: c.lobsExigidos }]));
  }
}
