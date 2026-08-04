/**
 * The print half of the design system.
 *
 * A PDF has no theme toggle and no viewport, so this is not the token file
 * ported across — it is the same intent restated for paper. Two things change:
 * the ground is always white, because that is what a sheet is, and the greys
 * are pulled a little darker, because a hairline that reads on a backlit
 * display disappears in a laser printer's toner.
 *
 * The typographic contract mirrors the app's: a serif for anything that names
 * something (Times, standing in for the interface's display face), a grotesque
 * for prose and labels, and figures set in the grotesque at a tighter size so
 * columns of numbers line up down the page.
 */

export type Rgb = [number, number, number];

export const INK: Rgb = [20, 22, 26];
export const SECONDARY: Rgb = [77, 82, 89];
export const MUTED: Rgb = [107, 113, 120];
export const FAINT: Rgb = [150, 156, 164];

export const LINE: Rgb = [217, 221, 226];
export const LINE_STRONG: Rgb = [186, 192, 199];
export const SUNKEN: Rgb = [244, 245, 247];
export const PAPER: Rgb = [255, 255, 255];

export const ACCENT: Rgb = [10, 92, 168];
export const ACCENT_SOFT: Rgb = [232, 240, 249];
export const SUCCESS: Rgb = [44, 100, 73];
export const ALERT: Rgb = [140, 47, 38];
export const WARNING: Rgb = [133, 96, 26];

/** The masthead band, and the ink a page prints on top of it. */
export const BAND: Rgb = [20, 22, 26];
export const ON_BAND: Rgb = [242, 244, 246];
export const ON_BAND_MUTED: Rgb = [154, 161, 170];

export const SERIF = 'times';
export const SANS = 'helvetica';

/** A4 in points, which is what jsPDF measures in by default here. */
export const PAGE = { width: 595.28, height: 841.89 };
export const MARGIN = { top: 54, right: 46, bottom: 54, left: 46 };

export const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

/**
 * A team's colour, taken from the tournament and used only as a 3pt swatch.
 * Clubs pick these themselves and some of them are near-white, so anything
 * printed *in* a team colour risks being invisible; a swatch beside black text
 * never is.
 */
export function hexToRgb(hex: string | null | undefined): Rgb {
  const value = (hex ?? '').replace('#', '').trim();

  if (value.length === 3) {
    const [r, g, b] = [...value].map((char) => parseInt(char + char, 16));
    return [r ?? 0, g ?? 0, b ?? 0];
  }

  if (value.length === 6) {
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  }

  return [...ACCENT];
}
