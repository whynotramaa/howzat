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

export const BAND: Rgb = [20, 22, 26];
export const ON_BAND: Rgb = [242, 244, 246];
export const ON_BAND_MUTED: Rgb = [154, 161, 170];

export const SERIF = 'times';
export const SANS = 'helvetica';

export const PAGE = { width: 595.28, height: 841.89 };
export const MARGIN = { top: 54, right: 46, bottom: 54, left: 46 };

export const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

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
