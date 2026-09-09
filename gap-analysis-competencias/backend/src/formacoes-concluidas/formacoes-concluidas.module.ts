import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { FormacoesConcluidasController } from './formacoes-concluidas.controller';
import { FormacoesConcluidasService } from './formacoes-concluidas.service';

@Module({
  imports: [ColaboradoresModule],
  controllers: [FormacoesConcluidasController],
  providers: [FormacoesConcluidasService],
})
export class FormacoesConcluidasModule {}
