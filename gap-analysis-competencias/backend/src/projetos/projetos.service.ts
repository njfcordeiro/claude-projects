import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrigemAvaliacao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { RegistarParticipacaoProjetoDto } from './dto/registar-participacao-projeto.dto';

interface NivelAtualRow {
  nivel_id: number;
}

const INCLUDE_PARTICIPACAO = {
  projeto: { select: { nome: true } },
  vertentes: { include: { vertente: { include: { competencia: { select: { nome: true } } } } } },
} as const;

/**
 * Participação em Projetos — pedido do utilizador: via alternativa a
 * Formação/Certificação para subir de nível numa competência. Um
 * colaborador só participa num dado Projeto uma vez (a tabela
 * ColaboradorProjeto tem @@unique([colaboradorId, projetoId])); nessa
 * única participação escolhe quais Vertentes fez (mínimo 1). Cada
 * vertente escolhida sobe +1 nível (capado ao nível máximo da escala,
 * lido ao vivo de `niveis`) na competência dessa vertente, registado como
 * uma nova avaliação (ColaboradorCompetencia, origem PROJETO) — o
 * histórico append-only nunca é alterado, só ganha uma linha nova.
 */
@Injectable()
export class ProjetosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
  ) {}

  /** Vertentes de um Projeto (catálogo, não dados pessoais) — usado pelo modal "Registar participação" para mostrar todas as vertentes possíveis, não só a que originou o clique. */
  async listarVertentes(projetoId: number) {
    return this.prisma.projetoVertente.findMany({
      where: { projetoId },
      include: { competencia: { select: { nome: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async listarParticipacoes(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);
    return this.prisma.colaboradorProjeto.findMany({
      where: { colaboradorId },
      include: INCLUDE_PARTICIPACAO,
      orderBy: { dataParticipacao: 'desc' },
    });
  }

  async registarParticipacao(colaboradorId: number, dto: RegistarParticipacaoProjetoDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const vertentes = await this.prisma.projetoVertente.findMany({ where: { id: { in: dto.vertenteIds } } });
    if (vertentes.length !== new Set(dto.vertenteIds).size) {
      throw new NotFoundException('Uma ou mais vertentes indicadas não existem.');
    }
    if (vertentes.some((v) => v.projetoId !== dto.projetoId)) {
      throw new BadRequestException('Todas as vertentes têm de pertencer ao projeto indicado.');
    }

    const jaParticipou = await this.prisma.colaboradorProjeto.findUnique({
      where: { colaboradorId_projetoId: { colaboradorId, projetoId: dto.projetoId } },
    });
    if (jaParticipou) {
      throw new ConflictException('Este colaborador já participou neste projeto — cada projeto só conta uma vez.');
    }

    const nivelMaximo = await this.prisma.nivel.findFirstOrThrow({ orderBy: { id: 'desc' } });

    return this.prisma.runAsUser(user.sub, async (tx) => {
      const participacao = await tx.colaboradorProjeto.create({
        data: {
          colaboradorId,
          projetoId: dto.projetoId,
          createdBy: user.sub,
          vertentes: { create: vertentes.map((v) => ({ vertenteId: v.id })) },
        },
      });

      for (const vertente of vertentes) {
        // Mesmo lock consultivo de ColaboradoresService.criarAvaliacao — evita
        // duas subidas de nível concorrentes na mesma competência lerem o
        // mesmo "nível atual" e perderem-se uma à outra.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avaliacao:${colaboradorId}:${vertente.competenciaId}`}))`;

        const atual = await tx.$queryRaw<NivelAtualRow[]>`
          SELECT nivel_id
          FROM colaborador_competencia_atual
          WHERE colaborador_id = ${colaboradorId} AND competencia_id = ${vertente.competenciaId}
        `;
        const nivelAtual = atual[0]?.nivel_id ?? 0;
        const novoNivel = Math.min(nivelAtual + 1, nivelMaximo.id);

        await tx.colaboradorCompetencia.create({
          data: {
            colaboradorId,
            competenciaId: vertente.competenciaId,
            nivelId: novoNivel,
            dataAvaliacao: new Date(),
            avaliadoPor: user.sub,
            origem: OrigemAvaliacao.PROJETO,
          },
        });
      }

      return tx.colaboradorProjeto.findUniqueOrThrow({ where: { id: participacao.id }, include: INCLUDE_PARTICIPACAO });
    });
  }

  async eliminarParticipacao(colaboradorId: number, projetoId: number, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);
    const resultado = await this.prisma.runAsUser(user.sub, (tx) =>
      tx.colaboradorProjeto.deleteMany({ where: { colaboradorId, projetoId } }),
    );
    if (resultado.count === 0) {
      throw new NotFoundException('Este colaborador não tem participação registada neste projeto.');
    }
    return { eliminado: true };
  }
}
