import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { GapAnalysisService } from './gap-analysis.service';

/** Mesmo RBAC do dashboard (ver GapAnalysisService.sugerirCandidatosCarreira) — EMPLOYEE sem acesso. */
@ApiTags('gap-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gap-analysis/candidatos')
export class CandidatosController {
  constructor(private readonly service: GapAnalysisService) {}

  @Get()
  sugerir(
    @Query('carreiraId') carreiraId: string | undefined,
    @Query('cargoId') cargoId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!carreiraId) {
      throw new BadRequestException('Parâmetro "carreiraId" é obrigatório.');
    }
    return this.service.sugerirCandidatosCarreira(carreiraId, cargoId, user);
  }
}
