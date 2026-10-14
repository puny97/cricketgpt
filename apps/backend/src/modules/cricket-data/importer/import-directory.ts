import 'dotenv/config';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import { formatValidationError, validateCricsheetMatch } from '../index';
import { importCricsheetMatch } from './cricsheet-importer';

async function main(): Promise<void> {
  const relativeDirectory = process.argv[2];

  if (!relativeDirectory) {
    throw new Error(
      'Usage: pnpm import:cricsheet:directory -- <path-to-directory>',
    );
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const directoryPath = path.resolve(process.cwd(), relativeDirectory);

  const entries = await readdir(directoryPath, {
    withFileTypes: true,
  });

  const files = entries
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name).toLowerCase() === '.json',
    )
    .map((entry) => entry.name)
    .sort();

  if (files.length === 0) {
    throw new Error(`No JSON files found in ${directoryPath}`);
  }

  const pool = new Pool({
    connectionString,
    max: 1,
  });

  let imported = 0;
  let failed = 0;

  try {
    const db = drizzle({ client: pool });

    console.log(`Found ${files.length} JSON files.`);
    console.log('Starting sequential import...\n');

    for (const fileName of files) {
      const filePath = path.join(directoryPath, fileName);
      const sourceMatchId = path.basename(fileName, path.extname(fileName));

      try {
        const fileContents = await readFile(filePath, 'utf8');

        let parsedJson: unknown;

        try {
          parsedJson = JSON.parse(fileContents);
        } catch {
          throw new Error('Invalid JSON syntax');
        }

        const match = validateCricsheetMatch(parsedJson);

        const result = await importCricsheetMatch(db, match, sourceMatchId);

        imported += 1;

        console.log(`[SUCCESS] ${fileName} | Match ID: ${result.matchId}`);
      } catch (error: unknown) {
        failed += 1;

        console.error(`[FAILED] ${fileName}`);
        console.error(formatValidationError(error));
        console.error('');
      }
    }
  } finally {
    await pool.end();
  }

  console.log('\nBulk import summary');
  console.log('-------------------');
  console.log(`Total files: ${files.length}`);
  console.log(`Imported successfully: ${imported}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(formatValidationError(error));
  process.exitCode = 1;
});
