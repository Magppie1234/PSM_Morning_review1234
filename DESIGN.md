---
name: PSM Morning Review
description: Compact daily leadership dashboard based on the supplied PSM Morning Review reference.
colors:
  canvas: "#f7f9fd"
  surface: "#fff"
  ink: "#10224c"
  heading: "#0c1e4a"
  secondary: "#5e739d"
  icon-blue: "#1761ec"
  action-blue: "#1260e9"
  focus-blue: "#76a7ff"
  panel-line: "#dce6f4"
  table-header: "#f5f8fd"
  positive: "#0d9b5a"
  danger: "#b6232f"
  danger-line: "#ffc6c9"
  warning: "#a56300"
  warning-line: "#ffdfa5"
  priority-high: "#ffdedf"
  priority-medium: "#fff0cb"
typography:
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.65rem, 2vw, 2rem)"
    lineHeight: 1.1
    letterSpacing: "-.04em"
  section:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.02rem"
    letterSpacing: "-.025em"
  metric:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.42rem, 2vw, 2rem)"
    lineHeight: 1.1
    letterSpacing: "-.04em"
  table:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: ".76rem"
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: ".82rem"
    fontWeight: 750
rounded:
  control: "8px"
  panel: "10px"
  priority: "20px"
  disclosure: "99px"
spacing:
  filter-gap: "8px"
  card-gap: "12px"
  panel-gap: "14px"
components:
  metric-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "18px 17px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  filter:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "36px"
---

# Design System: PSM Morning Review

## Overview

The supplied PSM Morning Review mockup is the binding visual reference: a clean, compact leadership dashboard with white panels, deep navy text, blue interactions, and restrained risk colors. There is no sidebar. This standalone app has its own Manrope-based visual system; do not import the typography, shell, or tokens of another MAGPPIE project.

This document records the implemented design in `frontend/src/App.jsx`, `frontend/src/components/`, and `frontend/src/styles/global.css`, together with the commitments in `PRODUCT.md`. The frontmatter extracts existing CSS values; it does not imply that the application already exposes these as CSS custom properties. The only computed color custom property in the current components is the funnel's stage color.

## Colors

White cards sit on a very pale blue-gray page. Navy headings and values lead; muted blue supporting text recedes. Bright blue marks icons and text actions. Controls retain a white surface and pale blue border.

Risk cards use two semantic treatments: danger has red text and borders over a subtle pale-red gradient; warning has amber text and borders over a pale-cream gradient. Status dots in the performance table accompany explicit On track, Watch, or At risk text. Priority chips similarly pair High or Medium labels with a tinted background. Preserve these labels rather than relying on hue alone.

The funnel moves through progressively stronger blue fills using the existing stage-index HSL formula. Keep that sequence distinct from risk semantics. Its final stage uses white text; preceding stages use navy. These are the current implementation choices, not a claim that every foreground/background pairing has been contrast-certified.

## Typography

Manrope is imported from Google Fonts at weights 400–800, with system sans fallbacks. It serves headings, figures, controls, and tables. There is no serif or monospace family in this app. Strong weight and tight tracking provide hierarchy without a decorative display face.

The page title and KPI figures scale with viewport width as recorded above. Section titles are compact and bold. Supporting card copy uses .74rem, action links .75rem, table cells .76rem, and table headers .67rem. Preserve the current small-table density when matching the reference; do not claim a universal minimum-font-size rule that the code does not implement. Table figures use tabular numerals.

## Layout

At the desktop reference size, the page reads in this order:

1. Title and subtitle at left; reporting-period and four dimension filters at right.
2. Six equally weighted KPI cards in one row.
3. Five risk cards in one row.
4. Two adjacent tables: PSM Performance on the left and Senior Decision Queue on the right.
5. A full-width lead funnel beneath the tables.

The centered workspace is capped at 1180px, with 14px side padding. KPI and risk grids use 12px gaps. The table panels have a 1.15:1 column ratio and a 14px gap. The presentation is compact enough to scan as one review workspace, without adding navigation rails or large introduction blocks.

At 900px the card grids use three columns and the table panels stack. At 780px the header stacks and card grids use two columns. At 440px the cards use one column. Tables and funnel stages have horizontal overflow containers. These are source-defined responsive rules; rendered behavior remains the responsibility of the implementation review.

The live-source disclosure sits between the header and KPI rows. It identifies the Zoho CRM snapshot and names lead-stage mappings that are still pending, even though that disclosure is additional to the reference mockup.

## Elevation & Depth

Cards and panels have thin pale-blue borders. Data panels carry a low-opacity blue shadow. Metric cards lift slightly on hover with a stronger soft shadow and border; these are interaction cues, not persistent dramatic elevation. There is no modal or drawer in the current detail flow.

Focus is expressed by a visible blue outline on buttons, selects, and keyboard-focusable performance rows. The exact shadows, hover transition, and focus treatment are recorded in `.impeccable/design.json`. No reduced-motion override is currently defined in the source; documentation must not imply one exists.

## Shapes

Controls use the modest control radius; cards and panels share the panel radius. Priority badges are rounded capsules and status dots are circular. Funnel stages use connected chevron silhouettes with clipped ends, a flat leading edge on the first stage, and small overlaps between segments. Keep stage labels and values inside the readable area of each segment.

Icons come from Lucide with a 2.2 stroke width: compact 20px marks in cards, a 16px calendar beside the period control, and 26px funnel icons. Their role is identification and scanning, not illustration.

## Components

**Filters.** Use native selects with accessible labels, matching height and pale borders. The current PSM filter is active against live CRM records. City, product, and source remain visibly disabled until their aggregation rules are implemented. The reporting period currently exposes one option. Do not style these as fully functional filters before their data behavior exists.

**KPI cards.** The whole card is a button. Place the icon beside a short label and strong value, optional subtext below, and the supplied comparison at the bottom. Values, trend text, and comparison labels come from the API. The current template always renders an upward arrow and green trend styling on ordinary KPIs; that is an implementation limitation to account for if negative trends are introduced.

**Risk cards.** Reuse the KPI structure at a shallower height, with danger or warning treatment, a trailing chevron, and the supplied risk change. Keep risk semantics explicit. Do not manufacture additional indicators to fill a row.

**Performance table.** Numeric cells align in compact columns, while PSM names align left. Missed and hot-pending values receive red emphasis under the existing conditions. Status text includes a small matching dot. Rows are pointer-selectable and respond to Enter when focused.

**Decision queue.** Lead name and secondary ID share the first column. Priority, ageing, risk reason, and a blue recommended-action button make each row actionable. Unlike performance cells, queue cells wrap text. Keep the two tables comparable in panel styling, without forcing identical column widths.

**Funnel.** Each API-supplied stage is a button with icon, label, value, and conversion text. Conversion labels repeat beneath the connected segments. The report label derives from backend reporting metadata.

**Detail and feedback states.** KPI, risk, table, queue, and funnel actions currently open a dismissible inline notice explaining that detailed lead records await a drilldown route. They do not yet open a real lead list. Loading and error states replace the dashboard with a simple centered message. Document these boundaries rather than promising unavailable drilldowns.

## Do's and Don'ts

- **Do** preserve the supplied reference's six-KPI, five-risk, paired-table, and funnel composition at desktop size.
- **Do** keep the standalone app's Manrope typography, white surfaces, and navy/blue hierarchy.
- **Do** retain labels alongside risk color, accessible control names, and visible focus.
- **Do** preserve live-source disclosures and current filter/drilldown limitations.
- **Don't** add a sidebar, decorative hero, or an unrelated dashboard shell.
- **Don't** fabricate CRM values, trend directions, conversion rates, or functioning lead details in documentation or styling.
- **Don't** treat this source extraction as a browser, accessibility, or live-data validation report.
