import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LobsService {
  constructor(private readonly prisma: PrismaService) {}

  /** nivelMinimoId (0-5) não tem FK formal — a escala é sempre a da Competência (ver comentário em schema.prisma, modelo Nivel). */
  private async nomesDeNiveis(): Promise<Map<string, string>> {
    const niveis = await this.prisma.nivel.findMany();
    return new Map(niveis.map((n) => [`${n.tipo}:${n.id}`, n.nome]));
  }

  async listar() {
    const lobs = await this.prisma.lob.findMany({
      include: {
        area: { select: { nome: true } },
        _count: { select: { requisitosCompetencia: true, requisitosCertificacao: true } },
      },
      orderBy: { nome: 'asc' },
    });
    return lobs.map((lob) => ({
      id: lob.id,
      nome: lob.nome,
      areaId: lob.areaId,
      areaNome: lob.area.nome,
      pontosMinimos: lob.pontosMinimos,
      totalRequisitosCompetencia: lob._count.requisitosCompetencia,
      totalRequisitosCertificacao: lob._count.requisitosCertificacao,
    }));
  }

  async obterDetalhe(id: number) {
    const [lob, nomesNiveis] = await Promise.all([
      this.prisma.lob.findUnique({
        where: { id },
        include: {
          area: { select: { nome: true } },
          requisitosCompetencia: {
            include: { competencia: { select: { nome: true, tipo: true } } },
            orderBy: { competencia: { nome: 'asc' } },
          },
          requisitosCertificacao: {
            include: { certificacao: { select: { nome: true } } },
            orderBy: { certificacao: { nome: 'asc' } },
          },
        },
      }),
      this.nomesDeNiveis(),
    ]);
    if (!lob) throw new NotFoundException(`LOB ${id} não encontrada.`);

    return {
      id: lob.id,
      nome: lob.nome,
      areaNome: lob.area.nome,
      pontosMinimos: lob.pontosMinimos,
      requisitosCompetencia: lob.requisitosCompetencia.map((r) => ({
        competenciaId: r.competenciaId,
        competenciaNome: r.competencia.nome,
        obrigatorio: r.obrigatorio,
        pontos: r.pontos,
        nivelMinimoId: r.nivelMinimoId,
        nivelMinimoNome: nomesNiveis.get(`${r.competencia.tipo}:${r.nivelMinimoId}`) ?? `Nível ${r.nivelMinimoId}`,
      })),
      requisitosCertificacao: lob.requisitosCertificacao.map((r) => ({
        certificacaoId: r.certificacaoId,
        certificacaoNome: r.certificacao.nome,
        obrigatorio: r.obrigatorio,
      })),
    };
  }
}
