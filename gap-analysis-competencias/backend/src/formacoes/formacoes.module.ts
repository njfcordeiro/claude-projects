import { Module } from '@nestjs/common';
import { FormacoesController } from './formacoes.controller';
import { FormacoesService } from './formacoes.service';

@Module({
  controllers: [FormacoesController],
  providers: [FormacoesService],
})
export class FormacoesModule {}
