import { BadRequestException, Controller, Get, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PapelUtilizador } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { FiltrosOrganizacionais } from '../gap-analysis/gap-analysis.types';
import { DadosColaboradoresService } from './dados-colaboradores.service';

function filtrosDe(direcaoId?: string, areaId?: string, nucleoId?: string, cargoId?: string): FiltrosOrganizacionais {
  return {
    direcaoId: direcaoId ? Number(direcaoId) : undefined,
    areaId: areaId ? Number(areaId) : undefined,
    nucleoId: nucleoId ? Number(nucleoId) : undefined,
    cargoId: cargoId || undefined,
  };
}

const LIMITE_FICHEIRO_BYTES = 10 * 1024 * 1024;

function ficheiroObrigatorio(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException('Nenhum ficheiro enviado (campo "file").');
  return file;
}

/**
 * Export/import em massa dos dados históricos/avaliação dos colaboradores
 * (pedido do utilizador, Gestão de Dados) — dados pessoais, por isso
 * ADMIN_RH only em toda a linha (leitura incluída), ao contrário do
 * catálogo genérico onde a leitura é aberta a qualquer papel autenticado.
 */
@ApiTags('dados-colaboradores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUtilizador.ADMIN_RH)
@Controller('dados-colaboradores')
export class DadosColaboradoresController {
  constructor(private readonly service: DadosColaboradoresService) {}

  @Get('competencias-tecnicas')
  listarCompetenciasTecnicas(
    @Query('direcaoId') direcaoId: string | undefined,
    @Query('areaId') areaId: string | undefined,
    @Query('nucleoId') nucleoId: string | undefined,
    @Query('cargoId') cargoId: string | undefined,
  ) {
    return this.service.listarCompetencias('TECNICA', filtrosDe(direcaoId, areaId, nucleoId, cargoId));
  }

  @Get('competencias-tecnicas/export')
  async exportarCompetenciasTecnicas(@Res() res: Response) {
    const buffer = await this.service.exportarCompetencias('TECNICA');
    res
      .set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="competencias-tecnicas.xlsx"' })
      .send(buffer);
  }

  @Post('competencias-tecnicas/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_FICHEIRO_BYTES } }))
  importarCompetenciasTecnicas(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.importarCompetencias('TECNICA', ficheiroObrigatorio(file).buffer, user);
  }

  @Get('competencias-comportamentais')
  listarCompetenciasComportamentais(
    @Query('direcaoId') direcaoId: string | undefined,
    @Query('areaId') areaId: string | undefined,
    @Query('nucleoId') nucleoId: string | undefined,
    @Query('cargoId') cargoId: string | undefined,
  ) {
    return this.service.listarCompetencias('COMPORTAMENTAL', filtrosDe(direcaoId, areaId, nucleoId, cargoId));
  }

  @Get('competencias-comportamentais/export')
  async exportarCompetenciasComportamentais(@Res() res: Response) {
    const buffer = await this.service.exportarCompetencias('COMPORTAMENTAL');
    res
      .set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="competencias-comportamentais.xlsx"' })
      .send(buffer);
  }

  @Post('competencias-comportamentais/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_FICHEIRO_BYTES } }))
  importarCompetenciasComportamentais(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.importarCompetencias('COMPORTAMENTAL', ficheiroObrigatorio(file).buffer, user);
  }

  @Get('certificacoes')
  listarCertificacoes(
    @Query('direcaoId') direcaoId: string | undefined,
    @Query('areaId') areaId: string | undefined,
    @Query('nucleoId') nucleoId: string | undefined,
    @Query('cargoId') cargoId: string | undefined,
  ) {
    return this.service.listarCertificacoes(filtrosDe(direcaoId, areaId, nucleoId, cargoId));
  }

  @Get('certificacoes/export')
  async exportarCertificacoes(@Res() res: Response) {
    const buffer = await this.service.exportarCertificacoes();
    res
      .set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="certificacoes-colaboradores.xlsx"' })
      .send(buffer);
  }

  @Post('certificacoes/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_FICHEIRO_BYTES } }))
  importarCertificacoes(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.importarCertificacoes(ficheiroObrigatorio(file).buffer, user);
  }

  @Get('formacoes-concluidas')
  listarFormacoesConcluidas(
    @Query('direcaoId') direcaoId: string | undefined,
    @Query('areaId') areaId: string | undefined,
    @Query('nucleoId') nucleoId: string | undefined,
    @Query('cargoId') cargoId: string | undefined,
  ) {
    return this.service.listarFormacoesConcluidas(filtrosDe(direcaoId, areaId, nucleoId, cargoId));
  }

  @Get('formacoes-concluidas/export')
  async exportarFormacoesConcluidas(@Res() res: Response) {
    const buffer = await this.service.exportarFormacoesConcluidas();
    res
      .set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="historico-formacao.xlsx"' })
      .send(buffer);
  }

  @Post('formacoes-concluidas/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_FICHEIRO_BYTES } }))
  importarFormacoesConcluidas(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.importarFormacoesConcluidas(ficheiroObrigatorio(file).buffer, user);
  }
}
