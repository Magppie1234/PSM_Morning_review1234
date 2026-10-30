/* Departmental Query Control Tower — rendering.
 * Scope rule: the department filter always follows AT FAULT, because leakage,
 * root cause and SLA accountability are all fault concepts. The lens toggle only
 * drives the comparison bars; a scoped view always shows both bars so the
 * raised-vs-fault gap stays readable.
 */

let period = 'month', lens = 'both', dept = 'all';

const el = id => document.getElementById(id);
const DASH = '—';

const nf = new Intl.NumberFormat('en-IN');
const num = v => (v === null || v === undefined) ? DASH : nf.format(v);
const lakh = v => (v === null || v === undefined) ? DASH : RS + v.toFixed(1) + 'L';
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

function delta(node, pair){
  if (!pair){ node.textContent = ''; return; }
  const w = pair[1].split(' ');
  node.innerHTML = '<span class="' + pair[0] + '">' + w[0] + '</span> ' + w.slice(1).join(' ');
}

function press(segId, attr, value){
  Array.prototype.forEach.call(el(segId).children, function(x){
    x.setAttribute('aria-pressed', String(x.dataset[attr] === value));
  });
}

/* ---------- panels ---------- */

function renderScope(D, S){
  const sb = el('scope');
  if (!S){ sb.className = 'scope'; sb.innerHTML = ''; return; }
  const leakBit = D.leak === null
    ? 'Leakage is not priced for this period.'
    : lakh(S.leak) + ' of ' + lakh(D.leak) + ' leakage.';
  sb.className = 'scope on';
  sb.innerHTML =
    '<span class="dot" style="background:' + COLOR[dept] + '"></span>'
    + '<span>Showing <b>' + dept + '</b> only — queries this department is <b>at fault</b> for. '
    + num(S.open) + ' of ' + num(D.kpi.open) + ' open queries. ' + leakBit
    + ' Comparison panels dim the rest; the lists below show ' + dept + ' only.</span>'
    + '<button type="button" class="sc-clear" id="scClear">Show All Depts</button>';
  el('scClear').addEventListener('click', function(){
    dept = 'all'; press('deptSeg', 'd', 'all'); render();
  });
}

function renderKpis(D, S){
  el('k-open').textContent = num(S ? S.open : D.kpi.open);
  el('k-sla').textContent  = num(S ? S.sla  : D.kpi.sla);
  const tat = S ? S.tat : D.kpi.tat;
  el('k-tat').textContent  = tat === null ? DASH : tat.toFixed(1);

  if (D.actual){
    el('k-open-d').innerHTML = '10 issues logged in August';
    el('k-sla-d').innerHTML  = 'No SLA clock — log has no dates';
    el('k-tat-d').innerHTML  = 'No raise or closure dates logged';
  } else if (S){
    el('k-open-d').innerHTML = '<span class="up">' + pct(S.open, D.kpi.open) + '%</span> of all open queries';
    el('k-sla-d').innerHTML  = '<span class="up">' + pct(S.sla, S.open) + '%</span> of ' + dept + ' queries';
    const g = S.tat - D.kpi.tat;
    el('k-tat-d').innerHTML  = '<span class="' + (g > 0 ? 'up' : 'down') + '">'
      + (g > 0 ? '+' : '') + g.toFixed(1) + '</span> days vs company average';
  } else {
    delta(el('k-open-d'), D.kpi.openD);
    delta(el('k-sla-d'),  D.kpi.slaD);
    delta(el('k-tat-d'),  D.kpi.tatD);
  }

  const leakVal = S ? S.leak : D.leak;
  const input = el('k-leak');
  const unpriced = leakVal === null || leakVal === undefined;
  el('k-leak-wrap').classList.toggle('unpriced', unpriced);
  input.value = unpriced ? DASH : leakVal.toFixed(1);
  input.readOnly = unpriced || !!S;
  el('k-leak-d').textContent = unpriced
    ? 'Not priced — add a cost field in Zoho'
    : (S ? pct(S.leak, D.leak) + '% of the period total'
         : 'Entered manually per period — click to edit');
}

function renderAcct(D, S){
  const barLens = S ? 'both' : lens;
  let max = 1;
  D.acct.forEach(r => { max = Math.max(max, r.raised, r.fault); });

  el('acct').innerHTML = D.acct.map(function(r){
    const gap  = r.fault - r.raised;
    const bars = [];
    if (barLens !== 'fault')
      bars.push('<div class="bar raised" style="width:' + (r.raised / max * 100) + '%"></div>');
    if (barLens !== 'raised')
      bars.push('<div class="bar" style="width:' + (r.fault / max * 100) + '%;background:' + COLOR[r.d] + '"></div>');
    const shown  = barLens === 'raised' ? r.raised : r.fault;
    const gapTag = (barLens === 'both' && gap > 0) ? '<div class="bgap">+' + gap + '</div>' : '';
    return '<div class="brow' + ((S && r.d !== dept) ? ' dim' : '') + '">'
      + '<div class="bname">' + r.d + '</div>'
      + '<div class="bpair">' + bars.join('') + '</div>'
      + '<div class="bnum">' + shown + gapTag + '</div></div>';
  }).join('');

  el('acctNote').textContent = D.actual
    ? 'In August, Design raised nothing at all and was at fault for 7 of 10 issues. Installation and Services do the complaining; Design causes the problem.'
    : 'Installation and Services file most of the tickets; the fault sits upstream in Design and Factory. That gap is the agenda.';
}

function renderLeak(D, S){
  if (!D.leakage){
    el('leak').innerHTML = '<p class="empty">Leakage is not priced for this period. The August log records what went wrong, '
      + 'but not what it cost — so no department can be ranked by money yet. A cost field on the Zoho ticket form closes this gap.</p>';
    return;
  }
  let lmax = 0.1, ltot = 0;
  D.leakage.forEach(x => { lmax = Math.max(lmax, x.v); ltot += x.v; });
  el('leak').innerHTML = D.leakage.map(x =>
    '<div class="r' + ((S && x.d !== dept) ? ' dim' : '') + '">'
    + '<div><div class="nm">' + x.d + '</div><div class="pc">' + pct(x.v, ltot) + '% of total leakage</div></div>'
    + '<div class="amt">' + lakh(x.v) + '</div>'
    + '<div class="t"><span style="width:' + (x.v / lmax * 100) + '%;background:' + COLOR[x.d] + '"></span></div>'
    + '</div>').join('');
}

function renderRc(D, S){
  const rows = S ? D.rc.filter(x => x.d === dept) : D.rc;
  if (!rows.length){
    el('rc').innerHTML = '<p class="empty">No root causes attributed to ' + dept + ' this period.</p>';
    return;
  }
  let rmax = 1;
  rows.forEach(x => { rmax = Math.max(rmax, x.v); });
  el('rc').innerHTML = rows.map(x =>
    '<div class="brow" style="grid-template-columns:1fr 92px 26px">'
    + '<div class="bname" style="font-weight:600">' + x.n + '</div>'
    + '<div class="btrack"><div class="bar" style="width:' + (x.v / rmax * 100) + '%;background:' + COLOR[x.d] + '"></div></div>'
    + '<div class="bnum">' + x.v + '</div></div>').join('');
}

function renderLocs(D){
  let lmax = 1, ltot = 0;
  D.locs.forEach(x => { lmax = Math.max(lmax, x.v); ltot += x.v; });
  el('locs').innerHTML = D.locs.map((x, i) =>
    '<div class="r">'
    + '<div><div class="nm">' + x.n + '</div><div class="pc">' + pct(x.v, ltot) + '% of issues</div></div>'
    + '<div class="amt">' + x.v + '</div>'
    + '<div class="t"><span style="width:' + (x.v / lmax * 100) + '%;background:'
    + (i === 0 ? 'var(--danger)' : '#a69c92') + '"></span></div>'
    + '</div>').join('');
}

function renderAge(D, S){
  const rows = S ? D.age.filter(x => x.dp === dept) : D.age;
  if (!rows.length){
    el('age').innerHTML = '<p class="empty">'
      + (D.ageNote ? D.ageNote : 'No ' + dept + ' queries aging beyond SLA.') + '</p>';
    return;
  }
  el('age').innerHTML = rows.map(x =>
    '<div class="a' + (x.w ? ' w' : '') + '">'
    + '<div><div class="nm">' + x.n + '</div><div class="mt">' + x.m + '</div></div>'
    + '<div class="d">' + x.d + '<div class="mt" style="font-weight:600">days</div></div></div>').join('');
}

function renderPipe(D, S){
  const chev = '<div class="chev" aria-hidden="true"><svg><use href="#i-chev" /></svg></div>';
  el('pipe').innerHTML = D.pipe.map((h, i) =>
    (i ? chev : '')
    + '<div class="stage' + ((S && h.n !== dept) ? ' dim' : '') + '">'
    + '<div class="hn"><i style="background:' + COLOR[h.n] + '"></i>' + h.n + '</div>'
    + '<div class="hc">' + h.open + '</div>'
    + '<div class="hs">open · ' + h.s + '</div>'
    + (h.l ? '<div class="hl">' + RS + h.l + ' leaked</div>' : '')
    + '</div>').join('');
}

function renderTix(D, S){
  const rows = S ? D.tix.filter(t => t.f === dept) : D.tix;
  if (!rows.length){
    el('tix').innerHTML = '<tr><td colspan="8" class="empty">No open queries attributed to ' + dept + ' this period.</td></tr>';
    return;
  }
  el('tix').innerHTML = rows.map(t =>
    '<tr>'
    + '<td class="tid">' + t.id + '</td>'
    + '<td><div class="tclient">' + t.c + '</div><div class="tloc">' + t.loc + '</div></td>'
    + '<td>' + (t.issue ? t.issue + '<div class="tloc">' + t.rc + '</div>' : t.rc) + '</td>'
    + '<td><span class="pill">' + t.r + '</span></td>'
    + '<td><span class="tag" style="background:' + (COLOR[t.f] || 'var(--d-crm)') + '">' + t.f + '</span></td>'
    + '<td class="rs">' + (t.a === null ? DASH : t.a + 'd') + '</td>'
    + '<td>' + (t.sla === null
        ? '<span class="pill na">No dates</span>'
        : '<span class="pill ' + (t.sla ? 'ok' : 'breach') + '">' + (t.sla ? 'Within SLA' : 'Breached') + '</span>')
      + '</td>'
    + '<td class="rs">' + (t.l === null ? DASH : RS + t.l) + '</td>'
    + '</tr>').join('');
}

function renderNote(D){
  el('srcNote').innerHTML = D.actual
    ? '<b>Actual data.</b> These are the ten issues from the August log circulated by Suruchi Mittar, classified here into '
      + 'raised-by, at-fault and root cause. The log carries no dates and no cost per issue, so age, SLA and leakage read as blank '
      + 'rather than as guesses — those two missing fields are the first thing the Zoho ticket form should add.'
    : '<b>Mockup — illustrative data.</b> Volumes, names and amounts are seeded from the patterns in Planning_Query, Dispatch_Failure '
      + 'and the CHI TAT / SLA alignment sheets, not live Zoho records. Switch to <b>August (actual)</b> for the real logged issues. '
      + 'Every ticket carries both a raised-by and an at-fault department so the room argues about fault, not about who complained.';
}

/* ---------- orchestration ---------- */

function render(){
  const D = DATA[period];
  const S = dept === 'all' ? null : (D.dept[dept] || {open:0, sla:0, tat:0, leak:0});

  renderScope(D, S);
  renderKpis(D, S);
  renderAcct(D, S);
  renderLeak(D, S);
  renderRc(D, S);
  renderLocs(D);
  renderAge(D, S);
  renderPipe(D, S);
  renderTix(D, S);
  renderNote(D);
}

function wire(segId, attr, set){
  el(segId).addEventListener('click', function(e){
    const b = e.target.closest('button');
    if (!b) return;
    press(segId, attr, b.dataset[attr]);
    set(b.dataset[attr]);
    render();
  });
}

wire('periodSeg', 'p', v => { period = v; });
wire('lensSeg',   'l', v => { lens   = v; });
wire('deptSeg',   'd', v => { dept   = v; });

el('k-leak').addEventListener('change', function(e){
  const v = parseFloat(e.target.value);
  if (!isNaN(v)) DATA[period].leak = v;
  render();
});

render();
