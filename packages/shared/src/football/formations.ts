import { MAX_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM } from '../constants';

/**
 * Formations, and where they put people on the grass.
 *
 * A formation is stored as the string everyone says out loud — "4-3-3" — and
 * the coordinates are derived from it. The alternative, storing eleven pairs of
 * numbers per team sheet, means a formation change silently leaves the old
 * positions behind, and it makes "4-3-3" a thing the database can disagree with
 * itself about. A string plus a function cannot drift.
 *
 * Coordinates are normalised: x runs 0 (own goal line) to 1 (halfway), y runs
 * 0 (one touchline) to 1 (the other). The renderer mirrors x for the away side,
 * so both teams are described in their own terms and neither is a special case.
 */

export interface FormationSpot {
  slot: number;
  x: number;
  y: number;
  /** GK, DEF, MID, FWD — what the shirt is called on the team sheet. */
  line: 'GK' | 'DEF' | 'MID' | 'FWD';
}

/**
 * The formations offered per squad size. The list is short on purpose: these
 * are the shapes a Sunday side actually lines up in, and a picker with thirty
 * entries is a picker nobody reads.
 */
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

  // An unlisted squad size still deserves a shape rather than an error: put the
  // keeper aside and split the rest as evenly as the number allows.
  const outfield = Math.max(0, playersPerTeam - 1);
  const back = Math.ceil(outfield / 3);
  const front = Math.floor(outfield / 3);
  return `${back}-${outfield - back - front}-${front}`;
}

/** The lines of a formation, keeper excluded: "4-2-3-1" → [4, 2, 3, 1]. */
export function parseFormation(formation: string): number[] {
  return formation
    .split('-')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

/** A formation is valid when its lines plus the keeper make the squad size. */
export function isValidFormation(formation: string, playersPerTeam: number): boolean {
  const lines = parseFormation(formation);
  if (lines.length < 2 || lines.length > 4) return false;
  if (playersPerTeam < MIN_PLAYERS_PER_TEAM || playersPerTeam > MAX_PLAYERS_PER_TEAM) return false;

  return lines.reduce((sum, count) => sum + count, 0) + 1 === playersPerTeam;
}

/**
 * Where each shirt stands, in slot order — slot 0 is the goalkeeper and the
 * rest run back to front, left to right within a line.
 *
 * Depth is spread across the half rather than the whole pitch because that is
 * what a formation graphic depicts: a side's own shape, from its keeper to its
 * forwards, with the opposition mirrored on the other side of halfway.
 */
export function formationSpots(formation: string, playersPerTeam: number): FormationSpot[] {
  const lines = parseFormation(formation);
  const spots: FormationSpot[] = [
    { slot: 0, x: 0.05, y: 0.5, line: 'GK' },
  ];

  if (lines.length === 0) return spots;

  const lineNames = lineLabels(lines.length);

  let slot = 1;

  lines.forEach((count, lineIndex) => {
    // Evenly spaced between the keeper and halfway, leaving air at both ends so
    // no shirt sits on the goal line or straddles the centre circle.
    const x = 0.2 + (0.75 * (lineIndex + 1)) / (lines.length + 0.35);

    for (let position = 0; position < count; position += 1) {
      spots.push({
        slot,
        x: round3(x),
        // A single player in a line stands in the middle; the rest spread out
        // with a margin, so a back four does not touch either touchline.
        y: count === 1 ? 0.5 : round3(0.12 + (0.76 * position) / (count - 1)),
        line: lineNames[lineIndex]!,
      });
      slot += 1;
    }
  });

  // A squad size that does not match the formation still has to render — an
  // extra shirt goes up front rather than vanishing off the team sheet.
  while (spots.length < playersPerTeam) {
    spots.push({ slot: spots.length, x: 0.9, y: 0.5, line: 'FWD' });
  }

  return spots.slice(0, playersPerTeam);
}

/**
 * Naming the lines of an n-line formation. Four lines means a holding band and
 * an attacking band between defence and attack — 4-2-3-1 — and both are
 * midfield, which is why the middle two collapse to MID rather than inventing
 * a label nobody uses on a team sheet.
 */
function lineLabels(count: number): Array<FormationSpot['line']> {
  if (count <= 1) return ['FWD'];
  if (count === 2) return ['DEF', 'FWD'];
  if (count === 3) return ['DEF', 'MID', 'FWD'];
  return ['DEF', 'MID', 'MID', 'FWD'];
}

/** Short label for a slot: "GK", "DEF", "MID", "FWD". */
export function slotLine(formation: string, playersPerTeam: number, slot: number): string {
  return formationSpots(formation, playersPerTeam).find((spot) => spot.slot === slot)?.line ?? 'SUB';
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
