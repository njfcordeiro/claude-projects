import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ColaboradoresModule } from './colaboradores/colaboradores.module';
import { HealthModule } from './health/health.module';
import { GapAnalysisModule } from './gap-analysis/gap-analysis.module';
import { LobsModule } from './lobs/lobs.module';
import { FormacoesModule } from './formacoes/formacoes.module';
import { UsersModule } from './users/users.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { AtribuicoesModule } from './atribuicoes/atribuicoes.module';
import { PdiModule } from './pdi/pdi.module';
import { ProjetosModule } from './projetos/projetos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ColaboradoresModule,
    GapAnalysisModule,
    LobsModule,
    FormacoesModule,
    UsersModule,
    CatalogoModule,
    AtribuicoesModule,
    PdiModule,
    ProjetosModule,
    HealthModule,
  ],
})
export class AppModule {}
