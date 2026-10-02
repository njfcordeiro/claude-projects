import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { GapAnalysisModule } from '../gap-analysis/gap-analysis.module';
import { PdiController } from './pdi.controller';
import { PdiEmMassaController } from './pdi-em-massa.controller';
import { PdiService } from './pdi.service';
import { LobObjetivosController } from './lob-objetivos.controller';
import { LobObjetivosService } from './lob-objetivos.service';
import { ProximoCargoController } from './proximo-cargo.controller';
import { ProximoCargoService } from './proximo-cargo.service';

@Module({
  imports: [ColaboradoresModule, GapAnalysisModule],
  controllers: [PdiController, PdiEmMassaController, LobObjetivosController, ProximoCargoController],
  providers: [PdiService, LobObjetivosService, ProximoCargoService],
  exports: [ProximoCargoService],
})
export class PdiModule {}
