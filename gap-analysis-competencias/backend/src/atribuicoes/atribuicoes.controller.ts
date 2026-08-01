import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PapelUtilizador } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AtribuicoesService } from './atribuicoes.service';
import { AtribuirCompetenciaDto } from './dto/atribuir-competencia.dto';
import { AtribuirCertificacaoDto } from './dto/atribuir-certificacao.dto';

/** Assistente de atribuição em massa — só ADMIN_RH (é uma ação de gestão de RH, não de equipa). */
@ApiTags('atribuicoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUtilizador.ADMIN_RH)
@Controller('atribuicoes')
export class AtribuicoesController {
  constructor(private readonly service: AtribuicoesService) {}

  @Post('competencias')
  atribuirCompetencia(@Body() dto: AtribuirCompetenciaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.atribuirCompetencia(dto, user);
  }

  @Post('certificacoes')
  atribuirCertificacao(@Body() dto: AtribuirCertificacaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.atribuirCertificacao(dto, user);
  }
}
