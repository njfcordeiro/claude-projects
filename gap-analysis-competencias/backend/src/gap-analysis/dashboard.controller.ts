import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { GapAnalysisService } from './gap-analysis.service';

/**
 * Vista de equipa/organização — separada de /gap-analysis/colaboradores/*
 * porque o RBAC é diferente (EMPLOYEE não tem acesso, ver
 * GapAnalysisService.obterDashboard).
 */
@ApiTags('gap-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gap-analysis/dashboard')
export class DashboardController {
  constructor(private readonly service: GapAnalysisService) {}

  @Get()
  obter(@CurrentUser() user: AuthenticatedUser) {
    return this.service.obterDashboard(user);
  }
}
