---
name: Howzat
description: Colourful, compact matchday software for local cricket and football.
typography:
  interface: Gilroy
  display: Behind The Nineties
  editorial: Apple Garamond
colors:
  app-surface: '#f7f8f5'
  app-card: '#ffffff'
  app-ink: '#242e29'
  app-secondary: '#566159'
  app-muted: '#667166'
  app-border: '#e0e5dc'
  app-action: '#214d3c'
  landing-paper: '#faf9f5'
  landing-ink: '#25232c'
  landing-hero: '#242329'
  landing-action: '#bca0ff'
  lilac: '#e2d6fb'
  mint: '#dcefe4'
  peach: '#f6dfca'
  lime: '#d5ed9d'
shapes:
  control-radius: 6px
  app-card-radius: 10px
  marketing-card-radius: 16px
  marketing-hero-radius: 22px
  border-width: 1px
---

# Howzat design reference

The direction combines rounded colour blocks, duotone sports artwork and restrained offset edges. Gilroy leads the interface. Serif type marks the landing hero, closing statement and wordmark. Copy stays short.

The landing page and working app share typography, icons and spacing. The landing page uses larger coloured surfaces. The app keeps scores, actions and statuses easy to read during a match.

## Sources

- `apps/web/src/styles/tokens.css` defines the app colours, themes and shared dimensions.
- `apps/web/src/styles/index.css` defines shared typography, cards and page layouts.
- `apps/web/src/features/home/home.css` defines the landing palette and composition.
- `apps/web/src/components/ui/BrandIcon.tsx` defines the rounded duotone sports icons.

## Typography

| Role                    | Family              | Size    | Weight     |
| ----------------------- | ------------------- | ------- | ---------- |
| Landing hero            | Behind The Nineties | 49–88px | 400        |
| Landing section heading | Gilroy              | 29–42px | 500        |
| App page heading        | Gilroy              | 28–32px | 700        |
| App section heading     | Gilroy              | 16–18px | 700        |
| Tournament name         | Gilroy              | 19–20px | 500        |
| Working text            | Gilroy              | 13–15px | 400 or 500 |
| Controls                | Gilroy              | 13–14px | 500        |
| Supporting data         | Gilroy              | 11–12px | 400 or 500 |
| Main live score         | Gilroy              | 56–80px | 700        |

Changing figures use tabular numerals. Runs and bowling wickets carry stronger weight than secondary statistics. Long player and tournament names wrap; they do not push figures out of view.

## Colour and depth

The landing hero stays charcoal in both themes. Lilac is the primary marketing accent. Mint and peach distinguish feature groups; lime is a small illustration accent. Each coloured panel has dark, readable text.

Working screens use white cards over a quiet background in light mode and separate dark surfaces in dark mode. Cards have a 1px grey border and no coloured top accent. Status colour accompanies a written label.

Offset shadows belong to the landing call to action and product illustrations. Working cards remain flat. Sheets retain a shadow to separate them from the page below.

## Icons and illustrations

Brand icons use rounded filled shapes and two related colours. Their SVG view box is square, and the caller supplies the rendered size. Utility controls retain simple outline icons for clarity at small sizes.

The landing artwork and product preview are static. The preview is labelled as an example and switches between cricket and football. It uses existing team marks and ball chips. Artwork does not cover the score or meaningful text.

## Layout

The app uses a horizontal desktop masthead and mobile bottom navigation. Scoring screens omit the bottom navigation to keep controls within reach.

Tournament lists separate in-progress, setup and completed competitions. Cards place sport and status first, tournament name next, then format and a divided footer for team counts and match length. A single primary creation action sits in the header.

The cricket Live view prioritises the score, current over and compact player tables. On desktop, the over chart sits beside the player summary. On mobile, it follows the summary. Detailed wicket history expands on request.

Scorecards display one innings at a time. Every batting and bowling column fits the phone width. Runs, balls and rates remain separate readable data, with dismissal text below the player name.

The landing page alternates a dark illustrated hero, a working product preview, coloured feature panels, a short setup sequence, questions and a closing action. Marketing content has one brief supporting sentence where it adds meaning.

## Interaction and verification

Primary actions remain distinct from secondary links. Touch controls are at least 44px high. Keyboard focus is visible. Forms associate errors with their fields; sheets close with Escape and restore focus.

Both themes use the same content and layout. Reduced motion does not hide feedback or leave animation artifacts. Decorative imagery has no pointer events or background animation.

Visual review covers 320px phones, larger phones, tablet widths and desktop. Verification includes long names, empty content, error retry, sheet focus and primary destinations. Browser checks complement screenshot review; passing tests alone does not establish visual quality.
