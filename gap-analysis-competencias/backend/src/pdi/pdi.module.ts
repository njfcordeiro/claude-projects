import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { GapAnalysisModule } from '../gap-analysis/gap-analysis.module';
import { PdiController } from './pdi.controller';
import { PdiService } from './pdi.service';
import { LobObjetivosController } from './lob-objetivos.controller';
import { LobObjetivosService } from './lob-objetivos.service';

@Module({
  imports: [ColaboradoresModule, GapAnalysisModule],
  controllers: [PdiController, LobObjetivosController],
  providers: [PdiService, LobObjetivosService],
})
export class PdiModule {}
