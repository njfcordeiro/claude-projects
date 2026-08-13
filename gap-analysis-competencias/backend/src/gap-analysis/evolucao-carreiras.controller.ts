import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { GapAnalysisService } from './gap-analysis.service';

/** Mapa de progressão de cargos entre carreiras — mesmo RBAC do Dashboard/Skill Matrix (ver GapAnalysisService.obterEvolucaoCarreiras). */
@ApiTags('gap-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gap-analysis/evolucao-carreiras')
export class EvolucaoCarreirasController {
  constructor(private readonly service: GapAnalysisService) {}

  @Get()
  obter(
    @Query('direcaoId') direcaoId: string | undefined,
    @Query('areaId') areaId: string | undefined,
    @Query('nucleoId') nucleoId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.obterEvolucaoCarreiras(
      {
        direcaoId: direcaoId ? Number(direcaoId) : undefined,
        areaId: areaId ? Number(areaId) : undefined,
        nucleoId: nucleoId ? Number(nucleoId) : undefined,
      },
      user,
    );
  }
}
