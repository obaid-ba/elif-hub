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

  const weekStart = (day) => EH.addDays(day, -((new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))).getUTCDay() + 6) % 7));
  const roomName = (id) => { const r = id && (S.data.rooms || []).find((x) => x.id === id); return r ? r.name : ''; };
  EH.roomName = roomName;
  const weekGrid = (list, start) => {
    const days = Array.from({ length: 7 }, (_, i) => EH.addDays(start, i));
    return `<div class="week">${days.map((day) => {
      const evs = list.filter((a) => a.date === day).sort(EH.by('time'));
      return `<div class="wday ${day === EH.TODAY ? 'today' : ''}"><div class="wd">${EH.fmtDay(day)}</div>${evs.length ? evs.map((a) => { const st = Q.activityStatus(a); return `<button class="ev ${st}" ${C.on('open-activity', { id: a.id })} title="${esc(a.title + ' · ' + AS[st].label)}"><b>${esc(a.time || '')}</b> ${esc(a.title)}<span>${esc([roomName(a.room) || (a.onlineLink ? 'En ligne' : ''), AS[st].label].filter(Boolean).join(' · '))}</span></button>`; }).join('') : '<span class="muted xs">—</span>'}</div>`;
    }).join('')}</div>`;
  };

  EH.pages.activites = {
    label: 'Activités', icon: 'calendar',
    render() {
      const d = S.data, pmo = S.isPmo();
      const centre = pmo ? EH.f('act.centre', '') : S.scope();
      const view = EH.f('act.view', 'list'), prog = EH.f('act.prog', ''), status = EH.f('act.status', ''), q = EH.norm(EH.f('act.q', ''));
      const base = Q.inScope(d.activities, centre || null).filter((a) => (!prog || a.programme === prog) && (!q || EH.norm(a.title + ' ' + a.type).includes(q)));
      const counts = EH.groupCount(base, Q.activityStatus);
      const list = base.filter((a) => !status || (status === 'upcoming' ? ['draft', 'planned', 'confirmed'].includes(Q.activityStatus(a)) : Q.activityStatus(a) === status)).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      const w = !pmo;

      let body;
      if (view === 'week') {
        const start = weekStart(EH.f('act.week', EH.TODAY));
        body = C.panel({ title: `Semaine du ${EH.fmtDate(start)} au ${EH.fmtDateY(EH.addDays(start, 6))}`, actions: C.btn('', { action: 'filter', data: { key: 'act.week', value: EH.addDays(start, -7) }, icon: 'chevronLeft', size: 'sm', title: 'Semaine précédente' }) + C.btn('Cette semaine', { action: 'filter', data: { key: 'act.week', value: EH.TODAY }, size: 'sm' }) + C.btn('', { action: 'filter', data: { key: 'act.week', value: EH.addDays(start, 7) }, icon: 'chevronRight', size: 'sm', title: 'Semaine suivante' }),
          body: weekGrid(list, start) });
      } else if (view === 'month') {
        const month = EH.f('act.month', EH.TODAY.slice(0, 7));
        const shift = (n) => { const y = +month.slice(0, 4), m = +month.slice(5, 7) - 1 + n; const dt = new Date(Date.UTC(y, m, 1)); return dt.toISOString().slice(0, 7); };
        body = C.panel({ title: EH.fmtMonth(month), actions: C.btn('', { action: 'filter', data: { key: 'act.month', value: shift(-1) }, icon: 'chevronLeft', size: 'sm', title: 'Mois précédent' }) + C.btn("Aujourd'hui", { action: 'filter', data: { key: 'act.month', value: EH.TODAY.slice(0, 7) }, size: 'sm' }) + C.btn('', { action: 'filter', data: { key: 'act.month', value: shift(1) }, icon: 'chevronRight', size: 'sm', title: 'Mois suivant' }),
          body: list.some((a) => a.date.slice(0, 7) === month) ? monthGrid(list, month) : monthGrid(list, month) + C.empty({ icon: 'calendar', tone: '', title: 'Aucune activité ce mois-ci', text: w ? 'Planifiez une activité pour la voir ici.' : '' }) });
      } else {
        const rows = list.map((a) => {
          const st = Q.activityStatus(a), p = Q.programme(d, a.programme), fac = EH.partnerName(a.facilitator);
          return { cls: 'clickable', attrs: `${C.on('open-activity', { id: a.id })} tabindex="0"`, cells: [
            `<span class="nowrap">${EH.fmtDay(a.date)}</span><span class="sub">${esc(a.time || '')}</span>`,
            `${EH.activityLink(a)}<span class="sub">${esc(a.type)}${pmo ? ' · ' + esc(Q.centreName(d, a.centre)) : ''}</span>`,
            `<span class="truncate" style="display:block;max-width:200px">${esc(p ? p.name : '—')}</span>`,
            fac ? esc(fac) : '<span class="t-warn strong">À définir</span>',
            a.status === 'done' ? `<span class="num">${a.attendees.length}/${a.expected}</span>${Q.attendanceRate(a) != null ? `<span class="sub num">${Math.round(Q.attendanceRate(a))}${EH.NBSP}% présents</span>` : ''}` : `<span class="muted num">${a.expected} attendus</span>`,
            C.statusBadge(AS, st),
            w && Q.needsClosing(a) ? C.btn('Clôturer', { action: 'close-activity', data: { id: a.id }, size: 'sm', variant: st === 'overdue' ? 'primary' : '' }) : ''
          ] };
        });
        body = C.panel({ body: C.table({ caption: 'Activités', cols: [{ label: 'Date' }, { label: 'Activité' }, { label: 'Programme', cls: 'hide-md' }, { label: 'Intervenant', cls: 'hide-sm' }, { label: 'Participants', cls: 'num hide-sm' }, { label: 'Statut' }, { label: '', cls: 'actions' }], rows, empty: C.empty({ icon: 'calendar', tone: '', title: 'Aucune activité', text: 'Aucune activité pour ces filtres.' }) }), foot: `<span class="muted xs">Les activités à clôturer apparaissent en premier, puis les prochaines, puis l'historique.</span>` });
      }
      const statusSeg = C.seg('act.status', [{ value: '', label: 'Toutes', count: base.length }, ...['overdue', 'draft', 'planned', 'confirmed', 'done', 'cancelled'].map((k) => ({ value: k, label: AS[k].label, count: counts[k] || 0 })), ...(status === 'upcoming' ? [{ value: 'upcoming', label: 'À venir', count: (counts.draft || 0) + (counts.planned || 0) + (counts.confirmed || 0) }] : [])], status, 'Statut');
      return C.pageHead('Activités', pmo ? 'Ateliers, formations et événements des six centres. Une activité « prévue » deux jours après sa date déclenche une alerte.' : 'Planifiez, puis clôturez avec les présences : les chiffres partent directement dans le rapport.',
        C.seg('act.view', [{ value: 'list', label: 'Liste' }, { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }], view, 'Affichage') + (w ? C.btn('Planifier une activité', { action: 'new-activity', icon: 'plus', variant: 'primary' }) : '')) +
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

  /* ---------- PBI-19/20: activity report section ---------- */
  const AR = R.activityReportStatus;
  const activityReportSection = (d, a, st) => {
    if (a.status !== 'done') return '';
    const r = Q.activityReport(d, a.id), status = Q.activityReportStatus(d, a);
    if (!status) return '';
    const late = Q.activityReportLate(d, a), w = S.can.writeOperational(a.centre), pmo = S.can.validateReport();
    const f = r && r.status === 'validated' && r.snapshot ? r.snapshot : Q.activityReportFigures(d, a);
    const n = (v) => (v == null ? '<span class="muted">Pas de donnée</span>' : Math.round(v) + EH.NBSP + '%');
    const FS = { proposed: 'proposé', confirmed: 'confirmé', refused: 'refusé' };
    const figures = `<div class="table-wrap"><table class="table"><caption class="sr-only">Chiffres pré-remplis du rapport d'activité</caption><tbody>
      <tr><td>Participants présents</td><td class="num strong">${f.present} / ${f.expected}</td></tr>
      <tr><td>Taux de présence</td><td class="num strong">${n(f.rate)}</td></tr>
      <tr><td>Intervenant</td><td class="strong">${esc(f.speaker || '—')}${f.speakerStatus ? ` <span class="muted xs">(${FS[f.speakerStatus] || ''})</span>` : ''}</td></tr>
      <tr><td>Budget prévu</td><td class="num strong">${f.budget != null ? f.budget.toLocaleString('fr-FR') + ' DT' : '—'}</td></tr>
      <tr><td>Rapports bénéficiaires validés</td><td class="num strong">${f.breportsExpected ? `${f.breportsValidated} / ${f.breportsExpected}` : '<span class="muted">Aucun attendu</span>'}</td></tr>
    </tbody></table></div><p class="muted xs" style="margin-top:4px">Pré-rempli depuis la fiche : rien à ressaisir. ${r && r.status === 'validated' ? 'Chiffres figés à la validation.' : 'Les chiffres suivent la fiche jusqu’à la validation.'}</p>`;
    const editable = w && (status === 'todo' || status === 'draft' || status === 'returned');
    const v = Object.assign({ difficulties: r ? r.difficulties : '', needs: r ? r.needs : '' }, st.arValues || {}), er = st.arErrors || {};
    const banner = status === 'returned' ? C.callout('warn', `<b>Renvoyé par le PMO :</b> ${esc(r.returnReason)}`)
      : status === 'submitted' ? C.callout('info', `Soumis le ${EH.fmtDateTime(r.submittedAt)}. ${pmo ? 'Validez-le ou renvoyez-le avec un motif.' : 'Le PMO va le valider ou vous le renvoyer.'}`)
      : status === 'validated' ? C.callout('ok', `Validé le ${EH.fmtDateTime(r.reviewedAt)} : rapport verrouillé.`)
      : late ? C.callout('bad', `En retard : attendu depuis le ${EH.fmtDate(Q.activityReportDue(a))}`) : '';
    const form = editable ? `<form data-form="activity-report" novalidate class="stack" style="margin-top:12px"><input type="hidden" name="version" value="${r ? r.version : 0}">
        ${C.field({ name: 'difficulties', id: 'fld-ar-difficulties', label: 'Difficultés rencontrées', type: 'textarea', rows: 2, value: v.difficulties, error: er.difficulties, required: true })}
        ${C.field({ name: 'needs', id: 'fld-ar-needs', label: "Besoins d'appui", type: 'textarea', rows: 2, value: v.needs, error: er.needs, required: true })}
        <div class="page-actions" style="justify-content:flex-end">${C.btn('Enregistrer le brouillon', { type: 'submit', extra: 'data-intent="draft"' })}${C.btn('Soumettre au PMO', { type: 'submit', variant: 'primary', icon: 'send' })}</div></form>`
      : r && (r.difficulties || r.needs) ? `<dl class="dl" style="margin-top:8px"><dt>Difficultés</dt><dd>${esc(r.difficulties || '—')}</dd><dt>Besoins d'appui</dt><dd>${esc(r.needs || '—')}</dd></dl>` : '';
    const review = pmo && status === 'submitted' ? (st.arReturn
      ? `<form data-form="activity-report-return" novalidate class="stack" style="margin-top:12px"><input type="hidden" name="version" value="${r.version}">${C.field({ name: 'reason', id: 'fld-ar-reason', label: 'Motif du renvoi', type: 'textarea', rows: 2, required: true, error: er.reason, autofocus: true })}
          <div class="page-actions" style="justify-content:flex-end">${C.btn('Annuler', { action: 'ar-return-mode', data: { on: 0 } })}${C.btn('Renvoyer au centre', { type: 'submit', variant: 'danger', icon: 'undo' })}</div></form>`
      : `<div class="page-actions" style="justify-content:flex-end;margin-top:12px">${C.btn('Renvoyer', { action: 'ar-return-mode', data: { on: 1 }, icon: 'undo' })}${C.btn('Valider et verrouiller', { action: 'ar-validate', data: { id: r.id, version: r.version }, variant: 'primary', icon: 'lock' })}</div>`) : '';
    return `<div class="section" id="activity-report"><h3>Rapport d'activité ${C.statusBadge(AR, status)}${late ? ' ' + C.badge('En retard', 'bad', 'alert') : ''}</h3>${banner}<div class="panel" style="margin-top:8px">${figures}</div>${form}${review}</div>`;
  };
  EH.activityReportSection = activityReportSection;

  /* ---------- detail ---------- */
  EH.drawers.activity = (st) => {
    const d = S.data, a = Q.activity(d, st.id);
    if (!a || !S.canSeeActivity(a)) return C.drawer({ title: 'Accès refusé', body: EH.denied('Cette activité') });
    const s = Q.activityStatus(a), w = S.can.writeOperational(a.centre), p = Q.programme(d, a.programme);
    const clashes = Q.conflicts(d, a);
    const FS = { proposed: ['Proposé', 'warn'], confirmed: ['Confirmé', 'ok'], refused: ['Refusé', 'bad'] };
    const fs = a.facilitator && FS[a.facilitatorStatus];
    const lines = (t) => t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const lessons = d.knowledge.filter((k) => k.activity === a.id);
    const locked = Q.isLocked(d, a.centre, a.date);
    const att = a.attendees.map((id) => Q.ent(d, id)).filter(Boolean);
    const tools = w ? [
      Q.needsClosing(a) ? C.btn('Clôturer', { action: 'close-activity', data: { id: a.id }, variant: 'primary', icon: 'checkCircle' }) : '',
      a.status === 'planned' && !locked ? C.btn('Modifier', { action: 'edit-activity', data: { id: a.id }, icon: 'edit' }) : '',
      a.status === 'done' && !st.justClosed ? C.btn('Noter une leçon apprise', { action: 'new-knowledge', data: { activity: a.id }, icon: 'book', variant: lessons.length ? '' : 'primary' }) : '',
      S.can.defineRequirement(a) && a.status !== 'cancelled' && !locked ? C.btn('Rapport demandé', { action: 'edit-activity', data: { id: a.id, req: 1 }, icon: 'report' }) : '',
      a.status === 'planned' && a.date >= EH.TODAY ? C.btn(a.date === EH.addDays(EH.TODAY, 1) ? 'Envoyer le rappel J-1' : 'Envoyer un rappel', { action: 'send-reminder', data: { id: a.id }, icon: 'bell', variant: Q.needsReminder(a) ? 'primary' : '' }) : ''
    ].join('') : '';
    const rc = a.status === 'planned' ? Q.reminderRecipients(d, a) : null;
    const speakerActions = w && a.facilitator && a.facilitatorStatus === 'proposed' && a.status === 'planned' && !locked
      ? ` ${C.btn('Confirmé', { action: 'speaker-status', data: { id: a.id, status: 'confirmed' }, size: 'sm', icon: 'check' })}${C.btn('A refusé', { action: 'speaker-refuse', data: { id: a.id }, size: 'sm', icon: 'x' })}` : '';
    const refused = (a.speakerHistory || []).filter((h) => h.status === 'refused');
    const body = `
      ${s === 'overdue' ? C.callout('bad', `Prévue le ${EH.fmtDate(a.date)} et toujours pas clôturée : elle est signalée au PMO.`) : ''}
      ${s === 'draft' ? C.callout('warn', `Intervenant à trouver : choisissez un intervenant pour qu'elle soit suivie (EC-01).${refused.length ? ` Dernier refus : ${esc((Q.partner(d, refused[refused.length - 1].partner) || {}).name || '—')}${refused[refused.length - 1].reason ? ' (' + esc(refused[refused.length - 1].reason) + ')' : ''}.` : ''}`, w && !locked ? C.btn("Choisir l'intervenant", { action: 'edit-activity', data: { id: a.id }, size: 'sm' }) : '') : ''}
      ${Q.speakerUnconfirmed(a) ? C.callout(EH.days(EH.TODAY, a.date) <= 1 ? 'bad' : 'warn', `<b>Intervenant non confirmé à J-${EH.days(EH.TODAY, a.date)}.</b> Relancez ${esc(EH.partnerName(a.facilitator))} puis enregistrez sa réponse. Le PMO voit cette alerte.`) : ''}
      ${clashes.length ? C.callout('warn', `<b>Conflit de planning.</b><ul style="margin:4px 0 0;padding-left:18px">${clashes.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>`) : ''}
      ${locked ? C.callout('info', 'Période validée : cette activité est verrouillée.') : ''}
      ${st.justClosed ? C.callout('ok', `<b>Activité clôturée${a.status === 'done' ? ' avec ' + EH.plural(a.attendees.length, 'présent') : ''}.</b> Ces chiffres comptent déjà dans le rapport du mois et le tableau de bord.${a.status === 'done' ? ' Voulez-vous noter ce que vous en retenez ?' : ''}`, a.status === 'done' ? C.btn('Noter une leçon apprise', { action: 'new-knowledge', data: { activity: a.id }, size: 'sm', variant: 'primary' }) + C.btn('Plus tard', { action: 'close-drawer', size: 'sm' }) : '') : ''}
      <dl class="dl">
        <dt>Date</dt><dd>${EH.fmtDay(a.date)} ${EH.fmtDateY(a.date).slice(-4)}${a.time ? ' · ' + esc(EH.fmtTimeRange(a)) : ''}${a.duration ? ' (' + esc(a.duration) + ')' : ''}</dd>
        <dt>Programme</dt><dd>${esc(p ? p.name : '—')}</dd>
        <dt>Centre</dt><dd>${esc(Q.centreName(d, a.centre))}${a.cohort ? ' · ' + esc((d.cohorts.find((c) => c.id === a.cohort) || {}).name || '') : ''}</dd>
        <dt>Intervenant</dt><dd>${a.facilitator ? `<button class="link-btn" ${C.on('open-partner', { id: a.facilitator })}>${esc(EH.partnerName(a.facilitator))}</button> ${fs ? C.badge(fs[0], fs[1]) : ''}${speakerActions}` : '<span class="t-warn">À trouver</span>'}</dd>
        ${a.staff && a.staff.length ? `<dt>Staff</dt><dd>${esc(a.staff.map((u) => Q.user(d, u).name).join(', '))}</dd>` : ''}
        <dt>Lieu</dt><dd>${esc([roomName(a.room), a.location].filter(Boolean).join(' · ') || '—')}</dd>
        ${a.onlineLink ? `<dt>Lien en ligne</dt><dd><a href="${esc(a.onlineLink)}" target="_blank" rel="noopener noreferrer">${esc(a.onlineLink)}</a></dd>` : ''}
        ${a.contact ? `<dt>Contact</dt><dd>${esc(a.contact)}</dd>` : ''}
        ${a.type === 'Session 1-1' && a.participant ? `<dt>Participant</dt><dd>${esc((Q.ent(d, a.participant) || {}).name || '—')}</dd>` : `<dt>Participants</dt><dd class="num">${a.status === 'done' ? `${a.attendees.length} présents sur ${a.expected} attendus` : `${a.expected} attendus`}</dd>`}
        ${a.status === 'done' ? `<dt>Taux de présence${C.info(R.kpis.attendance.formula)}</dt><dd class="num">${Q.attendanceRate(a) == null ? '<span class="muted">Pas de donnée</span>' : `<b>${Math.round(Q.attendanceRate(a))}${EH.NBSP}%</b>${C.meter(Q.attendanceRate(a))}`}</dd>` : ''}
        ${rc ? `<dt>Rappel</dt><dd>${(a.reminders || []).length ? (a.reminders || []).map((m) => `Envoyé le ${EH.fmtDateTime(m.at)} · ${EH.plural(m.participants, 'participant')}${m.speaker ? ' + ' + esc(m.speaker) : ''}`).join('<br>') : `<span class="muted">Pas encore envoyé · ${EH.plural(rc.count, 'destinataire')}</span>`}</dd>` : ''}
        ${a.budget != null ? `<dt>Budget prévu</dt><dd class="num">${a.budget.toLocaleString('fr-FR')} DT</dd>` : ''}
        ${a.equipment && a.equipment.length ? `<dt>Équipements</dt><dd>${a.equipment.map((x) => C.badge(x, 'outline')).join(' ')}</dd>` : ''}
        ${a.notes ? `<dt>Notes</dt><dd>${esc(a.notes)}</dd>` : ''}
      </dl>
      ${a.content || a.supports ? `<div class="section"><h3>Contenu</h3>${a.content ? `<p class="small" style="white-space:pre-line">${esc(a.content)}</p>` : ''}${a.supports ? `<ul class="small" style="margin:6px 0 0;padding-left:18px">${lines(a.supports).map((x) => `<li>${/^https?:\/\//.test(x) ? `<a href="${esc(x)}" target="_blank" rel="noopener noreferrer">${esc(x)}</a>` : esc(x)}</li>`).join('')}</ul>` : ''}</div>` : ''}
      ${a.status === 'done' ? `<div class="section"><h3>Présents <span class="muted num">${att.length}</span></h3><p class="small">${att.length ? att.map((e) => esc(e.name)).join(', ') : '<span class="muted">Aucune présence saisie.</span>'}</p></div>` : ''}
      ${activityReportSection(d, a, st)}
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
    const d = S.data;
    const cohorts = d.cohorts.filter((c) => c.centre === centre);
    const cohortDefault = (cohorts.find((c) => c.programme === v.programme) || cohorts[0] || {}).id;
    const rooms = (d.rooms || []).filter((r) => r.centre === centre);
    const staffOpts = [{ value: '', label: 'Aucun' }, ...d.users.filter((u) => u.role === 'officer' && u.centre === centre).map((u) => ({ value: u.id, label: u.name }))];
    const actives = d.entrepreneurs.filter((e) => e.centre === centre && R.activeStages.includes(e.stage)).sort((x, y) => x.name.localeCompare(y.name));
    const oneToOne = v.type === 'Session 1-1';
    const h = (t) => `<h3 class="form-sub">${t}</h3>`;
    const clash = st.conflicts && st.conflicts.length ? C.callout('warn', `<b>Conflit de planning.</b><ul style="margin:4px 0 0;padding-left:18px">${st.conflicts.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>Changez l'heure, la salle ou l'intervenant, ou planifiez quand même : le conflit sera inscrit au journal.`) : '';
    const planning = `
      ${h('Activité')}
      ${C.field({ name: 'title', label: 'Titre', required: true, value: v.title, error: er.title, full: true, autofocus: true, placeholder: 'Ex. : Atelier étude de marché' })}
      ${C.field({ name: 'programme', label: 'Programme', type: 'select', required: true, value: v.programme, error: er.programme, options: EH.programmeOptions(centre, 'Choisir…') })}
      ${C.field({ name: 'type', label: 'Type', type: 'select', required: true, value: v.type, error: er.type, options: ['', ...R.activityTypes], live: 'actType' })}
      ${C.field({ name: 'cohort', label: 'Cohorte', type: 'select', required: true, value: v.cohort || cohortDefault, error: er.cohort, options: cohorts.map((c) => ({ value: c.id, label: `${c.name} · ${(Q.programme(d, c.programme) || {}).name || ''}` })) })}
      ${oneToOne ? C.field({ name: 'participant', label: 'Participant', type: 'select', required: true, value: v.participant, error: er.participant, options: [{ value: '', label: 'Choisir…' }, ...actives.map((e) => ({ value: e.id, label: e.name }))], help: 'Une fois réalisée, la session compte comme une séance de coaching.' }) : C.field({ name: 'expected', label: 'Participants attendus', type: 'number', min: 0, value: v.expected != null && v.expected !== '' ? v.expected : actives.length })}
      ${h('Quand et où')}
      ${C.field({ name: 'date', label: 'Date', type: 'date', required: true, value: v.date, error: er.date })}
      ${C.field({ name: 'time', label: 'Heure de début', type: 'time', required: true, value: v.time || '09:00', error: er.time })}
      ${C.field({ name: 'durationMin', label: 'Durée (minutes)', type: 'number', min: 15, max: 720, value: v.durationMin || 180, error: er.durationMin })}
      ${C.field({ name: 'room', label: 'Salle', type: 'select', value: v.room, error: er.room, options: [{ value: '', label: 'Aucune salle du centre' }, ...rooms.map((r) => ({ value: r.id, label: `${r.name} · ${r.capacity} places` }))] })}
      ${C.field({ name: 'location', label: 'Lieu', value: v.location != null ? v.location : 'Centre ELIFE ' + Q.centreName(d, centre) })}
      ${C.field({ name: 'onlineLink', label: 'Lien Meet ou Zoom', type: 'url', value: v.onlineLink, error: er.onlineLink, placeholder: 'https://…', help: v.type === 'Atelier en ligne' ? 'Obligatoire pour un atelier en ligne.' : 'Facultatif.' })}
      ${h('Qui')}
      ${C.field({ name: 'facilitator', label: 'Intervenant', type: 'select', value: v.facilitator, options: EH.coachOptions('À trouver'), full: true, help: "Sans intervenant, l'activité reste « intervenant à trouver ». Un nouvel intervenant est « proposé » jusqu'à sa confirmation." })}
      ${C.field({ name: 'staff', label: 'Membre du staff', type: 'select', value: Array.isArray(v.staff) ? v.staff[0] : v.staff != null ? v.staff : (staffOpts[1] || {}).value, options: staffOpts })}
      ${C.field({ name: 'contact', label: 'Contact sur place', value: v.contact, placeholder: 'Nom et téléphone' })}
      ${h('Contenu')}
      ${C.field({ name: 'content', label: 'Programme du jour', type: 'textarea', rows: 3, value: v.content, full: true, placeholder: 'Accueil, contenu, mise en pratique, questions…' })}
      ${C.field({ name: 'supports', label: 'Supports (un par ligne, liens acceptés)', type: 'textarea', rows: 2, value: v.supports, full: true })}
      ${h('Logistique')}
      ${C.field({ name: 'budget', label: 'Budget prévu (DT)', type: 'number', min: 0, value: v.budget, error: er.budget })}
      <div class="field"></div>
      ${C.checks({ name: 'equipment', label: 'Équipements', grid: true, values: v.equipment || [], options: R.equipment.map((x) => ({ value: x, label: x })) })}`;
    const body = `${C.formError(er)}${clash}${st.reqOnly ? C.callout('info', "Activité réalisée : seul le rapport demandé peut être modifié. Les rapports déjà remis restent attachés à la version à laquelle ils répondent.") : ''}<div class="form-grid">${st.reqOnly ? '' : planning}${section}</div>`;
    return C.drawer({ title: st.reqOnly ? 'Rapport demandé' : st.id ? "Modifier l'activité" : 'Planifier une activité', sub: st.reqOnly ? esc(v.title) : `Centre de ${esc(Q.centreName(S.data, centre))}`, form: 'activity', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + (clash && !st.reqOnly ? C.btn('Planifier quand même', { type: 'submit', extra: 'data-intent="force"' }) : '') + C.btn(st.reqOnly ? 'Enregistrer' : st.id ? 'Enregistrer' : 'Planifier', { type: 'submit', variant: 'primary' }) });
  };
  EH.live.actType = (el) => {
    const st = EH.ui.drawer;
    if (!st || st.type !== 'activityForm') return;
    st.values = EH.formData(el.form); EH.req.sync(st, st.values); EH.renderOverlays();
    const t = document.getElementById('fld-type'); if (t) t.focus();
  };
  EH.forms.activity = (v, form, submitter) => {
    const st = EH.ui.drawer;
    st.values = v;
    EH.req.sync(st, v);
    const requirement = EH.req.parse(v, 'activity');
    if (st.reqOnly) {
      const res = EH.act.saveRequirement('activity', st.id, requirement, EH.req.base(v));
      EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(r.changed ? `Rapport demandé enregistré (version ${r.item.version}).` : 'Aucun changement.'); });
      return;
    }
    const res = EH.act.saveActivity(Object.assign({ id: st.id }, v, { requirement }), submitter && submitter.dataset.intent === 'force');
    if (res.conflicts) { st.conflicts = res.conflicts; st.errors = {}; EH.renderOverlays(true); return; }
    st.conflicts = null;
    EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(`« ${esc(r.item.title)} » planifiée le ${EH.fmtDate(r.item.date)} à ${esc(r.item.time)}${r.draft ? ' : intervenant à trouver' : ''}${r.clashes && r.clashes.length ? ' (conflit inscrit au journal)' : ''}`, { label: 'Ouvrir', action: () => EH.openDrawer('activity', { id: r.item.id }) }); });
  };

  /* ---------- close with attendance (US-04) ---------- */
  EH.drawers.closeActivity = (st) => {
    const d = S.data, a = Q.activity(d, st.id);
    const v = Object.assign({ status: 'done', attendees: null }, st.values), er = st.errors;
    const cohort = a.type === 'Session 1-1' && a.participant ? [Q.ent(d, a.participant)].filter(Boolean) : d.entrepreneurs.filter((e) => e.centre === a.centre && e.cohort && e.stage !== 'candidat' && (e.stage !== 'abandon' || (Q.stageDate(e, 'abandon') || '') > a.date)).sort((x, y) => x.name.localeCompare(y.name));
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

  EH.modals.speakerRefuse = (m) => {
    const a = Q.activity(S.data, m.id);
    return C.modal({ title: "L'intervenant a refusé", form: 'speaker-refuse', body: `<p class="small">${esc(EH.partnerName(a.facilitator))} ne viendra pas à « ${esc(a.title)} ». L'activité repasse en « Intervenant à trouver ».</p>${C.field({ name: 'reason', label: 'Motif (facultatif)', type: 'textarea', rows: 2, autofocus: true, placeholder: 'Ex. : indisponible ce jour-là' })}`,
      foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn('Enregistrer le refus', { type: 'submit', variant: 'danger' }) });
  };
  EH.forms['speaker-refuse'] = (v) => {
    const m = EH.ui.modal, res = EH.act.setSpeakerStatus(m.id, 'refused', v.reason);
    if (!res.ok) { m.errors = res.errors; EH.renderOverlays(true); return; }
    EH.closeModal(); EH.render(); EH.renderOverlays(); EH.toast(`Refus enregistré : « ${esc(res.item.title)} » repasse en intervenant à trouver.`, { label: "Choisir l'intervenant", action: () => EH.actions['edit-activity']({ dataset: { id: res.item.id } }) });
  };
  EH.forms['activity-report'] = (v, form, submitter) => {
    const st = EH.ui.drawer, submit = !(submitter && submitter.dataset.intent === 'draft');
    st.arValues = v;
    const res = EH.act.saveActivityReport(st.id, v, submit, v.version);
    if (!res.ok) { st.arErrors = res.errors; if (res.errors._) EH.toast(res.errors._, { tone: 'error' }); EH.renderOverlays(true); return; }
    st.arValues = null; st.arErrors = null; EH.render(); EH.renderOverlays();
    EH.toast(submit ? "Rapport d'activité soumis au PMO." : 'Brouillon enregistré.');
  };
  EH.forms['activity-report-return'] = (v) => {
    const st = EH.ui.drawer, r = Q.activityReport(S.data, st.id);
    const res = EH.act.reviewActivityReport(r.id, 'return', v.reason, v.version);
    if (!res.ok) { st.arErrors = res.errors; EH.renderOverlays(true); return; }
    st.arReturn = false; st.arErrors = null; EH.render(); EH.renderOverlays(); EH.toast("Rapport d'activité renvoyé au centre avec le motif.");
  };

  Object.assign(EH.actions, {
    'speaker-status': (el) => { const res = EH.act.setSpeakerStatus(el.dataset.id, el.dataset.status); if (!res.ok) return EH.toast(res.errors._, { tone: 'error' }); EH.render(); EH.renderOverlays(); EH.toast(`${esc(EH.partnerName(res.item.facilitator))} a confirmé sa venue.`); },
    'open-activity-report': (el) => { EH.openDrawer('activity', { id: el.dataset.id }); const sec = document.getElementById('activity-report'); if (sec) { sec.scrollIntoView({ block: 'start' }); const f = sec.querySelector('textarea, button'); if (f) f.focus({ preventScroll: true }); } },
    'speaker-refuse': (el) => EH.openModal('speakerRefuse', { id: el.dataset.id }),
    'send-reminder': (el) => { const res = EH.act.sendReminder(el.dataset.id); if (!res.ok) return EH.toast(res.errors._, { tone: 'error' }); EH.render(); EH.renderOverlays(); EH.toast(`Rappel envoyé : ${EH.plural(res.reminder.participants, 'participant')}${res.reminder.speaker ? ' et ' + esc(res.reminder.speaker) : ''}. Envoi tracé sur l'activité.`); },
    'ar-return-mode': (el) => { const st = EH.ui.drawer; st.arReturn = el.dataset.on === '1'; st.arErrors = null; EH.renderOverlays(true); },
    'ar-validate': (el) => { const res = EH.act.reviewActivityReport(el.dataset.id, 'validate', '', el.dataset.version); if (!res.ok) return EH.toast(res.errors._, { tone: 'error' }); EH.render(); EH.renderOverlays(); EH.toast("Rapport d'activité validé et verrouillé."); },
    'open-activity': (el) => { const a = Q.activity(S.data, el.dataset.id); if (a && !S.isBeneficiary() && !S.canSeeActivity(a)) EH.act.guardActivity(a); EH.openDrawer('activity', { id: el.dataset.id }); },
    'new-activity': () => { if (S.isOfficer()) EH.openDrawer('activityForm', {}); },
    'edit-activity': (el) => { const a = Q.activity(S.data, el.dataset.id); if (!S.isOfficer()) return; EH.openDrawer('activityForm', { id: a.id, values: Object.assign({}, a, { staff: (a.staff || [])[0] || '' }), reqOnly: a.status === 'done' || el.dataset.req === '1' }); },
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
