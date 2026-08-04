/**
 * The report layer.
 *
 * Everything under here is loaded on demand — jsPDF and its table plugin are
 * far too large to sit in the bundle that draws a scoreboard, and nobody needs
 * them until they press the button. Import from this barrel inside a dynamic
 * `import()`, never at the top of a screen.
 */

export type { BuiltPdf } from './doc';
export { buildCricketMatchPdf, renderCricketMatchPdf } from './cricketMatch';
export { buildFootballMatchPdf, renderFootballMatchPdf } from './footballMatch';
export { buildTournamentPdf, renderTournamentPdf } from './tournament';
export { canShareFiles, deliverPdf, type PdfDelivery } from './share';
