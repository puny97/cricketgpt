import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { alias } from 'drizzle-orm/pg-core';
import { DATABASE } from '../infrastructure/database/database.module';
import * as schema from '../infrastructure/database/schema';

type MatchQuery = {
  page?: string;
  limit?: string;
  matchType?: string;
  gender?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class MatchesService {
  constructor(
    @Inject(DATABASE)
    private readonly db: NodePgDatabase,
  ) {}

  async findAll(query: MatchQuery) {
    const page = this.parsePositiveInteger(query.page, 1, 'page');
    const limit = this.parsePositiveInteger(query.limit, 10, 'limit');

    if (limit > 100) {
      throw new BadRequestException('limit cannot exceed 100');
    }

    this.validateDate(query.from, 'from');
    this.validateDate(query.to, 'to');

    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }

    const conditions = [];

    if (query.matchType) {
      conditions.push(eq(schema.matches.matchType, query.matchType));
    }

    if (query.gender) {
      conditions.push(eq(schema.matches.gender, query.gender));
    }

    if (query.from) {
      conditions.push(gte(schema.matches.matchDate, query.from));
    }

    if (query.to) {
      conditions.push(lte(schema.matches.matchDate, query.to));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const team1 = alias(schema.teams, 'team1');
    const team2 = alias(schema.teams, 'team2');

    const [totalResult, data] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(schema.matches)
        .where(whereCondition),

      this.db
        .select({
          id: schema.matches.id,
          matchType: schema.matches.matchType,
          gender: schema.matches.gender,
          matchDate: schema.matches.matchDate,
          venue: schema.matches.venue,
          city: schema.matches.city,
          team1: team1.name,
          team2: team2.name,
          winnerTeamId: schema.matches.winnerTeamId,
          tossDecision: schema.matches.tossDecision,
          outcome: schema.matches.outcome,
        })
        .from(schema.matches)
        .leftJoin(team1, eq(schema.matches.team1Id, team1.id))
        .leftJoin(team2, eq(schema.matches.team2Id, team2.id))
        .where(whereCondition)
        .orderBy(desc(schema.matches.matchDate))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    const total = Number(totalResult[0]?.total ?? 0);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
    field: string,
  ): number {
    if (value === undefined) {
      return defaultValue;
    }

    if (!/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed)) {
      throw new BadRequestException(`${field} is outside the supported range`);
    }

    return parsed;
  }

  private validateDate(value: string | undefined, field: string): void {
    if (value === undefined) {
      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        `${field} must be a valid date in YYYY-MM-DD format`,
      );
    }
  }

  async findById(id: string) {
    const team1 = alias(schema.teams, 'team1');
    const team2 = alias(schema.teams, 'team2');
    const tossWinner = alias(schema.teams, 'toss_winnner');
    const matchWinner = alias(schema.teams, 'match_winnner');

    const rows = await this.db
      .select({
        id: schema.matches.id,
        source: schema.matches.source,
        sourceMatchId: schema.matches.sourceMatchId,
        matchType: schema.matches.matchType,
        gender: schema.matches.gender,
        matchDate: schema.matches.matchDate,
        venue: schema.matches.venue,
        city: schema.matches.city,

        team1: team1.name,
        team2: team2.name,

        competitionName: schema.competitions.name,
        competitionSeason: schema.competitions.season,

        tossWinner: tossWinner.name,
        tossDecision: schema.matches.tossDecision,

        winner: matchWinner.name,
        outcome: schema.matches.outcome,
        playerOfMatchNames: schema.matches.playerOfMatchNames,
      })
      .from(schema.matches)
      .leftJoin(team1, eq(schema.matches.team1Id, team1.id))
      .leftJoin(team2, eq(schema.matches.team2Id, team2.id))
      .leftJoin(tossWinner, eq(schema.matches.tossWinnerTeamId, tossWinner.id))
      .leftJoin(matchWinner, eq(schema.matches.winnerTeamId, matchWinner.id))
      .leftJoin(
        schema.competitions,
        eq(schema.matches.competitionId, schema.competitions.id),
      )
      .where(eq(schema.matches.id, id))
      .limit(1);

    const match = rows[0];

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    const {
      team1: team1Name,
      team2: team2Name,
      tossWinner: tossWinnerName,
      tossDecision,
      competitionName,
      competitionSeason,
      winner,
      outcome,
      ...details
    } = match;

    return {
      ...details,
      teams: {
        team1: team1Name,
        team2: team2Name,
      },
      competition: competitionName
        ? { name: competitionName, season: competitionSeason }
        : null,
      toss: {
        winner: tossWinnerName,
        decision: tossDecision,
      },
      result: {
        winner,
        outcome,
      },
    };
  }
}
