import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { AutoCriacaoService } from './auto-criacao.service';

@Module({
  controllers: [CatalogoController],
  providers: [CatalogoService, AutoCriacaoService],
  exports: [AutoCriacaoService],
})
export class CatalogoModule {}
