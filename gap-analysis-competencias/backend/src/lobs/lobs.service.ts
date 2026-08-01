import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LobsService {
  constructor(private readonly prisma: PrismaService) {}

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
      areaNome: lob.area.nome,
      pontosMinimos: lob.pontosMinimos,
      totalRequisitosCompetencia: lob._count.requisitosCompetencia,
      totalRequisitosCertificacao: lob._count.requisitosCertificacao,
    }));
  }

  async obterDetalhe(id: number) {
    const lob = await this.prisma.lob.findUnique({
      where: { id },
      include: {
        area: { select: { nome: true } },
        requisitosCompetencia: {
          include: { competencia: { select: { nome: true } }, nivelMinimo: { select: { nome: true } } },
          orderBy: { competencia: { nome: 'asc' } },
        },
        requisitosCertificacao: {
          include: { certificacao: { select: { nome: true } } },
          orderBy: { certificacao: { nome: 'asc' } },
        },
      },
    });
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
        nivelMinimoNome: r.nivelMinimo.nome,
      })),
      requisitosCertificacao: lob.requisitosCertificacao.map((r) => ({
        certificacaoId: r.certificacaoId,
        certificacaoNome: r.certificacao.nome,
        obrigatorio: r.obrigatorio,
      })),
    };
  }
}
