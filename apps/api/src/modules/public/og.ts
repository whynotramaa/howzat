import type { FootballSnapshot, MatchSnapshot } from '@howzat/shared';

type OgMatch = {
  tournamentName: string;
  status: string;
  sport: 'CRICKET' | 'FOOTBALL';
  team1: { name: string; shortName: string; primaryColor: string } | null;
  team2: { name: string; shortName: string; primaryColor: string } | null;
  resultText: string | null;
};

export function renderMatchOgImage(
  match: OgMatch,
  snapshot: MatchSnapshot | FootballSnapshot | null,
): string {
  const team1 = match.team1 ?? { name: 'Team one', shortName: 'ONE', primaryColor: '#1268bd' };
  const team2 = match.team2 ?? { name: 'Team two', shortName: 'TWO', primaryColor: '#363c44' };
  const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const status = match.resultText ?? (live ? 'LIVE NOW' : match.status.replace('_', ' '));
  const score = ogScoreLine(match.sport, snapshot);
  const detail = match.sport === 'FOOTBALL' ? 'FOOTBALL' : 'CRICKET · BALL BY BALL';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${xml(`${team1.shortName} v ${team2.shortName}`)} — ${xml(status)}</title>
  <desc id="desc">${xml(match.tournamentName)} · ${xml(detail)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0a0c10"/><stop offset="1" stop-color="#171b22"/></linearGradient>
    <radialGradient id="glow1" cx="0" cy="0" r="1"><stop stop-color="${color(team1.primaryColor)}" stop-opacity=".34"/><stop offset="1" stop-color="${color(team1.primaryColor)}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow2" cx="1" cy="1" r="1"><stop stop-color="${color(team2.primaryColor)}" stop-opacity=".28"/><stop offset="1" stop-color="${color(team2.primaryColor)}" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#fff" stroke-opacity=".035"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="760" height="500" fill="url(#glow1)"/>
  <rect x="440" y="130" width="760" height="500" fill="url(#glow2)"/>
  <rect x="64" y="62" width="1072" height="5" rx="2.5" fill="url(#teamline)"/>
  <defs><linearGradient id="teamline"><stop stop-color="${color(team1.primaryColor)}"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="${color(team2.primaryColor)}"/></linearGradient></defs>
  <text x="70" y="116" fill="#f4f6f8" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="3">HOWZAT</text>
  <text x="1130" y="116" text-anchor="end" fill="#89929c" font-family="Arial,sans-serif" font-size="18" letter-spacing="2">${xml(detail)}</text>
  <text x="70" y="196" fill="#89929c" font-family="Arial,sans-serif" font-size="18" letter-spacing="3">${xml(match.tournamentName).toUpperCase()}</text>
  <text x="70" y="274" fill="#f4f6f8" font-family="Arial,sans-serif" font-size="52" font-weight="700">${xml(team1.name)}</text>
  <text x="70" y="330" fill="#89929c" font-family="Arial,sans-serif" font-size="34" font-weight="400">v</text>
  <text x="108" y="330" fill="#f4f6f8" font-family="Arial,sans-serif" font-size="52" font-weight="700">${xml(team2.name)}</text>
  <rect x="70" y="382" width="1060" height="1" fill="#fff" fill-opacity=".15"/>
  <text x="70" y="480" fill="#f4f6f8" font-family="Arial,sans-serif" font-size="94" font-weight="700" letter-spacing="-4">${xml(score)}</text>
  <rect x="850" y="430" width="280" height="62" rx="31" fill="${live ? color(team1.primaryColor) : '#242a32'}" fill-opacity=".92"/>
  <circle cx="884" cy="461" r="6" fill="${live ? '#fff' : '#83c2ff'}"/>
  <text x="908" y="470" fill="#fff" font-family="Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="2">${xml(status).toUpperCase()}</text>
  <text x="70" y="570" fill="#89929c" font-family="Arial,sans-serif" font-size="18">Follow the match live at howzat</text>
  <text x="1130" y="570" text-anchor="end" fill="#89929c" font-family="monospace" font-size="18">${xml(team1.shortName)} · ${xml(team2.shortName)}</text>
</svg>`;
}

export function ogScoreLine(
  sport: 'CRICKET' | 'FOOTBALL',
  snapshot: MatchSnapshot | FootballSnapshot | null,
): string {
  return sport === 'FOOTBALL' ? footballScore(snapshot) : cricketScore(snapshot);
}

function cricketScore(snapshot: MatchSnapshot | FootballSnapshot | null): string {
  if (!snapshot || 'sport' in snapshot) return 'Not started';
  return `${snapshot.batting.runs}/${snapshot.batting.wickets}  ·  ${snapshot.batting.overs} ov`;
}

function footballScore(snapshot: MatchSnapshot | FootballSnapshot | null): string {
  if (!snapshot || !('sport' in snapshot)) return 'Not started';
  return `${snapshot.home.goals}  —  ${snapshot.away.goals}`;
}

function color(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#1268bd';
}

export function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
