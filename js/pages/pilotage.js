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

      const rows = d.centres.map((c) => {
        const kc = Q.kpis(d, c.id, period);
        const r = Q.report(d, c.id, Q.lastClosedPeriod());
        const st = Q.reportStatus(r);
        const officer = Q.user(d, c.officer);
        return {
          cls: 'clickable', attrs: `${C.on('open-centre', { id: c.id })} tabindex="0"`,
          cells: [
            `<span class="strong nowrap">${esc(c.name)}</span><span class="sub nowrap">${esc(officer.name)}</span>`,
            C.stageBar(kc.byStage),
            `<span class="num">${kc.active ?? '—'}</span>`,
            `<span class="${tone(kc.execution, 80, 60)}">${pctTxt(kc.execution)}</span>`,
            `<span class="${tone(kc.coverage, 80, 60)}">${pctTxt(kc.coverage)}</span>`,
            pctTxt(kc.abandon),
            C.statusBadge(EH.REF.reportStatus, st)
          ]
        };
      });
      const comparison = C.panel({
        title: 'Comparaison des centres', actions: `<span class="muted xs hide-sm">Cliquez sur un centre pour le détail</span>`,
        body: C.table({ caption: 'Comparaison des six centres', cols: [{ label: 'Centre' }, { label: 'Répartition par étape', cls: 'hide-sm' }, { label: 'Actifs', cls: 'num' }, { label: 'Exécution', cls: 'num' }, { label: 'Couverture', cls: 'num' }, { label: 'Abandon', cls: 'num hide-md' }, { label: 'Rapport ' + EH.fmtMonth(Q.lastClosedPeriod()).split(' ')[0].toLowerCase() }], rows }),
        foot: C.stageLegend() + `<p class="muted xs" style="margin-top:6px">Les chiffres d'un centre deviennent officiels quand son rapport est validé.</p>`
      });

      const validateRows = [
        ...toValidate.map((r) => `<div class="list-row">${C.ico('send', 'info')}<div class="body"><div class="title">Rapport ${esc(EH.fmtMonth(r.period).toLowerCase())} · ${esc(Q.centreName(d, r.centre))}</div><div class="meta">Soumis le ${EH.fmtDateTime(r.submitted)}${r.comment ? ' · « ' + esc(r.comment.slice(0, 60)) + (r.comment.length > 60 ? '…' : '') + ' »' : ''}</div></div><div class="row-actions">${C.btn('Examiner', { action: 'open-report', data: { id: r.id }, variant: 'primary', size: 'sm' })}</div></div>`),
        ...corrections.map((c) => `<div class="list-row">${C.ico('edit', 'warn')}<div class="body"><div class="title">Correction demandée · ${esc(Q.centreName(d, c.centre))}</div><div class="meta">${esc(c.text)}</div></div><div class="row-actions">${C.btn('Traiter', { action: 'open-report', data: { id: c.report }, size: 'sm' })}</div></div>`)
      ].join('');
      const validate = C.panel({ title: 'À valider', count: toValidate.length + corrections.length, body: validateRows || C.empty({ title: 'Rien à valider', text: 'Les rapports soumis par les centres apparaîtront ici.' }) });

      const counts = EH.groupCount(alerts, (a) => a.type);
      const alertRows = Object.entries(Q.ALERT_TYPES).map(([t, def]) => {
        const n = counts[t] || 0;
        const centres = [...new Set(alerts.filter((a) => a.type === t).map((a) => Q.centreName(d, a.centre)))];
        return `<div class="list-row">${C.ico(def.icon, n ? (t === 'abandon' ? 'info' : t === 'risk' ? 'warn' : 'bad') : 'ok')}<div class="body"><div class="title">${def.label}</div><div class="meta">${n ? esc(centres.slice(0, 3).join(', ') + (centres.length > 3 ? '…' : '')) : 'Aucune'}</div></div><div class="row-actions">${n ? `<button class="btn sm" ${C.on('go', { route: 'alertes', filters: JSON.stringify({ 'al.type': t, 'al.centre': '' }) })}><span class="num">${n}</span>${I('chevronRight')}</button>` : C.badge('0', 'ok')}</div></div>`;
      }).join('');
      const alertPanel = C.panel({ title: 'Alertes', count: alerts.length, actions: `<a href="#alertes" class="btn ghost sm">Tout voir</a>`, body: alertRows });

      return head + EH.kpiStrip(k) + `<div class="grid-2" style="margin-top:var(--s-4)">${comparison}<div class="stack">${validate}${alertPanel}</div></div>`;
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
