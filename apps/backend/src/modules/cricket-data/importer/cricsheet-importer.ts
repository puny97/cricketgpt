import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '../../../infrastructure/database/schema';
import type { CricsheetMatch } from '../schemas/cricsheet-match.schema';

const SOURCE = 'cricsheet';

type Database = NodePgDatabase;

export async function importCricsheetMatch(
  db: Database,
  match: CricsheetMatch,
  sourceMatchId: string,
) {
  return db.transaction(async (tx) => {
    // Resolve or create a team using its source name.
    async function ensureTeam(name: string): Promise<string> {
      const existing = await tx
        .select({ id: schema.teams.id })
        .from(schema.teams)
        .where(eq(schema.teams.name, name))
        .limit(1);

      if (existing[0]) return existing[0].id;

      const inserted = await tx
        .insert(schema.teams)
        .values({ name })
        .onConflictDoNothing({ target: schema.teams.name })
        .returning({ id: schema.teams.id });

      if (inserted[0]) return inserted[0].id;

      const raced = await tx
        .select({ id: schema.teams.id })
        .from(schema.teams)
        .where(eq(schema.teams.name, name))
        .limit(1);

      if (!raced[0]) {
        throw new Error(`Unable to resolve team: ${name}`);
      }

      return raced[0].id;
    }

    // Resolve a player using Cricsheet's registry ID where possible.
    async function ensurePlayer(name: string): Promise<string> {
      const registryId = match.info.registry?.people?.[name];

      if (registryId) {
        const existing = await tx
          .select({ id: schema.players.id })
          .from(schema.players)
          .where(eq(schema.players.sourcePlayerId, registryId))
          .limit(1);

        if (existing[0]) return existing[0].id;

        const inserted = await tx
          .insert(schema.players)
          .values({
            fullName: name,
            sourcePlayerId: registryId,
          })
          .onConflictDoNothing({
            target: schema.players.sourcePlayerId,
          })
          .returning({ id: schema.players.id });

        if (inserted[0]) return inserted[0].id;

        const raced = await tx
          .select({ id: schema.players.id })
          .from(schema.players)
          .where(eq(schema.players.sourcePlayerId, registryId))
          .limit(1);

        if (raced[0]) return raced[0].id;
      }

      // Fallback for players without a registry identifier.
      // A future source-alias table can improve identity resolution.
      const existingByName = await tx
        .select({ id: schema.players.id })
        .from(schema.players)
        .where(eq(schema.players.fullName, name))
        .limit(1);

      if (existingByName[0]) return existingByName[0].id;

      const insertedByName = await tx
        .insert(schema.players)
        .values({ fullName: name })
        .returning({ id: schema.players.id });

      if (!insertedByName[0]) {
        throw new Error(`Unable to resolve player: ${name}`);
      }

      return insertedByName[0].id;
    }

    // 1. Resolve participating teams.
    const [team1Name, team2Name] = match.info.teams;
    const team1Id = await ensureTeam(team1Name);
    const team2Id = await ensureTeam(team2Name);

    // 2. Create a competition only when the source supplies one.
    let competitionId: string | null = null;
    const eventName = match.info.event?.name;

    if (eventName) {
      const season = String(
        match.info.season ?? match.info.dates[0].slice(0, 4),
      );
      const gender = match.info.gender || 'unknown';

      const existingCompetition = await tx
        .select({ id: schema.competitions.id })
        .from(schema.competitions)
        .where(
          and(
            eq(schema.competitions.name, eventName),
            eq(schema.competitions.season, season),
            eq(schema.competitions.gender, gender),
          ),
        )
        .limit(1);

      if (existingCompetition[0]) {
        competitionId = existingCompetition[0].id;
      } else {
        const insertedCompetition = await tx
          .insert(schema.competitions)
          .values({
            name: eventName,
            season,
            gender,
            competitionType: match.info.match_type,
          })
          .returning({ id: schema.competitions.id });

        competitionId = insertedCompetition[0]?.id ?? null;
      }
    }

    // 3. Resolve toss and result teams.
    const tossWinnerTeamId = match.info.toss?.winner
      ? await ensureTeam(match.info.toss.winner)
      : null;

    const winnerTeamId = match.info.outcome?.winner
      ? await ensureTeam(match.info.outcome.winner)
      : null;

    // 4. Upsert the match using its stable source identifier.
    const matchValues = {
      source: SOURCE,
      sourceMatchId,
      competitionId,
      matchType: match.info.match_type,
      gender: match.info.gender,
      matchDate: match.info.dates[0],
      venue: match.info.venue ?? null,
      city: match.info.city ?? null,
      team1Id,
      team2Id,
      tossWinnerTeamId,
      tossDecision: match.info.toss?.decision ?? null,
      winnerTeamId,
      outcome: match.info.outcome ? { ...match.info.outcome } : null,
      playerOfMatchNames: match.info.player_of_match ?? [],
    };

    const savedMatch = await tx
      .insert(schema.matches)
      .values(matchValues)
      .onConflictDoUpdate({
        target: [schema.matches.source, schema.matches.sourceMatchId],
        set: {
          competitionId,
          matchType: match.info.match_type,
          gender: match.info.gender,
          matchDate: match.info.dates[0],
          venue: match.info.venue ?? null,
          city: match.info.city ?? null,
          team1Id,
          team2Id,
          tossWinnerTeamId,
          tossDecision: match.info.toss?.decision ?? null,
          winnerTeamId,
          outcome: match.info.outcome ? { ...match.info.outcome } : null,
          playerOfMatchNames: match.info.player_of_match ?? [],
        },
      })
      .returning({ id: schema.matches.id });

    const matchId = savedMatch[0]?.id;

    if (!matchId) {
      throw new Error(`Unable to save match: ${sourceMatchId}`);
    }

    // 5. Remove previous child data so a re-import replaces it.
    // Foreign-key cascade removes deliveries and wickets when
    // their innings are deleted.
    await tx
      .delete(schema.matchSquads)
      .where(eq(schema.matchSquads.matchId, matchId));

    await tx.delete(schema.innings).where(eq(schema.innings.matchId, matchId));

    // 6. Import squads.
    for (const [teamName, playerNames] of Object.entries(
      match.info.players ?? {},
    )) {
      const squadTeamId = await ensureTeam(teamName);

      for (const playerName of playerNames) {
        const playerId = await ensurePlayer(playerName);

        await tx
          .insert(schema.matchSquads)
          .values({
            matchId,
            teamId: squadTeamId,
            playerId,
          })
          .onConflictDoNothing();
      }
    }

    // 7. Import innings, deliveries and wickets.
    for (const [inningsIndex, sourceInnings] of match.innings.entries()) {
      const battingTeamId = await ensureTeam(sourceInnings.team);

      const savedInnings = await tx
        .insert(schema.innings)
        .values({
          matchId,
          inningsNumber: inningsIndex + 1,
          battingTeamId,
          isSuperOver: sourceInnings.super_over ?? false,
        })
        .returning({ id: schema.innings.id });

      const inningsId = savedInnings[0]?.id;

      if (!inningsId) {
        throw new Error(`Unable to save innings ${inningsIndex + 1}`);
      }

      let deliveryNumber = 0;

      for (const sourceOver of sourceInnings.overs ?? []) {
        for (const sourceDelivery of sourceOver.deliveries) {
          deliveryNumber += 1;

          const batterId = await ensurePlayer(sourceDelivery.batter);
          const bowlerId = await ensurePlayer(sourceDelivery.bowler);
          const nonStrikerId = await ensurePlayer(sourceDelivery.non_striker);

          const savedDelivery = await tx
            .insert(schema.deliveries)
            .values({
              inningsId,
              deliveryNumber,
              overNumber: sourceOver.over,
              batterId,
              bowlerId,
              nonStrikerId,
              batterRuns: sourceDelivery.runs.batter,
              extrasRuns: sourceDelivery.runs.extras,
              totalRuns: sourceDelivery.runs.total,
              extras: sourceDelivery.extras ?? null,
            })
            .returning({ id: schema.deliveries.id });

          const deliveryId = savedDelivery[0]?.id;

          if (!deliveryId) {
            throw new Error(`Unable to save delivery ${deliveryNumber}`);
          }

          for (const [wicketIndex, wicket] of (
            sourceDelivery.wickets ?? []
          ).entries()) {
            const playerOutId = await ensurePlayer(wicket.player_out);

            await tx.insert(schema.deliveryWickets).values({
              deliveryId,
              wicketNumber: wicketIndex + 1,
              playerOutId,
              dismissalKind: wicket.kind,
              fielders: (wicket.fielders ?? [])
                .map((fielder) => fielder.name)
                .filter((name): name is string => Boolean(name)),
            });
          }
        }
      }
    }

    return {
      matchId,
      sourceMatchId,
      teams: [team1Name, team2Name],
      inningsImported: match.innings.length,
      status: 'imported' as const,
    };
  });
}
