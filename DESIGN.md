---
name: Howzat
description: Cricket and football scoring, fixtures, and live scoreboards for local tournaments.
colors:
  surface: "#f5f5f5"
  surface-raised: "#ffffff"
  surface-sunken: "#ededed"
  surface-hover: "#ececec"
  surface-inverse: "#171717"
  line: "#e3e3e3"
  line-strong: "#cfcfcf"
  text-primary: "#171717"
  text-secondary: "#525252"
  text-muted: "#6b6b6b"
  accent: "#c2410c"
  accent-fill: "#f6821f"
  accent-strong: "#e5600b"
  accent-soft: "#fff1e6"
  accent-line: "#fbc49a"
  on-accent: "#1a0d02"
  live: "#e5600b"
  alert: "#c81e1e"
  alert-soft: "#fdeceb"
  success: "#15803d"
  success-soft: "#eaf6ee"
  warning: "#8a5a00"
  warning-soft: "#fdf3dc"
  board: "#171717"
  board-raised: "#212121"
  board-line: "#333333"
  board-ink: "#fafafa"
  board-muted: "#a3a3a3"
  dark-surface: "#0b0b0b"
  dark-surface-raised: "#141414"
  dark-line: "#262626"
  dark-text-primary: "#ededed"
  dark-text-muted: "#8f8f8f"
  dark-accent: "#ff9a45"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.5rem, 6.2vw, 5.25rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.045em"
  score:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 0.9
    letterSpacing: "-0.045em"
    fontFeature: "'tnum', 'lnum'"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'ss01', 'cv11'"
  control:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.05em"
rounded:
  xs: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  full: "999px"
spacing:
  row-y: "12px"
  row-x: "16px"
  card: "16px"
  panel: "20px"
  grid-cell: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-quiet:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-quiet-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text-primary}"
  button-danger:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.alert}"
    rounded: "{rounded.md}"
    height: "36px"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  choice-chip:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  choice-chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  pill:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  pill-live:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  ledger-row:
    padding: "12px 16px"
  ledger-row-hover:
    backgroundColor: "{colors.surface-hover}"
  nav-item:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text-primary}"
  tab:
    textColor: "{colors.text-muted}"
    typography: "{typography.control}"
    padding: "0 12px"
    height: "36px"
  tab-active:
    textColor: "{colors.text-primary}"
  scoreboard:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.lg}"
---

# Design System: Howzat

## Overview

**Creative North Star: "The Operations Console"**

Howzat reads like an infrastructure dashboard that happens to keep score. Neutral grays carry no tint, panels are bordered rather than lifted, and one orange accent marks the action, the live state, and the boundary. Density is high and calm: small type, short controls, and rows that pack many matches into one screen without crowding.

Light is the default theme. Dark sits behind a toggle that sets `data-theme="dark"` on the root and persists the choice. Both themes share one layout and one set of token names, so a component never branches on theme. The scoreboard is the exception that proves the rule: it stays a dark board in both themes, because a score display reads as an instrument rather than a page.

Copy is minimal and sentence case. Headings name the thing; they do not sell it. The old green-tinted dark matchday look is retired.

**Key Characteristics:**
- Neutral grays with zero hue, light first, dark on request.
- A single orange accent with separate text and fill values.
- Geist for everything, tabular numerals for every figure.
- Compact controls (32 to 40px) and 13px working text.
- Flat bordered panels, with shadow reserved for the primary button inset and floating layers.
- A drafting-table motif (faint grid, corner ticks) used sparingly on hero and sign-in plates.

## Colors

A colorless gray range with one warm orange that does all the signaling.

### Primary
- **Cloudflare Orange** (accent-fill): The fill behind primary buttons, the six on the scoring pad and ball chips, the active nav bar, the active tab underline, the chase progress fill, selection, caret, and the focus ring. Text on it is always the near-black on-accent ink, never white.
- **Burnt Orange Text** (accent): The orange used as text and icon color on light surfaces, where the fill orange would fail contrast. Dark theme swaps in Apricot (dark-accent).
- **Ember** (accent-strong, live): Live state color behind the live dot and live labels.
- **Peach Wash** (accent-soft) with **Peach Line** (accent-line): Tinted ground and border for selected chips, live and accent pills, the four on the pad, and the focus halo on inputs.

### Neutral
- **Canvas Gray** (surface): Page background.
- **Paper White** (surface-raised): Every card, ledger container, stat strip, sidebar, and field.
- **Well Gray** (surface-sunken): Scoring pad keys, assist notes, and inset table headers.
- **Hover Gray** (surface-hover): Row, nav, and quiet button hover.
- **Hairline** (line) and **Firm Line** (line-strong): Borders and dividers; firm line on hover and for dashed empty states.
- **Ink** (text-primary), **Graphite** (text-secondary), **Ash** (text-muted): Three text steps, nothing lighter for readable text.
- **Board** family (board, board-raised, board-line, board-ink, board-muted): The scoreboard surface, dark in both themes.

### Status
- **Alert Red** (alert, alert-soft): Errors and the danger button only.
- **Pitch Green** (success, success-soft): Completed results and the online dot.
- **Amber** (warning, warning-soft): Extras on ball chips, armed pad keys, offline state.

### Named Rules
**The No Tint Rule.** Grays are true neutrals. A gray with a green, blue, or warm cast does not belong in this system.

**The Two Oranges Rule.** Fill orange is for surfaces and strokes; text orange is for type. Never set body text in the fill value on a light surface.

**The One Voice Rule.** Orange is the only accent. Team identity colors appear only inside team marks.

## Typography

**Display Font:** Geist (with ui-sans-serif, system-ui)
**Body Font:** Geist
**Label/Mono Font:** Geist with tabular numerals; no separate mono face

**Character:** One neutral grotesque at many sizes, tightened as it grows. Hierarchy comes from size and weight, not from a second family.

### Hierarchy
- **Display**: Home hero only. Tight negative tracking, near-solid leading.
- **Score**: Scores and clock digits. Tabular and lining figures, heavy negative tracking, sized per context from 1rem in rows up to 4.5rem on the live stage.
- **Headline**: Page h1 on every app screen. Compact on purpose; pages do not shout.
- **Title**: Section h2 inside cards and panels, at the same size as working text and set apart only by weight.
- **Body**: Default document text. Working UI text (buttons, fields, rows, tabs) sits one step down at the control size.
- **Label**: Uppercase small data labels on stat terms, table column heads, and board stats.

### Named Rules
**The Small Label Rule.** The uppercase label marks a datum (a `dt`, a column head, a board stat). It never sits above a heading as a kicker and never introduces a section.

**The Tabular Rule.** Every number that can change (runs, overs, standings, counts) uses tabular figures.

## Layout

The app shell is a fixed 220px raised sidebar on desktop with a sticky 48px blurred top bar showing the current section; on mobile the sidebar gives way to a fixed bottom tab bar with 56px targets. Page content uses 16px horizontal padding, 24px from the small breakpoint.

Lists are ledgers: a single bordered raised container holding rows separated by hairlines, each row 10 to 12px tall in padding and 12 to 16px wide. Stats are a `dl` strip: one bordered raised container split into equal cells with left border dividers, collapsing to two columns with a top divider on small screens. The match overview splits into two columns at 1.1fr and 1fr with a vertical divider, stacking below 640px.

The 48px faint grid backs hero areas, empty states, and the sign-in plate. It is a texture, never a layout constraint.

## Elevation & Depth

Flat by default. Depth comes from surface steps (canvas, raised, sunken) and hairline borders. Shadows exist in four soft steps for light theme; in dark the two small steps turn off entirely, and the larger steps darken. Secondary buttons carry the extra-small shadow, the scoring pad the small one, and sheets and toasts the medium and large ones. Blur backs the sticky top bar and the live stage bar.

### Named Rules
**The Border First Rule.** Separate with a hairline before reaching for a shadow. A resting card has no shadow.

## Shapes

Small, even radii. Controls and keys use 6px, cards and panels 8px, pills and team marks 4px, focus outlines 3px. Only the live dot, avatars, ball chips, and transport buttons are fully round. Plates can carry corner ticks: thin crosshair marks just outside each corner, like registration marks on a drawing.

## Components

### Buttons
Short and solid. Four variants at 32, 36, and 40px heights, all with medium weight and a slight press scale (0.98).
- **Primary:** Fill orange with near-black ink and a faint bottom inset line; darkens about 10% on hover.
- **Secondary:** Raised white with a hairline border; border firms and ground shifts to hover gray.
- **Quiet:** No ground; graphite text that gains hover gray and ink.
- **Danger:** Secondary shape with red text; red border and red wash on hover.
- **Text action:** Underlined graphite text whose underline turns orange on hover.

### Chips
- **Pill:** 20px tall, 4px corners, label size. Tones are neutral, accent, live (with live dot), success, and warning. Status always has a word, never color alone.
- **Choice chip:** 32px toggle; selected state takes the fill orange border, peach wash, and orange text.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** Paper white on canvas gray.
- **Shadow Strategy:** None at rest (see Elevation & Depth).
- **Border:** One hairline. Card headers divide from bodies with a hairline.
- **Internal Padding:** 16px; overview panels 20px.

### Inputs / Fields
- **Style:** 36px, raised white, hairline border, 6px corners, label above at 12px medium graphite.
- **Focus:** Border turns fill orange with a 3px peach halo; no outline.
- **Error:** Red border with a red message below.

### Navigation
Sidebar items are 32px rows at control size. Active items take hover gray, ink, medium weight, and a 2px orange bar on the left edge. Tabs are 36px with an orange 1px underline on the active tab.

### Ledger row
The signature list row. Sits inside a bordered raised container, hairline between rows, hover gray on hover with a fast transition.

### Scoreboard and scoring pad
The board is a dark instrument in both themes, re-scoping the surface and text tokens so inner components need no special cases. Ball chips are round: dot is sunken and muted, four is peach and orange, six is solid orange, wicket is solid ink, extra is amber. Pad keys follow the same tone map on sunken 6px keys. The chase track is a 3px hairline track with an orange fill.

### Live dot
A 6px Ember dot with a soft expanding ping. It appears beside the word Live, never alone.

## Do's and Don'ts

### Do:
- **Do** use true neutral grays and the single orange accent.
- **Do** put text orange on type and fill orange on surfaces, with on-accent ink over fill.
- **Do** keep page h1 at the headline size and section h2 at the title size.
- **Do** group lists as ledger rows inside one bordered raised container.
- **Do** show stats as a `dl` strip with left border dividers.
- **Do** set every changing number in tabular figures.
- **Do** write minimal, sentence case copy.
- **Do** design in light first and let dark follow through the same tokens.

### Don't:
- **Don't** tint the grays green, blue, or warm.
- **Don't** use the uppercase label as a kicker or eyebrow above a heading.
- **Don't** add shadows to resting cards.
- **Don't** set white text on the orange fill.
- **Don't** introduce a second accent hue outside status colors and team marks.
- **Don't** signal status with color alone.
