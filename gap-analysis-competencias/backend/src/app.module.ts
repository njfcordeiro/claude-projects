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
    HealthModule,
  ],
})
export class AppModule {}
