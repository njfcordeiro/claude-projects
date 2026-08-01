import { Module } from '@nestjs/common';
import { AtribuicoesController } from './atribuicoes.controller';
import { AtribuicoesService } from './atribuicoes.service';

@Module({
  controllers: [AtribuicoesController],
  providers: [AtribuicoesService],
})
export class AtribuicoesModule {}
