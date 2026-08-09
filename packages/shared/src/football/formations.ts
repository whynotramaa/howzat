import { MAX_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM } from '../constants';

export interface FormationSpot {
  slot: number;
  x: number;
  y: number;
  line: 'GK' | 'DEF' | 'MID' | 'FWD';
}

export const FORMATIONS_BY_SIZE: Record<number, readonly string[]> = {
  5: ['1-2-1', '2-1-1', '1-1-2'],
  6: ['2-2-1', '1-3-1', '2-1-2'],
  7: ['2-3-1', '3-2-1', '2-1-3', '3-1-2'],
  8: ['3-3-1', '2-3-2', '3-2-2'],
  9: ['3-3-2', '4-3-1', '3-4-1'],
  10: ['4-3-2', '3-4-2', '4-4-1'],
  11: ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-5-1', '3-4-3'],
};

export function formationsFor(playersPerTeam: number): readonly string[] {
  return FORMATIONS_BY_SIZE[playersPerTeam] ?? [];
}

export function defaultFormation(playersPerTeam: number): string {
  const options = formationsFor(playersPerTeam);
  if (options.length > 0) return options[0]!;

  const outfield = Math.max(0, playersPerTeam - 1);
  const back = Math.ceil(outfield / 3);
  const front = Math.floor(outfield / 3);
  return `${back}-${outfield - back - front}-${front}`;
}

export function parseFormation(formation: string): number[] {
  return formation
    .split('-')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function isValidFormation(formation: string, playersPerTeam: number): boolean {
  const lines = parseFormation(formation);
  if (lines.length < 2 || lines.length > 4) return false;
  if (playersPerTeam < MIN_PLAYERS_PER_TEAM || playersPerTeam > MAX_PLAYERS_PER_TEAM) return false;

  return lines.reduce((sum, count) => sum + count, 0) + 1 === playersPerTeam;
}

export function formationSpots(formation: string, playersPerTeam: number): FormationSpot[] {
  const lines = parseFormation(formation);
  const spots: FormationSpot[] = [{ slot: 0, x: 0.05, y: 0.5, line: 'GK' }];

  if (lines.length === 0) return spots;

  const lineNames = lineLabels(lines.length);

  let slot = 1;

  lines.forEach((count, lineIndex) => {
    const x = 0.2 + (0.75 * (lineIndex + 1)) / (lines.length + 0.35);

    for (let position = 0; position < count; position += 1) {
      spots.push({
        slot,
        x: round3(x),
        y: count === 1 ? 0.5 : round3(0.12 + (0.76 * position) / (count - 1)),
        line: lineNames[lineIndex]!,
      });
      slot += 1;
    }
  });

  while (spots.length < playersPerTeam) {
    spots.push({ slot: spots.length, x: 0.9, y: 0.5, line: 'FWD' });
  }

  return spots.slice(0, playersPerTeam);
}

function lineLabels(count: number): Array<FormationSpot['line']> {
  if (count <= 1) return ['FWD'];
  if (count === 2) return ['DEF', 'FWD'];
  if (count === 3) return ['DEF', 'MID', 'FWD'];
  return ['DEF', 'MID', 'MID', 'FWD'];
}

export function slotLine(formation: string, playersPerTeam: number, slot: number): string {
  return (
    formationSpots(formation, playersPerTeam).find((spot) => spot.slot === slot)?.line ?? 'SUB'
  );
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
