import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PapelUtilizador, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { calcularGapLob, ordenarCertificacoes, ordenarFormacoes } from './gap-analysis.logic';
import {
  CandidatosCarreiraResponse,
  CertificacaoCandidata,
  CertificacaoColaboradorInput,
  ColaboradorEmRisco,
  CompetenciaCritica,
  DashboardResponse,
  DimensaoSkillMatrix,
  FiltrosOrganizacionais,
  FormacaoCandidata,
  PreparacaoCertificacao,
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

    return this.avaliarLobParaColaborador(lob, niveisAtuais, certsColaborador);
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
      return {
        lobId: resultado.lobId,
        lobNome: resultado.lobNome,
        areaId: lob.areaId,
        areaNome: lob.area.nome,
        pontosObtidos: resultado.pontosObtidos,
        pontosMinimos: resultado.pontosMinimos,
        prontidaoPercentual: resultado.prontidaoPercentual,
        atingido: resultado.atingido,
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
        colaboradores: [],
        insights: [],
        competenciasCriticas: [],
        colaboradoresEmRiscoFuga: [],
      };
    }

    const porDirecao = this.agruparPorCampo(resumos, (r) => r.direcaoNome ?? 'Sem direção');
    const porArea = this.agruparPorCampo(resumos, (r) => r.areaNome ?? 'Sem área');
    const porNucleo = this.agruparPorCampo(resumos, (r) => r.nucleoNome ?? 'Sem núcleo');
    const porCargo = this.agruparPorCampo(resumos, (r) => r.cargoNome);
    const porCarreira = this.agruparPorCampo(resumos, (r) => r.carreiraNome ?? 'Sem carreira');
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
      colaboradores: [...resumos].sort((a, b) => a.prontidaoMedia - b.prontidaoMedia),
      insights: this.gerarInsights(resumos, porDirecao, porArea, competenciasCriticas, colaboradoresEmRiscoFuga),
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
      ...(user.role === PapelUtilizador.MANAGER ? { managerId: user.colaboradorId ?? -1 } : {}),
      ...(filtros.direcaoId ? { direcaoId: filtros.direcaoId } : {}),
      ...(filtros.areaId ? { areaId: filtros.areaId } : {}),
      ...(filtros.nucleoId ? { nucleoId: filtros.nucleoId } : {}),
      ...(filtros.cargoId ? { cargoId: filtros.cargoId } : {}),
    };

    const colaboradores = await this.prisma.colaborador.findMany({ where, select: { id: true, nome: true }, orderBy: { nome: 'asc' } });
    if (colaboradores.length === 0) return { dimensao, colunas: [], linhas: [] };
    const ids = colaboradores.map((c) => c.id);

    if (dimensao === 'lob') {
      const [niveisPorColaborador, certsPorColaborador, todasAsLobs] = await Promise.all([
        this.buscarNiveisAtuaisEmLote(ids),
        this.buscarCertificacoesEmLote(ids),
        this.prisma.lob.findMany({
          include: {
            requisitosCompetencia: { include: { competencia: true } },
            requisitosCertificacao: { include: { certificacao: true } },
          },
          orderBy: { nome: 'asc' },
        }),
      ]);

      const colunas = todasAsLobs.map((l) => ({ id: l.id, nome: l.nome }));
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
        return { colaboradorId: c.id, nome: c.nome, valores };
      });

      return { dimensao, colunas, linhas };
    }

    const [niveisPorColaborador, competencias] = await Promise.all([
      this.buscarNiveisAtuaisEmLote(ids),
      this.prisma.competencia.findMany({ orderBy: { nome: 'asc' } }),
    ]);
    const colunas = competencias.map((c) => ({ id: c.id, nome: c.nome }));
    const linhas = colaboradores.map((c) => {
      const niveisAtuais = niveisPorColaborador.get(c.id) ?? new Map();
      const valores: Record<string, number> = {};
      for (const comp of competencias) {
        valores[String(comp.id)] = niveisAtuais.get(comp.id) ?? 0;
      }
      return { colaboradorId: c.id, nome: c.nome, valores };
    });

    return { dimensao, colunas, linhas };
  }

  /**
   * Candidatos a uma carreira (ex. Arquiteto): os LOBs não estão ligados a
   * um cargo específico — `lobsAtingidos`/`prontidaoMedia` de um
   * colaborador são calculados sobre TODAS as LOBs da organização e não
   * dependem do cargo-alvo (ver `calcularResumos`/`obterDashboard`); só
   * `cargo.lobsExigidos` varia por cargo. Por isso "quão perto está alguém
   * da carreira X" reduz-se a comparar o `lobsAtingidos` já calculado (uma
   * vez, em lote) contra o MENOR `lobsExigidos` entre os cargos dessa
   * carreira — o cargo de entrada mais acessível.
   */
  async sugerirCandidatosCarreira(carreiraId: string, user: AuthenticatedUser): Promise<CandidatosCarreiraResponse> {
    if (user.role === PapelUtilizador.EMPLOYEE) {
      throw new ForbiddenException('Os candidatos são uma vista de equipa/organização — usa a tua ficha pessoal.');
    }

    const carreira = await this.prisma.carreira.findUnique({ where: { id: carreiraId } });
    if (!carreira) throw new NotFoundException(`Carreira "${carreiraId}" não encontrada.`);

    const cargosDaCarreira = await this.prisma.cargo.findMany({ where: { carreiraId } });
    const cargoEntrada = cargosDaCarreira.reduce<(typeof cargosDaCarreira)[number] | null>((menor, atual) => {
      const atualExigidos = atual.lobsExigidos ?? 0;
      if (!menor) return atual;
      return atualExigidos < (menor.lobsExigidos ?? 0) ? atual : menor;
    }, null);
    const lobsExigidosEntrada = cargoEntrada?.lobsExigidos ?? 0;

    const where =
      user.role === PapelUtilizador.MANAGER
        ? { managerId: user.colaboradorId ?? -1, cargoId: { not: null }, carreiraId: { not: carreiraId } }
        : { cargoId: { not: null }, carreiraId: { not: carreiraId } };

    const { resumos } = await this.calcularResumos(where);

    const candidatos = resumos
      .map((r) => ({ ...r, lobsExigidos: lobsExigidosEntrada, gap: Math.max(0, lobsExigidosEntrada - r.lobsAtingidos) }))
      .sort((a, b) => a.gap - b.gap || b.prontidaoMedia - a.prontidaoMedia);

    return {
      carreiraId: carreira.id,
      carreiraNome: carreira.nome,
      cargoEntradaId: cargoEntrada?.id ?? null,
      cargoEntradaNome: cargoEntrada?.nome ?? null,
      lobsExigidosEntrada,
      candidatos,
    };
  }

  /**
   * Núcleo partilhado por `obterDashboard`/`sugerirCandidatosCarreira`:
   * carrega colaboradores (com o `where` pedido) em lote e calcula
   * `lobsAtingidos`/`prontidaoMedia` sobre todas as LOBs da organização —
   * ver nota em `sugerirCandidatosCarreira` sobre porque isto não depende
   * do cargo-alvo.
   */
  private async calcularResumos(
    where: Prisma.ColaboradorWhereInput,
  ): Promise<{ resumos: ResumoColaboradorDashboard[]; competenciasCriticas: CompetenciaCritica[] }> {
    const colaboradores = await this.prisma.colaborador.findMany({
      where,
      select: {
        id: true,
        nome: true,
        cargoId: true,
        carreiraId: true,
        dataAdmissao: true,
        direcao: { select: { nome: true } },
        area: { select: { nome: true } },
        nucleo: { select: { nome: true } },
        carreira: { select: { nome: true } },
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
        lobsExigidos,
        lobsAtingidos,
        gap: Math.max(0, lobsExigidos - lobsAtingidos),
        prontidaoMedia,
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

  private async avaliarLobParaColaborador(
    lob: Awaited<ReturnType<GapAnalysisService['buscarLobComRequisitos']>>,
    niveisAtuais: Map<number, number>,
    certsColaborador: Map<string, CertificacaoColaboradorInput>,
  ): Promise<RelatorioGapLob> {
    const requisitosCompetencia = this.mapearRequisitosCompetencia(lob.requisitosCompetencia);
    const requisitosCertificacao = this.mapearRequisitosCertificacao(lob.requisitosCertificacao);

    const resultado = calcularGapLob(lob, requisitosCompetencia, requisitosCertificacao, niveisAtuais, certsColaborador);

    const competencias = await Promise.all(
      resultado.competencias.map(async (gap) => ({
        ...gap,
        sugestoes: gap.cumprido
          ? { formacoes: [], certificacoes: [] }
          : await this.sugerirParaCompetencia(gap.competenciaId, gap.nivelAtual, gap.nivelExigido, certsColaborador),
      })),
    );

    const certificacoes = await Promise.all(
      resultado.certificacoes.map(async (gap) => ({
        ...gap,
        preparacao: gap.cumprido ? [] : await this.prepararCertificacao(gap.certificacaoId, niveisAtuais, certsColaborador),
      })),
    );

    return { ...resultado, competencias, certificacoes };
  }

  private async sugerirParaCompetencia(
    competenciaId: number,
    nivelAtual: number,
    nivelNecessario: number,
    certsColaborador: Map<string, CertificacaoColaboradorInput>,
  ): Promise<SugestoesCompetencia> {
    const [formacoesReq, certsReq] = await Promise.all([
      this.prisma.formacaoRequisitoCompetencia.findMany({ where: { competenciaId }, include: { formacao: true } }),
      this.prisma.certificacaoRequisitoCompetencia.findMany({ where: { competenciaId }, include: { certificacao: true } }),
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

    return {
      formacoes: ordenarFormacoes(formacoesCandidatas, nivelAtual, nivelNecessario),
      certificacoes: ordenarCertificacoes(certsCandidatas, nivelAtual, nivelNecessario),
    };
  }

  private async prepararCertificacao(
    certificacaoId: string,
    niveisAtuais: Map<number, number>,
    certsColaborador: Map<string, CertificacaoColaboradorInput>,
  ): Promise<PreparacaoCertificacao[]> {
    const competenciasValidadas = await this.prisma.certificacaoRequisitoCompetencia.findMany({
      where: { certificacaoId },
      include: { competencia: true },
    });

    return Promise.all(
      competenciasValidadas.map(async (c) => {
        const nivelAtual = niveisAtuais.get(c.competenciaId) ?? 0;
        const { formacoes } = await this.sugerirParaCompetencia(c.competenciaId, nivelAtual, c.nivelId, certsColaborador);
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
