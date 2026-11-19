/* Beneficiary space, part 1: Mes activités, Mes rapports, and the two drawers (activity, report form).
   A beneficiary only ever reads his own record (S.ownEnt()) and his cohort's activities. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF;
  const BR = R.beneficiaryReportStatus;

  const me = () => S.ownEnt();
  const myObligations = () => { const e = me(); return e ? Q.obligations(S.data, e) : []; };
  const myObligation = (activityId) => myObligations().find((o) => o.activity.id === activityId) || null;
  const progName = (a) => (Q.programme(S.data, a.programme) || {}).name || '—';
  const dueText = (o) => (o.late ? `En retard de ${EH.plural(o.daysLate, 'jour')}` : `À rendre le ${EH.fmtDate(o.due)}`);
  const reqText = (o) => Q.formatLabel(o.requirement.format) + (o.optional ? ' · Facultatif' : '');
  const actionLabel = (o) => ({ todo: 'Remplir', draft: 'Continuer', returned: 'Corriger', submitted: 'Voir', validated: 'Voir' }[o.status]);
  const statusBadge = (o) => C.statusBadge(BR, o.status) + (o.late ? ' ' + C.badge('En retard', 'bad', 'alert') : '');
  const draftKey = (id) => `breport:${S.user().id}:${id}`;
  const none = (title, text) => C.empty({ icon: 'shield', tone: 'bad', title, text });

  /** Urgency order used by the lists: late, returned, to do, draft, sent, validated. */
  const urgency = (o) => (o.late ? 0 : o.status === 'returned' ? 1 : o.status === 'todo' ? 2 : o.status === 'draft' ? 3 : o.status === 'submitted' ? 4 : 5);

  EH.benef = { me, myObligations, progName, dueText, reqText, actionLabel, statusBadge, urgency };

  EH.benefNavCount = (id) => {
    const open = myObligations().filter((o) => !o.optional && ['todo', 'draft', 'returned'].includes(o.status));
    if (id === 'mes-rapports') return open.length ? { n: open.length, alert: open.some((o) => o.late || o.status === 'returned') } : null;
    if (id === 'mon-espace') { const n = EH.benefTodayCount ? EH.benefTodayCount() : 0; return n.n ? n : null; }
    return null;
  };

  const reportRow = (o) => {
    const tone = o.late || o.status === 'returned' ? 'bad' : o.status === 'validated' ? 'ok' : o.status === 'submitted' ? 'info' : '';
    return `<div class="list-row">${C.ico('report', tone)}<div class="body"><div class="title">${esc(o.activity.title)}</div>
      <div class="meta">${esc(progName(o.activity))} · ${esc(reqText(o))}</div>
      <div class="meta ${o.late ? 't-bad strong' : ''}">${esc(dueText(o))}</div></div>
      <div class="row-actions">${statusBadge(o)}${C.btn(actionLabel(o), { action: 'my-open-report', data: { id: o.activity.id }, size: 'sm', variant: ['todo', 'draft', 'returned'].includes(o.status) && !o.optional ? 'primary' : '' })}</div></div>`;
  };
  EH.benef.reportRow = reportRow;

  /* ---------- Mes activités ---------- */
  const ACT_STATUS = {
    done: { label: 'Réalisée', tone: 'ok' }, cancelled: { label: 'Annulée', tone: '' }, postponed: { label: 'Reportée', tone: 'warn' },
    upcoming: { label: 'À venir', tone: 'info' }, waiting: { label: 'En attente de clôture', tone: 'warn' }
  };
  const actStatus = (a) => (a.status === 'planned' ? (a.date >= EH.TODAY ? 'upcoming' : 'waiting') : a.status);
  const isUpcoming = (a) => actStatus(a) === 'upcoming';

  EH.pages['mes-activites'] = {
    label: 'Mes activités', icon: 'calendar',
    render() {
      const e = me();
      if (!e) return none('Espace indisponible', 'Ce profil n’est lié à aucun entrepreneur.');
      const d = S.data, all = Q.cohortActivities(d, e);
      const prog = EH.f('ma.prog', ''), when = EH.f('ma.when', 'upcoming');
      const base = all.filter((a) => !prog || a.programme === prog);
      const obs = new Map(myObligations().map((o) => [o.activity.id, o]));
      const nUp = base.filter(isUpcoming).length;
      const list = base.filter((a) => when === 'all' || (when === 'upcoming') === isUpcoming(a))
        .sort((a, b) => (when === 'past' ? (a.date < b.date ? 1 : -1) : a.date < b.date ? -1 : 1));
      const progs = [...new Set(all.map((a) => a.programme))].map((id) => ({ value: id, label: (Q.programme(d, id) || {}).name || id }));
      const rows = list.map((a) => {
        const st = ACT_STATUS[actStatus(a)], o = obs.get(a.id);
        return `<div class="list-row">${C.ico('calendar', actStatus(a) === 'upcoming' ? 'info' : a.status === 'done' ? 'ok' : '')}<div class="body">
          <button type="button" class="link-btn title" ${C.on('my-open-activity', { id: a.id })}>${esc(a.title)}</button>
          <div class="meta">${EH.fmtDay(a.date)} · ${esc(progName(a))}</div>
          ${o ? `<div class="meta ${o.late ? 't-bad strong' : ''}">Rapport : ${esc(BR[o.status].label)} · ${esc(dueText(o))}</div>` : ''}</div>
          <div class="row-actions">${C.badge(st.label, st.tone)}${C.btn('Ouvrir', { action: 'my-open-activity', data: { id: a.id }, size: 'sm' })}</div></div>`;
      }).join('');
      const seg = C.seg('ma.when', [{ value: 'upcoming', label: 'À venir', count: nUp }, { value: 'past', label: 'Passées', count: base.length - nUp }, { value: 'all', label: 'Toutes', count: base.length }], when, 'Période');
      return C.pageHead('Mes activités', 'Les ateliers, formations et événements de votre parcours, tous programmes confondus.') +
        `<div class="toolbar" style="overflow-x:auto">${seg}</div>` +
        (progs.length > 1 ? `<div class="toolbar">${C.filterSelect('ma.prog', 'Programme', [{ value: '', label: 'Tous les programmes' }, ...progs], prog)}</div>` : '') +
        C.panel({ body: rows || C.empty({ icon: 'calendar', tone: '', title: 'Aucune activité', text: when === 'upcoming' ? 'Rien n’est prévu pour le moment. Regardez les activités passées pour retrouver vos rapports.' : 'Aucune activité pour ce filtre.', action: when === 'all' ? '' : C.btn('Voir toutes les activités', { action: 'filter', data: { key: 'ma.when', value: 'all' } }) }) });
    }
  };

  /* ---------- Mes rapports ---------- */
  EH.pages['mes-rapports'] = {
    label: 'Mes rapports', icon: 'report',
    render() {
      const e = me();
      if (!e) return none('Espace indisponible', 'Ce profil n’est lié à aucun entrepreneur.');
      const all = myObligations();
      const status = EH.f('mr.status', '');
      const counts = EH.groupCount(all, (o) => o.status);
      const list = all.filter((o) => !status || o.status === status).sort((a, b) => urgency(a) - urgency(b) || (a.due < b.due ? -1 : 1));
      const seg = C.seg('mr.status', [{ value: '', label: 'Tous', count: all.length }, ...Object.keys(BR).map((k) => ({ value: k, label: BR[k].label, count: counts[k] || 0 }))], status, 'Statut du rapport');
      const empty = all.length
        ? C.empty({ icon: 'search', tone: '', title: 'Aucun rapport pour ce filtre', text: 'Choisissez « Tous » pour revoir l’ensemble.', action: C.btn('Voir tous les rapports', { action: 'filter', data: { key: 'mr.status', value: '' } }) })
        : C.empty({ icon: 'report', tone: '', title: 'Aucun rapport à rendre', text: 'Un rapport apparaît ici après une activité à laquelle vous avez participé et pour laquelle le chargé en demande un.', action: C.btn('Voir mes activités', { action: 'go', data: { route: 'mes-activites' } }) });
      return C.pageHead('Mes rapports', 'Un rapport par activité suivie. Votre saisie est conservée automatiquement.') +
        `<div class="toolbar" style="overflow-x:auto">${seg}</div>` +
        C.panel({ body: list.length ? list.map(reportRow).join('') : empty });
    }
  };

  /* ---------- drawer: activity ---------- */
  EH.drawers.myActivity = (st) => {
    const d = S.data, a = Q.activity(d, st.id);
    if (!a || !S.canSeeActivity(a)) return C.drawer({ title: 'Accès refusé', body: none('Accès refusé', 'Cette activité ne fait pas partie de votre parcours. La tentative a été enregistrée.') });
    const s = ACT_STATUS[actStatus(a)], req = Q.requirementOf(d, a), o = myObligation(a.id);
    let reqHtml;
    if (!req) reqHtml = '<p class="muted small">Aucun rapport n’est demandé pour cette activité.</p>';
    else reqHtml = `<dl class="dl"><dt>Format</dt><dd>${esc(Q.formatLabel(req.format))}</dd><dt>Échéance</dt><dd>${req.dueDays} jours après l’activité (le ${EH.fmtDate(Q.reportDue(a, req))})</dd><dt>Caractère</dt><dd>${req.mandatory ? 'Obligatoire' : 'Facultatif'}</dd></dl>`;
    let mine = '';
    if (o) mine = `<div class="panel">${reportRow(o)}</div>`;
    else if (req && a.status !== 'done') mine = '<p class="muted small">Votre rapport s’ouvrira une fois l’activité réalisée.</p>';
    else if (req && a.status === 'done') mine = '<p class="muted small">Vous n’étiez pas présent : aucun rapport n’est attendu.</p>';
    const body = `<dl class="dl"><dt>Date</dt><dd>${EH.fmtDay(a.date)} ${a.date.slice(0, 4)}${a.duration ? ' · ' + esc(a.duration) : ''}</dd>
      <dt>Programme</dt><dd>${esc(progName(a))}</dd><dt>Lieu</dt><dd>${esc(a.location || '—')}</dd>
      <dt>Intervenant</dt><dd>${esc(EH.partnerName(a.facilitator) || 'À définir')}</dd></dl>
      <div class="section"><h3>Rapport demandé</h3>${reqHtml}</div>
      <div class="section"><h3>Mon rapport</h3>${mine || '<p class="muted small">Aucun rapport à rendre.</p>'}</div>`;
    return C.drawer({ title: esc(a.title), sub: `${C.badge(s.label, s.tone)} · ${esc(a.type)}`, body });
  };

  /* ---------- drawer: report form ---------- */
  const valuesFromReport = (o) => {
    const out = {};
    if (o.report) Object.entries(o.report.answers || {}).forEach(([k, v]) => (out['ans_' + k] = v));
    return out;
  };
  const answersView = (o) => {
    const req = o.requirement, a = (o.report && o.report.answers) || {};
    const link = (u) => (/^https?:\/\//.test(u || '') ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>` : esc(u || '—'));
    if (req.format === 'presence') return '<p class="small">Présence confirmée.</p>';
    if (req.format === 'free') return `<dl class="dl"><dt>Compte rendu</dt><dd>${esc(a.text || '—')}</dd></dl>`;
    if (req.format === 'deliverable') return `<dl class="dl"><dt>Livrable</dt><dd>${link(a.link)}</dd><dt>Note</dt><dd>${esc(a.note || '—')}</dd></dl>`;
    return `<dl class="dl">${req.fields.map((f) => `<dt>${esc(f.label)}</dt><dd>${a[f.id] == null ? '<span class="muted">—</span>' : esc(f.type === 'rating' ? a[f.id] + ' sur 5' : a[f.id])}</dd>`).join('')}</dl>`;
  };
  const ratingField = (f, v, er) => `<fieldset class="field full rating-field" ${er ? 'aria-invalid="true"' : ''}><legend class="field-label">${esc(f.label)}${f.required ? '<span class="req" aria-hidden="true">*</span>' : ''}</legend>
    <div class="rating" role="radiogroup" aria-label="${esc(f.label)}">${[1, 2, 3, 4, 5].map((n) => `<label class="rating-opt"><input type="radio" name="ans_${esc(f.id)}" value="${n}" ${String(v) === String(n) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
    <div class="rating-legend" aria-hidden="true"><span>1 · faible</span><span>5 · excellent</span></div>${er ? `<span class="error">${esc(er)}</span>` : ''}</fieldset>`;
  const formFields = (req, v, er) => {
    const val = (k) => (v['ans_' + k] == null ? '' : v['ans_' + k]);
    if (req.format === 'free') return C.field({ name: 'ans_text', label: 'Compte rendu', type: 'textarea', rows: 6, required: true, value: val('text'), error: er.ans_text, full: true, help: 'Ce que vous avez retenu, appliqué ou décidé.' });
    if (req.format === 'deliverable') return C.field({ name: 'ans_link', label: 'Lien vers votre livrable', type: 'url', required: true, value: val('link'), error: er.ans_link, full: true, placeholder: 'https://…', help: 'Document ou dossier partagé, accessible au chargé du centre.' }) +
      C.field({ name: 'ans_note', label: 'Note pour le chargé', type: 'textarea', rows: 3, value: val('note'), error: er.ans_note, full: true });
    if (req.format === 'presence') return '<p class="small">Vous avez participé à cette activité. Confirmez votre présence pour clore ce rapport.</p>';
    return req.fields.map((f) => {
      const name = 'ans_' + f.id;
      if (f.type === 'rating') return ratingField(f, val(f.id), er[name]);
      if (f.type === 'choice') return C.field({ name, label: f.label, type: 'select', required: f.required, value: val(f.id), error: er[name], full: true, options: [{ value: '', label: 'Choisir…' }, ...f.options.map((x) => ({ value: x, label: x }))] });
      if (f.type === 'number') return C.field({ name, label: f.label, type: 'number', required: f.required, value: val(f.id), error: er[name], full: true });
      return C.field({ name, label: f.label, type: 'textarea', rows: 3, required: f.required, value: val(f.id), error: er[name], full: true });
    }).join('');
  };

  EH.drawers.myReport = (st) => {
    const d = S.data, e = me(), a = Q.activity(d, st.id);
    if (!e || !a || !S.canSeeActivity(a)) return C.drawer({ title: 'Accès refusé', body: none('Accès refusé', 'Cette activité ne fait pas partie de votre parcours. La tentative a été enregistrée.') });
    const o = myObligation(a.id);
    if (!o) return C.drawer({ title: esc(a.title), sub: esc(progName(a)), body: C.empty({ icon: 'report', tone: '', title: 'Aucun rapport attendu', text: 'Aucun rapport n’est demandé pour cette activité, ou vous n’y avez pas participé.' }) });
    const req = o.requirement, rep = o.report, v = st.values || {}, er = st.errors || {};
    const fb = req.feedbackVisible, current = Q.requirementOf(d, a);
    const editable = ['todo', 'draft', 'returned'].includes(o.status);
    const notes = [];
    if (req.version > 1 || (current && current.id !== req.id)) {
      notes.push(C.callout('info', `Vous répondez à la <b>version ${req.version}</b> du rapport demandé.${current && current.id !== req.id ? ` Le chargé l’a modifié depuis (version ${current.version}) : votre réponse reste liée à la version que vous avez commencée.` : ''}`));
    }
    if (st.restored) notes.push(C.callout('info', 'Brouillon restauré : il était conservé sur cet appareil.'));
    if (o.late) notes.push(C.callout('bad', `En retard de ${EH.plural(o.daysLate, 'jour')} : l’échéance était le ${EH.fmtDateY(o.due)}. Envoyez-le dès que possible.`));
    else if (editable && !o.optional && o.status !== 'returned') notes.push(C.callout('info', `À rendre avant le ${EH.fmtDateY(o.due)}.`));
    else if (editable) notes.push(C.callout('info', `Facultatif · à rendre avant le ${EH.fmtDateY(o.due)}.`));
    if (o.status === 'returned') notes.push(C.callout('warn', fb && rep.reviewComment ? `<b>À corriger.</b> ${esc(rep.reviewComment)}` : '<b>À corriger.</b> Le chargé du centre a renvoyé ce rapport : corrigez-le puis renvoyez-le, ou demandez-lui des précisions.'));
    else if (o.status === 'draft' && rep && rep.firstSubmittedAt && fb && rep.reviewComment) notes.push(C.callout('warn', `<b>Dernier retour du chargé.</b> ${esc(rep.reviewComment)}`));
    if (o.status === 'submitted') notes.push(C.callout('info', `Envoyé le ${EH.fmtDateTime(rep.submittedAt)}. Le chargé du centre le relit : vous ne pouvez plus le modifier.`));
    if (o.status === 'validated') notes.push(C.callout('ok', `<b>Rapport validé</b> le ${EH.fmtDateTime(rep.reviewedAt)}.${fb && rep.reviewComment ? ' ' + esc(rep.reviewComment) : ''} Il n’est plus modifiable.`));
    const sub = `${statusBadge(o)} · ${esc(progName(a))} · ${esc(reqText(o))}`;
    const head = `<dl class="dl"><dt>Activité</dt><dd>${EH.fmtDay(a.date)} · ${esc(a.type)}</dd></dl>`;

    if (editable) {
      const version = st.version != null ? st.version : rep ? rep.version : 0;
      const presence = req.format === 'presence';
      const body = `${C.formError(er)}${notes.join('')}${head}
        <input type="hidden" name="activity" value="${esc(a.id)}"><input type="hidden" name="version" value="${version}">
        <div class="form-grid">${formFields(req, v, er)}</div>
        ${presence ? '' : '<p class="muted xs">Votre saisie est conservée automatiquement sur cet appareil.</p>'}`;
      const foot = (presence ? '' : C.btn('Enregistrer le brouillon', { type: 'submit', extra: 'data-intent="draft"' })) + C.btn(presence ? 'Confirmer ma présence' : 'Envoyer le rapport', { type: 'submit', variant: 'primary', icon: 'send', extra: 'data-intent="send"' });
      return C.drawer({ title: esc(a.title), sub, body, foot, form: 'breport', draft: !presence, draftKey: draftKey(a.id) });
    }

    const open = rep && d.beneficiaryCorrections.find((c) => c.report === rep.id && c.status === 'open');
    let extra = '';
    if (o.status === 'validated') {
      if (open) extra = C.callout('info', `<b>Demande de correction envoyée</b> le ${EH.fmtDateTime(open.at)} : « ${esc(open.text)} ». Le chargé du centre va répondre.`);
      else if (st.correctionMode) extra = `<form data-form="breport-correction" novalidate class="stack">${C.field({ name: 'text', label: 'Correction demandée', type: 'textarea', rows: 3, required: true, error: er.text, autofocus: true, value: (st.values || {}).text, help: 'Décrivez ce qui doit changer. Le chargé du centre décidera.' })}
        <div style="display:flex;gap:8px;justify-content:flex-end">${C.btn('Annuler', { action: 'my-correction-mode', data: { on: 0 } })}${C.btn('Envoyer la demande', { type: 'submit', variant: 'primary', icon: 'send' })}</div></form>`;
      else extra = `<div>${C.btn('Demander une correction', { action: 'my-correction-mode', data: { on: 1 }, icon: 'edit' })}</div>`;
    }
    return C.drawer({ title: esc(a.title), sub, body: `${C.formError(er)}${notes.join('')}${head}<div class="section"><h3>Ma réponse</h3>${answersView(o)}</div>${extra}` });
  };

  /* ---------- actions & forms (all prefixed "my-": the only ones a beneficiary may trigger) ---------- */
  Object.assign(EH.actions, {
    'my-open-activity': (el) => EH.openDrawer('myActivity', { id: el.dataset.id }),
    'my-open-report': (el) => {
      const id = el.dataset.id, o = myObligation(id);
      if (!o) { EH.openDrawer('myReport', { id }); return; }
      const dr = ['todo', 'draft', 'returned'].includes(o.status) && o.requirement.format !== 'presence' ? EH.drafts.get(draftKey(id)) : null;
      EH.openDrawer('myReport', { id, version: o.report ? o.report.version : 0, values: dr || valuesFromReport(o), restored: !!dr });
    },
    'my-correction-mode': (el) => { const st = EH.ui.drawer; if (!st || st.type !== 'myReport') return; st.correctionMode = el.dataset.on === '1'; st.errors = {}; EH.renderOverlays(true); }
  });

  EH.forms.breport = (v, form, submitter) => {
    const st = EH.ui.drawer;
    if (!st || st.type !== 'myReport') return;
    const intent = (submitter && submitter.dataset.intent) || 'send';
    st.values = v;
    const answers = {};
    Object.keys(v).forEach((k) => { if (k.startsWith('ans_')) answers[k.slice(4)] = v[k]; });
    const res = intent === 'draft' ? EH.act.saveReportDraft(st.id, answers, st.version) : EH.act.sendBeneficiaryReport(st.id, answers, st.version);
    EH.handle(res, st, (r) => {
      EH.drafts.clear(draftKey(st.id));
      st.errors = {};
      if (intent === 'draft') {
        st.version = r.item.version; st.values = valuesFromReport(myObligation(st.id) || {}); st.restored = false;
        EH.render();
        EH.toast('Brouillon enregistré.');
      } else {
        const pres = (myObligation(st.id) || { requirement: {} }).requirement.format === 'presence';
        EH.closeDrawer(); EH.render();
        EH.toast(pres ? 'Présence confirmée. Le chargé du centre va la relire.' : r.onTime === false ? 'Rapport envoyé après l’échéance. Le chargé du centre va le relire.' : 'Rapport envoyé. Le chargé du centre va le relire.');
      }
    });
  };
  EH.forms['breport-correction'] = (v) => {
    const st = EH.ui.drawer;
    if (!st || st.type !== 'myReport') return;
    const o = myObligation(st.id);
    st.values = v;
    const res = o && o.report ? EH.act.requestBeneficiaryCorrection(o.report.id, v.text) : { ok: false, errors: { _: 'Rapport introuvable.' } };
    EH.handle(res, st, () => { st.correctionMode = false; st.errors = {}; st.values = {}; EH.render(); EH.toast('Demande de correction envoyée.'); });
  };
})();
