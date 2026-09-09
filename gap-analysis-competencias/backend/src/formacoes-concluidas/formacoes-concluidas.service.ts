import { Injectable, NotFoundException } from '@nestjs/common';
import { AvaliacaoFormacao, OrigemAvaliacao, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CreateFormacaoConcluidaDto } from './dto/create-formacao-concluida.dto';
import { UpdateFormacaoConcluidaDto } from './dto/update-formacao-concluida.dto';

const INCLUDE_FORMACAO = {
  formacao: { select: { nome: true, duracaoHoras: true } },
} as const;

/**
 * Histórico de formações concluídas do colaborador (pedido do utilizador)
 * — uma lista, não um upsert (ColaboradorFormacao.@@index, sem unique: o
 * mesmo colaborador pode repetir a mesma Formação). Quando uma linha fica
 * com `avaliacao = APROVADO`, aplica os níveis de
 * FormacaoRequisitoCompetencia ao colaborador — mas só sobe (mesmo helper
 * de PdiService: ColaboradoresService.subirNivelSeSuperior), nunca desce
 * ao mudar a avaliação para Reprovado/Faltou depois de já ter estado
 * Aprovado.
 */
@Injectable()
export class FormacoesConcluidasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
  ) {}

  async listar(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);
    return this.prisma.colaboradorFormacao.findMany({
      where: { colaboradorId },
      include: INCLUDE_FORMACAO,
      orderBy: { dataConclusao: 'desc' },
    });
  }

  async criar(colaboradorId: number, dto: CreateFormacaoConcluidaDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const formacao = await this.prisma.formacao.findUnique({ where: { id: dto.formacaoId } });
    if (!formacao) throw new NotFoundException(`Formação ${dto.formacaoId} não encontrada.`);

    const horasFormacao = dto.horasFormacao ?? formacao.duracaoHoras ?? 0;

    const criado = await this.prisma.runAsUser(user.sub, async (tx) => {
      const registo = await tx.colaboradorFormacao.create({
        data: {
          colaboradorId,
          formacaoId: dto.formacaoId,
          dataConclusao: new Date(dto.dataConclusao),
          horasFormacao,
          avaliacao: dto.avaliacao,
          createdBy: user.sub,
        },
        include: INCLUDE_FORMACAO,
      });
      if (dto.avaliacao === AvaliacaoFormacao.APROVADO) {
        await this.aplicarNiveis(tx, colaboradorId, dto.formacaoId, user.sub);
      }
      return registo;
    });
    return criado;
  }

  async atualizar(colaboradorId: number, id: number, dto: UpdateFormacaoConcluidaDto, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const existente = await this.prisma.colaboradorFormacao.findFirst({ where: { id, colaboradorId } });
    if (!existente) {
      throw new NotFoundException(`Registo de formação concluída ${id} não encontrado para este colaborador.`);
    }

    const dados = {
      dataConclusao: dto.dataConclusao !== undefined ? new Date(dto.dataConclusao) : undefined,
      horasFormacao: dto.horasFormacao,
      avaliacao: dto.avaliacao,
      updatedBy: user.sub,
    };
    const novaAvaliacao = dto.avaliacao ?? existente.avaliacao;

    const atualizado = await this.prisma.runAsUser(user.sub, async (tx) => {
      const registo = await tx.colaboradorFormacao.update({ where: { id }, data: dados, include: INCLUDE_FORMACAO });
      if (novaAvaliacao === AvaliacaoFormacao.APROVADO) {
        await this.aplicarNiveis(tx, colaboradorId, existente.formacaoId, user.sub);
      }
      return registo;
    });
    return atualizado;
  }

  async eliminar(colaboradorId: number, id: number, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);
    const resultado = await this.prisma.runAsUser(user.sub, (tx) => tx.colaboradorFormacao.deleteMany({ where: { id, colaboradorId } }));
    if (resultado.count === 0) {
      throw new NotFoundException(`Registo de formação concluída ${id} não encontrado para este colaborador.`);
    }
    return { eliminado: true };
  }

  /** Aplica (só sobe) os níveis que esta Formação transmite — idempotente, seguro chamar em toda a gravação com avaliacao=APROVADO. */
  private async aplicarNiveis(tx: Prisma.TransactionClient, colaboradorId: number, formacaoId: number, userId: number) {
    const requisitos = await tx.formacaoRequisitoCompetencia.findMany({
      where: { formacaoId },
      select: { competenciaId: true, nivelId: true },
    });
    for (const r of requisitos) {
      await this.colaboradores.subirNivelSeSuperior(tx, colaboradorId, r.competenciaId, r.nivelId, OrigemAvaliacao.FORMACAO, userId);
    }
  }
}
