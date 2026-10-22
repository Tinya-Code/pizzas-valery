import type { ZodType } from 'zod';

/**
 * Thrown when a fixture (or an adapter-produced payload) violates the v2 data
 * contract. This is a BUILD-FATAL error: it must never be swallowed by the
 * per-resource fallbacks in `services/index.js` — those only guard transport
 * failures (missing file / network), not contract violations.
 */
export class SchemaViolationError extends Error {
  readonly fixture: string;
  readonly issues: string[];

  constructor(fixture: string, issues: string[]) {
    super(
      `[schemas] ${fixture} failed contract validation:\n${issues
        .map((issue) => `  → ${issue}`)
        .join('\n')}`
    );
    this.name = 'SchemaViolationError';
    this.fixture = fixture;
    this.issues = issues;
  }
}

/** Type guard used by service fallbacks to rethrow contract violations. */
export function isSchemaViolationError(error: unknown): error is SchemaViolationError {
  return error instanceof SchemaViolationError;
}

/**
 * Parse `data` against `schema`, or throw a `SchemaViolationError` listing
 * every broken path (`data.products.0.price: Expected number`).
 *
 * @param fixture Short fixture label used in the error (e.g. `menu.json`).
 */
export function parseFixture<T>(fixture: string, schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  throw new SchemaViolationError(fixture, issues);
}
