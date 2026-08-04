import { Module } from '@nestjs/common';
import { ColaboradoresModule } from '../colaboradores/colaboradores.module';
import { ProjetosController, ProjetoCatalogoController } from './projetos.controller';
import { ProjetosService } from './projetos.service';

@Module({
  imports: [ColaboradoresModule],
  controllers: [ProjetosController, ProjetoCatalogoController],
  providers: [ProjetosService],
})
export class ProjetosModule {}
