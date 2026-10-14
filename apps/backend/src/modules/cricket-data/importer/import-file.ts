import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from '../../../infrastructure/database/schema';
import { formatValidationError, validateCricsheetMatch } from '../index';
import { importCricsheetMatch } from './cricsheet-importer';

async function main(): Promise<void> {
  const relativeFile = process.argv[2];

  if (!relativeFile) {
    throw new Error('Usage: pnpm import:cricsheet -- <path-to-json>');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const filePath = path.resolve(process.cwd(), relativeFile);
  const fileContents = await readFile(filePath, 'utf8');

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(fileContents);
  } catch {
    throw new Error(`Invalid JSON syntax in ${filePath}`);
  }

  // Validate the complete file before opening the database transaction.
  const match = validateCricsheetMatch(parsedJson);

  // Cricsheet match IDs are taken from the original filename.
  const sourceMatchId = path.basename(filePath, path.extname(filePath));

  const pool = new Pool({
    connectionString,
    max: 1,
  });

  try {
    const db = drizzle({ client: pool });

    const result = await importCricsheetMatch(db, match, sourceMatchId);

    console.log('Cricsheet import completed');
    console.log(`Source match ID: ${result.sourceMatchId}`);
    console.log(`Internal match UUID: ${result.matchId}`);
    console.log(`Teams: ${result.teams.join(' vs ')}`);
    console.log(`Innings imported: ${result.inningsImported}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(formatValidationError(error));
  process.exitCode = 1;
});
