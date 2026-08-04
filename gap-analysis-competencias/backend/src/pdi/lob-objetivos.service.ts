import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { GapAnalysisService } from '../gap-analysis/gap-analysis.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ObjetivoLob, ObjetivosLobResponse } from './lob-objetivos.types';

const MAX_OBJETIVOS_AUTO = 3;

/**
 * "Objetivos de LOB" pedidos pelo utilizador — duas origens que alimentam o
 * PDI (ver PdiService.gerar): até 3 sugestões automáticas (LOBs da área do
 * colaborador, ainda não atingidas, pela maior % de prontidão) sempre
 * calculadas ao vivo a partir do motor de gap existente — nunca
 * persistidas, por isso nunca ficam desatualizadas; e recomendações
 * manuais do BUD (o gestor direto do colaborador, ou ADMIN_RH — mesmo RBAC
 * de escrita do resto da ficha, ver ColaboradoresService.podeEditar),
 * persistidas na tabela `ColaboradorLobRecomendacao` já existente no
 * schema (campo `bud`), sem limite de quantidade e sem restrição de Área
 * (o BUD pode querer desenvolver alguém numa área nova).
 */
@Injectable()
export class LobObjetivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
    private readonly gapAnalysis: GapAnalysisService,
  ) {}

  async listar(colaboradorId: number, user: AuthenticatedUser): Promise<ObjetivosLobResponse> {
    const colaborador = await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);
    const gapCargo = await this.gapAnalysis.avaliarColaboradorCargo(colaboradorId, user);

    const auto: ObjetivoLob[] = gapCargo.lobs
      .filter((l) => l.areaId === colaborador.areaId && !l.atingido)
      .sort((a, b) => b.prontidaoPercentual - a.prontidaoPercentual)
      .slice(0, MAX_OBJETIVOS_AUTO)
      .map((l) => ({ lobId: l.lobId, lobNome: l.lobNome, areaId: l.areaId, areaNome: l.areaNome, prontidaoPercentual: l.prontidaoPercentual }));

    const budRows = await this.prisma.colaboradorLobRecomendacao.findMany({
      where: { colaboradorId, bud: true },
      orderBy: { createdAt: 'asc' },
    });
    const bud: ObjetivoLob[] = budRows.map((r) => {
      const lobGap = gapCargo.lobs.find((l) => l.lobId === r.lobId);
      return {
        lobId: r.lobId,
        lobNome: lobGap?.lobNome ?? `LOB ${r.lobId}`,
        areaId: lobGap?.areaId ?? 0,
        areaNome: lobGap?.areaNome ?? '',
        prontidaoPercentual: lobGap?.prontidaoPercentual ?? 0,
      };
    });

    return { auto, bud };
  }

  async adicionar(colaboradorId: number, lobId: number, user: AuthenticatedUser): Promise<ObjetivosLobResponse> {
    await this.colaboradores.podeEditar(colaboradorId, user);
    const lob = await this.prisma.lob.findUnique({ where: { id: lobId } });
    if (!lob) throw new NotFoundException(`LOB ${lobId} não encontrada.`);

    await this.prisma.runAsUser(user.sub, (tx) =>
      tx.colaboradorLobRecomendacao.upsert({
        where: { colaboradorId_lobId: { colaboradorId, lobId } },
        create: { colaboradorId, lobId, bud: true },
        update: { bud: true },
      }),
    );
    return this.listar(colaboradorId, user);
  }

  async remover(colaboradorId: number, lobId: number, user: AuthenticatedUser): Promise<ObjetivosLobResponse> {
    await this.colaboradores.podeEditar(colaboradorId, user);
    await this.prisma.runAsUser(user.sub, (tx) => tx.colaboradorLobRecomendacao.deleteMany({ where: { colaboradorId, lobId } }));
    return this.listar(colaboradorId, user);
  }

  /** União auto+bud sem duplicados — usada pelo PdiService para gerar sugestões a partir de todos os objetivos ativos, não só de uma LOB. */
  async listarLobsAlvo(colaboradorId: number, user: AuthenticatedUser): Promise<ObjetivoLob[]> {
    const { auto, bud } = await this.listar(colaboradorId, user);
    const mapa = new Map<number, ObjetivoLob>();
    for (const o of [...auto, ...bud]) mapa.set(o.lobId, o);
    return Array.from(mapa.values());
  }
}
