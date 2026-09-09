import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { AtribuicoesController } from './atribuicoes.controller';
import { AtribuicoesService } from './atribuicoes.service';

@Module({
  imports: [ColaboradoresModule],
  controllers: [AtribuicoesController],
  providers: [AtribuicoesService],
})
export class AtribuicoesModule {}
