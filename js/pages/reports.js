/* Monthly reporting (FR-04): generated report, quality checks, submit, approve or return, corrections. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, I = EH.icon;
  const RS = EH.REF.reportStatus;

  const flow = (st) => {
    const steps = [['draft', 'Brouillon'], ['submitted', 'Soumis'], ['approved', 'Validé']];
    const idx = st === 'approved' ? 2 : st === 'submitted' ? 1 : 0;
    return `<div class="flow" aria-label="Étapes du rapport">${steps.map(([k, l], i) => `<span class="${i === idx ? 'on' : ''}">${i < idx ? I('check') : ''}${l}</span>`).join(I('chevronRight'))}</div>`;
  };

  /** Figures table: same selector as the dashboard, so totals match (PBI-20). */
  const figures = (centre, period, snapshotNote) => {
    const f = Q.reportFigures(S.data, centre, period);
    const row = (l, v, sub = '') => `<tr><td>${l}${sub ? `<span class="sub">${sub}</span>` : ''}</td><td class="num strong">${v}</td></tr>`;
    return `<div class="table-wrap"><table class="table"><caption class="sr-only">Chiffres du rapport</caption><tbody>
      ${row('Activités réalisées', `${f.activitiesDone} / ${f.activitiesPlanned}`, `${f.activitiesCancelled} annulée(s), ${f.activitiesOpen} non clôturée(s)`)}
      ${row('Participants aux activités', f.participants, 'Somme des présences cochées')}
      ${row('Séances de coaching et mentorat', f.sessions, `${f.coached} entrepreneur(s) accompagné(s)`)}
      ${row('Nouveaux candidats', f.newApplicants)}
      ${row("Changements d'étape", f.stageMoves, f.abandons ? `dont ${f.abandons} abandon(s)` : '')}
      ${row('Rapports bénéficiaires remis à temps', f.reportsDue ? `${f.reportsOnTime} / ${f.reportsDue}` : '<span class="muted">Pas de donnée</span>', f.reportsDue ? `${f.reportsLate} en retard` : 'Aucun rapport dû sur la période')}
      ${row('Engagement des bénéficiaires', f.engagement == null ? '<span class="muted">Pas de donnée</span>' : Math.round(f.engagement) + EH.NBSP + '%', f.engagement == null ? '' : `${f.engagementDetail.num} sur ${f.engagementDetail.den} (présences + rapports remis à temps)`)}
      ${row('Partenaires mobilisés', f.partners, 'Intervenants et coachs de la période')}
      ${row('Entrepreneurs par étape (à date)', '', EH.REF.stages.map((s) => `${s.short} ${f.byStage[s.id]}`).join(' · ') + ` · Abandon ${f.byStage.abandon}`)}
    </tbody></table></div>${snapshotNote ? `<p class="muted xs" style="padding:8px 16px">${snapshotNote}</p>` : ''}`;
  };

  const checksList = (centre, period, linkable) => {
    const checks = Q.qualityChecks(S.data, centre, period);
    if (!checks.length) return C.callout('ok', 'Aucun problème de qualité détecté.');
    return `<div class="panel">${checks.map((c) => `<div class="list-row">${C.ico('alert', 'warn')}<div class="body"><div class="title">${esc(c.text)}</div></div>${linkable ? `<div class="row-actions">${C.btn('Corriger', { action: c.kind === 'activity' ? (S.can.writeOperational(centre) ? 'close-activity' : 'open-activity') : 'open-ent', data: { id: c.id }, size: 'sm' })}</div>` : ''}</div>`).join('')}</div>`;
  };

  const historyOf = (r) => S.data.audit.filter((a) => a.object === `Rapport ${EH.fmtMonth(r.period).toLowerCase()} · ${Q.centreName(S.data, r.centre)}`);

  /* ---------- PMO: all reports ---------- */
  EH.pages.rapports = {
    label: 'Rapports', icon: 'report',
    render() {
      const d = S.data, period = EH.f('rep.period', Q.lastClosedPeriod());
      const rows = d.centres.map((c) => {
        const r = Q.report(d, c.id, period), st = Q.reportStatus(r);
        const f = Q.reportFigures(d, c.id, period);
        const qc = Q.qualityChecks(d, c.id, period).length;
        return { cls: r ? 'clickable' : '', attrs: r ? `${C.on('open-report', { id: r.id })} tabindex="0"` : '', cells: [
          `<span class="strong">${esc(c.name)}</span><span class="sub">${esc(Q.user(d, c.officer).name)}</span>`,
          C.statusBadge(RS, st),
          r && r.submitted ? EH.fmtDate(r.submitted.slice(0, 10)) : '<span class="muted">—</span>',
          `<span class="num">${f.activitiesDone}/${f.activitiesPlanned}</span>`,
          `<span class="num">${f.participants}</span>`,
          `<span class="num">${f.sessions}</span>`,
          qc ? C.badge(String(qc), 'warn', 'alert') : C.badge('0', 'ok'),
          r && r.status === 'submitted' ? C.btn('Examiner', { action: 'open-report', data: { id: r.id }, size: 'sm', variant: 'primary' }) : r ? C.btn('Ouvrir', { action: 'open-report', data: { id: r.id }, size: 'sm' }) : ''
        ] };
      });
      const due = EH.periodDue(period);
      return C.pageHead('Rapports mensuels', `Générés à partir des saisies des centres. Échéance de ${EH.fmtMonth(period).toLowerCase()} : ${EH.fmtDateY(due)}. Une période validée est verrouillée.`,
        EH.periodSeg('rep.period') + C.btn("Copier l'export CSV", { action: 'export-csv', icon: 'copy', data: { period } })) +
        C.panel({ body: C.table({ caption: 'Rapports par centre', cols: [{ label: 'Centre' }, { label: 'Statut' }, { label: 'Soumis le', cls: 'hide-sm' }, { label: 'Activités', cls: 'num' }, { label: 'Participants', cls: 'num hide-sm' }, { label: 'Séances', cls: 'num hide-sm' }, { label: 'Qualité', cls: 'hide-md' }, { label: '', cls: 'actions' }], rows }) });
    }
  };

  /* ---------- report drawer (PMO review, or officer read-only view) ---------- */
  EH.drawers.report = (st) => {
    const d = S.data, r = d.reports.find((x) => x.id === st.id);
    const status = Q.reportStatus(r);
    const name = Q.centreName(d, r.centre);
    const corr = d.corrections.filter((c) => c.report === r.id && c.status === 'open');
    const hist = historyOf(r);
    const body = `
      <div>${flow(r.status)}</div>
      ${status === 'late' ? C.callout('bad', `Non soumis : l'échéance était le ${EH.fmtDateY(EH.periodDue(r.period))}.`) : ''}
      ${r.status === 'returned' ? C.callout('warn', 'Renvoyé au centre : ' + esc(r.returnReason)) : ''}
      ${r.status === 'approved' ? C.callout('ok', `Validé le ${EH.fmtDateTime(r.approved)}. Les chiffres officiels du tableau de bord viennent de cette version.`) : ''}
      ${corr.map((c) => C.callout('warn', `<b>Correction demandée</b> par ${esc(Q.user(d, c.by).name)} : ${esc(c.text)}`, S.isPmo() ? C.btn('Accepter et rouvrir la période', { action: 'resolve-correction', data: { id: c.id, ok: 1 }, size: 'sm' }) + C.btn('Refuser', { action: 'resolve-correction', data: { id: c.id, ok: 0 }, size: 'sm' }) : '')).join('')}
      <div class="section"><h3>Chiffres générés</h3><div class="panel">${figures(r.centre, r.period, r.status === 'approved' ? 'Période verrouillée : toute modification passe par une demande de correction.' : '')}</div></div>
      <div class="section"><h3>Contrôle qualité</h3>${checksList(r.centre, r.period, false)}</div>
      <div class="section"><h3>Commentaire du centre</h3><p class="small">${r.comment ? esc(r.comment) : '<span class="muted">Aucun commentaire.</span>'}</p></div>
      ${hist.length ? `<div class="section"><h3>Historique</h3><ul class="timeline">${hist.map((h) => `<li>${C.ico('history')}<div><div class="what">${esc(h.action)}${h.detail ? ' · ' + esc(h.detail) : ''}</div><div class="when">${EH.fmtDateTime(h.at)} · ${esc(Q.user(d, h.user).name)}</div></div></li>`).join('')}</ul></div>` : ''}
      ${st.mode === 'return' ? `<div class="section">${C.field({ name: 'reason', label: 'Motif du renvoi', type: 'textarea', required: true, error: st.errors.reason, value: st.values.reason, autofocus: true, help: 'Le chargé verra ce motif et corrigera avant de soumettre à nouveau.' })}</div>` : ''}`;
    let foot = '';
    if (S.can.validateReport() && r.status === 'submitted') {
      foot = st.mode === 'return'
        ? C.btn('Annuler', { action: 'report-mode', data: { mode: '' } }) + C.btn('Renvoyer au centre', { type: 'submit', variant: 'danger', icon: 'undo' })
        : `<span class="left">${C.btn('Renvoyer', { action: 'report-mode', data: { mode: 'return' }, icon: 'undo' })}</span>` + C.btn('Valider et verrouiller', { action: 'approve-report', data: { id: r.id }, variant: 'primary', icon: 'lock' });
    }
    return C.drawer({ title: `Rapport ${esc(EH.fmtMonth(r.period).toLowerCase())} · ${esc(name)}`, sub: `${C.statusBadge(RS, status)} · Chargé : ${esc(Q.user(d, Q.centre(d, r.centre).officer).name)}`, body: C.formError(st.errors) + body, foot, wide: true, form: st.mode === 'return' ? 'return-report' : null });
  };

  /* ---------- officer: my report ---------- */
  EH.pages.rapport = {
    label: 'Rapport mensuel', icon: 'report',
    render() {
      const d = S.data, centre = S.scope();
      const closed = Q.lastClosedPeriod(), period = EH.f('my.period', closed);
      const isCurrent = period !== closed;
      const r = Q.report(d, centre, period) || { status: 'draft', period, centre, comment: '' };
      const st = isCurrent ? 'draft' : Q.reportStatus(r);
      const checks = Q.qualityChecks(d, centre, period);
      const editable = !isCurrent && (r.status === 'draft' || r.status === 'returned');
      const err = EH.ui.reportErrors || {};
      let banner = '';
      if (isCurrent) banner = C.callout('info', `Aperçu de la période en cours. La soumission sera possible à partir du ${EH.fmtDateY(EH.addDays(EH.periodEnd(period), 1))}.`);
      else if (st === 'late') banner = C.callout('bad', `Ce rapport est en retard : l'échéance était le ${EH.fmtDateY(EH.periodDue(period))}. Vérifiez les points ci-dessous puis soumettez-le.`);
      else if (r.status === 'returned') banner = C.callout('warn', `<b>Renvoyé par le PMO.</b> ${esc(r.returnReason)}`);
      else if (r.status === 'submitted') banner = C.callout('info', `Soumis le ${EH.fmtDateTime(r.submitted)}. Le PMO va le valider ou vous le renvoyer avec un motif.`);
      else if (r.status === 'approved') banner = C.callout('ok', `Validé le ${EH.fmtDateTime(r.approved)}. La période est verrouillée.`, C.btn('Demander une correction', { action: 'ask-correction', data: { id: r.id }, size: 'sm', icon: 'edit' }));

      const submitPanel = editable ? C.panel({ title: 'Soumettre au PMO', flush: false, body: `<form data-form="submit-report" novalidate class="stack">
          ${C.field({ name: 'comment', label: 'Commentaire pour le PMO', type: 'textarea', value: EH.ui.reportDraft != null ? EH.ui.reportDraft : r.comment, required: checks.length > 0, error: err.comment, help: checks.length ? `Obligatoire : ${checks.length} alerte(s) qualité à expliquer, ou corrigez-les d'abord.` : 'Facultatif : contexte du mois, difficultés, besoins d\'appui.' })}
          <div style="display:flex;justify-content:flex-end">${C.btn('Soumettre le rapport', { type: 'submit', variant: 'primary', icon: 'send' })}</div></form>` }) : '';

      return C.pageHead(`Rapport · ${EH.fmtMonth(period)}`, `Généré automatiquement depuis vos saisies : vous ne ressaisissez aucun chiffre. ${flow(isCurrent ? 'draft' : r.status)}`,
        C.seg('my.period', [{ value: closed, label: EH.fmtMonth(closed) }, { value: Q.currentPeriod(), label: EH.fmtMonth(Q.currentPeriod()) + ' (en cours)' }], period, 'Période')) +
        (banner ? `<div style="margin-bottom:var(--s-4)">${banner}</div>` : '') +
        `<div class="grid-2"><div class="stack">${C.panel({ title: 'Chiffres du mois', actions: C.statusBadge(RS, st), body: figures(centre, period) })}</div>
         <div class="stack">${C.panel({ title: 'Contrôle qualité', count: checks.length, body: checks.length ? `<div>${checks.map((c) => `<div class="list-row">${C.ico('alert', 'warn')}<div class="body"><div class="title">${esc(c.text)}</div></div><div class="row-actions">${C.btn('Corriger', { action: c.kind === 'activity' ? 'close-activity' : 'open-ent', data: { id: c.id }, size: 'sm' })}</div></div>`).join('')}</div>` : C.empty({ title: 'Données propres', text: 'Aucun champ manquant, doublon ou activité non clôturée.' }) })}${submitPanel}</div></div>`;
    }
  };

  /* ---------- correction modal ---------- */
  EH.modals.correction = (m) => C.modal({ title: 'Demander une correction', form: 'correction', body: `<p class="small">La période est verrouillée. Décrivez ce qui doit changer : le PMO rouvrira la période s'il accepte, et la version du rapport sera incrémentée.</p>${C.field({ name: 'text', label: 'Correction demandée', type: 'textarea', required: true, error: m.errors.text, autofocus: true })}`, foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn('Envoyer la demande', { type: 'submit', variant: 'primary', icon: 'send' }) });

  /* ---------- actions & forms ---------- */
  Object.assign(EH.actions, {
    'open-report': (el) => EH.openDrawer('report', { id: el.dataset.id }),
    'report-mode': (el) => { EH.ui.drawer.mode = el.dataset.mode; EH.ui.drawer.errors = {}; EH.renderOverlays(true); },
    'approve-report': (el) => {
      const res = EH.act.approveReport(el.dataset.id);
      if (!res.ok) return EH.toast(res.errors._, { tone: 'error' });
      EH.closeDrawer(); EH.render();
      EH.toast(`Rapport de ${esc(Q.centreName(S.data, res.item.centre))} validé : chiffres officiels mis à jour, période verrouillée.`);
    },
    'ask-correction': (el) => EH.openModal('correction', { id: el.dataset.id }),
    'resolve-correction': (el) => {
      const res = EH.act.resolveCorrection(el.dataset.id, el.dataset.ok === '1');
      if (!res.ok) return EH.toast(res.errors._, { tone: 'error' });
      EH.renderOverlays(); EH.render();
      EH.toast(el.dataset.ok === '1' ? 'Correction acceptée : la période est rouverte pour le centre.' : 'Correction refusée.');
    }
  });
  EH.forms['return-report'] = (v) => {
    const st = EH.ui.drawer;
    st.values = v;
    const res = EH.act.returnReport(st.id, v.reason);
    EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(`Rapport renvoyé à ${esc(Q.centreName(S.data, r.item.centre))} avec le motif.`); });
  };
  EH.forms['submit-report'] = (v) => {
    EH.ui.reportDraft = v.comment;
    const res = EH.act.submitReport(S.scope(), Q.lastClosedPeriod(), v.comment);
    if (res.ok) { EH.ui.reportErrors = null; EH.ui.reportDraft = null; EH.render(); EH.toast('Rapport soumis au PMO. Vous serez notifié de sa validation.'); }
    else { EH.ui.reportErrors = res.errors; EH.render(); const f = document.getElementById('fld-comment'); if (f) f.focus(); }
  };
  EH.forms.correction = (v) => {
    const m = EH.ui.modal;
    const res = EH.act.requestCorrection(m.id, v.text);
    if (res.ok) { EH.closeModal(); EH.render(); EH.toast('Demande de correction envoyée au PMO.'); }
    else { m.errors = res.errors; EH.renderOverlays(true); }
  };
})();
