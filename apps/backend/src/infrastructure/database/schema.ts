import { boolean, index, integer, jsonb } from 'drizzle-orm/pg-core';
import {
  pgTable,
  varchar,
  date,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// --------------------------------------------------
// Players
// Keep the existing Phase 2 columns.
// --------------------------------------------------

export const players = pgTable(
  'players',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    fullName: varchar('full_name', {
      length: 150,
    }).notNull(),

    country: varchar('country', {
      length: 100,
    }),

    playingRole: varchar('playing_role', {
      length: 50,
    }),

    dateOfBirth: date('date_of_birth'),

    sourcePlayerId: varchar('source_player_id', { length: 8 }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('players_source_player_id_unique').on(table.sourcePlayerId),
    index('players_full_name_idx').on(table.fullName),
  ],
);

// --------------------------------------------------
// Teams
// --------------------------------------------------

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    country: varchar('country', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex('teams_name_unique').on(table.name)],
);

// --------------------------------------------------
// Competitions
// --------------------------------------------------

export const competitions = pgTable(
  'competitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    season: varchar('season', { length: 30 }).notNull(),
    gender: varchar('gender', { length: 30 }),
    competitionType: varchar('competition_type', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('competitions_name_season_unique').on(
      table.name,
      table.season,
      table.gender,
    ),
  ],
);

// --------------------------------------------------
// Matches
// --------------------------------------------------

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    source: varchar('source', { length: 50 }).notNull().default('cricsheet'),

    sourceMatchId: varchar('source_match_id', { length: 200 }).notNull(),

    competitionId: uuid('competition_id').references(() => competitions.id, {
      onDelete: 'set null',
    }),

    matchType: varchar('match_type', { length: 30 }).notNull(),
    gender: varchar('gender', { length: 30 }),
    matchDate: date('match_date', { mode: 'string' }).notNull(),
    venue: varchar('venue', { length: 200 }),
    city: varchar('city', { length: 100 }),

    team1Id: uuid('team1_id')
      .notNull()
      .references(() => teams.id),
    team2Id: uuid('team2_id')
      .notNull()
      .references(() => teams.id),

    tossWinnerTeamId: uuid('toss_winner_team_id').references(() => teams.id, {
      onDelete: 'set null',
    }),
    tossDecision: varchar('toss_decision', { length: 30 }),

    winnerTeamId: uuid('winner_team_id').references(() => teams.id, {
      onDelete: 'set null',
    }),

    // Preserves result variants such as tie, no result,
    // D/L method and victory margin.
    outcome: jsonb('outcome').$type<Record<string, unknown>>(),

    // Can contain more than one award recipient.
    playerOfMatchNames: jsonb('player_of_match_names')
      .$type<string[]>()
      .notNull()
      .default([]),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('matches_source_identifier_unique').on(
      table.source,
      table.sourceMatchId,
    ),
    index('matches_date_idx').on(table.matchDate),
    index('matches_team1_date_idx').on(table.team1Id, table.matchDate),
    index('matches_team2_date_idx').on(table.team2Id, table.matchDate),
    index('matches_competition_idx').on(table.competitionId),
  ],
);

// --------------------------------------------------
// Match squads
// Players listed for a team in a particular match.
// --------------------------------------------------

export const matchSquads = pgTable(
  'match_squads',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),

    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),

    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('match_squads_unique').on(
      table.matchId,
      table.teamId,
      table.playerId,
    ),
    index('match_squads_player_idx').on(table.playerId),
  ],
);

// --------------------------------------------------
// Innings
// --------------------------------------------------

export const innings = pgTable(
  'innings',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),

    inningsNumber: integer('innings_number').notNull(),

    battingTeamId: uuid('batting_team_id')
      .notNull()
      .references(() => teams.id),

    isSuperOver: boolean('is_super_over').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('innings_match_number_unique').on(
      table.matchId,
      table.inningsNumber,
    ),
    index('innings_batting_team_idx').on(table.battingTeamId),
  ],
);

// --------------------------------------------------
// Deliveries
// One row per recorded delivery event.
// --------------------------------------------------

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    inningsId: uuid('innings_id')
      .notNull()
      .references(() => innings.id, { onDelete: 'cascade' }),

    // Sequential event number within the innings.
    deliveryNumber: integer('delivery_number').notNull(),

    // Zero-based over number follows the source data.
    overNumber: integer('over_number').notNull(),

    batterId: uuid('batter_id')
      .notNull()
      .references(() => players.id),

    bowlerId: uuid('bowler_id')
      .notNull()
      .references(() => players.id),

    nonStrikerId: uuid('non_striker_id')
      .notNull()
      .references(() => players.id),

    batterRuns: integer('batter_runs').notNull().default(0),
    extrasRuns: integer('extras_runs').notNull().default(0),
    totalRuns: integer('total_runs').notNull().default(0),

    // Examples: { wides: 1 }, { noballs: 1 }, { byes: 2 }.
    extras: jsonb('extras').$type<Record<string, number>>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('deliveries_innings_number_unique').on(
      table.inningsId,
      table.deliveryNumber,
    ),
    index('deliveries_batter_idx').on(table.batterId),
    index('deliveries_bowler_idx').on(table.bowlerId),
    index('deliveries_innings_over_idx').on(table.inningsId, table.overNumber),
  ],
);

// --------------------------------------------------
// Wickets
// A delivery may record multiple dismissals.
// --------------------------------------------------

export const deliveryWickets = pgTable(
  'delivery_wickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),

    wicketNumber: integer('wicket_number').notNull(),

    playerOutId: uuid('player_out_id')
      .notNull()
      .references(() => players.id),

    dismissalKind: varchar('dismissal_kind', { length: 50 }).notNull(),

    // Source names are retained for fielders without
    // requiring every fielder to be resolved immediately.
    fielders: jsonb('fielders').$type<string[]>().notNull().default([]),
  },
  (table) => [
    uniqueIndex('delivery_wickets_unique').on(
      table.deliveryId,
      table.wicketNumber,
    ),
    index('delivery_wickets_player_out_idx').on(table.playerOutId),
  ],
);
