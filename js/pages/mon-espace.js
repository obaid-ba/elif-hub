/* Beneficiary space, part 2: Mon espace (what to do today, grouped by programme) and Mon parcours (read-only). */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF;
  const B = () => EH.benef;
  const SEV = { bad: 0, warn: 1, info: 2 };

  /** Everything the beneficiary has to do, from his own data only. */
  const todoItems = () => {
    const e = B().me();
    if (!e) return [];
    const d = S.data, out = [];
    B().myObligations().forEach((o) => {
      if (o.status === 'submitted' || o.status === 'validated') return;
      const a = o.activity;
      const sev = o.optional ? 'info' : o.late || o.status === 'returned' ? 'bad' : 'warn';
      const title = o.status === 'returned' ? `Corriger le rapport « ${a.title} »` : o.status === 'draft' ? `Terminer le rapport « ${a.title} »` : `Rapport « ${a.title} »`;
      out.push({ sev, rank: o.late ? 0 : o.status === 'returned' ? 1 : 2, date: o.due, prog: a.programme, icon: 'report', title,
        meta: `${B().reqText(o)} · ${o.status === 'returned' ? 'renvoyé par le chargé du centre' : o.late ? 'en retard de ' + EH.plural(o.daysLate, 'jour') : 'à rendre le ' + EH.fmtDate(o.due)}`, late: o.late,
        btn: [B().actionLabel(o), 'my-open-report', { id: a.id }] });
    });
    const cohort = d.cohorts.find((c) => c.id === e.cohort);
    d.deliverables.filter((x) => x.entrepreneur === e.id && x.status === 'expected' && x.due < EH.TODAY).forEach((x) =>
      out.push({ sev: 'bad', rank: 3, date: x.due, prog: cohort ? cohort.programme : '', icon: 'file', title: `Livrable en retard : ${x.title}`, meta: `Échéance le ${EH.fmtDate(x.due)} · à remettre à votre chargé de programme`, late: true, btn: ['Voir', 'go', { route: 'mon-parcours' }] }));
    Q.cohortActivities(d, e).filter((a) => a.status === 'planned' && a.date >= EH.TODAY && EH.days(EH.TODAY, a.date) <= 14).forEach((a) => {
      const req = Q.requirementOf(d, a);
      out.push({ sev: 'info', rank: 4, date: a.date, prog: a.programme, icon: 'calendar', title: a.title, meta: `${EH.fmtDay(a.date)}${a.duration ? ' · ' + a.duration : ''}${req ? ' · rapport après l’activité : ' + Q.formatLabel(req.format).toLowerCase() : ''}`, btn: ['Ouvrir', 'my-open-activity', { id: a.id }] });
    });
    return out.sort((x, y) => SEV[x.sev] - SEV[y.sev] || x.rank - y.rank || (x.date < y.date ? -1 : 1));
  };
  EH.benefTodayCount = () => { const urgent = todoItems().filter((x) => x.sev !== 'info'); return { n: urgent.length, alert: urgent.some((x) => x.sev === 'bad') }; };

  EH.pages['mon-espace'] = {
    label: 'Mon espace', icon: 'home',
    render() {
      const e = B().me(), d = S.data;
      if (!e) return C.empty({ icon: 'shield', tone: 'bad', title: 'Espace indisponible', text: 'Ce profil n’est lié à aucun entrepreneur.' });
      const items = todoItems(), urgent = items.filter((x) => x.sev !== 'info').length;
      const groups = new Map();
      items.forEach((x) => { if (!groups.has(x.prog)) groups.set(x.prog, []); groups.get(x.prog).push(x); });
      const ordered = [...groups.entries()].sort((a, b) => SEV[a[1][0].sev] - SEV[b[1][0].sev] || (a[1][0].date < b[1][0].date ? -1 : 1));
      const panels = ordered.map(([pid, list]) => C.panel({
        title: (Q.programme(d, pid) || {}).name || 'Mon parcours', count: list.length,
        body: list.map((x, i) => `<div class="list-row">${C.ico(x.icon, x.sev)}<div class="body"><div class="title">${esc(x.title)}</div><div class="meta ${x.late ? 't-bad strong' : ''}">${esc(x.meta)}</div></div>
          <div class="row-actions">${C.btn(x.btn[0], { action: x.btn[1], data: x.btn[2], size: 'sm', variant: x.sev !== 'info' ? 'primary' : '' })}</div></div>`).join('')
      })).join('');
      const empty = C.empty({ title: 'Rien à faire pour le moment', text: 'Vos rapports sont à jour. Consultez vos prochaines activités pour vous préparer.', action: C.btn('Voir mes activités', { action: 'go', data: { route: 'mes-activites' }, icon: 'calendar' }) });
      return C.pageHead(`Bonjour ${esc(e.firstName || e.name.split(' ')[0])}`, `${EH.fmtDay(EH.TODAY)} · ${urgent ? EH.plural(urgent, 'point') + ' à traiter' : 'tout est à jour'}. Chaque programme a ses propres échéances.`) +
        (items.length ? `<div class="stack">${panels}</div>` : C.panel({ body: empty }));
    }
  };

  /* ---------- Mon parcours: read-only ---------- */
  EH.pages['mon-parcours'] = {
    label: 'Mon parcours', icon: 'flag',
    render() {
      const e = B().me(), d = S.data;
      if (!e) return C.empty({ icon: 'shield', tone: 'bad', title: 'Espace indisponible', text: 'Ce profil n’est lié à aucun entrepreneur.' });
      const si = EH.stageIndex(e.stage);
      const stepper = `<div class="stepper" aria-label="Parcours">${R.stages.map((s, i) => { const dt = Q.stageDate(e, s.id); const cls = e.stage === 'abandon' ? (dt ? 'done' : '') : i < si ? 'done' : i === si ? 'current' : ''; return `<div class="step ${cls}"><b>${s.label}</b>${dt ? EH.fmtDate(dt) : '&nbsp;'}</div>`; }).join('')}</div>`;
      const last = Q.isActive(e) ? Q.lastSession(d, e.id) : null;
      const next = last && last.nextAction ? last : null;
      const dels = d.deliverables.filter((x) => x.entrepreneur === e.id);
      const tl = EH.entTimeline(e);
      const nSes = Q.sessionsOf(d, e.id).length;
      return C.pageHead('Mon parcours', `${C.stageBadge(e.stage)} · ${esc(e.idea)} · ${EH.plural(nSes, 'séance')} d’accompagnement. Cette page est en lecture seule.`) +
        `<div class="stack">${C.panel({ title: 'Mon étape', flush: false, body: stepper })}
        ${next ? C.panel({ title: 'Prochaine action', body: `<div class="list-row">${C.ico('flag', next.nextDue < EH.TODAY ? 'bad' : 'accent')}<div class="body"><div class="title">${esc(next.nextAction)}</div><div class="meta ${next.nextDue < EH.TODAY ? 't-bad' : ''}">Échéance ${EH.fmtDate(next.nextDue)}${next.nextDue < EH.TODAY ? ' · en retard' : ''} · fixée le ${EH.fmtDate(next.date)}</div></div></div>` }) : ''}
        ${C.panel({ title: 'Mes livrables', count: dels.length, body: dels.length ? dels.map((x) => { const late = x.status === 'expected' && x.due < EH.TODAY; return `<div class="list-row">${C.ico('file', late ? 'bad' : x.status === 'validated' ? 'ok' : '')}<div class="body"><div class="title">${esc(x.title)}</div><div class="meta ${late ? 't-bad' : ''}">${EH.stageLabel(x.stage)} · échéance ${EH.fmtDate(x.due)}${late ? ' · en retard' : ''}</div></div><div class="row-actions">${C.badge(EH.DELIV[x.status][0], EH.DELIV[x.status][1])}</div></div>`; }).join('') : C.empty({ icon: 'file', tone: '', title: 'Aucun livrable', text: 'Vos livrables apparaîtront ici quand votre chargé de programme les aura définis.' }) })}
        ${C.panel({ title: 'Chronologie', flush: false, body: tl.length ? `<ul class="timeline">${tl.map((t) => `<li>${C.ico(t.icon, t.tone)}<div><div class="what">${esc(t.what)}</div><div class="when">${EH.fmtDateY(t.date)}${t.sub ? ' · ' + esc(t.sub) : ''}</div></div></li>`).join('')}</ul>` : '<p class="muted small">Rien à afficher.</p>' })}</div>`;
    }
  };
})();
