import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { GapAnalysisController } from './gap-analysis.controller';
import { DashboardController } from './dashboard.controller';
import { GapAnalysisService } from './gap-analysis.service';

@Module({
  imports: [ColaboradoresModule],
  controllers: [GapAnalysisController, DashboardController],
  providers: [GapAnalysisService],
})
export class GapAnalysisModule {}
