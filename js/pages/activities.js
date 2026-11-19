/* Programmes' activities (FR-01-03 to FR-01-05): plan, close with attendance, list and month views. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, I = EH.icon, R = EH.REF;
  const AS = R.activityStatus;

  const sortKey = (a) => (Q.needsClosing(a) ? '0' + a.date : a.date >= EH.TODAY ? '1' + a.date : '2' + (99999999 - +a.date.replace(/-/g, '')));

  const monthGrid = (list, month) => {
    const first = month + '-01';
    const startDow = (new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1)).getUTCDay() + 6) % 7; // Monday first
    const start = EH.addDays(first, -startDow);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = EH.addDays(start, i);
      if (i >= 35 && day.slice(0, 7) !== month) break;
      const evs = list.filter((a) => a.date === day);
      cells.push(`<div class="day ${day.slice(0, 7) !== month ? 'out' : ''} ${day === EH.TODAY ? 'today' : ''}"><span class="d">${+day.slice(8)}</span>${evs.map((a) => { const st = Q.activityStatus(a); return `<button class="ev ${st}" ${C.on('open-activity', { id: a.id })} title="${esc(a.title + ' · ' + AS[st].label)}">${esc(a.title)}</button>`; }).join('')}</div>`);
    }
    return `<div class="cal">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((x) => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div>`;
  };

  EH.pages.activites = {
    label: 'Activités', icon: 'calendar',
    render() {
      const d = S.data, pmo = S.isPmo();
      const centre = pmo ? EH.f('act.centre', '') : S.scope();
      const view = EH.f('act.view', 'list'), prog = EH.f('act.prog', ''), status = EH.f('act.status', ''), q = EH.norm(EH.f('act.q', ''));
      const base = Q.inScope(d.activities, centre || null).filter((a) => (!prog || a.programme === prog) && (!q || EH.norm(a.title + ' ' + a.type).includes(q)));
      const counts = EH.groupCount(base, Q.activityStatus);
      const list = base.filter((a) => !status || Q.activityStatus(a) === status).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      const w = !pmo;

      let body;
      if (view === 'month') {
        const month = EH.f('act.month', EH.TODAY.slice(0, 7));
        const shift = (n) => { const y = +month.slice(0, 4), m = +month.slice(5, 7) - 1 + n; const dt = new Date(Date.UTC(y, m, 1)); return dt.toISOString().slice(0, 7); };
        body = C.panel({ title: EH.fmtMonth(month), actions: C.btn('', { action: 'filter', data: { key: 'act.month', value: shift(-1) }, icon: 'chevronLeft', size: 'sm', title: 'Mois précédent' }) + C.btn("Aujourd'hui", { action: 'filter', data: { key: 'act.month', value: EH.TODAY.slice(0, 7) }, size: 'sm' }) + C.btn('', { action: 'filter', data: { key: 'act.month', value: shift(1) }, icon: 'chevronRight', size: 'sm', title: 'Mois suivant' }),
          body: list.some((a) => a.date.slice(0, 7) === month) ? monthGrid(list, month) : monthGrid(list, month) + C.empty({ icon: 'calendar', tone: '', title: 'Aucune activité ce mois-ci', text: w ? 'Planifiez une activité pour la voir ici.' : '' }) });
      } else {
        const rows = list.map((a) => {
          const st = Q.activityStatus(a), p = Q.programme(d, a.programme), fac = EH.partnerName(a.facilitator);
          return { cls: 'clickable', attrs: `${C.on('open-activity', { id: a.id })} tabindex="0"`, cells: [
            `<span class="nowrap">${EH.fmtDay(a.date)}</span>`,
            `${EH.activityLink(a)}<span class="sub">${esc(a.type)}${pmo ? ' · ' + esc(Q.centreName(d, a.centre)) : ''}</span>`,
            `<span class="truncate" style="display:block;max-width:200px">${esc(p ? p.name : '—')}</span>`,
            fac ? esc(fac) : '<span class="t-warn strong">À définir</span>',
            a.status === 'done' ? `<span class="num">${a.attendees.length}/${a.expected}</span>` : `<span class="muted num">${a.expected} attendus</span>`,
            C.statusBadge(AS, st),
            w && Q.needsClosing(a) ? C.btn('Clôturer', { action: 'close-activity', data: { id: a.id }, size: 'sm', variant: st === 'overdue' ? 'primary' : '' }) : ''
          ] };
        });
        body = C.panel({ body: C.table({ caption: 'Activités', cols: [{ label: 'Date' }, { label: 'Activité' }, { label: 'Programme', cls: 'hide-md' }, { label: 'Intervenant', cls: 'hide-sm' }, { label: 'Participants', cls: 'num hide-sm' }, { label: 'Statut' }, { label: '', cls: 'actions' }], rows, empty: C.empty({ icon: 'calendar', tone: '', title: 'Aucune activité', text: 'Aucune activité pour ces filtres.' }) }), foot: `<span class="muted xs">Les activités à clôturer apparaissent en premier, puis les prochaines, puis l'historique.</span>` });
      }
      const statusSeg = C.seg('act.status', [{ value: '', label: 'Toutes', count: base.length }, ...['overdue', 'draft', 'planned', 'done', 'cancelled'].map((k) => ({ value: k, label: AS[k].label, count: counts[k] || 0 }))], status, 'Statut');
      return C.pageHead('Activités', pmo ? 'Ateliers, formations et événements des six centres. Une activité « prévue » deux jours après sa date déclenche une alerte.' : 'Planifiez, puis clôturez avec les présences : les chiffres partent directement dans le rapport.',
        C.seg('act.view', [{ value: 'list', label: 'Liste' }, { value: 'month', label: 'Mois' }], view, 'Affichage') + (w ? C.btn('Planifier une activité', { action: 'new-activity', icon: 'plus', variant: 'primary' }) : '')) +
        `<div class="toolbar">${C.search('act.q', 'Rechercher une activité…', EH.f('act.q', ''))}${pmo ? C.filterSelect('act.centre', 'Centre', EH.centreOptions(), centre) : ''}${C.filterSelect('act.prog', 'Programme', EH.programmeOptions(centre || null, 'Tous les programmes'), prog)}</div>` +
        `<div class="toolbar" style="overflow-x:auto">${statusSeg}</div>` + body;
    }
  };


  /* ---------- reporting requirement and beneficiary reports (Défi 1) ---------- */
  const yn = (b) => (b ? 'Oui' : 'Non');
  const requirementSection = (d, a) => {
    const req = Q.requirementOf(d, a), origin = Q.requirementOrigin(d, a);
    if (!req) return `<div class="section"><h3>Rapport demandé</h3><p class="muted small">Aucun rapport demandé pour cette activité.</p></div>`;
    const key = req.scope === 'programme' ? req.programmeId : req.activityId;
    const versions = Q.requirementVersions(d, req.scope, key);
    const mine = d.beneficiaryReports.filter((r) => r.activityId === a.id);
    const perVersion = versions.length > 1 ? `<dt>Rapports par version</dt><dd class="num">${versions.map((v) => `v${v.version} : ${EH.plural(mine.filter((r) => r.requirementId === v.id).length, 'rapport')}`).join(' · ')}</dd>` : '';
    return `<div class="section"><h3>Rapport demandé ${C.badge('v' + req.version, 'outline')}</h3><dl class="dl">
      <dt>Origine</dt><dd>${origin === 'override' ? 'Personnalisé pour cette activité' : 'Hérité du programme'}</dd>
      <dt>Format</dt><dd>${esc(Q.formatLabel(req.format))}${req.format === 'form' ? ` · ${EH.plural(req.fields.length, 'question')}` : ''}</dd>
      <dt>Échéance</dt><dd>${req.dueDays} jours après l'activité (${EH.fmtDate(Q.reportDue(a, req))})</dd>
      <dt>Obligatoire</dt><dd>${yn(req.mandatory)}</dd><dt>Commentaire visible</dt><dd>${yn(req.feedbackVisible)}</dd>${perVersion}</dl></div>`;
  };

  const answersHtml = (d, rep) => {
    const req = Q.requirementById(d, rep.requirementId), an = rep.answers || {};
    let body = '';
    if (!req) body = '';
    else if (req.format === 'free') body = `<p class="small">${esc(an.text || '—')}</p>`;
    else if (req.format === 'presence') body = '<p class="small">Présence confirmée.</p>';
    else if (req.format === 'deliverable') body = `<p class="small">${an.link ? `<a href="${esc(an.link)}" target="_blank" rel="noopener noreferrer">${esc(an.link)}</a>` : '—'}${an.note ? `<br>${esc(an.note)}` : ''}</p>`;
    else body = `<dl class="dl">${req.fields.map((f) => `<dt>${esc(f.label)}</dt><dd>${an[f.id] != null && an[f.id] !== '' ? esc(an[f.id]) + (f.type === 'rating' ? ' / 5' : '') : '<span class="muted">—</span>'}</dd>`).join('')}</dl>`;
    return body + (rep.reviewComment ? `<p class="muted xs" style="margin-top:6px">Commentaire du chargé : ${esc(rep.reviewComment)}</p>` : '');
  };

  const reportsSection = (d, a, st) => {
    if (!Q.requirementOf(d, a) && !d.beneficiaryReports.some((r) => r.activityId === a.id)) return '';
    const head = '<h3>Rapports bénéficiaires</h3>';
    if (a.status !== 'done') return `<div class="section">${head}<p class="muted small">Les rapports sont attendus une fois l'activité réalisée et clôturée.</p></div>`;
    const list = Q.activityObligations(d, a), review = S.can.reviewBeneficiaryReport(a.centre);
    const repIds = d.beneficiaryReports.filter((r) => r.activityId === a.id).map((r) => r.id);
    const corr = d.beneficiaryCorrections.filter((c) => c.status === 'open' && repIds.includes(c.report)).map((c) => {
      const e = Q.ent(d, c.entrepreneurId);
      return C.callout('warn', `<b>Correction demandée</b> par ${esc(e ? e.name : '—')} : ${esc(c.text)}`, review ? C.btn('Accepter', { action: 'resolve-bcorrection', data: { id: c.id, ok: 1 }, size: 'sm' }) + C.btn('Refuser', { action: 'resolve-bcorrection', data: { id: c.id, ok: 0 }, size: 'sm' }) : '');
    }).join('');
    if (!list.length) return `<div class="section">${head}${corr}<p class="muted small">Aucun bénéficiaire avec un espace activé n'a participé à cette activité : aucun rapport à relire.</p></div>`;
    const rows = list.map((o) => {
      const rep = o.report, e = o.entrepreneur, BS = R.beneficiaryReportStatus;
      const buttons = review && rep && rep.status === 'submitted' ? C.btn('Valider', { action: 'validate-breport', data: { id: rep.id, version: rep.version }, size: 'sm', variant: 'primary' }) + C.btn('Renvoyer', { action: 'return-breport-mode', data: { id: rep.id }, size: 'sm' }) : '';
      const ret = st.returning && rep && st.returning === rep.id ? `<form data-form="return-breport" novalidate class="breport-return"><input type="hidden" name="id" value="${rep.id}"><input type="hidden" name="version" value="${rep.version}">
        ${C.field({ name: 'reason', label: 'Motif du renvoi', type: 'textarea', rows: 2, required: true, error: (st.errors || {}).reason, autofocus: true, help: 'Le bénéficiaire verra ce motif et corrigera avant de renvoyer.' })}
        <div class="page-actions">${C.btn('Annuler', { action: 'return-breport-mode', data: { id: '' }, size: 'sm' })}${C.btn('Renvoyer', { type: 'submit', variant: 'danger', size: 'sm', icon: 'undo' })}</div></form>` : '';
      return `<div class="breport"><div class="list-row">${C.ico('report', o.late ? 'bad' : rep && rep.status === 'validated' ? 'ok' : '')}<div class="body"><div class="title">${EH.entLink(e)}</div>
        <div class="meta">Échéance ${EH.fmtDate(o.due)}${o.optional ? ' · facultatif' : ''}${rep ? ` · version v${rep.requirementVersion}` : ''}</div></div>
        <div class="row-actions">${C.statusBadge(BS, o.status)}${o.late ? C.badge(`En retard de ${o.daysLate} j`, 'bad', 'alert') : ''}${buttons}</div></div>
        ${rep ? `<details class="breport-more"><summary>Lire la réponse</summary>${answersHtml(d, rep)}</details>` : ''}${ret}</div>`;
    }).join('');
    return `<div class="section">${head}${corr}<div class="panel">${rows}</div></div>`;
  };

  /* ---------- detail ---------- */
  EH.drawers.activity = (st) => {
    const d = S.data, a = Q.activity(d, st.id);
    if (!a || !S.canSeeActivity(a)) return C.drawer({ title: 'Accès refusé', body: EH.denied('Cette activité') });
    const s = Q.activityStatus(a), w = S.can.writeOperational(a.centre), p = Q.programme(d, a.programme);
    const lessons = d.knowledge.filter((k) => k.activity === a.id);
    const locked = Q.isLocked(d, a.centre, a.date);
    const att = a.attendees.map((id) => Q.ent(d, id)).filter(Boolean);
    const tools = w ? [
      Q.needsClosing(a) ? C.btn('Clôturer', { action: 'close-activity', data: { id: a.id }, variant: 'primary', icon: 'checkCircle' }) : '',
      a.status === 'planned' && !locked ? C.btn('Modifier', { action: 'edit-activity', data: { id: a.id }, icon: 'edit' }) : '',
      a.status === 'done' && !st.justClosed ? C.btn('Noter une leçon apprise', { action: 'new-knowledge', data: { activity: a.id }, icon: 'book', variant: lessons.length ? '' : 'primary' }) : '',
      S.can.defineRequirement(a) && a.status !== 'cancelled' && !locked ? C.btn('Rapport demandé', { action: 'edit-activity', data: { id: a.id, req: 1 }, icon: 'report' }) : ''
    ].join('') : '';
    const body = `
      ${s === 'overdue' ? C.callout('bad', `Prévue le ${EH.fmtDate(a.date)} et toujours pas clôturée : elle est signalée au PMO.`) : ''}
      ${s === 'draft' ? C.callout('warn', "Brouillon : choisissez un intervenant pour qu'elle soit suivie (EC-01).") : ''}
      ${locked ? C.callout('info', 'Période validée : cette activité est verrouillée.') : ''}
      ${st.justClosed ? C.callout('ok', `<b>Activité clôturée${a.status === 'done' ? ' avec ' + EH.plural(a.attendees.length, 'présent') : ''}.</b> Ces chiffres comptent déjà dans le rapport du mois et le tableau de bord.${a.status === 'done' ? ' Voulez-vous noter ce que vous en retenez ?' : ''}`, a.status === 'done' ? C.btn('Noter une leçon apprise', { action: 'new-knowledge', data: { activity: a.id }, size: 'sm', variant: 'primary' }) + C.btn('Plus tard', { action: 'close-drawer', size: 'sm' }) : '') : ''}
      <dl class="dl">
        <dt>Date</dt><dd>${EH.fmtDay(a.date)} ${EH.fmtDateY(a.date).slice(-4)} · ${esc(a.duration || '')}</dd>
        <dt>Programme</dt><dd>${esc(p ? p.name : '—')}</dd>
        <dt>Centre</dt><dd>${esc(Q.centreName(d, a.centre))}</dd>
        <dt>Intervenant</dt><dd>${a.facilitator ? `<button class="link-btn" ${C.on('open-partner', { id: a.facilitator })}>${esc(EH.partnerName(a.facilitator))}</button>` : '<span class="t-warn">À définir</span>'}</dd>
        <dt>Lieu</dt><dd>${esc(a.location || '—')}</dd>
        <dt>Participants</dt><dd class="num">${a.status === 'done' ? `${a.attendees.length} présents sur ${a.expected} attendus` : `${a.expected} attendus`}</dd>
        ${a.notes ? `<dt>Notes</dt><dd>${esc(a.notes)}</dd>` : ''}
      </dl>
      ${a.status === 'done' ? `<div class="section"><h3>Présents <span class="muted num">${att.length}</span></h3><p class="small">${att.length ? att.map((e) => esc(e.name)).join(', ') : '<span class="muted">Aucune présence saisie.</span>'}</p></div>` : ''}
      ${requirementSection(d, a)}
      ${reportsSection(d, a, st)}
      <div class="section"><h3>Leçons et ressources liées</h3>${lessons.length ? `<div class="panel">${lessons.map((k) => `<div class="list-row">${C.ico('book', 'accent')}<div class="body"><button class="link-btn" ${C.on('open-knowledge', { id: k.id })}>${esc(k.title)}</button><div class="meta">${esc(k.type)} · ${C.statusBadge(R.knowledgeStatus, Q.knowledgeStatus(k))}</div></div></div>`).join('')}</div>` : '<p class="muted small">Aucune pour le moment.</p>'}</div>`;
    return C.drawer({ title: esc(a.title), sub: `${C.statusBadge(AS, s)} · ${esc(a.type)}`, tools, body: C.formError(st.errors) + body });
  };

  /* ---------- plan / edit ---------- */
  EH.drawers.activityForm = (st) => {
    const centre = S.scope();
    if (!st.reqInit) { EH.req.init(st, 'activity', st.id); st.reqInit = true; }
    const v = st.values, er = st.errors;
    const section = EH.req.section(st, 'activity', { programme: v.programme });
    const planning = `
      ${C.field({ name: 'title', label: 'Titre', required: true, value: v.title, error: er.title, full: true, autofocus: true, placeholder: 'Ex. : Atelier étude de marché' })}
      ${C.field({ name: 'programme', label: 'Programme', type: 'select', required: true, value: v.programme, error: er.programme, options: EH.programmeOptions(centre, 'Choisir…') })}
      ${C.field({ name: 'type', label: 'Type', type: 'select', required: true, value: v.type, error: er.type, options: ['', ...R.activityTypes] })}
      ${C.field({ name: 'date', label: 'Date', type: 'date', required: true, value: v.date, error: er.date })}
      ${C.field({ name: 'duration', label: 'Durée', value: v.duration, placeholder: 'Ex. : 3 h' })}
      ${C.field({ name: 'facilitator', label: 'Intervenant', type: 'select', value: v.facilitator, options: EH.coachOptions('À définir (brouillon)'), full: true, help: "Sans intervenant, l'activité reste en brouillon." })}
      ${C.field({ name: 'location', label: 'Lieu', value: v.location || 'Centre ELIFE ' + Q.centreName(S.data, centre) })}
      ${C.field({ name: 'expected', label: 'Participants attendus', type: 'number', min: 0, value: v.expected || S.data.entrepreneurs.filter((e) => e.centre === centre && R.activeStages.includes(e.stage)).length })}`;
    const body = `${C.formError(er)}${st.reqOnly ? C.callout('info', "Activité réalisée : seul le rapport demandé peut être modifié. Les rapports déjà remis restent attachés à la version à laquelle ils répondent.") : ''}<div class="form-grid">${st.reqOnly ? '' : planning}${section}</div>`;
    return C.drawer({ title: st.reqOnly ? 'Rapport demandé' : st.id ? "Modifier l'activité" : 'Planifier une activité', sub: st.reqOnly ? esc(v.title) : `Centre de ${esc(Q.centreName(S.data, centre))}`, form: 'activity', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn(st.reqOnly ? 'Enregistrer' : st.id ? 'Enregistrer' : 'Planifier', { type: 'submit', variant: 'primary' }) });
  };
  EH.forms.activity = (v) => {
    const st = EH.ui.drawer;
    EH.req.sync(st, v);
    const requirement = EH.req.parse(v, 'activity');
    if (st.reqOnly) {
      const res = EH.act.saveRequirement('activity', st.id, requirement, EH.req.base(v));
      EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(r.changed ? `Rapport demandé enregistré (version ${r.item.version}).` : 'Aucun changement.'); });
      return;
    }
    const res = EH.act.saveActivity(Object.assign({ id: st.id }, v, { requirement }));
    EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(r.draft ? `« ${esc(r.item.title)} » enregistrée en brouillon : ajoutez un intervenant.` : `« ${esc(r.item.title)} » planifiée le ${EH.fmtDate(r.item.date)}.`, { label: 'Ouvrir', action: () => EH.openDrawer('activity', { id: r.item.id }) }); });
  };

  /* ---------- close with attendance (US-04) ---------- */
  EH.drawers.closeActivity = (st) => {
    const d = S.data, a = Q.activity(d, st.id);
    const v = Object.assign({ status: 'done', attendees: null }, st.values), er = st.errors;
    const cohort = d.entrepreneurs.filter((e) => e.centre === a.centre && e.cohort && e.stage !== 'candidat' && (e.stage !== 'abandon' || (Q.stageDate(e, 'abandon') || '') > a.date)).sort((x, y) => x.name.localeCompare(y.name));
    const checked = v.attendees || cohort.filter((e) => R.activeStages.includes(e.stage)).map((e) => e.id);
    const body = `${C.formError(er)}
      ${C.radios({ name: 'status', label: 'Résultat', value: v.status, error: er.status, options: [{ value: 'done', label: 'Réalisée' }, { value: 'postponed', label: 'Reportée' }, { value: 'cancelled', label: 'Annulée' }] })}
      ${!a.facilitator ? C.field({ name: 'facilitator', label: 'Intervenant', type: 'select', required: true, value: v.facilitator, error: er.facilitator, options: EH.coachOptions(), help: 'Obligatoire pour une activité réalisée.' }) : ''}
      <div class="field full"><div style="display:flex;justify-content:space-between;align-items:center"><span class="field-label">Présences · <span class="num" id="att-count">${checked.length}</span> sur ${cohort.length}</span><span>${C.btn('Tout cocher', { action: 'att-all', data: { on: 1 }, size: 'sm', variant: 'ghost' })}${C.btn('Tout décocher', { action: 'att-all', data: { on: 0 }, size: 'sm', variant: 'ghost' })}</span></div>
        <div class="check-list">${cohort.map((e) => `<label class="check"><input type="checkbox" name="attendees" value="${e.id}" ${checked.includes(e.id) ? 'checked' : ''} data-live="attCount">${esc(e.name)} <span class="muted xs">${esc(EH.stageLabel(e.stage))}</span></label>`).join('')}</div>
        <span class="help">Ignorées si l'activité est reportée ou annulée.</span></div>
      ${C.field({ name: 'newDate', label: 'Nouvelle date (si reportée)', type: 'date', value: v.newDate, error: er.newDate, min: EH.TODAY })}
      ${C.field({ name: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: v.notes, error: er.notes, help: 'Obligatoire en cas d\'annulation.' })}`;
    return C.drawer({ title: 'Clôturer · ' + esc(a.title), sub: `${EH.fmtDay(a.date)} · ${esc(a.type)}`, form: 'close-activity', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn('Clôturer', { type: 'submit', variant: 'primary' }) });
  };
  EH.forms['return-breport'] = (v) => {
    const st = EH.ui.drawer;
    const res = EH.act.reviewBeneficiaryReport(v.id, 'return', v.reason, v.version);
    EH.handle(res, st, (r) => { st.returning = null; st.errors = {}; EH.render(); EH.toast(`Rapport renvoyé à ${esc(Q.ent(S.data, r.item.entrepreneurId).name)}.`); });
  };
  EH.live.attCount = (el) => { const n = el.form.querySelectorAll('input[name=attendees]:checked').length; const c = document.getElementById('att-count'); if (c) c.textContent = n; };
  EH.forms['close-activity'] = (v) => {
    const st = EH.ui.drawer;
    st.values = v;
    const res = EH.act.closeActivity(st.id, v);
    EH.handle(res, st, (r) => {
      EH.render();
      EH.ui.drawer = { type: 'activity', id: r.item.id, justClosed: true, values: {}, errors: {} };
      EH.renderOverlays(true);
    });
  };

  Object.assign(EH.actions, {
    'open-activity': (el) => { const a = Q.activity(S.data, el.dataset.id); if (a && !S.isBeneficiary() && !S.canSeeActivity(a)) EH.act.guardActivity(a); EH.openDrawer('activity', { id: el.dataset.id }); },
    'new-activity': () => { if (S.isOfficer()) EH.openDrawer('activityForm', {}); },
    'edit-activity': (el) => { const a = Q.activity(S.data, el.dataset.id); if (!S.isOfficer()) return; EH.openDrawer('activityForm', { id: a.id, values: Object.assign({}, a), reqOnly: a.status === 'done' || el.dataset.req === '1' }); },
    'validate-breport': (el) => {
      const res = EH.act.reviewBeneficiaryReport(el.dataset.id, 'validate', '', el.dataset.version);
      if (!res.ok) return EH.toast(res.errors._ || 'Action impossible.', { tone: 'error' });
      EH.render(); EH.toast(`Rapport validé : ${esc(Q.ent(S.data, res.item.entrepreneurId).name)}.`);
    },
    'return-breport-mode': (el) => { const st = EH.ui.drawer; st.returning = el.dataset.id || null; st.errors = {}; EH.renderOverlays(true); },
    'resolve-bcorrection': (el) => {
      const res = EH.act.resolveBeneficiaryCorrection(el.dataset.id, el.dataset.ok === '1');
      if (!res.ok) return EH.toast(res.errors._ || 'Action impossible.', { tone: 'error' });
      EH.render(); EH.toast(el.dataset.ok === '1' ? 'Correction acceptée : le rapport est renvoyé au bénéficiaire.' : 'Correction refusée.');
    },
    'close-activity': (el) => { const a = Q.activity(S.data, el.dataset.id); if (!S.can.writeOperational(a.centre)) return EH.openDrawer('activity', { id: a.id }); EH.openDrawer('closeActivity', { id: a.id }); },
    'att-all': (el) => { const f = el.closest('form'); f.querySelectorAll('input[name=attendees]').forEach((i) => (i.checked = el.dataset.on === '1')); EH.live.attCount(f.querySelector('input[name=attendees]') || el); }
  });
})();
