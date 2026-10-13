CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(200) NOT NULL,
	"season" varchar(30) NOT NULL,
	"gender" varchar(30),
	"competition_type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"innings_id" uuid NOT NULL,
	"delivery_number" integer NOT NULL,
	"over_number" integer NOT NULL,
	"batter_id" uuid NOT NULL,
	"bowler_id" uuid NOT NULL,
	"non_striker_id" uuid NOT NULL,
	"batter_runs" integer DEFAULT 0 NOT NULL,
	"extras_runs" integer DEFAULT 0 NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"extras" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_wickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"delivery_id" uuid NOT NULL,
	"wicket_number" integer NOT NULL,
	"player_out_id" uuid NOT NULL,
	"dismissal_kind" varchar(50) NOT NULL,
	"fielders" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "innings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"match_id" uuid NOT NULL,
	"innings_number" integer NOT NULL,
	"batting_team_id" uuid NOT NULL,
	"is_super_over" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_squads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"match_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source" varchar(50) DEFAULT 'cricsheet' NOT NULL,
	"source_match_id" varchar(200) NOT NULL,
	"competition_id" uuid,
	"match_type" varchar(30) NOT NULL,
	"gender" varchar(30),
	"match_date" date NOT NULL,
	"venue" varchar(200),
	"city" varchar(100),
	"team1_id" uuid NOT NULL,
	"team2_id" uuid NOT NULL,
	"toss_winner_team_id" uuid,
	"toss_decision" varchar(30),
	"winner_team_id" uuid,
	"outcome" jsonb,
	"player_of_match_names" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"full_name" varchar(150) NOT NULL,
	"country" varchar(100),
	"playing_role" varchar(50),
	"date_of_birth" date,
	"source_player_id" varchar(8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(150) NOT NULL,
	"country" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_name_season_unique" ON "competitions" ("name","season","gender");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_innings_number_unique" ON "deliveries" ("innings_id","delivery_number");--> statement-breakpoint
CREATE INDEX "deliveries_batter_idx" ON "deliveries" ("batter_id");--> statement-breakpoint
CREATE INDEX "deliveries_bowler_idx" ON "deliveries" ("bowler_id");--> statement-breakpoint
CREATE INDEX "deliveries_innings_over_idx" ON "deliveries" ("innings_id","over_number");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_wickets_unique" ON "delivery_wickets" ("delivery_id","wicket_number");--> statement-breakpoint
CREATE INDEX "delivery_wickets_player_out_idx" ON "delivery_wickets" ("player_out_id");--> statement-breakpoint
CREATE UNIQUE INDEX "innings_match_number_unique" ON "innings" ("match_id","innings_number");--> statement-breakpoint
CREATE INDEX "innings_batting_team_idx" ON "innings" ("batting_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_squads_unique" ON "match_squads" ("match_id","team_id","player_id");--> statement-breakpoint
CREATE INDEX "match_squads_player_idx" ON "match_squads" ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_source_identifier_unique" ON "matches" ("source","source_match_id");--> statement-breakpoint
CREATE INDEX "matches_date_idx" ON "matches" ("match_date");--> statement-breakpoint
CREATE INDEX "matches_team1_date_idx" ON "matches" ("team1_id","match_date");--> statement-breakpoint
CREATE INDEX "matches_team2_date_idx" ON "matches" ("team2_id","match_date");--> statement-breakpoint
CREATE INDEX "matches_competition_idx" ON "matches" ("competition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_source_player_id_unique" ON "players" ("source_player_id");--> statement-breakpoint
CREATE INDEX "players_full_name_idx" ON "players" ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_name_unique" ON "teams" ("name");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_innings_id_innings_id_fkey" FOREIGN KEY ("innings_id") REFERENCES "innings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_batter_id_players_id_fkey" FOREIGN KEY ("batter_id") REFERENCES "players"("id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_bowler_id_players_id_fkey" FOREIGN KEY ("bowler_id") REFERENCES "players"("id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_non_striker_id_players_id_fkey" FOREIGN KEY ("non_striker_id") REFERENCES "players"("id");--> statement-breakpoint
ALTER TABLE "delivery_wickets" ADD CONSTRAINT "delivery_wickets_delivery_id_deliveries_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_wickets" ADD CONSTRAINT "delivery_wickets_player_out_id_players_id_fkey" FOREIGN KEY ("player_out_id") REFERENCES "players"("id");--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_match_id_matches_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_batting_team_id_teams_id_fkey" FOREIGN KEY ("batting_team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "match_squads" ADD CONSTRAINT "match_squads_match_id_matches_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "match_squads" ADD CONSTRAINT "match_squads_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "match_squads" ADD CONSTRAINT "match_squads_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team1_id_teams_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team2_id_teams_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_toss_winner_team_id_teams_id_fkey" FOREIGN KEY ("toss_winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_team_id_teams_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL;