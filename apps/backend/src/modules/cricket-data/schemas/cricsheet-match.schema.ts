import { z } from 'zod';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Invalid calendar date');

const nonNegativeIntegerSchema = z.number().int().nonnegative();

const registrySchema = z
  .object({
    people: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const outcomeSchema = z
  .object({
    winner: z.string().optional(),
    result: z.string().optional(),
    eliminator: z.string().optional(),
    bowl_out: z.string().optional(),
    method: z.string().optional(),
    by: z
      .object({
        runs: nonNegativeIntegerSchema.optional(),
        wickets: nonNegativeIntegerSchema.optional(),
        innings: nonNegativeIntegerSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const infoSchema = z
  .object({
    balls_per_over: z.number().int().positive(),
    dates: z.array(dateSchema).min(1),
    gender: z.string().min(1),
    match_type: z.string().min(1),
    teams: z.array(z.string().min(1)).length(2),
    overs: nonNegativeIntegerSchema.optional(),
    venue: z.string().optional(),
    city: z.string().optional(),
    season: z.union([z.string(), z.number()]).optional(),
    event: z
      .object({
        name: z.string(),
        match_number: z.union([z.string(), z.number()]).optional(),
        group: z.string().optional(),
        stage: z.string().optional(),
      })
      .passthrough()
      .optional(),
    toss: z
      .object({
        decision: z.string().optional(),
        winner: z.string().optional(),
        uncontested: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    outcome: outcomeSchema.optional(),
    player_of_match: z.array(z.string()).optional(),
    players: z.record(z.string(), z.array(z.string())).optional(),
    registry: registrySchema.optional(),
  })
  .passthrough();

const runsSchema = z
  .object({
    batter: nonNegativeIntegerSchema,
    extras: nonNegativeIntegerSchema,
    total: nonNegativeIntegerSchema,
    non_boundary: z.boolean().optional(),
  })
  .passthrough();

const wicketSchema = z
  .object({
    kind: z.string().min(1),
    player_out: z.string().min(1),
    fielders: z
      .array(
        z
          .object({
            name: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const deliverySchema = z
  .object({
    actual_delivery: z.string().optional(),
    batter: z.string().min(1),
    bowler: z.string().min(1),
    non_striker: z.string().min(1),
    runs: runsSchema,
    extras: z.record(z.string(), nonNegativeIntegerSchema).optional(),
    wickets: z.array(wicketSchema).optional(),
  })
  .passthrough();

const overSchema = z
  .object({
    over: nonNegativeIntegerSchema,
    deliveries: z.array(deliverySchema),
  })
  .passthrough();

const inningsSchema = z
  .object({
    team: z.string().min(1),
    overs: z.array(overSchema).optional(),
    super_over: z.boolean().optional(),
    declared: z.boolean().optional(),
    forfeited: z.boolean().optional(),
    absent_hurt: z.array(z.string()).optional(),
    penalty_runs: z
      .object({
        pre: nonNegativeIntegerSchema.optional(),
        post: nonNegativeIntegerSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const cricsheetMatchSchema = z
  .object({
    meta: z
      .object({
        data_version: z.string().min(1),
        created: dateSchema,
        revision: z.number().int().positive(),
      })
      .passthrough(),
    info: infoSchema,
    innings: z.array(inningsSchema),
  })
  .passthrough()
  .superRefine((match, ctx) => {
    const [team1, team2] = match.info.teams;

    if (team1 === team2) {
      ctx.addIssue({
        code: 'custom',
        path: ['info', 'teams'],
        message: 'A match must contain two distinct teams',
      });
    }

    match.innings.forEach((inning, index) => {
      if (!match.info.teams.includes(inning.team)) {
        ctx.addIssue({
          code: 'custom',
          path: ['innings', index, 'team'],
          message: `Unknown batting team: ${inning.team}`,
        });
      }

      inning.overs?.forEach((over, overIndex) => {
        over.deliveries.forEach((delivery, deliveryIndex) => {
          if (
            delivery.runs.batter + delivery.runs.extras !==
            delivery.runs.total
          ) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'innings',
                index,
                'overs',
                overIndex,
                'deliveries',
                deliveryIndex,
                'runs',
              ],
              message: 'Total runs must equal batter runs plus extras runs',
            });
          }
        });
      });
    });
  });

export type CricsheetMatch = z.infer<typeof cricsheetMatchSchema>;
