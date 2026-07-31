import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { calcularGapLob, ordenarCertificacoes, ordenarFormacoes } from './gap-analysis.logic';
import {
  CertificacaoCandidata,
  CertificacaoColaboradorInput,
  FormacaoCandidata,
  PreparacaoCertificacao,
  RelatorioGapCargo,
  RelatorioGapLob,
  RequisitoCertificacaoInput,
  RequisitoCompetenciaInput,
  ResumoGapLob,
  SugestoesCompetencia,
} from './gap-analysis.types';

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
        pontosObtidos: resultado.pontosObtidos,
        pontosMinimos: resultado.pontosMinimos,
        prontidaoPercentual: resultado.prontidaoPercentual,
        atingido: resultado.atingido,
      };
    });

    const lobsAtingidos = lobs.filter((l) => l.atingido).length;
    const lobsExigidos = cargo.lobsExigidos ?? 0;

    return {
      colaboradorId,
      cargoId: cargo.id,
      cargoNome: cargo.nome,
      lobsExigidos,
      lobsAtingidos,
      gap: Math.max(0, lobsExigidos - lobsAtingidos),
      lobs: lobs.sort((a, b) => b.prontidaoPercentual - a.prontidaoPercentual),
    };
  }

  // -----------------------------------------------------------------
  // Privados
  // -----------------------------------------------------------------

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
}
