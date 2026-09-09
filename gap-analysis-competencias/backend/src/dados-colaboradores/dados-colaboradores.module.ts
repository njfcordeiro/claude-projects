import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { FormacoesConcluidasModule } from '../formacoes-concluidas/formacoes-concluidas.module';
import { DadosColaboradoresController } from './dados-colaboradores.controller';
import { DadosColaboradoresService } from './dados-colaboradores.service';

@Module({
  imports: [ColaboradoresModule, FormacoesConcluidasModule],
  controllers: [DadosColaboradoresController],
  providers: [DadosColaboradoresService],
})
export class DadosColaboradoresModule {}
