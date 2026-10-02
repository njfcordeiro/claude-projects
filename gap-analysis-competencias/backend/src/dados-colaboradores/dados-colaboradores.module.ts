import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { FormacoesConcluidasModule } from '../formacoes-concluidas/formacoes-concluidas.module';
import { PdiModule } from '../pdi/pdi.module';
import { GapAnalysisModule } from '../gap-analysis/gap-analysis.module';
import { DadosColaboradoresController } from './dados-colaboradores.controller';
import { DadosColaboradoresService } from './dados-colaboradores.service';

@Module({
  imports: [ColaboradoresModule, FormacoesConcluidasModule, PdiModule, GapAnalysisModule],
  controllers: [DadosColaboradoresController],
  providers: [DadosColaboradoresService],
})
export class DadosColaboradoresModule {}
