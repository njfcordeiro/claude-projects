import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrigemPdi } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { GapAnalysisService } from '../gap-analysis/gap-analysis.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CreatePdiItemDto } from './dto/create-pdi-item.dto';
import { UpdatePdiItemDto } from './dto/update-pdi-item.dto';
import { GerarParaLobDto } from './dto/gerar-para-lob.dto';
import { LobObjetivosService } from './lob-objetivos.service';

const INCLUDE_ITEM = {
  competencia: { select: { nome: true } },
  certificacao: { select: { nome: true } },
  formacao: { select: { nome: true, duracaoHoras: true } },
  lob: { select: { nome: true } },
} as const;

interface CandidatoPdi {
  competenciaId: number | null;
  certificacaoId: string | null;
  formacaoId: number | null;
  lobId: number;
  descricao: string;
}

/**
 * PDI (Plano de Desenvolvimento Individual): as sugestões nunca duplicam a
 * lógica de comparação de gap — a geração reutiliza o motor já existente
 * (`GapAnalysisService.avaliarColaboradorLob`, que já traz as formações
 * candidatas ordenadas em `sugestoes.formacoes`) e só persiste um item de
 * acompanhamento por gap encontrado. Gerar outra vez não duplica itens já
 * existentes (mesma competência ou certificação em falta), mesmo que ainda
 * estejam pendentes.
 *
 * Cada geração visa sempre UMA ÚNICA LOB (pedido do utilizador) — há duas
 * formas de chegar lá:
 *  - `gerar`: escolhe a LOB automaticamente — a recomendada pelo BUD (a de
 *    maior prontidão, se houver mais que uma) se existir alguma, senão a
 *    sugestão do sistema mais próxima de ser atingida (maior prontidão);
 *    em caso de empate, escolhe uma das empatadas.
 *  - `gerarParaLobEscolhida`: a LOB é escolhida manualmente pelo
 *    utilizador — só é permitida uma LOB da Área do colaborador.
 *
 * Cada item gerado grava a LOB de origem (`lobId`) — a classificação
 * BUD/Sistema/Outras usada pelo frontend para agrupar o PDI é sempre
 * derivada ao vivo desse `lobId` contra os objetivos de LOB atuais, nunca
 * guardada como texto (evita ficar desatualizada se o objetivo mudar).
 */
@Injectable()
export class PdiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
    private readonly gapAnalysis: GapAnalysisService,
    private readonly lobObjetivos: LobObjetivosService,
  ) {}

  async listar(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);
    return this.prisma.pdiItem.findMany({
      where: { colaboradorId },
      include: INCLUDE_ITEM,
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Escolhe automaticamente a LOB-alvo (BUD, senão sistema, ambos por maior prontidão) e gera sugestões só para essa. */
  async gerar(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const { auto, bud } = await this.lobObjetivos.listar(colaboradorId, user);
    const candidatosLob = bud.length > 0 ? bud : auto;
    if (candidatosLob.length === 0) {
      return { criados: 0, itens: await this.listar(colaboradorId, user) };
    }

    const lobEscolhida = candidatosLob.reduce((melhor, atual) =>
      atual.prontidaoPercentual > melhor.prontidaoPercentual ? atual : melhor,
    );
    return this.gerarParaLob(colaboradorId, lobEscolhida.lobId, user);
  }

  /**
   * Escolha manual da LOB-alvo (pedido do utilizador: "Gerar sugestões
   * para LOB") — só é permitida uma LOB da própria Área do colaborador,
   * ao contrário da recomendação do BUD em `gerar`, que pode ser de
   * qualquer Área.
   */
  async gerarParaLobEscolhida(colaboradorId: number, dto: GerarParaLobDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const colaborador = await this.prisma.colaborador.findUnique({
      where: { id: colaboradorId },
      select: { areaId: true, area: { select: { nome: true } } },
    });
    if (!colaborador) throw new NotFoundException(`Colaborador ${colaboradorId} não encontrado.`);

    const lob = await this.prisma.lob.findUnique({ where: { id: dto.lobId } });
    if (!lob) throw new NotFoundException(`LOB ${dto.lobId} não encontrada.`);
    if (lob.areaId !== colaborador.areaId) {
      throw new BadRequestException(
        `A LOB "${lob.nome}" não pertence à área do colaborador (${colaborador.area?.nome ?? 'sem área definida'}) — só é possível gerar sugestões para uma LOB da própria área.`,
      );
    }

    return this.gerarParaLob(colaboradorId, dto.lobId, user);
  }

  /** Núcleo partilhado por `gerar`/`gerarParaLobEscolhida`: avalia o gap de UMA LOB e persiste um item por gap ainda não coberto. */
  private async gerarParaLob(colaboradorId: number, lobId: number, user: AuthenticatedUser) {
    const detalhe = await this.gapAnalysis.avaliarColaboradorLob(colaboradorId, lobId, user);

    const candidatos = new Map<string, CandidatoPdi>();
    for (const c of detalhe.competencias) {
      if (c.cumprido) continue;
      candidatos.set(`competencia:${c.competenciaId}`, {
        competenciaId: c.competenciaId,
        certificacaoId: null,
        formacaoId: c.sugestoes.formacoes[0]?.formacaoId ?? null,
        lobId,
        descricao: `Reforçar competência "${c.competenciaNome}" (nível atual ${c.nivelAtual} → exigido ${c.nivelExigido}) para a LOB "${detalhe.lobNome}".`,
      });
    }

    for (const cert of detalhe.certificacoes) {
      if (cert.cumprido) continue;
      const formacaoSugerida = cert.preparacao.find((p) => p.formacoesRecomendadas.length > 0)?.formacoesRecomendadas[0];
      candidatos.set(`certificacao:${cert.certificacaoId}`, {
        competenciaId: null,
        certificacaoId: cert.certificacaoId,
        formacaoId: formacaoSugerida?.formacaoId ?? null,
        lobId,
        descricao: `Obter a certificação "${cert.certificacaoNome}" — exigida pela LOB "${detalhe.lobNome}".`,
      });
    }

    const existentes = await this.prisma.pdiItem.findMany({ where: { colaboradorId } });
    const competenciasComItem = new Set(existentes.map((i) => i.competenciaId).filter((v): v is number => v !== null));
    const certificacoesComItem = new Set(existentes.map((i) => i.certificacaoId).filter((v): v is string => v !== null));

    let criados = 0;
    for (const candidato of candidatos.values()) {
      if (candidato.competenciaId !== null && competenciasComItem.has(candidato.competenciaId)) continue;
      if (candidato.certificacaoId !== null && certificacoesComItem.has(candidato.certificacaoId)) continue;

      await this.prisma.runAsUser(user.sub, (tx) =>
        tx.pdiItem.create({
          data: {
            colaboradorId,
            competenciaId: candidato.competenciaId,
            certificacaoId: candidato.certificacaoId,
            formacaoId: candidato.formacaoId,
            lobId: candidato.lobId,
            descricao: candidato.descricao,
            origem: OrigemPdi.AUTOMATICO,
            createdBy: user.sub,
          },
        }),
      );
      criados++;
    }

    return { criados, itens: await this.listar(colaboradorId, user) };
  }

  /** Adição manual de uma Competência ou Certificação ao PDI — pedido do utilizador: "deve ser possível adicionar... manualmente". */
  async criar(colaboradorId: number, dto: CreatePdiItemDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    if ((dto.competenciaId === undefined) === (dto.certificacaoId === undefined)) {
      throw new BadRequestException('Indica exatamente uma Competência OU uma Certificação.');
    }

    let descricao: string;
    if (dto.competenciaId !== undefined) {
      const competencia = await this.prisma.competencia.findUnique({ where: { id: dto.competenciaId } });
      if (!competencia) throw new NotFoundException(`Competência ${dto.competenciaId} não encontrada.`);
      descricao = `Reforçar competência "${competencia.nome}".`;
    } else {
      const certificacao = await this.prisma.certificacao.findUnique({ where: { id: dto.certificacaoId } });
      if (!certificacao) throw new NotFoundException(`Certificação "${dto.certificacaoId}" não encontrada.`);
      descricao = `Obter a certificação "${certificacao.nome}".`;
    }

    const criado = await this.prisma.runAsUser(user.sub, (tx) =>
      tx.pdiItem.create({
        data: {
          colaboradorId,
          competenciaId: dto.competenciaId ?? null,
          certificacaoId: dto.certificacaoId ?? null,
          descricao,
          origem: OrigemPdi.MANUAL,
          createdBy: user.sub,
        },
        include: INCLUDE_ITEM,
      }),
    );
    return criado;
  }

  async atualizar(colaboradorId: number, itemId: number, dto: UpdatePdiItemDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const resultado = await this.prisma.runAsUser(user.sub, (tx) =>
      tx.pdiItem.updateMany({
        where: { id: itemId, colaboradorId },
        data: { ...dto, updatedBy: user.sub },
      }),
    );
    if (resultado.count === 0) {
      throw new NotFoundException(`Item de PDI ${itemId} não encontrado para este colaborador.`);
    }
    return this.prisma.pdiItem.findUniqueOrThrow({ where: { id: itemId }, include: INCLUDE_ITEM });
  }

  async eliminar(colaboradorId: number, itemId: number, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);
    const resultado = await this.prisma.runAsUser(user.sub, (tx) => tx.pdiItem.deleteMany({ where: { id: itemId, colaboradorId } }));
    if (resultado.count === 0) {
      throw new NotFoundException(`Item de PDI ${itemId} não encontrado para este colaborador.`);
    }
    return { eliminado: true };
  }

  /**
   * Elimina de uma vez todos os itens SUGERIDOS (origem AUTOMATICO) — pedido
   * do utilizador: hoje só é possível eliminar um a um. Itens adicionados
   * manualmente (origem MANUAL) nunca são tocados por este endpoint.
   */
  async eliminarSugestoes(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);
    const resultado = await this.prisma.runAsUser(user.sub, (tx) =>
      tx.pdiItem.deleteMany({ where: { colaboradorId, origem: OrigemPdi.AUTOMATICO } }),
    );
    return { eliminados: resultado.count };
  }
}
