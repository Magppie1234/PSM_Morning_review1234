---
name: Sales Efficiency margin
description: Compact operational summaries with source-aware chart and table details.
colors:
  ink: "#131c33"
  ink-secondary: "#33405a"
  muted: "#626b7d"
  accent: "#1d5ce0"
  surface: "#ffffff"
  line: "#e7e7e2"
  line-soft: "#f0f0ec"
  warning: "#8f5800"
  warning-surface: "#fdf6e8"
  warning-line: "#eedcb2"
typography:
  heading:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 750
  metric:
    fontSize: "1.45rem"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-.02em"
  label:
    fontSize: ".76rem"
    fontWeight: 750
    lineHeight: 1.4
  supporting:
    fontSize: ".71rem"
    lineHeight: 1.4
rounded:
  card: "12px"
  control: "6px"
  close: "8px"
spacing:
  grid: "10px"
  section: "14px"
  detail: "20px"
components:
  metric-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "13px 14px"
  detail-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 16px"
  detail-toggle-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 16px"
  measure-select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  close-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.close}"
    width: "36px"
    height: "36px"
---

# Design System: Sales Efficiency margin

## Overview

**Creative North Star: "Operate"**

Operate keeps the existing navy-and-white Sales workspace and Manrope typography. Shallow metric cards expose the critical value, comparison and sample; selecting a card reveals the calculation and breakdown. This is a feature extension, not a replacement brand.

**Key Characteristics:**

- Compact summaries with explicit units and sample context.
- Detailed charts and tables on demand.
- Source-aware wording and visible missing-data states.

Scope: this record governs `EfficiencyMargin.jsx`, `MetricCard.jsx`, `EfficiencyDetails.jsx`, `TrendChart.jsx` and `format.js`, with `../../../styles/sales-efficiency.css` and the shared Sales section shell. It preserves the durable white/navy, compact-density commitments in the repository PRODUCT.md. The root DESIGN.md records an older standalone composition and remains unchanged; this feature record does not redefine unrelated boards or navigation.

## Colors

Deep navy carries values and headings; softer navy carries category names. Muted slate carries comparison, sample and explanatory copy. White panels and pale neutral borders maintain the incumbent Sales workspace. Blue marks actionable arrows, selected detail controls and the leading bar. Other ranked bars use muted slate. Amber is reserved for the explicit service/installation inclusion notice.

Values above are extracted from the Sales/Pre Sales variables in `../../../styles/presales.css`. The application variables are scoped to the existing `.ps` shell; sidecar previews supply literal fallbacks so isolated examples render reliably. They are not new global tokens.

## Typography

Manrope is inherited from the app, with system sans fallbacks. Values use tabular numerals and tight tracking. Units are smaller and muted; comparison and sample text remain subordinate. The feature heading stays modest, leaving the data in control. Detail tables use .78rem text and trend labels use 11px text. This records current density, not a universal minimum-size or contrast-certification claim.

## Layout

The wide overview has four metric columns, making two rows for the current eight metrics, followed by three breakdown cards. The metric grid steps to three columns at 1000px, two at 740px and one at 380px. Breakdown cards stack at 740px. The heading also stacks at that breakpoint.

Product and regional overview cards show three leading categories plus an Other aggregate when required. The monthly card shows the final four monthly closure values, with its total spanning all supplied months. These are compact previews, not complete tables.

The native detail dialog is capped at 820px, with 32px total horizontal clearance and a viewport-relative maximum height. At 740px its horizontal clearance becomes 20px and padding becomes 14px. Its header remains sticky while detail content scrolls. Tables scroll horizontally inside their own container.

## Elevation & Depth

Overview cards remain flat with thin borders. Hover changes the border to blue and the fill to the soft neutral surface. The modal backdrop is navy at 40% opacity, providing separation without introducing a new material language. Feature controls use a 2px blue focus outline offset by 3px. No feature-specific entrance animation is implemented.

## Shapes

Cards and dialog use the shared gentle card radius. Controls use smaller corners. Mini-bars are thin, square tracks: 5px in summaries and 9px in detail. The arrow-up-right icon signals that the whole card opens a detail view; the icon alone is not the target.

## Components

**Metric cards.** Whole-card buttons expose the label, value and unit, previous comparison, and supplied sample label. Unavailable values say “Not recorded”; missing comparison says “No previous comparison.” Selection opens both comparison bars and a period/value/record-count table, followed by relevant calculation notes.

**Breakdown cards and detail controls.** Product and regional details open on Chart; Table exposes all supplied categories, including zero values. Ranked detail charts retain eight positive categories plus Other where needed. Monthly detail offers a native measure selector for intake, qualified contacts, closures and closed value; Table shows all monthly measures. Selected Chart/Table buttons expose aria-pressed. There is no free-text input or chip in this feature.

**Charts.** Mini-bars expose a readable aggregate accessible label. The monthly SVG uses three horizontal guide lines, a single blue series, sparse month labels and point titles. Missing numeric observations break the line. Its complete data remains available in Table; do not imply a rich interactive tooltip that the implementation does not provide.

**Dialog.** Details load lazily after selection, with an “Opening detail…” status. The native modal has a labelled title and an autofocus close button. Close, Escape and backdrop clicks dismiss it; cleanup returns focus to the connected triggering card. Coarse-pointer close, toggle and select controls have a 44px minimum height.

**Shared Sales navigation.** The existing white segmented tab strip retains blue selected tabs and muted inactive labels. Navigation and filters remain owned by the shared Sales shell; the feature does not replace them.

**Data and calculation context.** Working-day rates use the current Monday–Saturday rule. Intake, qualification and closure populations are not a conversion funnel. Closure intervals exclude invalid dates; average order value is described as closed-contact value pending business confirmation. Product order value covers orders created across all stages and currently excludes Sunroof. Monthly spikes alone do not prove imports. Formatting uses Indian grouping and lakh/crore currency abbreviations.

The backend has 30-minute source and response caching, while the frontend reuses active query data. Freshness and refresh behavior belong to the shared data layer. See the repository `docs/architecture/dashboard-system-design.md`; this visual record makes no live-source latency guarantee.

**Review record.** Completed feature review: Pass, with verification limits. The coordinating implementation review confirmed desktop and 390px mobile rendering, card-to-detail/table interaction, Escape dismissal and focus return. Evidence is stored at repository `.impeccable/review/desktop.png`, `mobile.png` and `mobile-detail.png`. This documenter extracted source values and did not independently rerun those browser checks. The review does not certify every viewport, assistive technology, contrast pairing or CRM mapping. No material fixes were required by that review.

## Do's and Don'ts

- **Do** preserve the incumbent Sales palette and Manrope typography.
- **Do** keep period, unit, sample and missing-data context attached to values.
- **Do** keep chart detail paired with a complete table and keyboard dismissal.
- **Don't** infer conversion, profit or import causes from these activity measures.
- **Don't** expand the overview into a wall of full charts.
- **Don't** treat the root standalone design record as a prescription to replace the current Sales shell.

