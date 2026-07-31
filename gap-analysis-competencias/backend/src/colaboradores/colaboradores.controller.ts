import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PapelUtilizador } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ColaboradoresService } from './colaboradores.service';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';

@ApiTags('colaboradores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colaboradores')
export class ColaboradoresController {
  constructor(private readonly service: ColaboradoresService) {}

  @Get('me')
  meuPerfil(@CurrentUser() user: AuthenticatedUser) {
    return this.service.meuPerfil(user);
  }

  @Roles(PapelUtilizador.ADMIN_RH, PapelUtilizador.VIEWER)
  @Get()
  listar(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.service.listar(skip ? Number(skip) : undefined, take ? Number(take) : undefined);
  }

  // Sem @Roles aqui de propósito — a restrição fina (gestor só vê a sua
  // equipa, colaborador só se vê a si) vive no service, não no guard.
  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.obterComVerificacaoDeAcesso(id, user);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateColaboradorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.atualizar(id, dto, user);
  }
}
