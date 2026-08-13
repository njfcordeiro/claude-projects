import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PapelUtilizador } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { GapAnalysisService } from './gap-analysis.service';
import { UpdateConfiguracaoProntidaoDto } from './dto/update-configuracao-prontidao.dto';

/**
 * Pesos globais do cálculo de prontidão (ver gap-analysis.logic.ts
 * calcularGapLob) — leitura aberta a qualquer papel autenticado (o ecrã
 * "Como Funciona" mostra a fórmula a todos), escrita restrita a ADMIN_RH,
 * mesmo padrão misto de catalogo.controller.ts.
 */
@ApiTags('gap-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gap-analysis/configuracao-prontidao')
export class ConfiguracaoProntidaoController {
  constructor(private readonly service: GapAnalysisService) {}

  @Get()
  obter() {
    return this.service.obterConfiguracaoProntidao();
  }

  @Patch()
  @Roles(PapelUtilizador.ADMIN_RH)
  atualizar(@Body() dto: UpdateConfiguracaoProntidaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.atualizarConfiguracaoProntidao(dto, user);
  }
}
