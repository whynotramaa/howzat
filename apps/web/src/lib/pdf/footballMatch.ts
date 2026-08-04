import {
  FOOTBALL_EVENT_LABELS,
  type FootballIncident,
  type FootballSnapshot,
  type LineupPlayer,
  type TeamLineup,
} from '@howzat/shared';
import { ReportDoc, pdfFileName, type BuiltPdf } from './doc';
import { ALERT, INK, MUTED, SECONDARY, SUCCESS, WARNING, hexToRgb } from './theme';
import {
  fetchFootballSnapshot,
  fetchMatchHeader,
  formatWhen,
  stageLabel,
  statusLabel,
  type PublicMatchHeader,
} from './sources';

/**
 * A football match as a printed match report.
 *
 * Football's record is not a table of figures the way cricket's is — it is a
 * sequence. So the document is built around the timeline: the score, then what
 * happened and when, then the two team sheets with each player's own tally
 * beside their name. That ordering is what makes the report readable by
 * somebody who was not there, which is the only reason it exists.
 */

export async function buildFootballMatchPdf(slug: string): Promise<BuiltPdf> {
  const [header, snapshot] = await Promise.all([
    fetchMatchHeader(slug),
    fetchFootballSnapshot(slug),
  ]);

  return renderFootballMatchPdf(header, snapshot);
}

export function renderFootballMatchPdf(
  header: PublicMatchHeader,
  snapshot: FootballSnapshot | null,
): BuiltPdf {
  const [teamA, teamB] = header.teams;

  const home = snapshot?.home;
  const away = snapshot?.away;

  const homeName = home?.name ?? teamA?.name ?? 'TBD';
  const awayName = away?.name ?? teamB?.name ?? 'TBD';
  const homeShort = home?.short ?? teamA?.shortName ?? 'TBD';
  const awayShort = away?.short ?? teamB?.shortName ?? 'TBD';

  const title = `${homeName} v ${awayName}`;
  const shortTitle = `${homeShort} v ${awayShort}`;

  const doc = new ReportDoc({
    title: `${title} — match report`,
    subject: `${header.tournamentName} · ${stageLabel(header.stage, header.round)}`,
    runningHead: shortTitle,
  });

  const when = formatWhen(header.scheduledAt);

  doc.masthead({
    kicker: `Football · ${header.tournamentName}`,
    title,
    subtitle: [
      stageLabel(header.stage, header.round),
      `${header.periods} × ${header.periodMinutes} minutes`,
      when,
    ]
      .filter(Boolean)
      .join('  ·  '),
    status: statusLabel(header.status),
    facts: [
      header.venue ? `Venue ${header.venue}` : 'Venue not recorded',
      snapshot ? `${snapshot.incidents.length} incidents recorded` : 'Not kicked off',
      home && away ? `Full time ${home.goals}–${away.goals}` : 'No score',
    ],
  });

  if (!snapshot || !home || !away) {
    doc.heading('The match', 'Not kicked off');
    doc.paragraph(
      'This fixture has not started, so there is nothing to report yet. The score, the timeline and both team sheets appear here from the moment the whistle goes.',
    );

    return {
      blob: doc.blob(),
      fileName: pdfFileName([shortTitle, 'match report']),
      title: `${shortTitle} — match report`,
      text: `Match report for ${title}, ${header.tournamentName}.`,
    };
  }

  renderResult(doc, header, snapshot);
  renderSummary(doc, snapshot);
  renderTimeline(doc, snapshot);
  renderLineups(doc, snapshot);
  renderKey(doc);

  return {
    blob: doc.blob(),
    fileName: pdfFileName([shortTitle, 'match report']),
    title: `${shortTitle} — match report`,
    text: header.resultText
      ? `${title}. ${header.resultText}.`
      : `${title} — ${home.goals}–${away.goals}, ${header.tournamentName}.`,
  };
}

// ──────────────────────────────────────────────────────────  the result ──

function renderResult(
  doc: ReportDoc,
  header: PublicMatchHeader,
  snapshot: FootballSnapshot,
): void {
  doc.heading('The result', header.resultText ? 'Full time' : 'Score');

  const decided = snapshot.home.goals !== snapshot.away.goals;

  for (const side of [snapshot.home, snapshot.away]) {
    const other = side === snapshot.home ? snapshot.away : snapshot.home;
    const scorers = scorerLine(snapshot, side.teamId);

    doc.scoreLine({
      color: hexToRgb(side.color),
      name: side.name,
      detail: scorers ?? `${side.saves} saves  ·  ${side.yellowCards} yellow  ·  ${side.redCards} red`,
      figure: String(side.goals),
      won: decided ? side.goals > other.goals : undefined,
    });
  }

  doc.space(6);
  doc.rule(true);
  doc.space(12);

  if (header.resultText) {
    doc.paragraph(header.resultText, { color: SUCCESS, size: 12 });
  } else if (header.status === 'LIVE' || header.status === 'INNINGS_BREAK') {
    doc.paragraph('This match was still in progress when the report was generated.', {
      color: MUTED,
      italic: true,
    });
  }
}

/** "Okafor 12', 61'  ·  Silva 78'" — the line under a scoreline on a card. */
function scorerLine(snapshot: FootballSnapshot, teamId: string): string | null {
  const goals = snapshot.incidents.filter(
    (incident) => incident.teamId === teamId && (incident.kind === 'GOAL' || incident.kind === 'OWN_GOAL'),
  );

  if (goals.length === 0) return null;

  const byPlayer = new Map<string, string[]>();

  for (const goal of goals) {
    const name =
      (goal.playerName ?? 'Unknown') + (goal.kind === 'OWN_GOAL' ? ' (og)' : '');
    const minutes = byPlayer.get(name) ?? [];
    minutes.push(goal.minuteLabel);
    byPlayer.set(name, minutes);
  }

  return [...byPlayer]
    .map(([name, minutes]) => `${name} ${minutes.join(', ')}`)
    .join('   ·   ');
}

// ─────────────────────────────────────────────────────────────  summary ──

/**
 * The two sides' tallies against each other, home in the left column and away
 * in the right, with the label between them. It is the only layout that lets a
 * reader compare two numbers without moving their eye across a whole row.
 */
function renderSummary(doc: ReportDoc, snapshot: FootballSnapshot): void {
  doc.heading('Match summary', 'How it was played');

  const rows: Array<[number, string, number]> = [
    [snapshot.home.goals, 'Goals', snapshot.away.goals],
    [snapshot.home.saves, 'Saves', snapshot.away.saves],
    [snapshot.home.yellowCards, 'Yellow cards', snapshot.away.yellowCards],
    [snapshot.home.redCards, 'Red cards', snapshot.away.redCards],
    [
      countKind(snapshot, snapshot.home.teamId, 'SUBSTITUTION'),
      'Substitutions',
      countKind(snapshot, snapshot.away.teamId, 'SUBSTITUTION'),
    ],
  ];

  doc.table({
    head: [[snapshot.home.name, '', snapshot.away.name]],
    body: rows.map(([left, label, right]) => [String(left), label, String(right)]),
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', fontSize: 11, cellWidth: 150 },
      1: { halign: 'center', textColor: MUTED, fontSize: 7.5 },
      2: { halign: 'right', fontStyle: 'bold', fontSize: 11, cellWidth: 150 },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        if (data.column.index === 0) data.cell.styles.halign = 'left';
        if (data.column.index === 2) data.cell.styles.halign = 'right';
      }
    },
  });
}

function countKind(snapshot: FootballSnapshot, teamId: string, kind: string): number {
  return snapshot.incidents.filter(
    (incident) => incident.teamId === teamId && incident.kind === kind,
  ).length;
}

// ────────────────────────────────────────────────────────────  timeline ──

function renderTimeline(doc: ReportDoc, snapshot: FootballSnapshot): void {
  doc.heading('The timeline', 'Minute by minute', `${snapshot.incidents.length} incidents`);

  if (snapshot.incidents.length === 0) {
    doc.paragraph('Nothing was recorded in this match.', { color: MUTED, italic: true });
    return;
  }

  // Oldest first. On screen the newest matters most because the match is still
  // going; on paper it is over, and a story reads forwards.
  const ordered = [...snapshot.incidents].sort((a, b) => a.seq - b.seq);

  doc.table({
    head: [['Min', 'Side', 'Incident', 'Player', 'Detail']],
    body: ordered.map((incident) => [
      incident.minuteLabel,
      incident.teamId === snapshot.home.teamId ? snapshot.home.short : snapshot.away.short,
      FOOTBALL_EVENT_LABELS[incident.kind],
      incident.playerName ?? '—',
      detailOf(incident),
    ]),
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 46, textColor: SECONDARY },
      2: { cellWidth: 88 },
      3: { fontStyle: 'bold' },
      4: { textColor: MUTED, fontSize: 7.5 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 2) return;

      const incident = ordered[data.row.index];
      if (!incident) return;

      if (incident.kind === 'GOAL' || incident.kind === 'OWN_GOAL') {
        data.cell.styles.textColor = SUCCESS;
        data.cell.styles.fontStyle = 'bold';
      }
      if (incident.kind === 'YELLOW_CARD') data.cell.styles.textColor = WARNING;
      if (incident.kind === 'RED_CARD') data.cell.styles.textColor = ALERT;
    },
  });
}

function detailOf(incident: FootballIncident): string {
  if (incident.kind === 'SUBSTITUTION') {
    return incident.playerOffName ? `for ${incident.playerOffName}` : 'change made';
  }
  if (incident.kind === 'GOAL' && incident.assistPlayerName) {
    return `assist ${incident.assistPlayerName}`;
  }
  if (incident.kind === 'OWN_GOAL') return 'own goal';

  return '';
}

// ─────────────────────────────────────────────────────────────  lineups ──

function renderLineups(doc: ReportDoc, snapshot: FootballSnapshot): void {
  for (const [lineup, side] of [
    [snapshot.lineups.home, snapshot.home],
    [snapshot.lineups.away, snapshot.away],
  ] as const) {
    if (!lineup) continue;
    renderTeamSheet(doc, lineup, side.name);
  }
}

function renderTeamSheet(doc: ReportDoc, lineup: TeamLineup, teamName: string): void {
  doc.heading('Team sheet', teamName, lineup.formation);

  doc.table({
    head: [['#', 'Player', 'Goals', 'Saves', 'Cards', 'On/off']],
    body: lineup.players.map((player) => playerRow(player)),
    columnStyles: sheetColumns,
  });

  if (lineup.substitutes.length > 0) {
    doc.space(12);
    doc.table({
      head: [['#', 'Substitutes', 'Goals', 'Saves', 'Cards', 'On/off']],
      body: lineup.substitutes.map((player) => playerRow(player)),
      columnStyles: sheetColumns,
    });
  }
}

const sheetColumns = {
  0: { cellWidth: 28, textColor: MUTED, halign: 'center' as const },
  1: { fontStyle: 'bold' as const },
  2: { cellWidth: 46, halign: 'right' as const, textColor: INK },
  3: { cellWidth: 46, halign: 'right' as const, textColor: MUTED },
  4: { cellWidth: 54, halign: 'right' as const, textColor: MUTED },
  5: { cellWidth: 74, halign: 'right' as const, textColor: MUTED, fontSize: 7.5 },
};

function playerRow(player: LineupPlayer): string[] {
  const cards = [
    player.yellowCards > 0 ? `${player.yellowCards}Y` : null,
    player.redCards > 0 ? `${player.redCards}R` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const movement = [
    player.cameOnAt ? `on ${player.cameOnAt}` : null,
    player.wentOffAt ? `off ${player.wentOffAt}` : null,
    player.isSentOff ? 'sent off' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    player.shirtNumber !== null ? String(player.shirtNumber) : '—',
    player.isCaptain ? `${player.name} (c)` : player.name,
    player.goals > 0 ? String(player.goals) : '—',
    player.saves > 0 ? String(player.saves) : '—',
    cards || '—',
    movement || '—',
  ];
}

function renderKey(doc: ReportDoc): void {
  doc.space(20);
  doc.caption(
    'Reading this report',
    "Minutes are shown as the referee's watch recorded them, with stoppage time as 45+2. " +
      '(c) marks the captain, (og) an own goal, Y a yellow card and R a red. ' +
      'A substitute who never came on is listed with no minute against them.',
  );
}
