import { z } from 'zod';
import { hexColorSchema, nameSchema } from './common';

export const createTeamSchema = z.object({
  name: nameSchema,
  shortName: z
    .string()
    .trim()
    .min(2, 'At least 2 characters')
    .max(5, 'At most 5 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Letters and numbers only'),
  primaryColor: hexColorSchema.default('#1e40af'),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
