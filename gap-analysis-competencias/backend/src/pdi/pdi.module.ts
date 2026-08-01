import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { GapAnalysisModule } from '../gap-analysis/gap-analysis.module';
import { PdiController } from './pdi.controller';
import { PdiService } from './pdi.service';

@Module({
  imports: [ColaboradoresModule, GapAnalysisModule],
  controllers: [PdiController],
  providers: [PdiService],
})
export class PdiModule {}
