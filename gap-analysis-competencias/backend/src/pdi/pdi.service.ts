import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoPdi, OrigemPdi, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { GapAnalysisService } from '../gap-analysis/gap-analysis.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CreatePdiItemDto } from './dto/create-pdi-item.dto';
import { UpdatePdiItemDto } from './dto/update-pdi-item.dto';
import { GerarParaLobDto } from './dto/gerar-para-lob.dto';
import { GerarParaProximoCargoDto } from './dto/gerar-para-proximo-cargo.dto';
import { LobObjetivosService } from './lob-objetivos.service';

const INCLUDE_ITEM = {
  competencia: { select: { nome: true } },
  certificacao: { select: { nome: true } },
  formacao: { select: { nome: true, duracaoHoras: true } },
  lob: { select: { nome: true } },
  cargo: { select: { nome: true } },
  nivelAlvo: { select: { nome: true } },
} as const;

interface CandidatoPdi {
  competenciaId: number | null;
  certificacaoId: string | null;
  formacaoId: number | null;
  /** Mutuamente exclusivo com cargoId — um candidato vem de uma LOB OU de um Cargo, nunca das duas. */
  lobId: number | null;
  cargoId: string | null;
  /** Nível a atingir na competência — null para candidatos de certificação (sem escala de nível). */
  nivelAlvoId: number | null;
  descricao: string;
}

/**
 * Chave de "origem" de um item/candidato — usada para saber se dois itens
 * visam o mesmo alvo (mesma competência/certificação, no mesmo contexto) ou
 * se são alvos genuinamente distintos. Pedido do utilizador: gerar para o
 * Cargo Atual e depois para o Próximo Cargo tem de produzir DUAS linhas para
 * a mesma competência quando os níveis exigidos são diferentes (ex.
 * "Liderança": Proficiente para o cargo atual, Especialista para o
 * seguinte) — dedupe só faz sentido dentro do mesmo Cargo/LOB, nunca entre
 * origens diferentes.
 */
function origemChave(item: { lobId: number | null; cargoId: string | null }): string {
  if (item.cargoId !== null) return `cargo:${item.cargoId}`;
  if (item.lobId !== null) return `lob:${item.lobId}`;
  return 'manual';
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

  /**
   * "Gerar para o Cargo Atual" (pedido do utilizador) — visa o Perfil de
   * Competências do Cargo atual do colaborador (CargoRequisitoCompetencia,
   * Gestão de Dados → "Perfil de Competências por Cargo").
   */
  async gerarParaCargoAtual(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const colaborador = await this.prisma.colaborador.findUnique({ where: { id: colaboradorId }, select: { cargoId: true } });
    if (!colaborador?.cargoId) {
      throw new BadRequestException('Este colaborador não tem Cargo atribuído.');
    }

    return this.gerarParaPerfilCargo(colaboradorId, colaborador.cargoId, user);
  }

  /**
   * "Gerar para o Próximo Cargo" (pedido do utilizador) — resolve o Próximo
   * Cargo via Progressão de Cargos (mesmo grafo já usado em Evolução de
   * Carreiras/Candidatos): escolhe-o automaticamente se só houver um
   * possível, exige `proximoCargoId` se houver mais que um. Depois visa o
   * Perfil de Competências desse Cargo.
   */
  async gerarParaProximoCargo(colaboradorId: number, dto: GerarParaProximoCargoDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const colaborador = await this.prisma.colaborador.findUnique({ where: { id: colaboradorId }, select: { cargoId: true } });
    if (!colaborador?.cargoId) {
      throw new BadRequestException('Este colaborador não tem Cargo atribuído.');
    }

    const progressoes = await this.prisma.cargoProgressao.findMany({ where: { cargoId: colaborador.cargoId } });
    if (progressoes.length === 0) {
      throw new BadRequestException('Não há Próximo Cargo definido em Progressão de Cargos para o cargo atual deste colaborador.');
    }

    let proximoCargoId: string;
    if (progressoes.length === 1) {
      proximoCargoId = progressoes[0].proximoCargoId;
    } else {
      if (!dto.proximoCargoId) {
        throw new BadRequestException('Há mais que um Próximo Cargo possível a partir do cargo atual — indica qual escolher.');
      }
      if (!progressoes.some((p) => p.proximoCargoId === dto.proximoCargoId)) {
        throw new BadRequestException(`"${dto.proximoCargoId}" não é um Próximo Cargo possível a partir do cargo atual deste colaborador.`);
      }
      proximoCargoId = dto.proximoCargoId;
    }

    return this.gerarParaPerfilCargo(colaboradorId, proximoCargoId, user);
  }

  /**
   * Núcleo partilhado por `gerarParaCargoAtual`/`gerarParaProximoCargo`:
   * avalia o Perfil de Competências de UM Cargo (GapAnalysisService.
   * avaliarColaboradorPerfilCargo) e persiste um item por competência em
   * falta ainda não coberta — mesma lógica de dedup de `gerarParaLob`,
   * partilhando o mesmo Set de competências já com item.
   */
  private async gerarParaPerfilCargo(colaboradorId: number, cargoId: string, user: AuthenticatedUser) {
    const detalhe = await this.gapAnalysis.avaliarColaboradorPerfilCargo(colaboradorId, cargoId, user);
    if (detalhe.competencias.length === 0) {
      return { criados: 0, itens: await this.listar(colaboradorId, user) };
    }

    const candidatos = new Map<string, CandidatoPdi>();
    for (const c of detalhe.competencias) {
      if (c.cumprido) continue;
      candidatos.set(`competencia:${c.competenciaId}`, {
        competenciaId: c.competenciaId,
        certificacaoId: null,
        formacaoId: c.sugestoes.formacoes[0]?.formacaoId ?? null,
        lobId: null,
        cargoId,
        nivelAlvoId: c.nivelExigido,
        descricao: `Reforçar competência "${c.competenciaNome}" (nível atual ${c.nivelAtual} → exigido ${c.nivelExigido}) para o perfil do cargo "${detalhe.cargoNome}".`,
      });
    }

    return this.persistirCandidatos(colaboradorId, candidatos, user);
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
        cargoId: null,
        nivelAlvoId: c.nivelExigido,
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
        cargoId: null,
        nivelAlvoId: null,
        descricao: `Obter a certificação "${cert.certificacaoNome}" — exigida pela LOB "${detalhe.lobNome}".`,
      });
    }

    return this.persistirCandidatos(colaboradorId, candidatos, user);
  }

  /**
   * Persiste um item por candidato ainda não coberto por um item existente
   * — partilhado por `gerarParaLob`/`gerarParaPerfilCargo`. "Coberto" é
   * sempre relativo à MESMA origem (mesmo Cargo ou mesma LOB, via
   * `origemChave`): gerar duas vezes para a mesma LOB/Cargo não duplica,
   * mas gerar para o Cargo Atual e depois para o Próximo Cargo produz duas
   * linhas para a mesma competência quando os níveis exigidos diferem
   * (pedido do utilizador) — são alvos diferentes, não o mesmo gap.
   */
  private async persistirCandidatos(colaboradorId: number, candidatos: Map<string, CandidatoPdi>, user: AuthenticatedUser) {
    const existentes = await this.prisma.pdiItem.findMany({ where: { colaboradorId } });
    const alvosComItem = new Set(
      existentes.map((i) => {
        const alvo = i.competenciaId !== null ? `competencia:${i.competenciaId}` : `certificacao:${i.certificacaoId}`;
        return `${alvo}@${origemChave(i)}`;
      }),
    );

    let criados = 0;
    for (const [chaveCandidato, candidato] of candidatos) {
      if (alvosComItem.has(`${chaveCandidato}@${origemChave(candidato)}`)) continue;

      await this.prisma.runAsUser(user.sub, (tx) =>
        tx.pdiItem.create({
          data: {
            colaboradorId,
            competenciaId: candidato.competenciaId,
            certificacaoId: candidato.certificacaoId,
            formacaoId: candidato.formacaoId,
            lobId: candidato.lobId,
            cargoId: candidato.cargoId,
            nivelAlvoId: candidato.nivelAlvoId,
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

  /**
   * Adição manual de uma Competência ou Certificação ao PDI — pedido do
   * utilizador: "deve ser possível adicionar... manualmente". Competência
   * exige sempre um nível-alvo (pedido do utilizador: "senão não temos um
   * target de atingimento para perceber se cumpriu ou não") — Certificação
   * não tem escala de nível, por isso não aceita nivelAlvoId.
   */
  async criar(colaboradorId: number, dto: CreatePdiItemDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    if ((dto.competenciaId === undefined) === (dto.certificacaoId === undefined)) {
      throw new BadRequestException('Indica exatamente uma Competência OU uma Certificação.');
    }

    let descricao: string;
    let nivelAlvoId: number | null = null;
    if (dto.competenciaId !== undefined) {
      if (dto.nivelAlvoId === undefined) {
        throw new BadRequestException('Indica o nível que o colaborador tem de atingir nesta competência.');
      }
      const [competencia, nivel] = await Promise.all([
        this.prisma.competencia.findUnique({ where: { id: dto.competenciaId } }),
        this.prisma.nivel.findUnique({ where: { id: dto.nivelAlvoId } }),
      ]);
      if (!competencia) throw new NotFoundException(`Competência ${dto.competenciaId} não encontrada.`);
      if (!nivel) throw new NotFoundException(`Nível ${dto.nivelAlvoId} não encontrado.`);
      nivelAlvoId = dto.nivelAlvoId;
      descricao = `Reforçar competência "${competencia.nome}" até ao nível "${nivel.nome}".`;
    } else {
      if (dto.nivelAlvoId !== undefined) {
        throw new BadRequestException('Certificações não têm nível — não indiques nivelAlvoId.');
      }
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
          nivelAlvoId,
          descricao,
          origem: OrigemPdi.MANUAL,
          createdBy: user.sub,
        },
        include: INCLUDE_ITEM,
      }),
    );
    return criado;
  }

  /**
   * Ao transitar para CONCLUIDO pela primeira vez, congela `dataConclusao` e
   * `duracaoHorasSnapshot` (pedido do utilizador: a duração da Formação no
   * catálogo pode mudar mais tarde — sem isto, relatórios históricos
   * mostrariam a duração de hoje, não a que valia quando a formação foi
   * feita). Reabrir o item (voltar a PENDENTE/EM_CURSO) não apaga este
   * registo — fica como prova de que já foi concluído uma vez.
   */
  async atualizar(colaboradorId: number, itemId: number, dto: UpdatePdiItemDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const existente = await this.prisma.pdiItem.findFirst({ where: { id: itemId, colaboradorId } });
    if (!existente) {
      throw new NotFoundException(`Item de PDI ${itemId} não encontrado para este colaborador.`);
    }

    const dados: Prisma.PdiItemUpdateInput = { ...dto, updatedBy: user.sub };
    if (dto.estado === EstadoPdi.CONCLUIDO && existente.dataConclusao === null) {
      dados.dataConclusao = new Date();
      if (existente.formacaoId !== null) {
        const formacao = await this.prisma.formacao.findUnique({
          where: { id: existente.formacaoId },
          select: { duracaoHoras: true },
        });
        dados.duracaoHorasSnapshot = formacao?.duracaoHoras ?? null;
      }
    }

    await this.prisma.runAsUser(user.sub, (tx) => tx.pdiItem.update({ where: { id: itemId }, data: dados }));
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
