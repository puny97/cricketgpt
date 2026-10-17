import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
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

  async getScorecard(matchId: string) {
    const matchRows = await this.db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1);

    if (!matchRows[0]) {
      throw new NotFoundException(`Match with ID "${matchId}" was not found`);
    }

    const battingTeam = alias(schema.teams, 'batting_team');
    const batter = alias(schema.players, 'batter');
    const bowler = alias(schema.players, 'bowler');
    const dismissedPlayer = alias(schema.players, 'dismissed_player');

    const inningsRows = await this.db
      .select({
        id: schema.innings.id,
        inningsNumber: schema.innings.inningsNumber,
        isSuperOver: schema.innings.isSuperOver,
        battingTeam: battingTeam.name,
      })
      .from(schema.innings)
      .leftJoin(battingTeam, eq(schema.innings.battingTeamId, battingTeam.id))
      .where(eq(schema.innings.matchId, matchId))
      .orderBy(schema.innings.inningsNumber);

    const deliveryRows = await this.db
      .select({
        id: schema.deliveries.id,
        inningsId: schema.deliveries.inningsId,
        overNumber: schema.deliveries.overNumber,
        deliveryNumber: schema.deliveries.deliveryNumber,
        batterId: schema.deliveries.batterId,
        bowlerId: schema.deliveries.bowlerId,
        batterRuns: schema.deliveries.batterRuns,
        extrasRuns: schema.deliveries.extrasRuns,
        totalRuns: schema.deliveries.totalRuns,
        extras: schema.deliveries.extras,
        batterName: batter.fullName,
        bowlerName: bowler.fullName,
      })
      .from(schema.deliveries)
      .innerJoin(
        schema.innings,
        eq(schema.deliveries.inningsId, schema.innings.id),
      )
      .leftJoin(batter, eq(schema.deliveries.batterId, batter.id))
      .leftJoin(bowler, eq(schema.deliveries.bowlerId, bowler.id))
      .where(eq(schema.innings.matchId, matchId))
      .orderBy(schema.innings.inningsNumber, schema.deliveries.deliveryNumber);

    const wicketRows = await this.db
      .select({
        inningsId: schema.deliveries.inningsId,
        deliveryId: schema.deliveryWickets.deliveryId,
        playerOutId: schema.deliveryWickets.playerOutId,
        dismissalKind: schema.deliveryWickets.dismissalKind,
        playerOutName: dismissedPlayer.fullName,
      })
      .from(schema.deliveryWickets)
      .innerJoin(
        schema.deliveries,
        eq(schema.deliveryWickets.deliveryId, schema.deliveries.id),
      )
      .innerJoin(
        schema.innings,
        eq(schema.deliveries.inningsId, schema.innings.id),
      )
      .leftJoin(
        dismissedPlayer,
        eq(schema.deliveryWickets.playerOutId, dismissedPlayer.id),
      )
      .where(eq(schema.innings.matchId, matchId));

    const scorecards = inningsRows.map((inningsRow) => {
      const deliveries = deliveryRows.filter(
        (delivery) => delivery.inningsId === inningsRow.id,
      );

      const wickets = wicketRows.filter(
        (wicket) => wicket.inningsId === inningsRow.id,
      );

      const batting = new Map<
        string,
        {
          playerId: string;
          player: string;
          runs: number;
          balls: number;
          fours: number;
          sixes: number;
          dismissal: string | null;
        }
      >();

      const bowling = new Map<
        string,
        {
          playerId: string;
          player: string;
          runsConceded: number;
          legalBalls: number;
          maidens: number;
          wickets: number;
        }
      >();

      const overFigures = new Map<
        string,
        { legalBalls: number; runsConceded: number }
      >();

      const extras = {
        total: 0,
        wides: 0,
        noBalls: 0,
        byes: 0,
        legByes: 0,
        penalty: 0,
        other: 0,
      };

      let totalRuns = 0;
      let inningsLegalBalls = 0;

      for (const delivery of deliveries) {
        const deliveryExtras = delivery.extras;
        const wides = extraValue(deliveryExtras, 'wides');
        const noBalls = extraValue(deliveryExtras, 'noballs');
        const byes = extraValue(deliveryExtras, 'byes');
        const legByes = extraValue(deliveryExtras, 'legbyes');
        const penalty = extraValue(deliveryExtras, 'penalty');

        totalRuns += delivery.totalRuns;
        extras.total += delivery.extrasRuns;
        extras.wides += wides;
        extras.noBalls += noBalls;
        extras.byes += byes;
        extras.legByes += legByes;
        extras.penalty += penalty;
        extras.other += Math.max(
          0,
          delivery.extrasRuns - wides - noBalls - byes - legByes - penalty,
        );

        const batterId = delivery.batterId;
        const batterFigure = batting.get(batterId) ?? {
          playerId: batterId,
          player: delivery.batterName ?? 'Unknown player',
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          dismissal: null,
        };

        batterFigure.runs += delivery.batterRuns;

        // Wides do not count as balls faced. No-balls do.
        if (wides === 0) {
          batterFigure.balls += 1;
        }

        // Approximate boundary counts until non-boundary metadata is stored.
        if (delivery.batterRuns === 4) {
          batterFigure.fours += 1;
        }

        if (delivery.batterRuns === 6) {
          batterFigure.sixes += 1;
        }

        batting.set(batterId, batterFigure);

        const bowlerId = delivery.bowlerId;
        const bowlerFigure = bowling.get(bowlerId) ?? {
          playerId: bowlerId,
          player: delivery.bowlerName ?? 'Unknown player',
          runsConceded: 0,
          legalBalls: 0,
          maidens: 0,
          wickets: 0,
        };

        // Byes, leg-byes, and penalty extras are not charged
        // to the bowler.
        bowlerFigure.runsConceded += delivery.batterRuns + wides + noBalls;

        const isLegalDelivery = wides === 0 && noBalls === 0;

        const overKey = `${bowlerId}:${delivery.overNumber}`;
        const overFigure = overFigures.get(overKey) ?? {
          legalBalls: 0,
          runsConceded: 0,
        };

        overFigure.runsConceded += delivery.batterRuns + wides + noBalls;

        if (isLegalDelivery) {
          bowlerFigure.legalBalls += 1;
          inningsLegalBalls += 1;
          overFigure.legalBalls += 1;
        }

        overFigures.set(overKey, overFigure);
        bowling.set(bowlerId, bowlerFigure);
      }

      for (const [overKey, overFigure] of overFigures) {
        if (overFigure.legalBalls === 6 && overFigure.runsConceded === 0) {
          const bowlerId = overKey.split(':')[0];
          const figure = bowling.get(bowlerId);

          if (figure) {
            figure.maidens += 1;
          }
        }
      }

      let wicketsLost = 0;

      for (const wicket of wickets) {
        if (wicket.dismissalKind.toLowerCase() !== 'retired hurt') {
          wicketsLost += 1;
        }

        const dismissed = batting.get(wicket.playerOutId);

        if (dismissed) {
          dismissed.dismissal = wicket.dismissalKind;
        }

        if (isBowlerCreditedDismissal(wicket.dismissalKind)) {
          // Find the bowler who delivered the ball on which the
          // wicket fell.
          const delivery = deliveries.find(
            (item) => item.id === wicket.deliveryId,
          );

          if (delivery) {
            const figure = bowling.get(delivery.bowlerId);

            if (figure) {
              figure.wickets += 1;
            }
          }
        }
      }

      return {
        inningsNumber: inningsRow.inningsNumber,
        battingTeam: inningsRow.battingTeam,
        isSuperOver: inningsRow.isSuperOver,
        totalRuns,
        wickets: wicketsLost,
        legalBalls: inningsLegalBalls,
        overs: formatOvers(inningsLegalBalls),
        runRate:
          inningsLegalBalls > 0
            ? Number((totalRuns / (inningsLegalBalls / 6)).toFixed(2))
            : 0,
        extras,
        batting: [...batting.values()],
        bowling: [...bowling.values()].map((figure) => ({
          ...figure,
          overs: formatOvers(figure.legalBalls),
        })),
      };
    });

    return {
      matchId,
      innings: scorecards,
    };
  }

  async getDeliveries(
    matchId: string,
    inningsNumber: number,
    pageInput?: string,
    limitInput?: string,
  ) {
    const parsePositiveInteger = (
      value: string | undefined,
      defaultValue: number,
      field: string,
    ): number => {
      if (value === undefined) {
        return defaultValue;
      }

      if (!/^[1-9]\d*$/.test(value)) {
        throw new BadRequestException(`${field} must be a positive integer`);
      }

      const parsed = Number(value);

      if (!Number.isSafeInteger(parsed)) {
        throw new BadRequestException(
          `${field} is outside the supported range`,
        );
      }

      return parsed;
    };

    if (!Number.isSafeInteger(inningsNumber) || inningsNumber < 1) {
      throw new BadRequestException('inningsNumber must be a positive integer');
    }

    const page = parsePositiveInteger(pageInput, 1, 'page');
    const limit = parsePositiveInteger(limitInput, 20, 'limit');

    if (limit > 100) {
      throw new BadRequestException('limit cannot exceed 100');
    }

    // Confirm that the match exists.
    const matchRows = await this.db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1);

    if (!matchRows[0]) {
      throw new NotFoundException(`Match with ID "${matchId}" was not found`);
    }

    // Find the requested innings within this match.
    const inningsRows = await this.db
      .select({
        id: schema.innings.id,
        inningsNumber: schema.innings.inningsNumber,
        battingTeamId: schema.innings.battingTeamId,
        battingTeam: schema.teams.name,
        isSuperOver: schema.innings.isSuperOver,
      })
      .from(schema.innings)
      .leftJoin(schema.teams, eq(schema.innings.battingTeamId, schema.teams.id))
      .where(
        and(
          eq(schema.innings.matchId, matchId),
          eq(schema.innings.inningsNumber, inningsNumber),
        ),
      )
      .limit(1);

    const innings = inningsRows[0];

    if (!innings) {
      throw new NotFoundException(
        `Innings ${inningsNumber} was not found for match "${matchId}"`,
      );
    }

    const batter = alias(schema.players, 'delivery_batter');
    const bowler = alias(schema.players, 'delivery_bowler');
    const nonStriker = alias(schema.players, 'delivery_non_striker');

    const [countRows, deliveryRows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(schema.deliveries)
        .where(eq(schema.deliveries.inningsId, innings.id)),

      this.db
        .select({
          id: schema.deliveries.id,
          deliveryNumber: schema.deliveries.deliveryNumber,
          overNumber: schema.deliveries.overNumber,
          batterId: schema.deliveries.batterId,
          bowlerId: schema.deliveries.bowlerId,
          nonStrikerId: schema.deliveries.nonStrikerId,
          batter: batter.fullName,
          bowler: bowler.fullName,
          nonStriker: nonStriker.fullName,
          batterRuns: schema.deliveries.batterRuns,
          extrasRuns: schema.deliveries.extrasRuns,
          totalRuns: schema.deliveries.totalRuns,
          extras: schema.deliveries.extras,
        })
        .from(schema.deliveries)
        .leftJoin(batter, eq(schema.deliveries.batterId, batter.id))
        .leftJoin(bowler, eq(schema.deliveries.bowlerId, bowler.id))
        .leftJoin(nonStriker, eq(schema.deliveries.nonStrikerId, nonStriker.id))
        .where(eq(schema.deliveries.inningsId, innings.id))
        .orderBy(asc(schema.deliveries.deliveryNumber))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    const deliveryIds = deliveryRows.map((delivery) => delivery.id);

    // Query wickets only for the deliveries on this page.
    const wicketRows =
      deliveryIds.length > 0
        ? await this.db
            .select({
              deliveryId: schema.deliveryWickets.deliveryId,
              wicketNumber: schema.deliveryWickets.wicketNumber,
              playerOutId: schema.deliveryWickets.playerOutId,
              playerOut: schema.players.fullName,
              dismissalKind: schema.deliveryWickets.dismissalKind,
              fielders: schema.deliveryWickets.fielders,
            })
            .from(schema.deliveryWickets)
            .leftJoin(
              schema.players,
              eq(schema.deliveryWickets.playerOutId, schema.players.id),
            )
            .where(inArray(schema.deliveryWickets.deliveryId, deliveryIds))
            .orderBy(asc(schema.deliveryWickets.wicketNumber))
        : [];

    const wicketsByDelivery = new Map<string, typeof wicketRows>();

    for (const wicket of wicketRows) {
      const existing = wicketsByDelivery.get(wicket.deliveryId) ?? [];

      existing.push(wicket);
      wicketsByDelivery.set(wicket.deliveryId, existing);
    }

    const data = deliveryRows.map((delivery) => ({
      deliveryNumber: delivery.deliveryNumber,
      overNumber: delivery.overNumber,
      batter: {
        id: delivery.batterId,
        name: delivery.batter,
      },
      bowler: {
        id: delivery.bowlerId,
        name: delivery.bowler,
      },
      nonStriker: {
        id: delivery.nonStrikerId,
        name: delivery.nonStriker,
      },
      runs: {
        batter: delivery.batterRuns,
        extras: delivery.extrasRuns,
        total: delivery.totalRuns,
      },
      extras: delivery.extras,
      wickets: (wicketsByDelivery.get(delivery.id) ?? []).map((wicket) => ({
        wicketNumber: wicket.wicketNumber,
        playerOut: {
          id: wicket.playerOutId,
          name: wicket.playerOut,
        },
        dismissalKind: wicket.dismissalKind,
        fielders: wicket.fielders,
      })),
    }));

    const total = Number(countRows[0]?.total ?? 0);

    return {
      matchId,
      innings: {
        inningsNumber: innings.inningsNumber,
        battingTeam: innings.battingTeam,
        isSuperOver: innings.isSuperOver,
      },
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

function extraValue(extras: unknown, key: string): number {
  if (typeof extras !== 'object' || extras === null || Array.isArray(extras)) {
    return 0;
  }

  const value = (extras as Record<string, unknown>)[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isBowlerCreditedDismissal(kind: string): boolean {
  return [
    'bowled',
    'caught',
    'caught and bowled',
    'lbw',
    'stumped',
    'hit wicket',
    'hit the ball twice',
  ].includes(kind.toLowerCase());
}

function formatOvers(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}
