/* Officer home "À faire aujourd'hui" (PBI-04 / US-44): everything due, with the action one click away. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF;

  EH.todayItems = () => {
    const d = S.data, c = S.scope();
    if (!c) return [];
    const items = [];
    const period = Q.lastClosedPeriod(), r = Q.report(d, c, period), rs = Q.reportStatus(r);
    if (rs === 'late' || rs === 'returned' || (rs === 'draft' && EH.TODAY >= EH.addDays(EH.periodEnd(period), 1))) {
      items.push({ sev: rs === 'draft' ? 'warn' : 'bad', icon: 'report', title: `Rapport ${EH.fmtMonth(period).toLowerCase()} ${rs === 'returned' ? 'renvoyé par le PMO' : rs === 'late' ? 'en retard' : 'à soumettre'}`, meta: rs === 'returned' ? r.returnReason : `Échéance : ${EH.fmtDateY(EH.periodDue(period))}`, btn: ['Préparer le rapport', 'go', { route: 'rapport' }], primary: true });
    }
    d.activities.filter((a) => a.centre === c && Q.needsClosing(a)).sort(EH.by('date')).forEach((a) => {
      const late = Q.activityStatus(a) === 'overdue';
      items.push({ sev: late ? 'bad' : 'warn', icon: 'calendar', title: `Clôturer « ${a.title} »`, meta: `${EH.fmtDay(a.date)} · ${late ? 'signalée au PMO' : 'saisissez les présences'}`, btn: ['Clôturer', 'close-activity', { id: a.id }] });
    });
    d.activities.filter((a) => a.centre === c && a.status === 'planned' && !a.facilitator && a.date > EH.TODAY).forEach((a) =>
      items.push({ sev: 'warn', icon: 'edit', title: `Choisir l'intervenant de « ${a.title} »`, meta: `${EH.fmtDay(a.date)} · brouillon`, btn: ['Compléter', 'edit-activity', { id: a.id }] }));
    d.entrepreneurs.filter((e) => e.centre === c && Q.atRisk(d, e)).forEach((e) =>
      items.push({ sev: 'warn', icon: 'user', title: `${e.name} : aucune séance depuis ${Q.daysWithoutSession(d, e)} jours`, meta: `${EH.stageLabel(e.stage)} · ${e.idea}`, btn: ['Saisir une séance', 'new-session', { id: e.id }] }));
    d.entrepreneurs.filter((e) => e.centre === c && Q.isActive(e) && !Q.atRisk(d, e)).forEach((e) => {
      const s = Q.lastSession(d, e.id);
      if (s && s.nextAction && s.nextDue && s.nextDue < EH.TODAY) items.push({ sev: 'info', icon: 'flag', title: `${e.name} : « ${s.nextAction} »`, meta: `Prochaine action attendue le ${EH.fmtDate(s.nextDue)}`, btn: ['Faire le point', 'new-session', { id: e.id }] });
    });
    d.entrepreneurs.filter((e) => e.centre === c && e.stage === 'candidat').forEach((e) =>
      items.push({ sev: 'info', icon: 'userPlus', title: `Décision de sélection : ${e.name}`, meta: `Candidat depuis le ${EH.fmtDate(e.history[0].date)} · ${e.idea}`, btn: ['Décider', 'select-decision', { id: e.id }] }));
    d.activities.filter((a) => a.centre === c && a.status === 'done').forEach((a) => {
      const obs = Q.activityObligations(d, a), subm = obs.filter((o) => o.status === 'submitted').length;
      if (subm) items.push({ kind: 'benef', sev: 'warn', icon: 'report', title: `${EH.plural(subm, 'rapport bénéficiaire', 'rapports bénéficiaires')} à valider · « ${a.title} »`, meta: `${EH.fmtDay(a.date)} · relisez puis validez ou renvoyez`, btn: ['Examiner', 'open-activity', { id: a.id }] });
      obs.filter((o) => o.late).forEach((o) => items.push({ kind: 'benef', sev: 'bad', icon: 'report', title: `${o.entrepreneur.name} : rapport en retard · « ${a.title} »`, meta: `À rendre le ${EH.fmtDate(o.due)} · ${o.daysLate} j de retard`, btn: ['Ouvrir', 'open-activity', { id: a.id }] }));
    });
    (d.exercises || []).filter((x) => x.centre === c && x.status === 'submitted').forEach((x) => {
      const e = Q.ent(d, x.entrepreneurId);
      items.push({ kind: 'incub', sev: 'warn', icon: 'edit', title: `Exercice rendu par ${e.name} : « ${x.title} »`, meta: `Rendu le ${EH.fmtDate(x.submittedAt.slice(0, 10))} · validez ou demandez de reprendre`, btn: ['Examiner', 'open-exercise', { id: x.id }] });
    });
    (d.exercises || []).filter((x) => x.centre === c && Q.exerciseLate(x)).forEach((x) => {
      const e = Q.ent(d, x.entrepreneurId);
      items.push({ kind: 'incub', sev: 'info', icon: 'edit', title: `${e.name} : exercice en retard « ${x.title} »`, meta: `Échéance ${EH.fmtDate(x.due)} · ${EH.ago(x.due)} j de retard${e.portal ? '' : ' · espace non activé'}`, btn: ['Ouvrir', 'open-exercise', { id: x.id }] });
    });
    d.entrepreneurs.filter((e) => e.centre === c && R.activeStages.includes(e.stage)).forEach((e) => {
      const p = Q.phaseProgress(e);
      if (p.over && p.days - p.target <= 21) items.push({ kind: 'incub', sev: 'info', icon: 'clock', title: `${e.name} : ${EH.stageLabel(e.stage).toLowerCase()} au-delà de la durée prévue`, meta: `${p.days} jours sur ${p.target} prévus · faites le point sur le passage à l'étape suivante`, btn: ['Changer d’étape', 'change-stage', { id: e.id }] });
    });
    const rank = { bad: 0, warn: 1, info: 2 };
    return items.sort((a, b) => rank[a.sev] - rank[b.sev]);
  };

  EH.pages.aujourdhui = {
    label: "Aujourd'hui", icon: 'home',
    render() {
      const d = S.data, c = S.scope(), u = S.user();
      const all = EH.todayItems(), kind = EH.f('td.kind', '');
      const benefN = all.filter((x) => x.kind === 'benef').length, incubN = all.filter((x) => x.kind === 'incub').length;
      const items = kind ? all.filter((x) => x.kind === kind) : all;
      const k = Q.kpis(d, c, Q.currentPeriod());
      const n = (v) => (v == null ? 'Pas de donnée' : Math.round(v) + EH.NBSP + '%');
      const upcoming = d.activities.filter((a) => a.centre === c && a.status === 'planned' && a.date > EH.TODAY && EH.days(EH.TODAY, a.date) <= 14).sort(EH.by('date'));
      const lessons = d.knowledge.filter((x) => x.status === 'published' && x.centre !== c && x.review >= EH.TODAY).sort(EH.by('created', -1)).slice(0, 3);
      const showAll = EH.f('td.all', '') === '1', LIMIT = 8;
      const todo = items.length ? (showAll ? items : items.slice(0, LIMIT)).map((x, i) => `<div class="list-row">${C.ico(x.icon, x.sev)}<div class="body"><div class="title">${esc(x.title)}</div><div class="meta truncate">${esc(x.meta)}</div></div><div class="row-actions">${C.btn(x.btn[0], { action: x.btn[1], data: x.btn[2], size: 'sm', variant: i === 0 ? 'primary' : '' })}</div></div>`).join('') : C.empty({ title: 'Rien à faire pour le moment', text: 'Toutes vos activités sont clôturées et chaque entrepreneur a eu une séance ce mois-ci.' });
      const more = items.length > LIMIT ? C.btn(showAll ? 'Réduire' : `Afficher les ${items.length - LIMIT} autres`, { action: 'filter', data: { key: 'td.all', value: showAll ? '' : '1' }, variant: 'ghost', size: 'sm' }) : '';
      return C.pageHead(`Bonjour ${esc(u.name.split(' ')[0])}`, `${EH.fmtDay(EH.TODAY)} · ${all.length ? EH.plural(all.length, 'point') + ' à traiter' : 'tout est à jour'}. Raccourcis clavier : S séance, C candidat, A activité.`,
        C.btn('Inscrire un candidat', { action: 'new-candidate', icon: 'userPlus' }) + C.btn('Saisir une séance', { action: 'new-session', icon: 'message', variant: 'primary' })) +
        `<div class="grid-2">${C.panel({ title: "À faire aujourd'hui", count: all.length, actions: benefN || incubN ? C.seg('td.kind', [{ value: '', label: 'Tout', count: all.length }, ...(benefN ? [{ value: 'benef', label: 'Rapports', count: benefN }] : []), ...(incubN ? [{ value: 'incub', label: 'Incubation', count: incubN }] : [])], kind, 'Filtrer les points') : '', body: todo, foot: more })}
        <div class="stack">
          ${C.panel({ title: 'Mon centre ce mois-ci', actions: C.badge('Provisoire', 'outline'), flush: false, body: `<dl class="dl"><dt>Entrepreneurs actifs</dt><dd class="num">${k.active ?? 'Pas de donnée'}</dd><dt>Couverture coaching</dt><dd class="num">${n(k.coverage)}</dd><dt>Exécution des activités</dt><dd class="num">${n(k.execution)}</dd><dt>Séances tenues</dt><dd class="num">${k.sessions}</dd><dt>Remise des rapports${C.info(EH.REF.kpis.reporting.formula)}</dt><dd class="num">${n(k.reporting)}</dd><dt>Engagement des bénéficiaires${C.info(EH.REF.kpis.engagement.formula)}</dt><dd class="num">${n(k.engagement)}</dd></dl><p class="muted xs" style="margin-top:8px">Ce sont les chiffres que voit le PMO. Ils deviennent officiels quand votre rapport est validé.</p>` })}
          ${C.panel({ title: 'Prochaines activités', count: upcoming.length, body: upcoming.length ? upcoming.map((a) => `<div class="list-row">${C.ico('calendar', a.facilitator ? 'info' : 'warn')}<div class="body">${EH.activityLink(a)}<div class="meta">${EH.fmtDay(a.date)} · ${esc(EH.partnerName(a.facilitator) || 'Intervenant à définir')}</div></div></div>`).join('') : C.empty({ icon: 'calendar', tone: '', title: 'Rien de prévu sous 14 jours', action: C.btn('Planifier une activité', { action: 'new-activity', icon: 'plus' }) }) })}
          ${lessons.length ? C.panel({ title: 'Appris dans les autres centres', body: lessons.map((x) => `<div class="list-row">${C.ico('book', 'accent')}<div class="body"><button class="link-btn" ${C.on('open-knowledge', { id: x.id })}>${esc(x.title)}</button><div class="meta">${esc(Q.centreName(d, x.centre))} · ${esc(x.type)}</div></div></div>`).join('') }) : ''}
        </div></div>
        <div style="margin-top:var(--s-4)">${EH.incubationPanel ? EH.incubationPanel() : ''}</div>`;
    }
  };
})();
