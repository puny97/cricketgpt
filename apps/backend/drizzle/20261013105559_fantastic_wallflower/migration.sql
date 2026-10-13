CREATE TABLE "players" (
	"id" uuid PRIMARY KEY,
	"full_name" varchar(150) NOT NULL,
	"country" varchar(100),
	"playing_role" varchar(50),
	"date_of_birth" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
