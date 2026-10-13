import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../infrastructure/database/database.module';
import { players } from '../infrastructure/database/schema';
import { asc } from 'drizzle-orm';

@Injectable()
export class PlayersService {
  constructor(@Inject(DATABASE) private readonly db: any) {}

  async getAllPlayers() {
    const results = await this.db
      .select()
      .from(players)
      .orderBy(asc(players.fullName))
      .limit(20);
    return results;
  }
}
