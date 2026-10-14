import { ZodError } from 'zod';

import {
  cricsheetMatchSchema,
  type CricsheetMatch,
} from '../schemas/cricsheet-match.schema';

export class CricsheetValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: Array<{
      path: string;
      message: string;
    }>,
  ) {
    super(message);
    this.name = 'CricsheetValidationError';
  }
}

export function validateCricsheetMatch(input: unknown): CricsheetMatch {
  const result = cricsheetMatchSchema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));

    throw new CricsheetValidationError(
      'Cricsheet match validation failed',
      issues,
    );
  }

  return result.data;
}

export function formatValidationError(error: unknown): string {
  if (error instanceof CricsheetValidationError) {
    return error.issues
      .map((issue) => `${issue.path || '(root)'}: ${issue.message}`)
      .join('\n');
  }

  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
      .join('\n');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown validation error';
}
