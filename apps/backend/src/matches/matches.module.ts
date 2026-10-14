import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
