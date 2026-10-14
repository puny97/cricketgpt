import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { formatValidationError, validateCricsheetMatch } from './index';

async function main(): Promise<void> {
  const relativeFile = process.argv[2];

  if (!relativeFile) {
    throw new Error(
      'Usage: pnpm --dir apps/backend validate:cricsheet -- <path-to-json>',
    );
  }

  const filePath = path.resolve(process.cwd(), relativeFile);
  const fileContents = await readFile(filePath, 'utf8');

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(fileContents);
  } catch {
    throw new Error(`Invalid JSON syntax in file: ${filePath}`);
  }

  const match = validateCricsheetMatch(parsedJson);

  console.log('Cricsheet file is valid');
  console.log(`Teams: ${match.info.teams.join(' vs ')}`);
  console.log(`Match type: ${match.info.match_type}`);
  console.log(`Date: ${match.info.dates.join(', ')}`);
  console.log(`Innings: ${match.innings.length}`);
}

main().catch((error: unknown) => {
  console.error(formatValidationError(error));
  process.exitCode = 1;
});
