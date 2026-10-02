import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ProximoCargoService } from './proximo-cargo.service';
import { DefinirProximoCargoDto } from './dto/definir-proximo-cargo.dto';

/**
 * Próximo Cargo (auto ao vivo via CargoProgressao + override manual) — mesmo
 * RBAC fino de leitura/escrita da ficha do colaborador: sem @Roles aqui de
 * propósito, a restrição vive no service (ColaboradoresService.podeEditar).
 */
@ApiTags('pdi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colaboradores/:id/proximo-cargo')
export class ProximoCargoController {
  constructor(private readonly service: ProximoCargoService) {}

  @Get()
  obter(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.obter(id, user);
  }

  @Put()
  definir(@Param('id', ParseIntPipe) id: number, @Body() dto: DefinirProximoCargoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.definir(id, dto.cargoId, user);
  }

  @Delete()
  remover(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remover(id, user);
  }
}
