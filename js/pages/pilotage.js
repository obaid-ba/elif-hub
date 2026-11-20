/* PMO dashboard (FR-08-01, FR-08-02) and centre drill-down. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, I = EH.icon;
  const pctTxt = (v) => (v == null ? '<span class="muted">Pas de donnée</span>' : `<span class="num">${Math.round(v)}${EH.NBSP}%</span>`);
  const tone = (v, good, warn) => (v == null ? '' : v >= good ? '' : v >= warn ? 't-warn' : 't-bad');

  const periodSeg = (key) => {
    const closed = Q.lastClosedPeriod(), cur = Q.currentPeriod();
    return C.seg(key, [{ value: closed, label: EH.fmtMonth(closed) }, { value: cur, label: EH.fmtMonth(cur) + ' (en cours)' }], EH.f(key, closed), 'Période');
  };
  EH.periodSeg = periodSeg;

  /* ---------- rate charts ---------- */
  const RATES = [
    { id: 'execution', label: 'Exécution des activités', short: 'Exécution' },
    { id: 'attendance', label: 'Taux de présence', short: 'Présence' },
    { id: 'coverage', label: 'Couverture coaching', short: 'Couverture' },
    { id: 'abandon', label: "Taux d'abandon", short: 'Abandon', invert: true },
    { id: 'reporting', label: 'Remise des rapports', short: 'Remise' },
    { id: 'engagement', label: 'Engagement des bénéficiaires', short: 'Engagement' }
  ];
  const pct = (v) => Math.round(v) + EH.NBSP + '%';
  const lastPeriods = (n) => {
    const out = []; let y = +EH.TODAY.slice(0, 4), m = +EH.TODAY.slice(5, 7);
    for (let i = 0; i < n; i++) { out.unshift(`${y}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; y--; } }
    return out;
  };

  /** Ring gauge for one rate; doubles as the metric picker. */
  const ring = (rate, v, selected) => {
    const r = 26, c = 2 * Math.PI * r, frac = v == null ? 0 : Math.max(0, Math.min(100, v)) / 100;
    return `<button type="button" class="ring-card" aria-pressed="${selected}" ${C.on('filter', { key: 'pil.rate', value: rate.id })} title="${esc(rate.label)}">
      <svg viewBox="0 0 64 64" class="ring" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-track"/>${v == null ? '' : `<circle cx="32" cy="32" r="${r}" class="ring-fill ${C.rateTone(v, rate.invert)}" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>`}</svg>
      <span class="ring-val num">${v == null ? '—' : pct(v)}</span><span class="ring-label">${esc(rate.short)}</span></button>`;
  };

  /** Horizontal bars, one per centre, with the programme value as a reference line. */
  const centreBars = (d, rate, period, overall) => {
    const rows = d.centres.map((c) => ({ c, v: Q.kpis(d, c.id, period)[rate.id] }));
    const label = rows.map((x) => `${x.c.name} ${x.v == null ? 'pas de donnée' : pct(x.v)}`).join(', ');
    return `<div class="hbars" role="img" aria-label="${esc(rate.label + ' par centre : ' + label)}">${rows.map((x) => `<div class="hbar-row">
      <span class="hbar-label">${esc(x.c.name)}</span>
      <span class="hbar-track">${x.v == null ? '' : `<span class="hbar-fill ${C.rateTone(x.v, rate.invert)}" style="width:${Math.max(1, Math.min(100, x.v))}%"></span>`}${overall == null ? '' : `<i class="hbar-ref" style="left:${Math.min(100, overall)}%"></i>`}</span>
      <span class="hbar-val num">${x.v == null ? '<span class="muted">—</span>' : pct(x.v)}</span></div>`).join('')}</div>
      <div class="legend" style="margin-top:8px"><span><i class="dot ok-dot"></i>Objectif atteint</span><span><i class="dot warn-dot"></i>À surveiller</span><span><i class="dot bad-dot"></i>Critique</span>${overall == null ? '' : `<span><i class="ref-key"></i>Programme ${pct(overall)}</span>`}</div>`;
  };

  /** Line chart of the programme value over the last six months. */
  const trendChart = (d, rate) => {
    const ps = lastPeriods(6), pts = ps.map((p) => ({ p, v: Q.kpis(d, null, p)[rate.id] }));
    const W = 560, H = 196, L = 34, Rr = 26, T = 24, B = 28;
    const x = (i) => L + (i * (W - L - Rr)) / (ps.length - 1), y = (v) => T + (1 - v / 100) * (H - T - B);
    const grid = [0, 25, 50, 75, 100].map((g) => `<line x1="${L}" x2="${W - Rr}" y1="${y(g)}" y2="${y(g)}" class="grid-line"/><text x="${L - 6}" y="${y(g) + 4}" class="axis" text-anchor="end">${g}</text>`).join('');
    const known = pts.map((o, i) => ({ ...o, i })).filter((o) => o.v != null);
    const path = known.map((o, j) => `${j ? 'L' : 'M'}${x(o.i).toFixed(1)},${y(o.v).toFixed(1)}`).join(' ');
    const area = known.length > 1 ? `${path} L${x(known[known.length - 1].i).toFixed(1)},${y(0)} L${x(known[0].i).toFixed(1)},${y(0)} Z` : '';
    const labels = ps.map((p, i) => `<text x="${x(i)}" y="${H - 8}" class="axis" text-anchor="middle">${EH.fmtDate(p + '-01').split(EH.NBSP)[1]}</text>`).join('');
    const dots = known.map((o) => `<circle cx="${x(o.i)}" cy="${y(o.v)}" r="4" class="pt"><title>${EH.fmtMonth(o.p)} : ${pct(o.v)}</title></circle><text x="${x(o.i)}" y="${y(o.v) - 9}" class="pt-label" text-anchor="middle">${Math.round(o.v)}</text>`).join('');
    const aria = pts.map((o) => `${EH.fmtMonth(o.p)} ${o.v == null ? 'pas de donnée' : pct(o.v)}`).join(', ');
    return `<svg viewBox="0 0 ${W} ${H}" class="trend" role="img" aria-label="${esc(rate.label + ', évolution : ' + aria)}">${grid}${area ? `<path d="${area}" class="area"/>` : ''}${path ? `<path d="${path}" class="line"/>` : ''}${dots}${labels}</svg>
      ${known.length ? (known.length < ps.length ? `<p class="muted xs">Mois sans donnée non tracés (${ps.filter((p, i) => !known.some((o) => o.i === i)).map((p) => EH.fmtDate(p + '-01').split(EH.NBSP)[1]).join(', ')}).</p>` : '') : '<p class="muted xs">Pas de donnée sur les six derniers mois.</p>'}<p class="muted xs" style="margin-top:4px">Six centres réunis · chiffres provisoires tant que les rapports ne sont pas validés.</p>`;
  };

  const rateCharts = (d, period, k) => {
    const sel = RATES.find((r) => r.id === EH.f('pil.rate', 'execution')) || RATES[0];
    return C.panel({
      title: 'Taux en graphiques', actions: `<span class="muted xs">${esc(EH.fmtMonth(period))} · choisissez un taux</span>`, flush: false, id: 'rate-charts',
      body: `<div class="rings" role="group" aria-label="Choisir le taux affiché">${RATES.map((r) => ring(r, k[r.id], r.id === sel.id)).join('')}</div>
        <div class="chart-grid">
          <div><h3 class="chart-title">${esc(sel.label)} par centre ${C.info(EH.REF.kpis[sel.id].formula)}</h3>${centreBars(d, sel, period, k[sel.id])}</div>
          <div><h3 class="chart-title">Évolution sur six mois</h3>${trendChart(d, sel)}</div>
        </div>`
    });
  };

  EH.pages.pilotage = {
    label: 'Pilotage', icon: 'gauge',
    render() {
      const d = S.data, period = EH.f('pil.period', Q.lastClosedPeriod());
      const k = Q.kpis(d, null, period);
      const alerts = Q.alerts(d, null);
      const toValidate = d.reports.filter((r) => r.status === 'submitted');
      const corrections = d.corrections.filter((c) => c.status === 'open');

      const head = C.pageHead('Pilotage du programme',
        `${k.validated ? 'Chiffres validés' : `Chiffres provisoires : ${k.approvedCount} centre${k.approvedCount > 1 ? 's' : ''} sur 6 validé${k.approvedCount > 1 ? 's' : ''}`} pour ${EH.fmtMonth(period).toLowerCase()}. Survolez ${I('info')} pour la formule de chaque indicateur.`,
        periodSeg('pil.period') + C.btn('Copier l\'export CSV', { action: 'export-csv', icon: 'copy', data: { period } }));

      const goTo = (route, filters, html, label, cls = '') => `<button type="button" class="cell-link ${cls}" ${C.on('go', { route, filters: JSON.stringify(filters) })} aria-label="${esc(label)}" title="${esc(label)}">${html}</button>`;
      const rows = d.centres.map((c) => {
        const kc = Q.kpis(d, c.id, period);
        const r = Q.report(d, c.id, Q.lastClosedPeriod());
        const st = Q.reportStatus(r);
        const officer = Q.user(d, c.officer);
        const acts = d.activities.filter((a) => a.centre === c.id), byS = EH.groupCount(acts, Q.activityStatus);
        const upcoming = (byS.draft || 0) + (byS.planned || 0) + (byS.confirmed || 0);
        const chip = (n, label, status, cls) => goTo('activites', { 'act.centre': c.id, 'act.status': status, 'act.view': 'list', 'act.prog': '', 'act.q': '' }, `<b class="num">${n}</b> ${label}`, `${c.name} : ${n} ${label}`, 'st-chip ' + cls + (n ? '' : ' zero'));
        const att = Q.attendance(d, [c.id], period);
        const arSub = acts.filter((a) => Q.activityReportStatus(d, a) === 'submitted').length, arLate = acts.filter((a) => Q.activityReportLate(d, a)).length;
        return {
          cls: 'clickable', attrs: `${C.on('open-centre', { id: c.id })} tabindex="0"`,
          cells: [
            `<span class="strong nowrap">${esc(c.name)}</span><span class="sub nowrap">${esc(officer.name)}</span>`,
            C.stageBar(kc.byStage),
            `<span class="num">${kc.active ?? '—'}</span>`,
            `<div class="st-chips">${chip(byS.done || 0, 'réalisées', 'done', 'ok')}${chip(upcoming, 'à venir', 'upcoming', 'info')}${chip(byS.overdue || 0, 'à clôturer', 'overdue', 'bad')}${chip(byS.cancelled || 0, 'annulées', 'cancelled', '')}</div>`,
            `<span class="${tone(kc.execution, 80, 60)}">${pctTxt(kc.execution)}</span>${C.meter(kc.execution)}`,
            att.rate == null ? '<span class="muted">Pas de donnée</span>' : goTo('activites', { 'act.centre': c.id, 'act.status': 'done', 'act.view': 'list', 'act.prog': '', 'act.q': '' }, `<span class="${tone(att.rate, 80, 60)}">${pctTxt(att.rate)}</span>${C.meter(att.rate)}`, `${c.name} : présence ${Math.round(att.rate)} %, ${att.present} présences sur ${att.expected} attendus`),
            `<span class="${tone(kc.coverage, 80, 60)}">${pctTxt(kc.coverage)}</span>${C.meter(kc.coverage)}`,
            `${arSub ? goTo('rapports', { 'rep.ar': 'submitted' }, `<b class="num">${arSub}</b> à valider`, `${c.name} : ${arSub} rapport(s) d'activité à valider`, 'st-chip accent') : ''}${arLate ? goTo('alertes', { 'al.type': 'areport', 'al.centre': c.id }, `<b class="num">${arLate}</b> en retard`, `${c.name} : ${arLate} rapport(s) d'activité en retard`, 'st-chip bad') : ''}${!arSub && !arLate ? '<span class="muted">—</span>' : ''}`,
            C.statusBadge(EH.REF.reportStatus, st)
          ]
        };
      });
      const comparison = C.panel({
        title: 'Comparaison des centres', actions: `<span class="muted xs hide-sm">Cliquez sur un chiffre pour la liste, sur un centre pour le détail</span>`,
        body: C.table({ caption: 'Comparaison des six centres', cols: [{ label: 'Centre' }, { label: 'Répartition par étape', cls: 'hide-md' }, { label: 'Actifs', cls: 'num' }, { label: 'Activités par état' }, { label: 'Exécution', cls: 'num hide-sm' }, { label: `Présence ${C.info(EH.REF.kpis.attendance.formula)}`, cls: 'num' }, { label: 'Couverture', cls: 'num hide-sm' }, { label: "Rapports d'activité" }, { label: 'Rapport ' + EH.fmtMonth(Q.lastClosedPeriod()).split(' ')[0].toLowerCase() }], rows }),
        foot: C.stageLegend() + `<p class="muted xs" style="margin-top:6px">Les chiffres d'un centre deviennent officiels quand son rapport est validé. Activités par état : toutes les activités du centre. Le taux d'abandon par centre est dans « Taux en graphiques ».</p>`
      });
      const arToValidate = (d.activityReports || []).filter((r) => r.status === 'submitted');

      const validateRows = [
        ...toValidate.map((r) => `<div class="list-row">${C.ico('send', 'info')}<div class="body"><div class="title">Rapport ${esc(EH.fmtMonth(r.period).toLowerCase())} · ${esc(Q.centreName(d, r.centre))}</div><div class="meta">Soumis le ${EH.fmtDateTime(r.submitted)}${r.comment ? ' · « ' + esc(r.comment.slice(0, 60)) + (r.comment.length > 60 ? '…' : '') + ' »' : ''}</div></div><div class="row-actions">${C.btn('Examiner', { action: 'open-report', data: { id: r.id }, variant: 'primary', size: 'sm' })}</div></div>`),
        ...arToValidate.map((r) => { const a = Q.activity(d, r.activityId); return `<div class="list-row">${C.ico('file', 'accent')}<div class="body"><div class="title">Rapport d'activité · ${esc(a.title)} · ${esc(Q.centreName(d, r.centre))}</div><div class="meta">Soumis le ${EH.fmtDateTime(r.submittedAt)} · ${a.attendees.length}/${a.expected} présents</div></div><div class="row-actions">${C.btn('Examiner', { action: 'open-activity-report', data: { id: a.id }, variant: 'primary', size: 'sm' })}</div></div>`; }),
        ...corrections.map((c) => `<div class="list-row">${C.ico('edit', 'warn')}<div class="body"><div class="title">Correction demandée · ${esc(Q.centreName(d, c.centre))}</div><div class="meta">${esc(c.text)}</div></div><div class="row-actions">${C.btn('Traiter', { action: 'open-report', data: { id: c.report }, size: 'sm' })}</div></div>`)
      ].join('');
      const validate = C.panel({ title: 'À valider', count: toValidate.length + corrections.length + arToValidate.length, body: validateRows || C.empty({ title: 'Rien à valider', text: 'Les rapports soumis par les centres apparaîtront ici.' }) });

      const counts = EH.groupCount(alerts, (a) => a.type);
      const alertRows = Object.entries(Q.ALERT_TYPES).map(([t, def]) => {
        const n = counts[t] || 0;
        const centres = [...new Set(alerts.filter((a) => a.type === t).map((a) => Q.centreName(d, a.centre)))];
        return `<div class="list-row">${C.ico(def.icon, n ? (t === 'abandon' ? 'info' : t === 'risk' ? 'warn' : 'bad') : 'ok')}<div class="body"><div class="title">${def.label}</div><div class="meta">${n ? esc(centres.slice(0, 3).join(', ') + (centres.length > 3 ? '…' : '')) : 'Aucune'}</div></div><div class="row-actions">${n ? `<button class="btn sm" ${C.on('go', { route: 'alertes', filters: JSON.stringify({ 'al.type': t, 'al.centre': '' }) })}><span class="num">${n}</span>${I('chevronRight')}</button>` : C.badge('0', 'ok')}</div></div>`;
      }).join('');
      const alertPanel = C.panel({ title: 'Alertes', count: alerts.length, actions: `<a href="#alertes" class="btn ghost sm">Tout voir</a>`, body: alertRows });

      return head + EH.kpiStrip(k) + `<div style="margin-top:var(--s-4)">${rateCharts(d, period, k)}</div>` + `<div style="margin-top:var(--s-4)">${comparison}</div><div class="grid-even" style="margin-top:var(--s-4)">${validate}${alertPanel}</div>`;
    }
  };

  /* ---------- centre drawer ---------- */
  EH.drawers.centre = (st) => {
    const d = S.data, c = Q.centre(d, st.id), period = EH.f('pil.period', Q.lastClosedPeriod());
    const k = Q.kpis(d, c.id, period);
    const alerts = Q.alerts(d, c.id);
    const r = Q.report(d, c.id, Q.lastClosedPeriod());
    const rs = Q.reportStatus(r);
    const n = (v) => (v == null ? 'Pas de donnée' : Math.round(v) + EH.NBSP + '%');
    const body = `
      <div class="section"><h3>Indicateurs · ${esc(EH.fmtMonth(period))} ${k.validated ? C.badge('Validé', 'ok', 'lock') : C.badge('Provisoire', 'outline')}</h3>
        <dl class="dl"><dt>Entrepreneurs actifs</dt><dd class="num">${k.active ?? 'Pas de donnée'}</dd>
        <dt>Répartition</dt><dd>${C.stageBar(k.byStage)}<span class="muted xs">${EH.REF.stages.map((s) => `${s.short} ${k.byStage[s.id]}`).join(' · ')} · Abandon ${k.byStage.abandon}</span></dd>
        <dt>Exécution des activités</dt><dd class="num">${n(k.execution)}</dd>
        <dt>Couverture coaching</dt><dd class="num">${n(k.coverage)}</dd>
        <dt>Taux de présence</dt><dd class="num">${n(k.attendance)}</dd>
        <dt>Taux d'abandon</dt><dd class="num">${n(k.abandon)}</dd>
        <dt>Séances tenues</dt><dd class="num">${k.sessions}</dd>
        <dt>Remise des rapports</dt><dd class="num">${n(k.reporting)}</dd>
        <dt>Engagement des bénéficiaires</dt><dd class="num">${n(k.engagement)}</dd></dl></div>
      <div class="section"><h3>Rapport ${esc(EH.fmtMonth(Q.lastClosedPeriod()).toLowerCase())} ${C.statusBadge(EH.REF.reportStatus, rs)}</h3>
        ${r && r.returnReason && rs === 'returned' ? C.callout('warn', 'Renvoyé : ' + esc(r.returnReason)) : ''}
        ${r && r.status === 'submitted' ? C.btn('Examiner le rapport', { action: 'open-report', data: { id: r.id }, variant: 'primary' }) : r ? C.btn('Ouvrir le rapport', { action: 'open-report', data: { id: r.id } }) : ''}</div>
      <div class="section"><h3>Alertes <span class="muted num">${alerts.length}</span></h3>${alerts.length ? `<div class="panel">${alerts.slice(0, 8).map(EH.alertRow).join('')}</div>` : C.empty({ title: 'Aucune alerte' })}</div>`;
    const tools = C.btn('Entrepreneurs', { action: 'go', data: { route: 'entrepreneurs', filters: JSON.stringify({ 'ent.centre': c.id, 'ent.stage': '', 'ent.risk': '' }) }, icon: 'users' }) +
      C.btn('Activités', { action: 'go', data: { route: 'activites', filters: JSON.stringify({ 'act.centre': c.id }) }, icon: 'calendar' });
    return C.drawer({ title: 'Centre de ' + esc(c.name), sub: `${esc(c.region)} · Chargé : ${esc(Q.user(d, c.officer).name)}`, tools, body });
  };

  Object.assign(EH.actions, {
    'open-centre': (el) => EH.openDrawer('centre', { id: el.dataset.id }),
    'export-csv': (el) => {
      const csv = EH.act.exportCsv(el.dataset.period);
      EH.copy(csv, (ok) => EH.toast(ok ? `Export de ${EH.fmtMonth(el.dataset.period).toLowerCase()} copié (CSV, sans données personnelles). Collez-le dans un tableur.` : "La copie a échoué : votre navigateur bloque le presse-papiers.", { tone: ok ? 'ok' : 'error' }));
    }
  });
})();
