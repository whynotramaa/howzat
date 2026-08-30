import type { RequestHandler } from 'express';
import { prisma } from '../../lib/prisma';
import { getSnapshot } from '../snapshot';
import { getFootballSnapshot } from '../football/snapshot';
import { ogScoreLine, xml } from './og';

type Card = { title: string; description: string; url: string; image: string };

export function renderShareHtml(card: Card): string {
  const tags: Array<[string, string, string]> = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Howzat'],
    ['property', 'og:title', card.title],
    ['property', 'og:description', card.description],
    ['property', 'og:url', card.url],
    ['property', 'og:image', card.image],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', card.title],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', card.title],
    ['name', 'twitter:description', card.description],
    ['name', 'twitter:image', card.image],
    ['name', 'description', card.description],
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${xml(card.title)}</title>
${tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${xml(value)}" />`).join('\n')}
<link rel="canonical" href="${xml(card.url)}" />
</head>
<body><a href="${xml(card.url)}">${xml(card.title)}</a></body>
</html>`;
}

// Link crawlers (WhatsApp, Facebook, Twitter) don't run JavaScript, so the SPA's
// meta tags never reach them. vercel.json routes those user agents here instead.
export const shareHandler: RequestHandler = async (req, res) => {
  const slug = req.params.slug ?? '';
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'howzat.live';
  const origin = `https://${Array.isArray(host) ? host[0] : host}`;
  const card: Card = {
    title: 'Howzat — every ball, on the record',
    description: 'Ball-by-ball scoring, a points table that keeps itself, and one link anyone can follow live.',
    url: `${origin}/live/${encodeURIComponent(slug)}`,
    image: `${origin}/og.png`,
  };

  // A crawler must never see a 500, or the link renders bare. Fall back to the
  // generic card if anything about this match fails to load.
  try {
    const match = await prisma.match.findUnique({
      where: { publicSlug: slug },
      include: { team1: true, team2: true, tournament: { select: { name: true, sport: true } } },
    });

    if (match) {
      const sport = match.tournament.sport === 'FOOTBALL' ? 'FOOTBALL' : 'CRICKET';
      const snapshot =
        sport === 'FOOTBALL' ? await getFootballSnapshot(match.id) : await getSnapshot(match.id);
      const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
      const teams = `${match.team1?.shortName ?? 'Team one'} v ${match.team2?.shortName ?? 'Team two'}`;
      const status = match.resultText ?? (live ? 'Live now' : match.status.replace(/_/g, ' ').toLowerCase());

      card.title = `${teams} · ${ogScoreLine(sport, snapshot)}`;
      card.description = `${match.tournament.name} — ${status}. Follow every ball live on Howzat.`;
    }
  } catch {
    // generic card it is
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  res.send(renderShareHtml(card));
};
