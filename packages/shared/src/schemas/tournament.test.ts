import { describe, expect, it } from 'vitest';
import { createTournamentSchema } from './tournament';

const base = { name: 'Riverside XI v Northgate CC', teamsCount: 2 };
const side = (name: string, shortName: string) => ({ name, shortName, primaryColor: '#1268bd' });

describe('createTournamentSchema with sides attached', () => {
  it('accepts a two-side match', () => {
    const parsed = createTournamentSchema.parse({
      ...base,
      teams: [side('Riverside XI', 'RIV'), side('Northgate CC', 'NOR')],
    });

    expect(parsed.teams).toHaveLength(2);
    expect(parsed.teamsCount).toBe(2);
  });

  it('rejects more sides than the tournament holds', () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      teams: [side('A team', 'AAA'), side('B team', 'BBB'), side('C team', 'CCC')],
    });

    expect(result.success).toBe(false);
  });

  it('rejects two sides sharing an abbreviation', () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      teams: [side('Riverside XI', 'RIV'), side('Riverton', 'riv')],
    });

    expect(result.success).toBe(false);
  });

  it('still allows a tournament with no sides attached', () => {
    expect(createTournamentSchema.parse({ ...base, teamsCount: 8 }).teams).toBeUndefined();
  });
});
