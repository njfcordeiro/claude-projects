import { Injectable, NotFoundException } from '@nestjs/common';
import { OrigemPdi } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { GapAnalysisService } from '../gap-analysis/gap-analysis.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { UpdatePdiItemDto } from './dto/update-pdi-item.dto';

const INCLUDE_ITEM = {
  competencia: { select: { nome: true } },
  certificacao: { select: { nome: true } },
  formacao: { select: { nome: true, duracaoHoras: true } },
} as const;

interface CandidatoPdi {
  competenciaId: number | null;
  certificacaoId: string | null;
  formacaoId: number | null;
  descricao: string;
}

/**
 * PDI (Plano de Desenvolvimento Individual): as sugestões nunca duplicam a
 * lógica de comparação de gap — `gerar` reutiliza o motor já existente
 * (`GapAnalysisService.avaliarColaboradorCargo`/`avaliarColaboradorLob`,
 * que já traz as formações candidatas ordenadas em `sugestoes.formacoes`)
 * e só persiste um item de acompanhamento por gap encontrado. Chamar
 * `gerar` outra vez não duplica itens já existentes (mesma competência ou
 * certificação em falta), mesmo que ainda estejam pendentes.
 */
@Injectable()
export class PdiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
    private readonly gapAnalysis: GapAnalysisService,
  ) {}

  async listar(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);
    return this.prisma.pdiItem.findMany({
      where: { colaboradorId },
      include: INCLUDE_ITEM,
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async gerar(colaboradorId: number, user: AuthenticatedUser) {
    await this.colaboradores.podeEditar(colaboradorId, user);

    const gapCargo = await this.gapAnalysis.avaliarColaboradorCargo(colaboradorId, user);
    const lobsEmFalta = gapCargo.lobs.filter((l) => !l.atingido);

    const candidatos = new Map<string, CandidatoPdi>();
    for (const lobResumo of lobsEmFalta) {
      const detalhe = await this.gapAnalysis.avaliarColaboradorLob(colaboradorId, lobResumo.lobId, user);

      for (const c of detalhe.competencias) {
        if (c.cumprido) continue;
        const chave = `competencia:${c.competenciaId}`;
        if (candidatos.has(chave)) continue;
        candidatos.set(chave, {
          competenciaId: c.competenciaId,
          certificacaoId: null,
          formacaoId: c.sugestoes.formacoes[0]?.formacaoId ?? null,
          descricao: `Reforçar competência "${c.competenciaNome}" (nível atual ${c.nivelAtual} → exigido ${c.nivelExigido}) para a LOB "${detalhe.lobNome}".`,
        });
      }

      for (const cert of detalhe.certificacoes) {
        if (cert.cumprido) continue;
        const chave = `certificacao:${cert.certificacaoId}`;
        if (candidatos.has(chave)) continue;
        const formacaoSugerida = cert.preparacao.find((p) => p.formacoesRecomendadas.length > 0)?.formacoesRecomendadas[0];
        candidatos.set(chave, {
          competenciaId: null,
          certificacaoId: cert.certificacaoId,
          formacaoId: formacaoSugerida?.formacaoId ?? null,
          descricao: `Obter a certificação "${cert.certificacaoNome}" — exigida pela LOB "${detalhe.lobNome}".`,
        });
      }
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
}
