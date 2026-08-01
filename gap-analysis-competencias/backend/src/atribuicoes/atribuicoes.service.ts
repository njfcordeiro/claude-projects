import { Injectable } from '@nestjs/common';
import { OrigemAvaliacao, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AtribuirCompetenciaDto } from './dto/atribuir-competencia.dto';
import { AtribuirCertificacaoDto } from './dto/atribuir-certificacao.dto';

export interface ResumoAtribuicao {
  processados: number;
  criados: number;
  atualizados: number;
  erros: string[];
}

/**
 * Assistente de atribuição em massa (pedido do utilizador: "associar uma
 * ou várias competências/certificações a um ou vários colaboradores em
 * simultâneo"). Uma transação `runAsUser` por colaborador — se um id vier
 * inválido/duplicado, só essa linha falha, o resto do lote continua.
 */
@Injectable()
export class AtribuicoesService {
  constructor(private readonly prisma: PrismaService) {}

  async atribuirCompetencia(dto: AtribuirCompetenciaDto, user: AuthenticatedUser): Promise<ResumoAtribuicao> {
    const resumo: ResumoAtribuicao = { processados: dto.colaboradorIds.length, criados: 0, atualizados: 0, erros: [] };
    const dataAvaliacao = dto.dataAvaliacao ? new Date(dto.dataAvaliacao) : new Date();

    for (const colaboradorId of dto.colaboradorIds) {
      try {
        await this.prisma.runAsUser(user.sub, (tx) =>
          tx.colaboradorCompetencia.create({
            data: {
              colaboradorId,
              competenciaId: dto.competenciaId,
              nivelId: dto.nivelId,
              dataAvaliacao,
              avaliadoPor: user.sub,
              origem: OrigemAvaliacao.FORMAL,
            },
          }),
        );
        resumo.criados++;
      } catch (err) {
        resumo.erros.push(`Colaborador ${colaboradorId}: ${this.traduzirErro(err)}`);
      }
    }

    return resumo;
  }

  async atribuirCertificacao(dto: AtribuirCertificacaoDto, user: AuthenticatedUser): Promise<ResumoAtribuicao> {
    const resumo: ResumoAtribuicao = { processados: dto.colaboradorIds.length, criados: 0, atualizados: 0, erros: [] };
    const dados = {
      dataObtencao: dto.dataObtencao ? new Date(dto.dataObtencao) : undefined,
      dataValidade: dto.dataValidade ? new Date(dto.dataValidade) : undefined,
    };

    for (const colaboradorId of dto.colaboradorIds) {
      try {
        const existente = await this.prisma.colaboradorCertificacao.findUnique({
          where: { colaboradorId_certificacaoId: { colaboradorId, certificacaoId: dto.certificacaoId } },
        });

        if (existente) {
          await this.prisma.runAsUser(user.sub, (tx) =>
            tx.colaboradorCertificacao.update({
              where: { colaboradorId_certificacaoId: { colaboradorId, certificacaoId: dto.certificacaoId } },
              data: { ...dados, version: { increment: 1 } },
            }),
          );
          resumo.atualizados++;
        } else {
          await this.prisma.runAsUser(user.sub, (tx) =>
            tx.colaboradorCertificacao.create({
              data: { colaboradorId, certificacaoId: dto.certificacaoId, ...dados },
            }),
          );
          resumo.criados++;
        }
      } catch (err) {
        resumo.erros.push(`Colaborador ${colaboradorId}: ${this.traduzirErro(err)}`);
      }
    }

    return resumo;
  }

  private traduzirErro(err: unknown): string {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2003') return 'colaborador não encontrado ou item inválido.';
      if (err.code === 'P2002') return 'já tem este registo atribuído.';
    }
    return err instanceof Error ? err.message : 'erro desconhecido.';
  }
}
