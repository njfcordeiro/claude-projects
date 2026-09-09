import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { GapAnalysisService } from './gap-analysis.service';

/**
 * RBAC igual ao de /colaboradores/:id (docs/02-arquitetura-tecnica.md
 * secção 4.3): sem @Roles aqui de propósito — a restrição fina (gestor só
 * vê a sua equipa, colaborador só se vê a si) vive no
 * ColaboradoresService.obterComVerificacaoDeAcesso, chamado pelo
 * GapAnalysisService antes de calcular seja o que for.
 */
@ApiTags('gap-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gap-analysis/colaboradores/:colaboradorId')
export class GapAnalysisController {
  constructor(private readonly service: GapAnalysisService) {}

  @Get('lobs/:lobId')
  avaliarLob(
    @Param('colaboradorId', ParseIntPipe) colaboradorId: number,
    @Param('lobId', ParseIntPipe) lobId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.avaliarColaboradorLob(colaboradorId, lobId, user);
  }

  @Get('cargo')
  avaliarCargo(@Param('colaboradorId', ParseIntPipe) colaboradorId: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.avaliarColaboradorCargo(colaboradorId, user);
  }

  @Get('competencias-comportamentais')
  obterCompetenciasComportamentais(@Param('colaboradorId', ParseIntPipe) colaboradorId: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.obterCompetenciasComportamentais(colaboradorId, user);
  }

  /**
   * Perfil de Competências Comportamentais de um Cargo à escolha (pedido
   * do utilizador) — mesmo motor que PdiService.gerarParaCargoAtual/
   * ...ProximoCargo já usa internamente, agora exposto para qualquer
   * Cargo, não só o atual/próximo do colaborador (ver
   * PerfilCargoComportamentalSection no frontend).
   */
  @Get('perfil-cargo/:cargoId')
  avaliarPerfilCargo(
    @Param('colaboradorId', ParseIntPipe) colaboradorId: number,
    @Param('cargoId') cargoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.avaliarColaboradorPerfilCargo(colaboradorId, cargoId, user);
  }
}
