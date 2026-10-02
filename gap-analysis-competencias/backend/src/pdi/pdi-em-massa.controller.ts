import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PdiService } from './pdi.service';
import { GerarPdiEmMassaDto } from './dto/gerar-pdi-em-massa.dto';
import { EliminarPdiEmMassaDto } from './dto/eliminar-pdi-em-massa.dto';

/**
 * PDI em massa (pedido do utilizador, ecrã Colaboradores) — rotas à parte
 * de PdiController (`colaboradores/:id/pdi`) porque operam sobre uma lista
 * de colaboradores, não um só. Mesmo RBAC fino por colaborador
 * (ColaboradoresService.podeEditar, aplicado dentro de PdiService) — sem
 * @Roles aqui de propósito.
 */
@ApiTags('pdi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pdi')
export class PdiEmMassaController {
  constructor(private readonly service: PdiService) {}

  @Post('gerar-em-massa')
  gerarEmMassa(@Body() dto: GerarPdiEmMassaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.gerarEmMassa(dto, user);
  }

  @Post('eliminar-em-massa')
  eliminarEmMassa(@Body() dto: EliminarPdiEmMassaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.eliminarEmMassa(dto, user);
  }
}
