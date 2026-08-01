import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { GapAnalysisService } from './gap-analysis.service';
import { DimensaoSkillMatrix } from './gap-analysis.types';

/** Heatmap colaboradores × LOBs/competências — mesmo RBAC do dashboard (ver GapAnalysisService.obterSkillMatrix). */
@ApiTags('gap-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gap-analysis/skill-matrix')
export class SkillMatrixController {
  constructor(private readonly service: GapAnalysisService) {}

  @Get()
  obter(
    @Query('dimensao') dimensao: DimensaoSkillMatrix | undefined,
    @Query('direcaoId') direcaoId: string | undefined,
    @Query('areaId') areaId: string | undefined,
    @Query('nucleoId') nucleoId: string | undefined,
    @Query('cargoId') cargoId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.obterSkillMatrix(
      dimensao === 'competencia' ? 'competencia' : 'lob',
      {
        direcaoId: direcaoId ? Number(direcaoId) : undefined,
        areaId: areaId ? Number(areaId) : undefined,
        nucleoId: nucleoId ? Number(nucleoId) : undefined,
        cargoId: cargoId || undefined,
      },
      user,
    );
  }
}
