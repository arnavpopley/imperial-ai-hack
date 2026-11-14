import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';

/** JSON body validator that returns a 400 with zod issues on failure. */
export const body = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid body', issues: result.error.issues }, 400);
  });
