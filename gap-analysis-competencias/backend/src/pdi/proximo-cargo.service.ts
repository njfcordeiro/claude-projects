import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ColaboradoresService } from '../colaboradores/colaboradores.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ProximoCargoCandidato, ProximoCargoResponse } from './proximo-cargo.types';
import { CargoComCategoriaOrdem, escolherMelhorProximoCargo } from './proximo-cargo.util';

/**
 * "Próximo Cargo" (pedido do utilizador) — mesmo princípio de LobObjetivosService
 * para "Próxima LOB": `auto` é sempre derivado ao vivo de CargoProgressao a
 * partir do cargo atual, nunca persistido; `manual` é um override opcional
 * (ColaboradorProximoCargo) que, uma vez definido, vence sempre `auto` em
 * `resolvido` — "se se alterar, o sistema não deve voltar a colocar o
 * [automático]" (pedido do utilizador).
 *
 * Quando o cargo atual tem mais que uma progressão possível em
 * CargoProgressao, `auto` escolhe entre os candidatos por esta ordem: (1) o
 * candidato cuja Categoria se chama "Principal" (pedido do utilizador: "no
 * caso dos seniores deve por defeito colocar principal"); (2) na ausência
 * de "Principal", o candidato cuja Categoria tem a menor `ordem` definida
 * (o próximo degrau mais próximo — ver Categoria.ordem,
 * EvolucaoCarreirasPage); (3) por fim, desempate determinístico por nome.
 */
@Injectable()
export class ProximoCargoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly colaboradores: ColaboradoresService,
  ) {}

  private async resolverAutoParaCargo(cargoAtualId: string): Promise<ProximoCargoCandidato | null> {
    const progressoes = await this.prisma.cargoProgressao.findMany({
      where: { cargoId: cargoAtualId },
      include: { proximoCargo: { include: { categoria: true } } },
    });
    return escolherMelhorProximoCargo(progressoes.map((p) => p.proximoCargo));
  }

  async obter(colaboradorId: number, user: AuthenticatedUser): Promise<ProximoCargoResponse> {
    const colaborador = await this.colaboradores.obterComVerificacaoDeAcesso(colaboradorId, user);
    const auto = colaborador.cargoId ? await this.resolverAutoParaCargo(colaborador.cargoId) : null;

    const overrideRow = await this.prisma.colaboradorProximoCargo.findUnique({ where: { colaboradorId }, include: { cargo: true } });
    const manual = overrideRow ? { cargoId: overrideRow.cargo.id, cargoNome: overrideRow.cargo.nome } : null;

    const resolvido = manual ? { ...manual, origem: 'MANUAL' as const } : auto ? { ...auto, origem: 'AUTO' as const } : null;
    return { auto, manual, resolvido };
  }

  async definir(colaboradorId: number, cargoId: string, user: AuthenticatedUser): Promise<ProximoCargoResponse> {
    await this.colaboradores.podeEditar(colaboradorId, user);
    const cargo = await this.prisma.cargo.findUnique({ where: { id: cargoId } });
    if (!cargo) throw new NotFoundException(`Cargo "${cargoId}" não encontrado.`);

    await this.prisma.runAsUser(user.sub, (tx) =>
      tx.colaboradorProximoCargo.upsert({
        where: { colaboradorId },
        create: { colaboradorId, cargoId, updatedBy: user.sub },
        update: { cargoId, updatedBy: user.sub },
      }),
    );
    return this.obter(colaboradorId, user);
  }

  /** Remove o override manual — volta a seguir `auto` a partir daqui. */
  async remover(colaboradorId: number, user: AuthenticatedUser): Promise<ProximoCargoResponse> {
    await this.colaboradores.podeEditar(colaboradorId, user);
    await this.prisma.runAsUser(user.sub, (tx) => tx.colaboradorProximoCargo.deleteMany({ where: { colaboradorId } }));
    return this.obter(colaboradorId, user);
  }

  /**
   * Versão em lote de `obter` (sem o RBAC de leitura por colaborador — o
   * chamador já tem de ter resolvido a lista de colaboradorIds visível ao
   * utilizador, ex. a lista filtrada de "Colaboradores") — usada pela
   * geração/eliminação de PDI em massa e pela tabela de PDI em Gestão de
   * Dados, para evitar N+1 queries por colaborador.
   */
  async resolverEmLote(colaboradorIds: number[]): Promise<Map<number, ProximoCargoResponse>> {
    const resultado = new Map<number, ProximoCargoResponse>();
    if (colaboradorIds.length === 0) return resultado;

    const colaboradores = await this.prisma.colaborador.findMany({
      where: { id: { in: colaboradorIds } },
      select: { id: true, cargoId: true },
    });
    const cargoIdsAtuais = Array.from(new Set(colaboradores.map((c) => c.cargoId).filter((v): v is string => v !== null)));
    const progressoes = await this.prisma.cargoProgressao.findMany({
      where: { cargoId: { in: cargoIdsAtuais } },
      include: { proximoCargo: { include: { categoria: true } } },
    });
    const candidatosPorCargoOrigem = new Map<string, CargoComCategoriaOrdem[]>();
    for (const p of progressoes) {
      if (!candidatosPorCargoOrigem.has(p.cargoId)) candidatosPorCargoOrigem.set(p.cargoId, []);
      candidatosPorCargoOrigem.get(p.cargoId)!.push(p.proximoCargo);
    }

    const overrides = await this.prisma.colaboradorProximoCargo.findMany({
      where: { colaboradorId: { in: colaboradorIds } },
      include: { cargo: true },
    });
    const overridePorColaborador = new Map(overrides.map((o) => [o.colaboradorId, { cargoId: o.cargo.id, cargoNome: o.cargo.nome }]));

    for (const c of colaboradores) {
      const auto = c.cargoId ? escolherMelhorProximoCargo(candidatosPorCargoOrigem.get(c.cargoId) ?? []) : null;
      const manual = overridePorColaborador.get(c.id) ?? null;
      const resolvido = manual ? { ...manual, origem: 'MANUAL' as const } : auto ? { ...auto, origem: 'AUTO' as const } : null;
      resultado.set(c.id, { auto, manual, resolvido });
    }
    return resultado;
  }
}
