import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrigemPdi } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { GapAnalysisService } from '../gap-analysis/gap-analysis.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CreatePdiItemDto } from './dto/create-pdi-item.dto';
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
 *
 * Pedido do utilizador: as sugestões automáticas visam sempre UMA única
 * LOB por chamada a `gerar` (nunca várias LOBs misturadas) — a "Próxima
 * LOB" do colaborador se estiver preenchida, senão a LOB da própria Área
 * do colaborador em que está mais perto de atingir (maior prontidão,
 * ainda não atingida).
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
    const colaborador = await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);

    const gapCargo = await this.gapAnalysis.avaliarColaboradorCargo(colaboradorId, user);

    const lobAlvo =
      colaborador.proximaLobId !== null
        ? gapCargo.lobs.find((l) => l.lobId === colaborador.proximaLobId)
        : gapCargo.lobs
            .filter((l) => l.areaId === colaborador.areaId && !l.atingido)
            .sort((a, b) => b.prontidaoPercentual - a.prontidaoPercentual)[0];

    const candidatos = new Map<string, CandidatoPdi>();
    if (lobAlvo) {
      const detalhe = await this.gapAnalysis.avaliarColaboradorLob(colaboradorId, lobAlvo.lobId, user);

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
}
