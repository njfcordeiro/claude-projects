import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { GapAnalysisController } from './gap-analysis.controller';
import { DashboardController } from './dashboard.controller';
import { CandidatosController } from './candidatos.controller';
import { SkillMatrixController } from './skill-matrix.controller';
import { GapAnalysisService } from './gap-analysis.service';

@Module({
  imports: [ColaboradoresModule],
  controllers: [GapAnalysisController, DashboardController, CandidatosController, SkillMatrixController],
  providers: [GapAnalysisService],
  exports: [GapAnalysisService],
})
export class GapAnalysisModule {}
