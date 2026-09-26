// India demand map — one component, both boards (Sales review and Pre Sales review).
//
// PROPS
//   points   [{ city, leads, closures, value }]  — a plain array the caller assembles. One entry per
//            record or per city; rows that resolve to the same place are summed here, so the caller
//            does not have to group. `city` is the canonical spelling the boards already normalise to
//            ("Bangalore", "Gurgaon"). `closures` and `value` may be absent — see below.
//   loading  boolean  — dim the current figures while the API is re-read. The map is never emptied;
//            the last good numbers stay on screen (the board's convention, no spinner).
//   title    string   — optional heading. Defaults to "Demand by city".
//
// THE TWO FILTERS the customer asked for
//   Lead generation — how many leads came from each city (`leads`).
//   Closures        — how many closed (`closures`), with their value (`value`) in the readout and list.
//   Switching re-scales everything: the colour bins, the bubble radii and the ranked list are all
//   recomputed from the selected measure. Pre Sales passes raw leads with no `closures` key at all, so
//   the Closures filter disables itself and says why rather than drawing an empty map.
//
// ENCODING (see the map's own legend, which states this on screen)
//   Colour — one sequential blue ramp, light to dark, quintile bins over the cities that have a value.
//            One hue, monotone lightness: safe for every kind of colour blindness, and colour is never
//            the only channel because the ranked list carries the figures.
//   Size   — bubble AREA is proportional to the measure, so the radius is its SQUARE ROOT. Delhi has
//            ~70x Kochi's leads; drawn linearly its dot would be 70x wide and swallow half of north
//            India. Under the square root it is ~8x wide, which is what "much bigger" should look like.
//
// ONE MARK IS NOT ALWAYS ONE ROW
//   Delhi's circle is about 100 km across at this zoom, so its own colonies sit inside it. Those
//   localities roll up to the city for the MAP only (the plotAt column in indiaGeo.js); each keeps its
//   own row in the table, labelled with where it is drawn. Hovering a circle reads out the whole group
//   and highlights every row it covers; focusing a row reads out that one place and lights its circle.
//
// ACCESSIBILITY
//   A map is a picture, so the figures live in a real <table> beside it, ranked, carrying exactly the
//   same numbers. The table is the keyboard and screen-reader interface: each row's button focuses and
//   highlights its bubble, click pins the readout. The SVG itself is one labelled image with a summary,
//   and its bubbles are aria-hidden so a screen reader is not read 90 unordered dots.
//   Places with no coordinate are NOT dropped — they are listed under the table with the reason.
import { useId, useMemo, useState } from 'react';
import {
  CITY_COORDS,
  INDIA_STATES,
  INDIA_VIEWBOX,
  MAPPED_CITY_COUNT,
  MERCATOR,
  lookupPlace,
} from './indiaGeo';

/* ---- Projection ------------------------------------------------------------
   Spherical Mercator, the same formula indiaGeo.js used to pre-project the state
   outlines, so cities and boundaries share one coordinate space. Documented in
   full at the top of indiaGeo.js. */
const DEG = Math.PI / 180;

function project(lat, lon) {
  const mx = lon * DEG;
  const my = Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
  return {
    x: (mx - MERCATOR.originX) * MERCATOR.scale,
    y: (MERCATOR.originY - my) * MERCATOR.scale,
  };
}

/* ---- Scales ---------------------------------------------------------------- */

// Sequential blue, light -> dark. Steps 250/350/450/550/650 of the shared blue ramp: one hue (3 degrees
// of spread), lightness strictly decreasing, and the lightest step still clears the white panel. Picked
// over the full 100-700 range because a bubble is a mark, not a filled region — step 100 on white is
// 1.3:1 and a small dot in it would be invisible.
const RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];

const MAX_R = 34; // viewBox units, ~13px on a 380px-wide map
// The floor keeps a one-lead town clickable. It is deliberately small: the long tail is ~100 marks,
// most of them inside or beside a big one, and every extra pixel of floor is a pixel scrubbed off
// whatever they sit on.
const MIN_R = 3.5;

// Geometric (order-of-magnitude) breaks over the cities that actually have a value.
//
// Demand is brutally skewed: Delhi carries 350 leads and roughly half of the places carry one. Neither
// obvious scheme works. Equal-width bins would paint everything except Delhi, Hyderabad and Bangalore
// the palest step. Quantile bins go wrong the other way — with a long tail of ones, the lower bands
// come out as "1", "2", "3–4" while the darkest band has to span 11 to 350, so a market with eleven
// leads is coloured the same as the capital. Geometric breaks give each step a constant ratio, which is
// how a reader actually thinks about counts like these ("a handful", "dozens", "hundreds").
function magnitudeBreaks(values, binCount) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const min = Math.max(Math.min(...values), 1);
  if (max <= min) return [];
  const ratio = (max / min) ** (1 / binCount);
  const breaks = [];
  for (let i = 1; i < binCount; i++) breaks.push(min * ratio ** i);
  // Collapse breaks that round to the same integer, so the legend never shows two identical bands.
  return breaks.filter((b, i) => i === 0 || Math.floor(b) > Math.floor(breaks[i - 1]));
}

const binOf = (value, breaks) => {
  let i = 0;
  while (i < breaks.length && value > breaks[i]) i++;
  return i;
};

// Area proportional to the measure => radius proportional to its square root.
const radiusOf = (value, max) =>
  max > 0 ? Math.max(MIN_R, MAX_R * Math.sqrt(Math.max(value, 0) / max)) : MIN_R;

/* ---- The density (heat) layer ------------------------------------------------
   The customer asked for the familiar kernel-density look — soft overlapping blobs
   running blue through green and yellow to red — rather than discrete circles.

   HOW IT IS DRAWN, with no new dependency: a Gaussian kernel is summed onto a coarse
   grid in JS, each cell is bucketed into one of seven bands, and each band is emitted
   as ONE <path> holding all of its cells as rectangle subpaths. Seven paths, not five
   thousand rects. One feGaussianBlur then melts the bands into continuous blobs, and
   the layer is clipped to the coastline so it reads as a thematic layer rather than a
   smudge over the Arabian Sea.

   HOW THE SKEW IS HANDLED — the crux, and two separate decisions:

   1. Each city's kernel is weighted by the SQUARE ROOT of its figure, not the figure.
      Delhi carries 627 leads against a long tail of ones. Weighted linearly it is 627x
      a one-lead town, and the map is a single red dot over the NCR with a flat blue
      wash everywhere else. Under the square root it is 25x, and Bangalore, Mumbai,
      Hyderabad and Surat become centres in their own right — which is the truth the
      map exists to show.

   2. The summed field is displayed through a SECOND square root, measured against the
      99.5th percentile of the populated cells rather than the maximum. The percentile
      stops one freak cell owning the top of the ramp; the second root spends the middle
      of the ramp on the middle of the data.

   The consequence, stated in the legend and again in the caption: the shading is
   RELATIVE. Red means "the densest cluster in this view", not a fixed number of leads.
   Absolute figures live in the table, where they can be exact. */

// Blue -> cyan -> green -> yellow -> orange -> red, with alpha carrying the low end so sparse
// country keeps showing the base map underneath.
//
// This is a multi-hue ramp for magnitude, which the house data-viz rules forbid in general: a
// rainbow hides order, because a reader cannot say from the colours alone whether green is more
// than yellow. Those rules name exactly one exception — "semantic heat" — and require it to ship
// with a scale legend. This is that case: heat is a convention people already read, the customer
// sent a reference image of one, and the gradient legend under the map carries the scale. Two
// things keep it as honest as it can be for colour-blind readers, green-against-red being the
// common confusion: lightness climbs through the middle of the ramp and falls again at the red
// end, so the hot end is separable by lightness alone, and the Points view — one click away —
// uses the validated single-hue blue ramp instead.
const HEAT = [
  { fill: '#2a63c8', alpha: 0.34 },
  { fill: '#1e93d6', alpha: 0.46 },
  { fill: '#17b39a', alpha: 0.58 },
  { fill: '#4fbf3f', alpha: 0.68 },
  { fill: '#d8c22f', alpha: 0.78 },
  { fill: '#ef8724', alpha: 0.87 },
  { fill: '#d2271c', alpha: 0.94 },
];

const CELL = 14; // viewBox units per grid cell
const BANDWIDTH = 48; // kernel sigma in viewBox units, roughly 155 km
/* Cells below this share of the scale are left unpainted, and it is the most consequential number
   in this file. A kernel density layer will happily wash faint colour over the Thar desert and the
   whole north-east on the strength of one lead in Guwahati, and a reader takes shading to mean
   demand. At 0.1 the country was shaded corner to corner; at 0.22 the blobs stop where the data
   stops and empty country stays empty, which is the honest picture. */
const HEAT_FLOOR = 0.22;

/** Sum a Gaussian kernel per city onto a coarse grid, walking only each city's own neighbourhood. */
function densityGrid(marks) {
  const cols = Math.ceil(INDIA_VIEWBOX.width / CELL);
  const rows = Math.ceil(INDIA_VIEWBOX.height / CELL);
  const grid = new Float64Array(cols * rows);
  const reach = BANDWIDTH * 2.6; // past this the kernel is worth less than a rounding error
  const twoSigmaSq = 2 * BANDWIDTH * BANDWIDTH;

  for (const m of marks) {
    const w = Math.sqrt(m.v);
    const c0 = Math.max(0, Math.floor((m.x - reach) / CELL));
    const c1 = Math.min(cols - 1, Math.floor((m.x + reach) / CELL));
    const r0 = Math.max(0, Math.floor((m.y - reach) / CELL));
    const r1 = Math.min(rows - 1, Math.floor((m.y + reach) / CELL));
    for (let r = r0; r <= r1; r++) {
      const cy = (r + 0.5) * CELL;
      for (let c = c0; c <= c1; c++) {
        const cx = (c + 0.5) * CELL;
        const d2 = (cx - m.x) ** 2 + (cy - m.y) ** 2;
        if (d2 > reach * reach) continue;
        grid[r * cols + c] += w * Math.exp(-d2 / twoSigmaSq);
      }
    }
  }
  return { grid, cols, rows };
}

/** One SVG path per heat band; each path carries its cells as rectangle subpaths. */
function heatBands(marks) {
  if (!marks.length) return [];
  const { grid, cols, rows } = densityGrid(marks);

  const populated = Array.from(grid).filter((v) => v > 0).sort((a, b) => a - b);
  if (!populated.length) return [];
  const ceiling = populated[Math.min(populated.length - 1, Math.floor(populated.length * 0.995))];
  if (!(ceiling > 0)) return [];

  const parts = HEAT.map(() => []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r * cols + c];
      if (v <= 0) continue;
      const t = Math.min(1, Math.sqrt(v / ceiling));
      if (t < HEAT_FLOOR) continue;
      // Re-spread what survives the floor across the whole ramp, so the legend never shows a
      // colour the map does not contain.
      const u = (t - HEAT_FLOOR) / (1 - HEAT_FLOOR);
      const band = Math.min(HEAT.length - 1, Math.floor(u * HEAT.length * 0.999999));
      parts[band].push(`M${c * CELL} ${r * CELL}h${CELL}v${CELL}h${-CELL}Z`);
    }
  }
  // Low bands first so the hot ones paint on top.
  return HEAT.map((h, i) => ({ ...h, key: i, d: parts[i].join('') })).filter((b) => b.d);
}

/* Pick the centres to name on the map, skipping any that would land on top of a label already
   placed. Delhi and Gurgaon are 9 units apart at this zoom; without this, "Delhi" — the whole point
   of the map — is printed underneath "Gurgaon" and cannot be read at all. */
function nameable(marks, wanted = 5, minGap = 70) {
  const picked = [];
  for (const m of marks) {
    if (picked.length >= wanted) break;
    if (picked.some((p) => Math.hypot(p.x - m.x, p.y - m.y) < minGap)) continue;
    picked.push(m);
  }
  return picked;
}

/* Below this much data a density map is theatre. Seven places and nine leads — what the Pre Sales
   board shows on a Daily period — would draw seven smudges that say nothing anyone could act on,
   and the blur would imply demand spread across country where there is none. Under the threshold
   the component falls back to the circles and says why. */
const HEAT_MIN_POINTS = 12;
const HEAT_MIN_TOTAL = 40;

/* ---- Formatting ------------------------------------------------------------ */

const nf = new Intl.NumberFormat('en-IN');

// Lakhs and crores, matching the ₹ L / ₹ Cr labels the API already sends.
function formatValue(n) {
  if (!Number.isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(abs >= 1e8 ? 0 : 1)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(abs >= 1e6 ? 0 : 1)} L`;
  return `₹${nf.format(Math.round(n))}`;
}

const MEASURES = {
  leads: { key: 'leads', label: 'Lead generation', noun: 'leads', one: 'lead', short: 'Leads' },
  closures: { key: 'closures', label: 'Closures', noun: 'closures', one: 'closure', short: 'Closures' },
};

// "1 closures" in a list of small markets reads as a bug and costs the board credibility.
const countOf = (n, measure) => `${nf.format(n)} ${n === 1 ? measure.one : measure.noun}`;

const VIEWS = [
  { key: 'heat', label: 'Heat' },
  { key: 'points', label: 'Points' },
];

const WHY_UNMAPPED = {
  region: 'A state or region, not a single place — it cannot be drawn as one point',
  outside: 'Outside India — not on this map',
  unrecorded: 'The city field was empty on these records',
  nonplace: 'The city field does not hold a place name',
  unknown: 'No coordinate on file for this name',
};

/* ---- Aggregation ----------------------------------------------------------- */

function aggregate(points) {
  const mapped = new Map();
  const unmapped = new Map();
  let anyClosureData = false;

  for (const p of Array.isArray(points) ? points : []) {
    if (!p) continue;
    const leads = Number.isFinite(Number(p.leads)) ? Number(p.leads) : 0;
    const hasClosures = p.closures != null && Number.isFinite(Number(p.closures));
    if (hasClosures) anyClosureData = true;
    const closures = hasClosures ? Number(p.closures) : 0;
    const value = Number.isFinite(Number(p.value)) ? Number(p.value) : 0;

    const place = lookupPlace(p.city);
    const bucket = place.status === 'mapped' ? mapped : unmapped;
    const existing = bucket.get(place.key);
    if (existing) {
      existing.leads += leads;
      existing.closures += closures;
      existing.value += value;
    } else {
      const plotKey = place.coord?.plotAt || place.key;
      bucket.set(place.key, {
        key: place.key,
        label: place.label,
        status: place.status,
        note: place.note,
        region: place.coord?.region,
        coord: place.coord,
        // Where this row is DRAWN. Equal to its own key unless the coordinate table rolls it up —
        // see the plotAt note in indiaGeo.js.
        plotKey,
        plotLabel: plotKey === place.key ? null : CITY_COORDS[plotKey]?.name || plotKey,
        leads,
        closures,
        value,
      });
    }
  }
  return { mapped: [...mapped.values()], unmapped: [...unmapped.values()], anyClosureData };
}

/* ---- Component -------------------------------------------------------------- */

export default function IndiaHeatMap({ points, loading = false, title = 'Demand by city' }) {
  const uid = useId();
  const [measureKey, setMeasureKey] = useState('leads');
  const [viewKey, setViewKey] = useState('heat');
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);

  const { mapped, unmapped, anyClosureData } = useMemo(() => aggregate(points), [points]);

  // Pre Sales sends raw leads and never sets `closures`. That is a missing measure, not a zero one, so
  // the filter is disabled and explains itself instead of drawing an empty country.
  const closuresAvailable = anyClosureData;
  const measure = MEASURES[closuresAvailable ? measureKey : 'leads'];

  const model = useMemo(() => {
    const withValue = mapped.filter((c) => c[measure.key] > 0);
    const totals = withValue.reduce((n, c) => n + c[measure.key], 0);

    // One mark per plot target. A locality that rolls up adds its figures to its parent's mark and
    // still keeps its own row below; the mark's tooltip says how many places it stands for.
    const byMark = new Map();
    for (const row of withValue) {
      const parent = CITY_COORDS[row.plotKey] || row.coord;
      const mark = byMark.get(row.plotKey);
      if (mark) {
        mark.v += row[measure.key];
        mark.leads += row.leads;
        mark.closures += row.closures;
        mark.value += row.value;
        mark.members.push(row.label);
      } else {
        byMark.set(row.plotKey, {
          key: row.plotKey,
          label: parent.name,
          region: parent.region,
          lat: parent.lat,
          lon: parent.lon,
          v: row[measure.key],
          leads: row.leads,
          closures: row.closures,
          value: row.value,
          members: [row.label],
        });
      }
    }

    const marks = [...byMark.values()];
    const max = marks.reduce((n, m) => Math.max(n, m.v), 0);
    const min = marks.reduce((n, m) => Math.min(n, m.v), Infinity);
    const breaks = magnitudeBreaks(marks.map((m) => m.v), RAMP.length);

    const plotted = marks
      .map((m) => ({
        ...m,
        ...project(m.lat, m.lon),
        r: radiusOf(m.v, max),
        bin: binOf(m.v, breaks),
      }))
      // Largest first, so a big mark never hides a smaller one painted under it.
      .sort((a, b) => b.r - a.r);


    // Cities that resolve to a coordinate but score zero on this measure still belong in the list — a
    // city with 40 leads and no closures is a finding, not an absence.
    const zeroed = mapped
      .filter((c) => c[measure.key] <= 0)
      .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));

    return {
      plotted,
      places: withValue.length,
      ranked: [...withValue].sort(
        (a, b) => b[measure.key] - a[measure.key] || a.label.localeCompare(b.label),
      ),
      zeroed,
      breaks,
      max,
      min: Number.isFinite(min) ? min : 0,
      totals,
    };
  }, [mapped, measure.key]);

  // Enough data for a density map to mean anything? See HEAT_MIN_POINTS.
  const heatWorthIt =
    model.plotted.length >= HEAT_MIN_POINTS && model.totals >= HEAT_MIN_TOTAL;
  const view = heatWorthIt ? viewKey : 'points';

  // Only pay for the grid when the heat layer is actually on screen.
  const bands = useMemo(
    () => (view === 'heat' ? heatBands(model.plotted) : []),
    [view, model.plotted],
  );

  /* Hover and focus can come from either half of the component, so `active` records which:
       { kind: 'mark' }  — the pointer is on a circle; the readout shows the whole mark.
       { kind: 'place' } — a table row has focus; the readout shows that one place.
     Either way the SAME mark lights up on the map, and every table row drawn at that mark is
     highlighted, so the two halves always agree about what is being looked at. */
  const active = hovered ?? pinned;
  const activeMark =
    active &&
    (active.kind === 'mark'
      ? model.plotted.find((m) => m.key === active.key)
      : model.plotted.find((m) => m.key === mapped.find((r) => r.key === active.key)?.plotKey));
  const activePlace =
    active && active.kind === 'place' ? mapped.find((r) => r.key === active.key) : null;
  const activeMarkKey = activeMark?.key ?? null;

  // What the readout says. A table row speaks for itself and adds a line naming where it is drawn;
  // a circle speaks for everything drawn at it, which for Delhi is the city plus its colonies.
  const readout = activePlace
    ? {
        label: activePlace.label,
        region: activePlace.region,
        leads: activePlace.leads,
        closures: activePlace.closures,
        value: activePlace.value,
        note: [
          activePlace.note,
          activePlace.plotLabel && `Drawn on the map at ${activePlace.plotLabel}`,
        ]
          .filter(Boolean)
          .join(' · '),
      }
    : activeMark
      ? {
          label: activeMark.label,
          region: activeMark.region,
          leads: activeMark.leads,
          closures: activeMark.closures,
          value: activeMark.value,
          note:
            activeMark.members.length > 1
              ? `This point covers ${nf.format(activeMark.members.length)} places: ${activeMark.members
                  .slice(0, 6)
                  .join(', ')}${activeMark.members.length > 6 ? ' and more — see the table' : ''}`
              : null,
        }
      : null;

  const unmappedTotal = unmapped.reduce((n, c) => n + (c[measure.key] || 0), 0);
  const isEmpty = !loading && model.plotted.length === 0;

  const headingId = `${uid}-h`;
  const svgTitleId = `${uid}-svg-t`;
  const svgDescId = `${uid}-svg-d`;

  const legendBands = RAMP.slice(0, model.breaks.length + 1).map((fill, i) => {
    const lo = i === 0 ? model.min : Math.ceil(model.breaks[i - 1] + 0.000001);
    const hi = i < model.breaks.length ? Math.floor(model.breaks[i]) : model.max;
    return { fill, label: lo >= hi ? nf.format(hi) : `${nf.format(lo)}–${nf.format(hi)}` };
  });

  return (
    <section className={`im${loading ? ' im-loading' : ''}`} aria-labelledby={headingId}>
      <header className="im-head">
        <div>
          <h3 className="im-title" id={headingId}>{title}</h3>
          <p className="im-sub">
            {model.places
              ? `${countOf(model.totals, measure)} across ${nf.format(model.places)} ${
                  model.places === 1 ? 'place' : 'places'
                }, drawn as ${nf.format(model.plotted.length)} ${
                  model.plotted.length === 1 ? 'point' : 'points'
                }`
              : 'No places to plot'}
          </p>
        </div>

        <div className="im-controls">
          <div className="im-modes" role="group" aria-label="Measure shown on the map">
            {Object.values(MEASURES).map((m) => {
              const disabled = m.key === 'closures' && !closuresAvailable;
              return (
                <button
                  key={m.key}
                  type="button"
                  className="im-mode"
                  aria-pressed={!disabled && measure.key === m.key}
                  disabled={disabled}
                  aria-describedby={disabled ? `${uid}-why` : undefined}
                  onClick={() => { setMeasureKey(m.key); setPinned(null); setHovered(null); }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="im-modes im-views" role="group" aria-label="How the map is drawn">
            {VIEWS.map((v) => {
              const disabled = v.key === 'heat' && !heatWorthIt;
              return (
                <button
                  key={v.key}
                  type="button"
                  className="im-mode"
                  aria-pressed={!disabled && view === v.key}
                  disabled={disabled}
                  aria-describedby={disabled ? `${uid}-thin` : undefined}
                  onClick={() => setViewKey(v.key)}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {!closuresAvailable && (
        <p className="im-why" id={`${uid}-why`}>
          Closures are switched off because this board's data has no closure outcome on it — these points
          carry lead counts only. The Sales review, which reads qualified leads through to closure, shows
          both filters.
        </p>
      )}

      {model.plotted.length > 0 && !heatWorthIt && (
        <p className="im-why" id={`${uid}-thin`}>
          Heat is switched off because there is too little here to find a pattern in —{' '}
          {countOf(model.totals, measure)} across {nf.format(model.plotted.length)}{' '}
          {model.plotted.length === 1 ? 'place' : 'places'}. A density layer needs at least{' '}
          {HEAT_MIN_POINTS} places and {HEAT_MIN_TOTAL} {measure.noun} before the blobs mean anything
          rather than just blurring a handful of dots. Widen the period and it comes back on.
        </p>
      )}

      <div className="im-body">
        <figure className="im-figure">
          <svg
            className="im-svg"
            viewBox={`0 0 ${INDIA_VIEWBOX.width} ${INDIA_VIEWBOX.height}`}
            role="img"
            aria-labelledby={`${svgTitleId} ${svgDescId}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <title id={svgTitleId}>Map of India, {measure.noun} by city</title>
            <desc id={svgDescId}>
              {model.plotted.length
                ? (view === 'heat'
                    ? `A density layer shades the country by how concentrated ${measure.noun} are, ` +
                      'from blue where they are sparse to red where they are densest. '
                    : `Each city is a circle whose area and colour show its ${measure.noun}. `) +
                  `The busiest is ${model.plotted[0]?.label} with ` +
                  `${nf.format(model.plotted[0]?.v ?? 0)}. ` +
                  'The same figures are in the ranked table beside this map.'
                : 'No cities to show.'}
            </desc>

            <defs>
              {/* The blur is what turns seven banded grids into overlapping blobs. The filter region
                  is widened because the default -10%/120% box clips a blur this wide. */}
              <filter id={`${uid}-soften`} x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation={CELL * 0.85} />
              </filter>
              {/* Keeps the density inside the coastline, so it reads as a thematic layer and not a
                  stain across the Arabian Sea. clipPath unions its children. */}
              <clipPath id={`${uid}-land`}>
                {INDIA_STATES.map((s) => (
                  <path key={s.name} d={s.d} />
                ))}
              </clipPath>
            </defs>

            <g className="im-land">
              {INDIA_STATES.map((s) => (
                <path key={s.name} d={s.d} />
              ))}
            </g>

            {view === 'heat' && (
              <g clipPath={`url(#${uid}-land)`} aria-hidden="true">
                <g className="im-heat" filter={`url(#${uid}-soften)`}>
                  {bands.map((b) => (
                    <path key={b.key} d={b.d} fill={b.fill} fillOpacity={b.alpha} />
                  ))}
                </g>
              </g>
            )}

            <g className="im-dots" aria-hidden="true">
              {model.plotted.map((m) => {
                const on = {
                  onMouseEnter: () => setHovered({ kind: 'mark', key: m.key }),
                  onMouseLeave: () => setHovered(null),
                  onClick: () =>
                    setPinned(pinned?.key === m.key ? null : { kind: 'mark', key: m.key }),
                };
                const isActive = activeMarkKey === m.key;

                /* In Heat view the circles stop being the encoding and become handles: a small
                   constant marker saying "a real city is here, point at it for the figures".
                   Without them a blob is an anonymous smudge — the density tells you where demand
                   is concentrated but not whose it is. They are deliberately faint; 153 bright
                   pins over a density layer read as measles and fight the thing they sit on. The
                   invisible pad behind each one keeps it pointable. */
                if (view === 'heat') {
                  return (
                    <g key={m.key}>
                      <circle className="im-hit" cx={m.x} cy={m.y} r={12} {...on} />
                      <circle className={`im-pin${isActive ? ' is-active' : ''}`} cx={m.x} cy={m.y} r={3} />
                    </g>
                  );
                }
                return (
                  <circle
                    key={m.key}
                    className={`im-dot${isActive ? ' is-active' : ''}`}
                    cx={m.x}
                    cy={m.y}
                    r={m.r}
                    fill={RAMP[m.bin]}
                    {...on}
                  />
                );
              })}
            </g>

            {/* In Heat view the biggest few centres are named on the map, because a blob that merges
                Delhi, Gurgaon and Noida needs to say whose blob it is. */}
            {view === 'heat' && (
              <g className="im-names" aria-hidden="true">
                {nameable(model.plotted).map((m) => (
                  <text key={m.key} x={m.x} y={m.y - 13} textAnchor="middle">
                    {m.label}
                  </text>
                ))}
              </g>
            )}

            {activeMark && (
              <g className="im-callout" aria-hidden="true">
                <circle
                  cx={activeMark.x}
                  cy={activeMark.y}
                  r={(view === 'heat' ? 3 : activeMark.r) + 8}
                />
                <text
                  x={activeMark.x}
                  y={activeMark.y - (view === 'heat' ? 3 : activeMark.r) - 13}
                  textAnchor="middle"
                >
                  {activeMark.label}
                </text>
              </g>
            )}
          </svg>

          <figcaption className="im-legend">
            {view === 'heat' ? (
              <>
                <div className="im-legend-row">
                  <span className="im-legend-cap" id={`${uid}-lc`}>
                    How concentrated {measure.noun} are
                  </span>
                </div>
                {/* The scale legend the semantic-heat exception requires: the ramp itself, with both
                    ends named, so the colours are never left to be guessed. */}
                <div className="im-scale" aria-labelledby={`${uid}-lc`}>
                  <span className="im-scale-end">Sparse</span>
                  <span
                    className="im-scale-bar"
                    role="img"
                    aria-label="Colour scale running blue, green, yellow, then red as demand gets denser"
                    style={{
                      background: `linear-gradient(to right, ${HEAT.map(
                        (h, i) => `${h.fill} ${Math.round((i / (HEAT.length - 1)) * 100)}%`,
                      ).join(', ')})`,
                    }}
                  />
                  <span className="im-scale-end">Densest</span>
                </div>
                <p className="im-legend-note">
                  Shading is <em>relative</em>: red marks the densest cluster in this view, not a fixed
                  number of {measure.noun}. Each city spreads a soft halo weighted by the square root of
                  its figure, and the halos add where they overlap — so a cluster of mid-sized markets
                  can glow as warm as one big one. For exact figures per city, read the table.
                </p>
              </>
            ) : (
              <>
                <div className="im-legend-row">
                  <span className="im-legend-cap" id={`${uid}-lc`}>
                    {measure.short} per city
                  </span>
                  <ul className="im-swatches" aria-labelledby={`${uid}-lc`}>
                    {legendBands.map((b) => (
                      <li key={b.fill}>
                        <span className="im-swatch">
                          <i style={{ background: b.fill }} />
                        </span>
                        {b.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="im-legend-note">
                  Darker and bigger means more {measure.noun}. Circle <em>area</em> is proportional to
                  the figure, so the radius grows with its square root — a city with four times the
                  demand is twice as wide, not four times.
                </p>
              </>
            )}
          </figcaption>
        </figure>

        <div className="im-side">
          <div className="im-readout" role="status" aria-live="polite">
            {readout ? (
              <>
                <strong className="im-readout-city">{readout.label}</strong>
                {readout.region && <span className="im-readout-region">{readout.region}</span>}
                <dl className="im-readout-figs">
                  <div>
                    <dt>Leads</dt>
                    <dd>{nf.format(readout.leads)}</dd>
                  </div>
                  {closuresAvailable && (
                    <>
                      <div>
                        <dt>Closures</dt>
                        <dd>{nf.format(readout.closures)}</dd>
                      </div>
                      <div>
                        <dt>Value</dt>
                        <dd>{formatValue(readout.value)}</dd>
                      </div>
                    </>
                  )}
                </dl>
                {readout.note && <p className="im-readout-note">{readout.note}</p>}
              </>
            ) : (
              <span className="im-readout-idle">
                Point at a city, or move through the table below, to see its figures.
              </span>
            )}
          </div>

          <div className="im-scroll">
            <table className="im-table">
              <caption>
                Every place, ranked by {measure.noun}. The same figures as the map.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col" className="im-num">Leads</th>
                  {closuresAvailable && <th scope="col" className="im-num">Closed</th>}
                  {closuresAvailable && <th scope="col" className="im-num">Value</th>}
                </tr>
              </thead>
              <tbody>
                {model.ranked.concat(model.zeroed).map((c) => (
                  <tr
                    key={c.key}
                    className={activeMarkKey && c.plotKey === activeMarkKey ? 'is-active' : undefined}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        className="im-row"
                        aria-pressed={pinned?.kind === 'place' && pinned.key === c.key}
                        onFocus={() => setHovered({ kind: 'place', key: c.key })}
                        onBlur={() => setHovered(null)}
                        onMouseEnter={() => setHovered({ kind: 'place', key: c.key })}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() =>
                          setPinned(
                            pinned?.kind === 'place' && pinned.key === c.key
                              ? null
                              : { kind: 'place', key: c.key },
                          )
                        }
                      >
                        <span className="im-row-name">{c.label}</span>
                        {c.region && <span className="im-row-region">{c.region}</span>}
                        {c.plotLabel && (
                          <span className="im-row-at">Shown on the map at {c.plotLabel}</span>
                        )}
                        {c.note && <span className="im-row-note">{c.note}</span>}
                      </button>
                    </th>
                    <td className="im-num">{nf.format(c.leads)}</td>
                    {closuresAvailable && <td className="im-num">{nf.format(c.closures)}</td>}
                    {closuresAvailable && <td className="im-num">{formatValue(c.value)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>

            {isEmpty && (
              <p className="im-empty">
                Nothing to map for this measure. Either no records carry a city, or every city in them is
                one we have no coordinate for — the list below says which.
              </p>
            )}

            {unmapped.length > 0 && (
              <div className="im-off">
                <h4 className="im-off-h">
                  Not on the map — {countOf(unmappedTotal, measure)}
                </h4>
                <p className="im-off-lead">
                  These carry demand but cannot be drawn as a point. They are counted here so nobody reads
                  the blank space as no demand.
                </p>
                <ul className="im-off-list">
                  {unmapped
                    .slice()
                    .sort((a, b) => (b[measure.key] || 0) - (a[measure.key] || 0) || b.leads - a.leads)
                    .map((c) => (
                      <li key={`${c.status}-${c.key}`}>
                        <span className="im-off-name">{c.label}</span>
                        <span className="im-off-fig">{countOf(c[measure.key] || 0, measure)}</span>
                        <span className="im-off-why">{WHY_UNMAPPED[c.status]}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="im-credit">
        Outline: <em>India state boundaries</em> by the DataMeet India community (CC BY 4.0), simplified.
        Boundaries follow the official boundary of India as published by the Survey of India. Schematic
        only — not for measurement or any administrative use. {nf.format(MAPPED_CITY_COUNT)} places have a
        coordinate on file; anything else appears in the list above.
      </p>
    </section>
  );
}
