import type { StandingsRowDto, TournamentMatchDto, TournamentReportDto } from '@howzat/shared';
import { ReportDoc, pdfFileName, type BuiltPdf } from './doc';
import { ACCENT, ALERT, INK, MUTED, SECONDARY, SUCCESS } from './theme';
import { fetchTournamentReport, formatWhen, stageLabel } from './sources';

export async function buildTournamentPdf(tournamentId: string): Promise<BuiltPdf> {
  return renderTournamentPdf(await fetchTournamentReport(tournamentId));
}

export function renderTournamentPdf(report: TournamentReportDto): BuiltPdf {
  const { tournament, items, matches, totals } = report;
  const isFootball = tournament.sport === 'FOOTBALL';

  const doc = new ReportDoc({
    title: `${tournament.name} — tournament report`,
    subject: `${isFootball ? 'Football' : 'Cricket'} · ${tournament.format.replace(/_/g, ' + ').toLowerCase()}`,
    runningHead: tournament.name,
  });

  doc.masthead({
    kicker: `${isFootball ? 'Football' : 'Cricket'} · ${tournament.format.replace(/_/g, ' + ').toLowerCase()}`,
    title: tournament.name,
    subtitle: [
      `${tournament.teamsCount} sides`,
      `${tournament.playersPerTeam} a side`,
      isFootball
        ? `${tournament.periods} × ${tournament.periodMinutes} minutes`
        : `${tournament.oversPerInnings} overs an innings`,
    ].join('  ·  '),
    status: tournament.status.replace(/_/g, ' '),
    facts: [
      `${totals.completed} of ${totals.total} played`,
      totals.live > 0 ? `${totals.live} in progress` : `${totals.upcoming} to come`,
      `${items.length} sides in the table`,
    ],
  });

  doc.metrics([
    { label: 'Sides', value: String(items.length) },
    { label: 'Fixtures', value: String(totals.total) },
    { label: 'Played', value: String(totals.completed), tone: SUCCESS },
    { label: 'In progress', value: String(totals.live), tone: totals.live > 0 ? ACCENT : INK },
    { label: 'To come', value: String(totals.upcoming) },
  ]);

  renderStandings(doc, items, isFootball);
  renderResults(doc, matches, isFootball);
  renderLive(doc, matches, isFootball);
  renderUpcoming(doc, matches);

  return {
    blob: doc.blob(new Date(report.generatedAt)),
    fileName: pdfFileName([tournament.name, 'tournament report']),
    title: `${tournament.name} — tournament report`,
    text: `${tournament.name}: points table, ${totals.completed} result${
      totals.completed === 1 ? '' : 's'
    } and ${totals.upcoming} fixture${totals.upcoming === 1 ? '' : 's'} to come.`,
  };
}

function renderStandings(doc: ReportDoc, items: StandingsRowDto[], isFootball: boolean): void {
  doc.heading('Standings', 'Points table', `${items.length} sides`);

  if (items.length === 0) {
    doc.paragraph('No side has a result on record yet, so there is no table to print.', {
      color: MUTED,
      italic: true,
    });
    return;
  }

  const head = isFootball
    ? [['#', 'Side', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']]
    : [['#', 'Side', 'P', 'W', 'L', 'T', 'NR', 'For', 'Against', 'NRR', 'Pts']];

  const body = items.map((row) =>
    isFootball
      ? [
          String(row.position),
          row.team.name,
          String(row.played),
          String(row.won),
          String(row.tied),
          String(row.lost),
          String(row.goalsFor),
          String(row.goalsAgainst),
          row.goalDifferenceText,
          String(row.points),
        ]
      : [
          String(row.position),
          row.team.name,
          String(row.played),
          String(row.won),
          String(row.lost),
          String(row.tied),
          String(row.noResult),
          `${row.runsScored}/${row.oversFaced}`,
          `${row.runsConceded}/${row.oversBowled}`,
          row.nrrText,
          String(row.points),
        ],
  );

  const marginColumn = isFootball ? 8 : 9;
  const pointsColumn = isFootball ? 9 : 10;

  doc.table({
    head,
    body,
    columnStyles: isFootball
      ? {
          0: { cellWidth: 24, halign: 'center', textColor: MUTED },
          1: { fontStyle: 'bold' },
          2: { cellWidth: 28, halign: 'right' },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 34, halign: 'right', textColor: MUTED },
          7: { cellWidth: 34, halign: 'right', textColor: MUTED },
          8: { cellWidth: 40, halign: 'right' },
          9: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 22, halign: 'center', textColor: MUTED },
          1: { fontStyle: 'bold' },
          2: { cellWidth: 24, halign: 'right' },
          3: { cellWidth: 24, halign: 'right' },
          4: { cellWidth: 24, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 24, halign: 'right' },
          7: { cellWidth: 56, halign: 'right', textColor: MUTED, fontSize: 7.5 },
          8: { cellWidth: 56, halign: 'right', textColor: MUTED, fontSize: 7.5 },
          9: { cellWidth: 44, halign: 'right' },
          10: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
        },
    didParseCell: (data) => {
      if (data.section !== 'body') return;

      const row = items[data.row.index];
      if (!row) return;

      if (data.column.index === marginColumn) {
        const margin = isFootball ? row.goalDifference : row.nrr;
        data.cell.styles.textColor = margin > 0 ? SUCCESS : margin < 0 ? ALERT : SECONDARY;
      }

      if (data.column.index === pointsColumn) data.cell.styles.textColor = INK;
    },
  });

  doc.caption(
    'Columns',
    isFootball
      ? 'P played · W won · D drawn · L lost · GF goals for · GA goals against · GD goal difference · Pts points. Three points for a win, one for a draw.'
      : 'P played · W won · L lost · T tied · NR no result · For and Against are runs and overs · NRR net run rate · Pts points. Two points for a win, one for a tie or no result.',
  );
}

function renderResults(doc: ReportDoc, matches: TournamentMatchDto[], isFootball: boolean): void {
  const played = matches.filter((match) => ['COMPLETED', 'ABANDONED'].includes(match.status));

  doc.heading('Results', 'Matches played', `${played.length} played`);

  if (played.length === 0) {
    doc.paragraph('Nothing has been played yet.', { color: MUTED, italic: true });
    return;
  }

  doc.table({
    head: [['Stage', 'Fixture', isFootball ? 'Score' : 'Scores', 'Result']],
    body: played.map((match) => [
      stageLabel(match.stage, match.round),
      fixtureLine(match),
      scoreLine(match, isFootball),
      match.resultText ?? (match.status === 'ABANDONED' ? 'Abandoned — no result' : '—'),
    ]),
    columnStyles: {
      0: { cellWidth: 62, textColor: MUTED, fontSize: 7.5 },
      1: { cellWidth: 150, fontStyle: 'bold' },
      2: { cellWidth: 120 },
      3: { textColor: SECONDARY, fontSize: 7.5 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 3) return;

      const match = played[data.row.index];
      if (!match) return;

      data.cell.styles.textColor = match.winnerTeamId ? SUCCESS : SECONDARY;
    },
  });
}

function renderLive(doc: ReportDoc, matches: TournamentMatchDto[], isFootball: boolean): void {
  const live = matches.filter((match) => ['LIVE', 'INNINGS_BREAK'].includes(match.status));
  if (live.length === 0) return;

  doc.heading('In progress', 'Being played now', `${live.length} live`);

  doc.table({
    head: [['Stage', 'Fixture', isFootball ? 'Score' : 'Scores', 'State']],
    body: live.map((match) => [
      stageLabel(match.stage, match.round),
      fixtureLine(match),
      scoreLine(match, isFootball),
      match.status === 'INNINGS_BREAK' ? 'Interval' : 'Live',
    ]),
    columnStyles: {
      0: { cellWidth: 62, textColor: MUTED, fontSize: 7.5 },
      1: { cellWidth: 150, fontStyle: 'bold' },
      2: { cellWidth: 120 },
      3: { textColor: ACCENT, fontSize: 7.5 },
    },
  });

  doc.caption(
    'Note',
    'These scores were correct when this report was generated and will have moved on since.',
  );
}

function renderUpcoming(doc: ReportDoc, matches: TournamentMatchDto[]): void {
  const upcoming = matches.filter((match) => ['SCHEDULED', 'TOSS'].includes(match.status));

  doc.heading('Fixtures', 'Still to be played', `${upcoming.length} to come`);

  if (upcoming.length === 0) {
    doc.paragraph('Every fixture in this tournament has been played.', {
      color: MUTED,
      italic: true,
    });
    return;
  }

  doc.table({
    head: [['Stage', 'Fixture', 'When', 'Venue']],
    body: upcoming.map((match) => [
      stageLabel(match.stage, match.round),
      fixtureLine(match),
      formatWhen(match.scheduledAt) ?? 'To be arranged',
      match.venue ?? '—',
    ]),
    columnStyles: {
      0: { cellWidth: 62, textColor: MUTED, fontSize: 7.5 },
      1: { cellWidth: 170, fontStyle: 'bold' },
      2: { cellWidth: 130, textColor: SECONDARY, fontSize: 7.5 },
      3: { textColor: MUTED, fontSize: 7.5 },
    },
  });
}

function fixtureLine(match: TournamentMatchDto): string {
  return `${match.team1?.name ?? 'TBD'} v ${match.team2?.name ?? 'TBD'}`;
}

function scoreLine(match: TournamentMatchDto, isFootball: boolean): string {
  if (!match.score) return 'Not scored';

  const { team1, team2 } = match.score;

  if (isFootball) return `${team1 ?? '–'}  –  ${team2 ?? '–'}`;

  return [team1, team2].filter(Boolean).join('   |   ') || 'Not scored';
}
