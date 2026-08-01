import { Module } from '@nestjs/common';
import { LobsController } from './lobs.controller';
import { LobsService } from './lobs.service';

@Module({
  controllers: [LobsController],
  providers: [LobsService],
})
export class LobsModule {}
