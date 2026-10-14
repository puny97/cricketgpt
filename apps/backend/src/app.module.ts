import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { PlayersModule } from './players/players.module';
import { MatchesModule } from './matches/matches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HealthModule,
    PlayersModule,
    MatchesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
