import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FormacoesService {
  constructor(private readonly prisma: PrismaService) {}

  /** nivelId (0-5) não tem FK formal — a escala é sempre a da Competência (ver comentário em schema.prisma, modelo Nivel). */
  private async nomesDeNiveis(): Promise<Map<string, string>> {
    const niveis = await this.prisma.nivel.findMany();
    return new Map(niveis.map((n) => [`${n.tipo}:${n.id}`, n.nome]));
  }

  async listar() {
    const formacoes = await this.prisma.formacao.findMany({
      include: {
        area: { select: { nome: true } },
        requisitosCompetencia: { include: { competencia: { select: { nome: true } } } },
      },
      orderBy: { nome: 'asc' },
    });
    return formacoes.map((f) => ({
      id: f.id,
      nome: f.nome,
      areaNome: f.area.nome,
      duracaoHoras: f.duracaoHoras,
      competenciasDesenvolvidas: f.requisitosCompetencia.map((r) => r.competencia.nome),
    }));
  }

  async obterDetalhe(id: number) {
    const [formacao, nomesNiveis] = await Promise.all([
      this.prisma.formacao.findUnique({
        where: { id },
        include: {
          area: { select: { nome: true } },
          requisitosCompetencia: {
            include: { competencia: { select: { nome: true, tipo: true } } },
            orderBy: { competencia: { nome: 'asc' } },
          },
        },
      }),
      this.nomesDeNiveis(),
    ]);
    if (!formacao) throw new NotFoundException(`Formação ${id} não encontrada.`);

    return {
      id: formacao.id,
      nome: formacao.nome,
      areaNome: formacao.area.nome,
      duracaoHoras: formacao.duracaoHoras,
      requisitosCompetencia: formacao.requisitosCompetencia.map((r) => ({
        competenciaId: r.competenciaId,
        competenciaNome: r.competencia.nome,
        nivelId: r.nivelId,
        nivelNome: nomesNiveis.get(`${r.competencia.tipo}:${r.nivelId}`) ?? `Nível ${r.nivelId}`,
      })),
    };
  }
}
