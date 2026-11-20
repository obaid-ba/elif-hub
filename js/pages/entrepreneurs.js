/* Entrepreneur journey (FR-02): list, profile timeline, registration with duplicate check,
   selection, stage changes, coaching sessions and deliverables. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, I = EH.icon, R = EH.REF;
  const DRAFT_KEY = 'elife-hub:drafts';

  /* ---------- form drafts kept locally (EC-19, PBI-16) ---------- */
  const drafts = { get: (k) => { try { return (JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'))[k] || null; } catch (e) { return null; } },
    set: (k, v) => { try { const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); all[k] = v; localStorage.setItem(DRAFT_KEY, JSON.stringify(all)); } catch (e) {} },
    clear: (k) => drafts.set(k, null) };
  EH.drafts = drafts;
  EH.live.draft = (el) => { const form = el.closest('form'); if (form) drafts.set(form.dataset.draftKey || form.dataset.form, EH.formData(form)); };

  const nextAction = (e) => {
    if (!Q.isActive(e)) return null;
    const last = Q.lastSession(S.data, e.id);
    return last && last.nextAction ? last : null;
  };

  /* ---------- list ---------- */
  EH.pages.entrepreneurs = {
    label: 'Entrepreneurs', icon: 'users',
    render() {
      const d = S.data, pmo = S.isPmo();
      const centre = pmo ? EH.f('ent.centre', '') : S.scope();
      const q = EH.norm(EH.f('ent.q', '')), stage = EH.f('ent.stage', ''), risk = EH.f('ent.risk', '');
      const base = Q.inScope(d.entrepreneurs, centre || null);
      const counts = EH.groupCount(base, (e) => e.stage);
      const riskCount = base.filter((e) => Q.atRisk(d, e)).length;
      const list = base
        .filter((e) => !stage || e.stage === stage)
        .filter((e) => !risk || Q.atRisk(d, e))
        .filter((e) => !q || EH.norm(e.name + ' ' + e.idea + ' ' + e.sector).includes(q))
        .map((e) => ({ e, risk: Q.atRisk(d, e), last: Q.lastSession(d, e.id), next: nextAction(e) }))
        .sort((a, b) => (b.risk - a.risk) || EH.stageIndex(a.e.stage) - EH.stageIndex(b.e.stage) || a.e.name.localeCompare(b.e.name));

      const seg = C.seg('ent.stage', [{ value: '', label: 'Toutes', count: base.length }, ...R.stages.map((s) => ({ value: s.id, label: s.label, count: counts[s.id] || 0 })), { value: 'abandon', label: 'Abandon', count: counts.abandon || 0 }], stage, 'Étape');
      const canWrite = !pmo;
      const rows = list.map(({ e, risk: rk, last, next }) => ({
        cls: 'clickable', attrs: `${C.on('open-ent', { id: e.id })} tabindex="0"`,
        cells: [
          `${EH.entLink(e)}<span class="sub truncate" style="max-width:320px">${esc(e.idea)}</span>`,
          ...(pmo ? [esc(Q.centreName(d, e.centre))] : []),
          C.stageBadge(e.stage),
          last ? `<span class="${rk ? 't-bad strong' : ''}">${EH.relDays(last.date)}</span>${rk ? '<span class="sub t-bad">À risque</span>' : ''}` : (R.activeStages.includes(e.stage) ? '<span class="t-bad strong">Aucune</span>' : '<span class="muted">—</span>'),
          next ? `<span class="truncate" style="display:block;max-width:220px">${esc(next.nextAction)}</span><span class="sub ${next.nextDue < EH.TODAY ? 't-bad' : ''}">${next.nextDue < EH.TODAY ? 'En retard · ' : ''}${EH.fmtDate(next.nextDue)}</span>` : '<span class="muted">—</span>',
          canWrite ? (e.stage === 'candidat'
            ? (EH.selectionNext(e) === 'interview' ? C.btn('Entretien', { action: 'sel-interview', data: { id: e.id }, size: 'sm' }) : EH.selectionNext(e) === 'committee' ? C.btn('Avis du comité', { action: 'sel-committee', data: { id: e.id }, size: 'sm' }) : C.btn('Décider', { action: 'select-decision', data: { id: e.id }, size: 'sm' }))
            : R.activeStages.includes(e.stage) ? C.btn('', { action: 'new-session', data: { id: e.id }, icon: 'message', size: 'sm', title: `Saisir une séance pour ${e.name}` }) + ' ' + C.btn('', { action: 'change-stage', data: { id: e.id }, icon: 'arrowRight', size: 'sm', title: `Changer l'étape de ${e.name}` }) : '') : ''
        ]
      }));
      const cols = [{ label: 'Entrepreneur' }, ...(pmo ? [{ label: 'Centre' }] : []), { label: 'Étape' }, { label: 'Dernière séance' }, { label: 'Prochaine action', cls: 'hide-md' }, { label: '', cls: 'actions' }];
      const actions = canWrite ? C.btn('Saisir une séance', { action: 'new-session', icon: 'message' }) + C.btn('Importer (Excel)', { action: 'import-candidates', icon: 'file' }) + C.btn('Inscrire un candidat', { action: 'new-candidate', icon: 'userPlus', variant: 'primary' }) : '';
      return C.pageHead('Entrepreneurs', pmo ? 'Parcours des entrepreneurs des six centres, de la candidature à la sortie. Lecture seule : les centres saisissent.' : 'Votre cohorte, de la candidature à la sortie. Les entrepreneurs sans séance depuis 30 jours apparaissent en premier.', actions) +
        `<div class="toolbar">${C.search('ent.q', 'Rechercher un nom, un projet…', EH.f('ent.q', ''))}${pmo ? C.filterSelect('ent.centre', 'Centre', EH.centreOptions(), centre) : ''}<label class="check"><input type="checkbox" ${risk ? 'checked' : ''} ${C.on('filter', { key: 'ent.risk', value: risk ? '' : '1' })}> À risque <span class="muted num">(${riskCount})</span></label></div>` +
        `<div class="toolbar" style="overflow-x:auto">${seg}</div>` +
        C.panel({ body: C.table({ caption: 'Liste des entrepreneurs', cols, rows, empty: C.empty({ icon: 'search', tone: '', title: 'Aucun entrepreneur', text: 'Aucun résultat pour ces filtres. Élargissez la recherche ou retirez un filtre.' }) }), foot: `<span class="muted xs">${EH.plural(list.length, 'entrepreneur')} affiché${list.length > 1 ? 's' : ''}</span>` });
    }
  };

  /* ---------- profile drawer (US-15) ---------- */
  const timeline = (e) => {
    const d = S.data, items = [];
    e.history.forEach((h) => items.push({ date: h.date, icon: h.stage === 'abandon' ? 'trendDown' : 'flag', tone: h.stage === 'abandon' ? 'bad' : 'accent', what: `${h.stage === 'candidat' ? 'Candidature enregistrée' : 'Étape : ' + EH.stageLabel(h.stage)}`, sub: h.note || '' }));
    if (e.interview) items.push({ date: e.interview.date, icon: 'message', tone: 'accent', what: `Entretien de sélection · ${e.interview.score}/5`, sub: e.interview.comment });
    if (e.committee) items.push({ date: e.committee.date, icon: 'users', tone: e.committee.opinion === 'favorable' ? 'ok' : e.committee.opinion === 'defavorable' ? 'bad' : 'warn', what: `Avis du comité : ${(R.committeeOpinions.find((o) => o.id === e.committee.opinion) || {}).label} · ${e.committee.score}/5`, sub: e.committee.comment });
    if (e.selection) items.push({ date: e.selection.date, icon: 'flag', tone: e.selection.decision === 'selected' ? 'ok' : '', what: `Décision : ${(R.selection.find((s) => s.id === e.selection.decision) || {}).label}`, sub: e.selection.reason });
    Q.sessionsOf(d, e.id).forEach((s) => items.push({ date: s.date, icon: 'message', tone: 'info', what: `${s.type} · ${s.topic}`, sub: `Avec ${EH.partnerName(s.coach) || '—'}${s.nextAction ? ' · Prochaine action : ' + s.nextAction + ' (' + EH.fmtDate(s.nextDue) + ')' : ''}` }));
    d.activities.filter((a) => a.attendees.includes(e.id)).forEach((a) => items.push({ date: a.date, icon: 'calendar', tone: '', what: `Présent : ${a.title}`, sub: a.type }));
    return items.sort((a, b) => (a.date < b.date ? 1 : -1));
  };
  EH.entTimeline = timeline;
  const DELIV = (EH.DELIV = { expected: ['Attendu', ''], submitted: ['Déposé', 'info'], validated: ['Validé', 'ok'], closed: ['Clôturé', 'outline'] });

  /** "Rapports" block of the profile: one line per report plus the two rates, from the same selector as the dashboard. */
  const reportsBlock = (d, e) => {
    const head = (extra = '') => `<h3>Rapports bénéficiaires${extra}</h3>`;
    if (!e.portal) return `<div class="section">${head()}<p class="muted small">Espace bénéficiaire non activé : aucun rapport attendu.</p></div>`;
    const BS = R.beneficiaryReportStatus, obs = Q.obligations(d, e);
    const rate = (v, ok, tot, label, tip) => `<dt>${label}${C.info(tip)}</dt><dd class="num">${v == null ? '<span class="muted">Pas de donnée</span>' : `${Math.round(v)}${EH.NBSP}% · ${ok} sur ${tot}`}</dd>`;
    const all = Q.beneficiaryStats(d, [e.id], null);
    const periods = [...new Set(obs.map((o) => o.activity.date.slice(0, 7)))].sort().slice(-2).reverse();
    const perPeriod = periods.map((p) => { const b = Q.beneficiaryStats(d, [e.id], p); return `<div class="meta">${esc(EH.fmtMonth(p))} : remise ${b.reporting == null ? 'pas de donnée' : Math.round(b.reporting) + EH.NBSP + '%'} · engagement ${b.engagement == null ? 'pas de donnée' : Math.round(b.engagement) + EH.NBSP + '%'}</div>`; }).join('');
    const rows = obs.length ? `<div class="panel">${obs.map((o) => `<div class="list-row">${C.ico('report', o.late ? 'bad' : o.status === 'validated' ? 'ok' : '')}<div class="body"><button type="button" class="link-btn" ${C.on('open-activity', { id: o.activity.id })}>${esc(o.activity.title)}</button><div class="meta ${o.late ? 't-bad' : ''}">Échéance ${EH.fmtDate(o.due)}${o.optional ? ' · facultatif' : ''}${o.report ? ` · version v${o.report.requirementVersion}` : ''}</div></div><div class="row-actions">${C.statusBadge(BS, o.status)}${o.late ? C.badge(`En retard de ${o.daysLate} j`, 'bad', 'alert') : ''}</div></div>`).join('')}</div>` : '<p class="muted small">Aucun rapport attendu pour le moment.</p>';
    return `<div class="section">${head(' ' + C.badge('Provisoire', 'outline'))}<dl class="dl">${rate(all.reporting, all.onTime, all.due, 'Taux de remise', R.kpis.reporting.formula)}${rate(all.engagement, all.engagementDetail.num, all.engagementDetail.den, 'Engagement', R.kpis.engagement.formula)}</dl>${perPeriod}<div style="margin-top:8px">${rows}</div></div>`;
  };

  /* ---------- PBI-23: selection path (application → interview → committee → decision) ---------- */
  EH.selectionNext = (e) => (e.stage !== 'candidat' ? null : !e.interview ? 'interview' : !e.committee ? 'committee' : 'decision');
  const selectionBlock = (e) => {
    const op = e.committee && R.committeeOpinions.find((o) => o.id === e.committee.opinion);
    const steps = [
      { l: 'Candidature', done: true, sub: EH.fmtDate(e.history[0].date) },
      { l: 'Entretien', done: !!e.interview, sub: e.interview ? `${EH.fmtDate(e.interview.date)} · ${e.interview.score}/5` : 'À faire' },
      { l: 'Avis du comité', done: !!e.committee, sub: e.committee ? `${op.label} · ${e.committee.score}/5` : 'À faire' },
      { l: 'Décision', done: !!e.selection || e.stage !== 'candidat', sub: e.selection ? (R.selection.find((s) => s.id === e.selection.decision) || {}).label : e.stage !== 'candidat' ? 'Sélectionné' : 'À prendre' }
    ];
    const cur = steps.findIndex((s) => !s.done);
    return `<div class="section"><h3>Parcours de sélection</h3><div class="stepper sel-steps">${steps.map((s, i) => `<div class="step ${s.done ? 'done' : i === cur ? 'current' : ''}"><b>${s.l}</b>${esc(s.sub)}</div>`).join('')}</div>
      ${e.interview ? `<p class="small" style="margin-top:8px"><b>Entretien :</b> ${esc(e.interview.comment)}</p>` : ''}${e.committee ? `<p class="small"><b>Comité :</b> ${esc(e.committee.comment)}</p>` : ''}</div>`;
  };
  const scoreField = (name, value, error) => C.radios({ name, label: 'Note sur 5', value: value != null ? String(value) : '', error, options: ['1', '2', '3', '4', '5'].map((x) => ({ value: x, label: x })) }).replace('class="radio-cards"', 'class="radio-cards score-cards"');
  EH.modals.interview = (m) => {
    const e = Q.ent(S.data, m.id), v = Object.assign({ date: EH.TODAY }, e.interview || {}, m.values), er = m.errors;
    return C.modal({ title: `Entretien · ${esc(e.name)}`, form: 'interview', body: `${C.formError(er)}<p class="small">${esc(e.idea)}</p>
      ${C.field({ name: 'date', label: "Date de l'entretien", type: 'date', required: true, value: v.date, error: er.date, max: EH.TODAY })}
      <div style="height:12px"></div>${scoreField('score', v.score, er.score)}
      <div style="height:12px"></div>${C.field({ name: 'comment', label: 'Commentaire', type: 'textarea', rows: 3, required: true, value: v.comment, error: er.comment, placeholder: 'Motivation, clarté du projet, points à vérifier.' })}`,
      foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn("Enregistrer l'entretien", { type: 'submit', variant: 'primary' }) });
  };
  EH.modals.committee = (m) => {
    const e = Q.ent(S.data, m.id), v = Object.assign({ date: EH.TODAY }, e.committee || {}, m.values), er = m.errors;
    return C.modal({ title: `Avis du comité · ${esc(e.name)}`, form: 'committee', body: `${C.formError(er)}<p class="small">Entretien du ${EH.fmtDate(e.interview.date)} : ${e.interview.score}/5 · ${esc(e.interview.comment)}</p>
      ${C.radios({ name: 'opinion', label: 'Avis', value: v.opinion, error: er.opinion, options: R.committeeOpinions.map((o) => ({ value: o.id, label: o.label })) })}
      <div style="height:12px"></div>${C.field({ name: 'date', label: 'Date du comité', type: 'date', required: true, value: v.date, error: er.date, max: EH.TODAY })}
      <div style="height:12px"></div>${scoreField('score', v.score, er.score)}
      <div style="height:12px"></div>${C.field({ name: 'comment', label: 'Commentaire', type: 'textarea', rows: 3, required: true, value: v.comment, error: er.comment })}`,
      foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn("Enregistrer l'avis", { type: 'submit', variant: 'primary' }) });
  };
  const stepForm = (fn, label) => (v) => {
    const m = EH.ui.modal; m.values = v;
    const res = EH.act[fn](m.id, v);
    if (res.ok) { EH.closeModal(); EH.render(); if (EH.ui.drawer) EH.renderOverlays(); EH.toast(`${label} enregistré pour ${esc(res.item.name)}.`); }
    else { m.errors = res.errors; EH.renderOverlays(true); }
  };
  EH.forms.interview = stepForm('recordInterview', 'Entretien');
  EH.forms.committee = stepForm('recordCommittee', 'Avis du comité');

  EH.drawers.ent = (st) => {
    const d = S.data, e = Q.ent(d, st.id);
    if (!e) return C.drawer({ title: 'Fiche introuvable', body: C.empty({ icon: 'search', tone: '', title: 'Cette fiche n\'existe plus' }) });
    if (!S.canSeeEnt(e)) return C.drawer({ title: 'Accès refusé', body: EH.denied('Cette fiche entrepreneur') });
    const w = S.can.writeOperational(e.centre);
    const risk = Q.atRisk(d, e), next = nextAction(e);
    const si = EH.stageIndex(e.stage);
    const stepper = `<div class="stepper" aria-label="Parcours">${R.stages.map((s, i) => { const dt = Q.stageDate(e, s.id); const cls = e.stage === 'abandon' ? (dt ? 'done' : '') : i < si ? 'done' : i === si ? 'current' : ''; return `<div class="step ${cls}"><b>${s.label}</b>${dt ? EH.fmtDate(dt) : '&nbsp;'}</div>`; }).join('')}</div>`;
    const dels = d.deliverables.filter((x) => x.entrepreneur === e.id);
    const tl = timeline(e);
    const selNext = EH.selectionNext(e);
    const tools = w ? (e.stage === 'candidat'
      ? C.btn('Entretien', { action: 'sel-interview', data: { id: e.id }, icon: 'message', variant: selNext === 'interview' ? 'primary' : '' }) + C.btn('Avis du comité', { action: 'sel-committee', data: { id: e.id }, icon: 'users', variant: selNext === 'committee' ? 'primary' : '', disabled: !e.interview }) + C.btn('Décision de sélection', { action: 'select-decision', data: { id: e.id }, variant: selNext === 'decision' ? 'primary' : '', icon: 'flag' }) + C.btn('Abandon', { action: 'change-stage', data: { id: e.id, to: 'abandon' } })
      : C.btn('Saisir une séance', { action: 'new-session', data: { id: e.id }, variant: 'primary', icon: 'message', disabled: !R.activeStages.includes(e.stage) }) + C.btn("Changer d'étape", { action: 'change-stage', data: { id: e.id }, icon: 'arrowRight' })) : '';
    const selSteps = e.stage === 'candidat' || e.interview || e.committee ? selectionBlock(e) : '';
    const body = `
      ${stepper}
      ${selSteps}
      ${e.stage === 'abandon' ? C.callout('bad', `Abandon le ${EH.fmtDate(Q.stageDate(e, 'abandon'))} : ${esc(e.abandonReason || 'motif non précisé')}. L'historique est conservé.`) : ''}
      ${risk ? C.callout('warn', `Aucune séance depuis ${Q.daysWithoutSession(d, e)} jours. Planifiez un échange.`) : ''}
      ${next ? `<div class="section"><h3>Prochaine action</h3><div class="panel"><div class="list-row">${C.ico('flag', next.nextDue < EH.TODAY ? 'bad' : 'accent')}<div class="body"><div class="title">${esc(next.nextAction)}</div><div class="meta ${next.nextDue < EH.TODAY ? 't-bad' : ''}">Échéance ${EH.fmtDate(next.nextDue)}${next.nextDue < EH.TODAY ? ' · en retard' : ''} · fixée le ${EH.fmtDate(next.date)}</div></div></div></div></div>` : ''}
      <div class="section"><h3>Profil</h3><dl class="dl">
        <dt>Projet</dt><dd>${esc(e.idea)}</dd><dt>Secteur</dt><dd>${esc(e.sector || '—')}</dd>
        <dt>Centre</dt><dd>${esc(Q.centreName(d, e.centre))}${e.cohort ? ' · ' + esc((d.cohorts.find((c) => c.id === e.cohort) || {}).name || '') : ''}</dd>
        <dt>Contact</dt><dd>${esc(e.phone || '—')}<br>${esc(e.email || '')}</dd>
        <dt>Maturité</dt><dd>${e.maturity ? `Niveau ${e.maturity} sur 5` : '<span class="muted">Non évaluée</span>'}</dd>
        <dt>Connu par</dt><dd>${esc(e.source || '—')}</dd></dl></div>
      <div class="section"><h3>Livrables <span class="muted num">${dels.length}</span></h3>${dels.length ? `<div class="panel">${dels.map((x) => { const late = x.status === 'expected' && x.due < EH.TODAY; return `<div class="list-row">${C.ico('file', late ? 'bad' : x.status === 'validated' ? 'ok' : '')}<div class="body"><div class="title">${esc(x.title)}</div><div class="meta ${late ? 't-bad' : ''}">${EH.stageLabel(x.stage)} · échéance ${EH.fmtDate(x.due)}${late ? ' · en retard' : ''}</div></div><div class="row-actions">${C.badge(DELIV[x.status][0], DELIV[x.status][1])}${w && x.status === 'expected' ? C.btn('Déposé', { action: 'set-deliverable', data: { id: x.id, status: 'submitted' }, size: 'sm' }) : ''}${w && x.status === 'submitted' ? C.btn('Valider', { action: 'set-deliverable', data: { id: x.id, status: 'validated' }, size: 'sm' }) : ''}</div></div>`; }).join('')}</div>` : '<p class="muted small">Aucun livrable pour cette étape.</p>'}</div>
      ${S.isBeneficiary() ? '' : reportsBlock(d, e)}
      ${S.isBeneficiary() || !EH.entIncubationBlocks ? '' : EH.entIncubationBlocks(d, e)}
      <div class="section"><h3>Chronologie</h3>${tl.length ? `<ul class="timeline">${tl.map((t) => `<li>${C.ico(t.icon, t.tone)}<div><div class="what">${esc(t.what)}</div><div class="when">${EH.fmtDateY(t.date)}${t.sub ? ' · ' + esc(t.sub) : ''}</div></div></li>`).join('')}</ul>` : '<p class="muted small">Rien à afficher.</p>'}</div>`;
    return C.drawer({ title: esc(e.name), sub: `${C.stageBadge(e.stage)} ${risk ? C.badge('À risque', 'bad', 'alert') : ''} · ${esc(Q.centreName(d, e.centre))}`, tools, body, wide: true });
  };

  /* ---------- registration (US-08, US-09) ---------- */
  const candTabs = (tab) => `<div class="seg cand-tabs" role="tablist" aria-label="Mode d'inscription">${[['manual', 'Saisie manuelle', 'edit'], ['import', 'Importer un fichier Excel', 'file']].map(([id, l, ic]) => `<button type="button" role="tab" aria-selected="${tab === id}" aria-pressed="${tab === id}" ${C.on('cand-tab', { tab: id })}>${I(ic)} ${l}</button>`).join('')}</div>`;

  /** Import tab: choose a file, see one verdict per row, then insert the valid ones. */
  const importBody = (st) => {
    const an = st.analysis, cols = EH.act.IMPORT_COLUMNS;
    const intro = `<div class="callout info">${I('info')}<div>Colonnes attendues (ligne 1) : <b>Prénom*</b>, <b>Nom*</b>, Téléphone, E-mail, Date de naissance, Secteur, <b>Idée de projet*</b>, Source. Téléphone ou e-mail obligatoire. Formats acceptés : .xlsx et .csv.
      <div class="actions">${C.btn('Télécharger le modèle Excel', { action: 'cand-template', icon: 'file', size: 'sm' })}</div></div></div>`;
    const picker = `<div class="field full"><label for="import-file">Fichier des candidats</label><input id="import-file" class="input file-input" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" data-live="importFile">${st.fileName ? `<span class="help">Fichier lu : ${esc(st.fileName)}</span>` : ''}</div>`;
    const err = st.importError ? C.callout('bad', esc(st.importError)) : '';
    if (!an) return `${intro}${picker}${err}`;
    const S2 = an.summary, filter = st.importFilter || '';
    const badge = { ok: C.badge('À insérer', 'ok', 'check'), duplicate: C.badge('Ignoré · doublon', 'warn', 'copy'), error: C.badge('Erreur', 'bad', 'alert') };
    const rows = an.rows.filter((x) => !filter || x.status === filter).map((x) => ({ cls: 'imp-' + x.status, cells: [
      `<span class="num muted">${x.line}</span>`,
      `<span class="strong">${esc((x.values.firstName + ' ' + x.values.lastName).trim() || '—')}</span><span class="sub truncate" style="max-width:240px">${esc(x.values.idea || '')}</span>`,
      badge[x.status],
      x.status === 'error' ? `<ul class="imp-errors">${Object.entries(x.errors).map(([k, m]) => `<li><b>${esc(cols[k] || k)}</b> : ${esc(m)}</li>`).join('')}</ul>` : x.status === 'duplicate' ? `<span class="small">${esc(x.reason)}</span>` : `<span class="small muted">${esc([x.values.phone, x.values.email].filter(Boolean).join(' · '))}</span>`
    ] }));
    const seg = C.seg('imp', [{ value: '', label: 'Toutes', count: an.rows.length }, { value: 'ok', label: 'À insérer', count: S2.ok }, { value: 'duplicate', label: 'Doublons ignorés', count: S2.duplicate }, { value: 'error', label: 'Erreurs', count: S2.error }], filter, 'Filtrer les lignes').replace(/data-action="filter"/g, 'data-action="imp-filter"');
    return `${intro}${picker}${err}
      <div class="imp-summary"><div class="imp-stat ok"><b class="num">${S2.ok}</b><span>à insérer</span></div><div class="imp-stat warn"><b class="num">${S2.duplicate}</b><span>doublons ignorés</span></div><div class="imp-stat bad"><b class="num">${S2.error}</b><span>en erreur</span></div></div>
      ${S2.error ? C.callout('warn', 'Les lignes en erreur ne seront pas insérées. Corrigez-les dans le fichier puis importez-le à nouveau : les candidats déjà insérés seront alors reconnus comme doublons et ignorés.') : ''}
      <div class="toolbar" style="overflow-x:auto">${seg}</div>
      <div class="panel">${C.table({ caption: 'Aperçu de l’import', cols: [{ label: 'Ligne', cls: 'num' }, { label: 'Candidat' }, { label: 'Statut' }, { label: 'Détail' }], rows, empty: C.empty({ icon: 'search', tone: '', title: 'Aucune ligne pour ce filtre' }) })}</div>`;
  };

  EH.drawers.candidate = (st) => {
    if (st.tab === 'import') {
      const n = st.analysis ? st.analysis.summary.ok : 0;
      return C.drawer({ title: 'Inscrire des candidats', sub: `Centre de ${esc(Q.centreName(S.data, S.scope()))} · statut Candidat`, tools: candTabs('import'), wide: true, body: importBody(st),
        foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn(n ? `Insérer ${EH.plural(n, 'candidat')}` : 'Insérer', { action: 'cand-import', variant: 'primary', icon: 'userPlus', disabled: !n }) });
    }
    const v = st.values, er = st.errors;
    const dup = st.duplicates ? C.callout('warn', `<b>Doublon possible.</b><ul style="margin:6px 0 0;padding-left:18px">${st.duplicates.map((x) => x.own ? `<li>${esc(x.name)} · ${EH.stageLabel(x.stage)} — <button type="button" class="link-btn" ${C.on('open-ent', { id: x.id })}>ouvrir la fiche</button></li>` : `<li>Une personne avec ces coordonnées existe déjà au centre de ${esc(x.centre)}.</li>`).join('')}</ul>`) +
      C.field({ name: 'overrideReason', label: 'Motif pour enregistrer quand même', type: 'textarea', rows: 2, required: true, error: er.override, value: v.overrideReason, help: 'Ce motif est enregistré dans le journal.' }) : '';
    const body = `${C.formError(er)}${dup}<div class="form-grid">
      ${C.field({ name: 'firstName', label: 'Prénom', required: true, value: v.firstName, error: er.firstName, autofocus: true })}
      ${C.field({ name: 'lastName', label: 'Nom', required: true, value: v.lastName, error: er.lastName })}
      ${C.field({ name: 'phone', label: 'Téléphone', type: 'tel', value: v.phone, error: er.phone, placeholder: '+216 …', help: 'Téléphone ou e-mail obligatoire.' })}
      ${C.field({ name: 'email', label: 'E-mail', type: 'email', value: v.email, error: er.email })}
      ${C.field({ name: 'birth', label: 'Date de naissance', type: 'date', value: v.birth, help: 'Sert au contrôle de doublon.' })}
      ${C.field({ name: 'sector', label: 'Secteur', type: 'select', value: v.sector, options: ['', ...R.sectors] })}
      ${C.field({ name: 'idea', label: 'Idée de projet', type: 'textarea', rows: 2, required: true, value: v.idea, error: er.idea, full: true })}
      ${C.field({ name: 'source', label: "Comment a-t-il connu ELIFE ?", type: 'select', value: v.source, options: ['', ...R.sources], full: true })}
    </div>`;
    return C.drawer({ title: 'Inscrire un candidat', sub: `Centre de ${esc(Q.centreName(S.data, S.scope()))} · statut Candidat`, tools: candTabs('manual'), form: 'candidate', draft: true, body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn(st.duplicates ? 'Enregistrer quand même' : 'Enregistrer', { type: 'submit', variant: 'primary' }) });
  };
  EH.forms.candidate = (v) => {
    const st = EH.ui.drawer;
    st.values = v;
    const res = EH.act.registerCandidate(v, st.duplicates ? { reason: v.overrideReason } : null);
    if (res.duplicates) { st.duplicates = res.duplicates; st.errors = {}; EH.renderOverlays(true); return; }
    EH.handle(res, st, (r) => {
      drafts.clear('candidate'); EH.closeDrawer(); EH.render();
      EH.toast(`${esc(r.item.name)} est inscrit comme candidat.`, { label: 'Décision de sélection', action: () => EH.openModal('selection', { id: r.item.id }) });
    });
  };

  /** File chosen in the import tab: read it, then analyse every row (nothing is written yet). */
  EH.live.importFile = async (el) => {
    const st = EH.ui.drawer, file = el.files && el.files[0];
    if (!st || !file || st.readingFile === file) return;
    st.readingFile = file;
    st.fileName = file.name; st.importError = null; st.analysis = null; st.rawRows = null; st.importFilter = '';
    try {
      const rows = await EH.sheet.readFile(file);
      const an = EH.act.analyzeImport(rows);
      if (an.ok) { st.analysis = an; st.rawRows = rows; } else st.importError = an.errors._;
    } catch (e) { st.importError = e && e.message ? e.message : 'Impossible de lire ce fichier.'; }
    if (EH.ui.drawer === st) EH.renderOverlays();
  };

  /* ---------- session (US-12): six fields ---------- */
  EH.drawers.session = (st) => {
    const d = S.data, centre = S.scope();
    const v = Object.assign({ date: EH.TODAY, type: 'Coaching' }, st.values), er = st.errors;
    const ents = d.entrepreneurs.filter((e) => e.centre === centre && R.activeStages.includes(e.stage)).sort((a, b) => Q.atRisk(d, b) - Q.atRisk(d, a) || a.name.localeCompare(b.name));
    const restored = st.restored ? C.callout('info', 'Saisie précédente restaurée : elle avait été conservée sur cet appareil.') : '';
    const body = `${C.formError(er)}${restored}<div class="form-grid">
      ${C.field({ name: 'entrepreneur', label: 'Entrepreneur', type: 'select', required: true, value: v.entrepreneur, error: er.entrepreneur, full: true, options: [{ value: '', label: 'Choisir…' }, ...ents.map((e) => ({ value: e.id, label: `${e.name}${Q.atRisk(d, e) ? ' · à risque' : ''}` }))], autofocus: !v.entrepreneur })}
      ${C.field({ name: 'date', label: 'Date', type: 'date', required: true, value: v.date, error: er.date, max: EH.TODAY })}
      <div class="field"><span class="field-label">Type</span><div class="seg" role="radiogroup" aria-label="Type de séance">${['Coaching', 'Mentorat'].map((t) => `<label style="display:contents"><input type="radio" class="sr-only" name="type" value="${t}" ${v.type === t ? 'checked' : ''}><button type="button" aria-pressed="${v.type === t}" ${C.on('pick-type', { value: t })}>${t}</button></label>`).join('')}</div></div>
      ${C.field({ name: 'coach', label: 'Coach ou mentor', type: 'select', required: true, value: v.coach, error: er.coach, full: true, options: EH.coachOptions(), help: "Choisi dans l'annuaire : sa contribution est comptée automatiquement." })}
      ${C.field({ name: 'topic', label: 'Sujet abordé', required: true, value: v.topic, error: er.topic, full: true, placeholder: 'Ex. : Prix de revient', autofocus: !!v.entrepreneur })}
      ${C.field({ name: 'nextAction', label: 'Prochaine action', value: v.nextAction, error: er.nextAction, placeholder: "Ex. : Envoyer l'étude de marché" })}
      ${C.field({ name: 'nextDue', label: 'Échéance', type: 'date', value: v.nextDue, error: er.nextDue, min: EH.TODAY })}
    </div>`;
    return C.drawer({ title: 'Saisir une séance', sub: 'Six champs, moins d\'une minute. La séance compte dans le rapport du mois.', form: 'session', draft: true, body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn('Enregistrer la séance', { type: 'submit', variant: 'primary' }) });
  };
  EH.forms.session = (v) => {
    const st = EH.ui.drawer;
    st.values = v;
    const res = EH.act.logSession(v);
    EH.handle(res, st, (r) => {
      drafts.clear('session'); EH.closeDrawer(); EH.render();
      const x = Q.ent(S.data, r.item.entrepreneur);
      EH.toast(`Séance enregistrée pour ${esc(x.name)}.`, { label: 'Voir la fiche', action: () => EH.openDrawer('ent', { id: x.id }) });
    });
  };
  EH.actions['pick-type'] = (el) => {
    const form = el.closest('form');
    form.querySelectorAll('input[name=type]').forEach((i) => (i.checked = i.value === el.dataset.value));
    el.parentElement.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.value === el.dataset.value));
    drafts.set('session', EH.formData(form));
  };

  /* ---------- stage change (US-11) ---------- */
  EH.modals.stage = (m) => {
    const e = Q.ent(S.data, m.id);
    const to = m.values.to || m.to || R.stages[Math.min(EH.stageIndex(e.stage) + 1, 4)].id;
    const back = to === 'abandon' || EH.stageIndex(to) < EH.stageIndex(e.stage) || e.stage === 'abandon';
    const opts = [...R.stages.filter((s) => s.id !== 'candidat').map((s) => ({ value: s.id, label: s.label + (s.id === e.stage ? ' (actuelle)' : '') })), { value: 'abandon', label: 'Abandon' }];
    return C.modal({ title: `Changer l'étape · ${esc(e.name)}`, form: 'stage', body: `${C.formError(m.errors)}
      <p class="small">Étape actuelle : ${C.stageBadge(e.stage)}</p>
      <input type="hidden" name="version" value="${e.version}">
      ${C.field({ name: 'to', label: 'Nouvelle étape', type: 'select', required: true, value: to, options: opts, error: m.errors.to, live: 'stageTo' })}
      ${C.field({ name: 'reason', label: to === 'abandon' ? "Motif de l'abandon" : 'Motif', type: 'textarea', rows: 2, required: back, value: m.values.reason, error: m.errors.reason, help: back ? 'Obligatoire pour un abandon ou un retour en arrière. L\'historique est conservé.' : 'Facultatif pour une avancée.' })}`,
      foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn(to === 'abandon' ? "Déclarer l'abandon" : "Changer l'étape", { type: 'submit', variant: to === 'abandon' ? 'danger' : 'primary' }) });
  };
  EH.live.stageTo = (el) => { const m = EH.ui.modal; if (m && m.type === 'stage') { m.values = EH.formData(el.form); EH.renderOverlays(); const s = document.querySelector('.modal [name=to]'); if (s) s.focus(); } };
  EH.forms.stage = (v) => {
    const m = EH.ui.modal;
    m.values = v;
    const res = EH.act.moveStage(m.id, v.to, v.reason, +v.version);
    if (res.ok) {
      EH.closeModal(); EH.render(); if (EH.ui.drawer) EH.renderOverlays();
      EH.toast(v.to === 'abandon' ? `Abandon enregistré pour ${esc(res.item.name)}.` : `${esc(res.item.name)} passe en ${esc(EH.stageLabel(v.to).toLowerCase())}. Le tableau de bord du PMO est à jour.`);
    } else { m.errors = res.errors; EH.renderOverlays(true); }
  };

  /* ---------- selection decision (US-10) ---------- */
  EH.modals.selection = (m) => {
    const e = Q.ent(S.data, m.id);
    const cohorts = S.data.cohorts.filter((c) => c.centre === e.centre);
    const v = m.values;
    const cop = e.committee && R.committeeOpinions.find((o) => o.id === e.committee.opinion);
    return C.modal({ title: `Décision de sélection · ${esc(e.name)}`, form: 'selection', body: `${C.formError(m.errors)}
      ${cop ? C.callout(e.committee.opinion === 'favorable' ? 'ok' : e.committee.opinion === 'defavorable' ? 'bad' : 'warn', `Avis du comité : <b>${cop.label}</b> (${e.committee.score}/5) · ${esc(e.committee.comment)}`) : C.callout('info', e.interview ? "Aucun avis du comité enregistré : vous pouvez décider maintenant ou attendre l'avis." : 'Ni entretien ni avis du comité enregistrés pour ce candidat.')}
      ${C.radios({ name: 'decision', label: 'Décision', value: v.decision, error: m.errors.decision, options: R.selection.map((s) => ({ value: s.id, label: s.label })) })}
      ${C.field({ name: 'reason', label: 'Motif', type: 'textarea', rows: 2, required: true, value: v.reason, error: m.errors.reason })}
      ${C.field({ name: 'cohort', label: 'Cohorte (si sélectionné)', type: 'select', value: v.cohort || (cohorts[0] || {}).id, error: m.errors.cohort, options: cohorts.map((c) => ({ value: c.id, label: `${c.name} · ${(Q.programme(S.data, c.programme) || {}).name || ''}` })), help: 'Sélectionné : passe en pré-incubation dans cette cohorte.' })}`,
      foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn('Enregistrer la décision', { type: 'submit', variant: 'primary' }) });
  };
  EH.forms.selection = (v) => {
    const m = EH.ui.modal;
    m.values = v;
    const res = EH.act.decideSelection(m.id, v);
    if (res.ok) { EH.closeModal(); EH.render(); if (EH.ui.drawer) EH.renderOverlays(); EH.toast(v.decision === 'selected' ? `${esc(res.item.name)} est sélectionné et passe en pré-incubation.` : 'Décision enregistrée.'); }
    else { m.errors = res.errors; EH.renderOverlays(true); }
  };

  Object.assign(EH.actions, {
    'open-ent': (el) => { const e = Q.ent(S.data, el.dataset.id); if (e && !S.isBeneficiary() && !S.canSeeEnt(e)) EH.act.guardEnt(e); EH.openDrawer('ent', { id: el.dataset.id }); },
    'new-candidate': (el) => { if (!S.isOfficer()) return; const dr = drafts.get('candidate'); EH.openDrawer('candidate', { values: dr || {}, tab: el && el.dataset && el.dataset.tab === 'import' ? 'import' : 'manual' }); },
    'import-candidates': () => { if (!S.isOfficer()) return; EH.openDrawer('candidate', { values: {}, tab: 'import' }); },
    'cand-tab': (el) => { const st = EH.ui.drawer; if (!st || st.type !== 'candidate') return; st.tab = el.dataset.tab; st.errors = {}; EH.renderOverlays(true); },
    'imp-filter': (el) => { const st = EH.ui.drawer; if (!st) return; st.importFilter = el.dataset.value; EH.renderOverlays(); },
    'cand-template': () => {
      const cols = Object.values(EH.act.IMPORT_COLUMNS);
      const rows = [cols, ['Amel', 'Ben Youssef', '+216 22 345 678', 'amel.benyoussef@exemple.tn', '14/03/1998', 'Tourisme', "Maison d'hôtes à Houmt Souk", 'Réseaux sociaux']];
      EH.sheet.download(EH.sheet.writeXlsx(rows, 'Candidats'), 'modele-candidats-elife.xlsx');
      EH.toast('Modèle téléchargé : remplissez une ligne par candidat sous les en-têtes.');
    },
    'cand-import': () => {
      const st = EH.ui.drawer;
      if (!st || !st.rawRows) return;
      const res = EH.act.importCandidates(st.rawRows);
      if (!res.ok) { st.importError = res.errors._; EH.renderOverlays(); return; }
      EH.closeDrawer(); EH.render();
      const sm = res.summary;
      EH.toast(`${EH.plural(res.items.length, 'candidat inséré', 'candidats insérés')}${sm.duplicate ? ` · ${EH.plural(sm.duplicate, 'doublon ignoré', 'doublons ignorés')}` : ''}${sm.error ? ` · ${EH.plural(sm.error, 'ligne en erreur', 'lignes en erreur')} non insérée${sm.error > 1 ? 's' : ''}` : ''}.`, { tone: sm.error ? 'error' : 'ok' });
    },
    'new-session': (el) => {
      if (!S.isOfficer()) return;
      const id = el && el.dataset && el.dataset.id;
      const dr = drafts.get('session');
      const restored = !id && dr && (dr.topic || dr.nextAction);
      EH.openDrawer('session', { values: id ? { entrepreneur: id } : restored ? dr : {}, restored });
    },
    'sel-interview': (el) => EH.openModal('interview', { id: el.dataset.id }),
    'sel-committee': (el) => { const e = Q.ent(S.data, el.dataset.id); if (!e.interview) return EH.toast("Saisissez d'abord l'entretien.", { tone: 'error' }); EH.openModal('committee', { id: el.dataset.id }); },
    'change-stage': (el) => EH.openModal('stage', { id: el.dataset.id, to: el.dataset.to }),
    'select-decision': (el) => EH.openModal('selection', { id: el.dataset.id, values: { decision: 'selected' } }),
    'set-deliverable': (el) => { const r = EH.act.setDeliverable(el.dataset.id, el.dataset.status); if (r.ok) { EH.renderOverlays(); EH.toast('Livrable mis à jour.'); } }
  });
})();
