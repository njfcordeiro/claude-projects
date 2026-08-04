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
import { GapAnalysisService } from './gap-analysis.service';
import { DimensaoSkillMatrix } from './gap-analysis.types';

const LIMITE_FICHEIRO_BYTES = 10 * 1024 * 1024;

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

  @Get('export')
  async exportar(
    @Query('direcaoId') direcaoId: string | undefined,
    @Query('areaId') areaId: string | undefined,
    @Query('nucleoId') nucleoId: string | undefined,
    @Query('cargoId') cargoId: string | undefined,
    @Query('competenciaIds') competenciaIds: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    // @Res() sem passthrough — ver comentário equivalente em CatalogoController.exportar.
    const buffer = await this.service.exportarNiveisCompetencia(
      {
        direcaoId: direcaoId ? Number(direcaoId) : undefined,
        areaId: areaId ? Number(areaId) : undefined,
        nucleoId: nucleoId ? Number(nucleoId) : undefined,
        cargoId: cargoId || undefined,
      },
      competenciaIds
        ? competenciaIds
            .split(',')
            .map((v) => Number(v.trim()))
            .filter((v) => !Number.isNaN(v))
        : undefined,
      user,
    );
    res
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="niveis-competencia.xlsx"',
      })
      .send(buffer);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_FICHEIRO_BYTES } }))
  importar(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!file) {
      throw new BadRequestException('Nenhum ficheiro enviado (campo "file").');
    }
    return this.service.importarNiveisCompetencia(file.buffer, user);
  }
}
