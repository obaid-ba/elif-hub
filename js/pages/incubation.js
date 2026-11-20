/* Incubation follow-up on the officer home: phase tracking, exercises given to beneficiaries
   (they become actions in their space), and funders linked to the projects they support. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF, I = EH.icon;
  const EX = R.exerciseStatus;
  const money = (n) => (n == null ? '' : n.toLocaleString('fr-FR').replace(/ | /g, EH.NBSP) + EH.NBSP + 'DT');
  const exRank = (x) => (x.status === 'submitted' ? 0 : Q.exerciseLate(x) ? 1 : x.status === 'returned' ? 2 : x.status === 'todo' ? 3 : 4);
  const exBadge = (x) => C.statusBadge(EX, x.status) + (Q.exerciseLate(x) ? ' ' + C.badge('En retard', 'bad', 'alert') : '');

  /* ---------- 1. phases ---------- */
  const phases = (d, c) => {
    const ents = d.entrepreneurs.filter((e) => e.centre === c && R.activeStages.includes(e.stage))
      .map((e) => ({ e, p: Q.phaseProgress(e), ex: Q.exercisesOf(d, e.id) }))
      .sort((a, b) => R.activeStages.indexOf(a.e.stage) - R.activeStages.indexOf(b.e.stage) || (b.p.pct || 0) - (a.p.pct || 0));
    const cards = R.activeStages.map((s) => {
      const list = ents.filter((x) => x.e.stage === s), over = list.filter((x) => x.p.over).length;
      const st = R.stages.find((y) => y.id === s);
      return `<button type="button" class="phase-card" aria-pressed="${EH.f('inc.stage', '') === s}" ${C.on('filter', { key: 'inc.stage', value: EH.f('inc.stage', '') === s ? '' : s })}>
        <span class="phase-dot" style="background:${st.color}"></span><span class="phase-name">${esc(st.label)}</span>
        <b class="num">${list.length}</b><span class="muted xs">Durée prévue : ${R.phaseTargets[s]} j${over ? ` · <span class="t-bad strong">${over} au-delà</span>` : ''}</span></button>`;
    }).join('');
    const stage = EH.f('inc.stage', '');
    const rows = ents.filter((x) => !stage || x.e.stage === stage).map(({ e, p, ex }) => {
      const dels = d.deliverables.filter((x) => x.entrepreneur === e.id && x.stage === e.stage);
      const delOk = dels.filter((x) => x.status === 'validated' || x.status === 'submitted').length;
      const exOpen = ex.filter((x) => x.status !== 'validated').length, exDone = ex.filter((x) => x.status === 'validated').length;
      return { cells: [
        `${EH.entLink(e)}<span class="sub truncate" style="max-width:260px">${esc(e.idea)}</span>`,
        C.stageBadge(e.stage),
        `<span class="nowrap">${EH.fmtDate(p.since)}</span><span class="sub">${EH.plural(p.days, 'jour')}</span>`,
        `<span class="phase-meter" title="${p.days} jours sur ${p.target} prévus"><span class="meter wide" aria-hidden="true"><span class="fill ${p.over ? 'bad' : p.pct >= 80 ? 'warn' : ''}" style="width:${Math.min(100, Math.max(2, p.pct))}%"></span></span><span class="xs ${p.over ? 't-bad strong' : 'muted'}">J${EH.NBSP}${p.days} / ${p.target}${p.over ? ' · dépassé' : ''}</span></span>`,
        dels.length ? `<span class="num">${delOk}/${dels.length}</span>` : '<span class="muted">—</span>',
        ex.length ? `<span class="num">${exDone}/${ex.length}</span>${exOpen ? `<span class="sub">${exOpen} en cours</span>` : ''}` : '<span class="muted">—</span>',
        C.btn('', { action: 'give-exercise', data: { id: e.id }, icon: 'plus', size: 'sm', title: `Donner un exercice à ${e.name}` }) + ' ' + C.btn('', { action: 'change-stage', data: { id: e.id }, icon: 'arrowRight', size: 'sm', title: `Changer l'étape de ${e.name}` })
      ] };
    });
    return `<div class="phase-cards" role="group" aria-label="Filtrer par phase">${cards}</div>` +
      C.table({ caption: 'Suivi des phases d’incubation', cols: [{ label: 'Entrepreneur' }, { label: 'Phase' }, { label: 'Depuis', cls: 'hide-sm' }, { label: 'Avancement de la phase' }, { label: 'Livrables', cls: 'num hide-md' }, { label: 'Exercices', cls: 'num hide-sm' }, { label: '', cls: 'actions' }], rows, empty: C.empty({ icon: 'users', tone: '', title: 'Aucun entrepreneur dans cette phase' }) });
  };

  /* ---------- 2. exercises ---------- */
  const exerciseRow = (d, x) => {
    const e = Q.ent(d, x.entrepreneurId), late = Q.exerciseLate(x);
    return `<div class="list-row">${C.ico('edit', x.status === 'submitted' ? 'accent' : late ? 'bad' : x.status === 'validated' ? 'ok' : x.status === 'returned' ? 'warn' : 'info')}
      <div class="body"><button type="button" class="link-btn title" ${C.on('open-exercise', { id: x.id })}>${esc(x.title)}</button>
      <div class="meta">${esc(e.name)}${e.portal ? '' : ' · espace non activé'} · donné le ${EH.fmtDate(x.givenAt)} · <span class="${late ? 't-bad strong' : ''}">échéance ${EH.fmtDate(x.due)}</span></div></div>
      <div class="row-actions">${exBadge(x)}${C.btn(x.status === 'submitted' ? 'Examiner' : 'Ouvrir', { action: 'open-exercise', data: { id: x.id }, size: 'sm', variant: x.status === 'submitted' ? 'primary' : '' })}</div></div>`;
  };
  const exercises = (d, c) => {
    const all = (d.exercises || []).filter((x) => x.centre === c), f = EH.f('inc.ex', 'open');
    const list = all.filter((x) => f === 'all' || (f === 'open' ? x.status !== 'validated' : x.status === 'validated')).sort((a, b) => exRank(a) - exRank(b) || (a.due < b.due ? -1 : 1));
    const seg = C.seg('inc.ex', [{ value: 'open', label: 'En cours', count: all.filter((x) => x.status !== 'validated').length }, { value: 'done', label: 'Validés', count: all.filter((x) => x.status === 'validated').length }, { value: 'all', label: 'Tous', count: all.length }], f, 'Filtrer les exercices');
    return `<div class="toolbar" style="padding:var(--s-3) var(--s-4) 0">${seg}<span class="spacer"></span>${C.btn('Donner un exercice', { action: 'give-exercise', icon: 'plus', variant: 'primary', size: 'sm' })}</div>
      <p class="muted xs" style="padding:4px var(--s-4) 8px">Chaque exercice devient une action dans l’espace du bénéficiaire. Il le rend en ligne, vous le validez ou le renvoyez.</p>
      ${list.length ? list.map((x) => exerciseRow(d, x)).join('') : C.empty({ icon: 'edit', tone: '', title: 'Aucun exercice', text: 'Donnez un exercice pour faire avancer un projet entre deux séances.', action: C.btn('Donner un exercice', { action: 'give-exercise', icon: 'plus' }) })}`;
  };

  /* ---------- 3. funders ---------- */
  const funders = (d, c) => {
    const list = Q.centreFunders(d, c);
    const total = (d.fundings || []).filter((f) => f.centre === c).reduce((n, f) => n + (f.amount || 0), 0);
    const cards = list.map(({ partner: p, programmes, collaborations, projects }) => `<article class="funder">
      <div class="funder-head">${C.ico('handshake', 'accent')}<div class="body"><div class="title">${esc(p.name)}</div><div class="meta">${esc(p.type)} · ${esc(p.region)}${p.contact ? ' · ' + esc(p.contact) : ''}</div></div>
        ${C.btn('Lier un projet', { action: 'add-funding', data: { partner: p.id }, icon: 'link', size: 'sm' })}</div>
      ${programmes.length || collaborations.length ? `<div class="funder-progs">${programmes.map((x) => `<span class="chip">${I('layers')} ${esc(x.name)} · jusqu’au ${EH.fmtDate(x.end)}</span>`).join('')}${collaborations.filter((cb) => !programmes.some((x) => x.id === cb.programme)).map((cb) => `<span class="chip">${I('layers')} ${esc((Q.programme(d, cb.programme) || {}).name || '')} · financement</span>`).join('')}</div>` : ''}
      ${projects.length ? `<ul class="funder-projects">${projects.map(({ funding: f, ent: e }) => `<li><div>${EH.entLink(e)}<span class="sub">${esc(e.idea)} · ${C.stageBadge(e.stage)}</span></div><div class="right"><b class="num">${f.amount ? money(f.amount) : '—'}</b><span class="sub">${esc(f.kind)} · ${EH.fmtDate(f.date)}</span></div></li>`).join('')}</ul>` : '<p class="muted small" style="padding:0 var(--s-4) var(--s-3)">Aucun projet de votre centre lié à ce bailleur.</p>'}
    </article>`).join('');
    return `<div class="toolbar" style="padding:var(--s-3) var(--s-4) 0"><span class="small">${EH.plural(list.length, 'bailleur')} · ${EH.plural((d.fundings || []).filter((f) => f.centre === c).length, 'projet financé', 'projets financés')}${total ? ' · ' + money(total) + ' mobilisés' : ''}</span><span class="spacer"></span>${C.btn('Lier un financement', { action: 'add-funding', icon: 'link', size: 'sm', variant: 'primary' })}</div>
      <div class="funders">${cards || C.empty({ icon: 'handshake', tone: '', title: 'Aucun bailleur de fonds', text: 'Ajoutez un partenaire de type Financeur dans l’annuaire.' })}</div>`;
  };

  /** Panel shown on "Aujourd'hui". */
  EH.incubationPanel = () => {
    const d = S.data, c = S.scope(), tab = EH.f('td.inc', 'phases');
    const submitted = (d.exercises || []).filter((x) => x.centre === c && x.status === 'submitted').length;
    const seg = C.seg('td.inc', [{ value: 'phases', label: 'Phases' }, { value: 'exercices', label: 'Exercices', count: submitted || null }, { value: 'bailleurs', label: 'Bailleurs de fonds' }], tab, 'Vue incubation');
    const body = tab === 'exercices' ? exercises(d, c) : tab === 'bailleurs' ? funders(d, c) : phases(d, c);
    return C.panel({ title: 'Incubation', id: 'incubation', actions: seg, body });
  };

  /* ---------- drawers ---------- */
  EH.drawers.exercise = (st) => {
    const d = S.data, c = S.scope(), v = st.values, er = st.errors;
    const ents = d.entrepreneurs.filter((e) => e.centre === c && R.activeStages.includes(e.stage)).sort((a, b) => (b.portal ? 1 : 0) - (a.portal ? 1 : 0) || a.name.localeCompare(b.name));
    const chosen = v.entrepreneurs || (st.entId ? [st.entId] : []);
    const body = `${C.formError(er)}<div class="form-grid">
      ${C.field({ name: 'title', label: 'Titre de l’exercice', required: true, value: v.title, error: er.title, full: true, autofocus: true, placeholder: 'Ex. : Interviewer cinq clients potentiels' })}
      ${C.field({ name: 'instructions', label: 'Consigne', type: 'textarea', rows: 4, required: true, value: v.instructions, error: er.instructions, full: true, placeholder: 'Ce qu’il faut faire, le livrable attendu, les ressources à utiliser.' })}
      ${C.field({ name: 'due', label: 'Échéance', type: 'date', required: true, value: v.due || EH.addDays(EH.TODAY, 7), error: er.due, min: EH.TODAY })}
      ${C.checks({ name: 'entrepreneurs', label: 'Bénéficiaires', values: chosen, error: er.entrepreneurs, options: ents.map((e) => ({ value: e.id, label: e.name, meta: `${EH.stageLabel(e.stage)}${e.portal ? ' · reçoit l’action dans son espace' : ' · espace non activé : à transmettre en séance'}` })) })}
    </div>`;
    return C.drawer({ title: 'Donner un exercice', sub: 'Il apparaît comme une action à faire dans l’espace du bénéficiaire.', form: 'exercise', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn('Donner l’exercice', { type: 'submit', variant: 'primary', icon: 'send' }) });
  };

  const answerBlock = (x) => (x.status === 'submitted' || x.status === 'validated' || (x.status === 'returned' && x.answer)
    ? `<div class="section"><h3>Réponse du bénéficiaire${x.submittedAt ? ` <span class="muted xs">· rendue le ${EH.fmtDateTime(x.submittedAt)}</span>` : ''}</h3><p class="small pre">${esc(x.answer)}</p>${x.link ? `<p class="small"><a href="${esc(x.link)}" target="_blank" rel="noopener">${I('link')} ${esc(x.link)}</a></p>` : ''}</div>` : '');

  EH.drawers.exerciseView = (st) => {
    const d = S.data, x = (d.exercises || []).find((y) => y.id === st.id);
    if (!x) return C.drawer({ title: 'Exercice introuvable', body: C.empty({ icon: 'search', tone: '', title: 'Cet exercice n’existe plus' }) });
    const e = Q.ent(d, x.entrepreneurId), w = S.can.writeOperational(x.centre);
    const body = `${C.formError(st.errors)}
      ${x.status === 'returned' ? C.callout('warn', `<b>Renvoyé :</b> ${esc(x.reviewComment)}`) : ''}
      ${x.status === 'validated' ? C.callout('ok', `Validé le ${EH.fmtDateTime(x.reviewedAt)}${x.reviewComment ? ' · ' + esc(x.reviewComment) : ''}`) : ''}
      <div class="section"><h3>Consigne</h3><p class="small pre">${esc(x.instructions)}</p>
      <dl class="dl"><dt>Bénéficiaire</dt><dd>${EH.entLink(e)} · ${C.stageBadge(e.stage)}</dd><dt>Donné le</dt><dd>${EH.fmtDateY(x.givenAt)}</dd><dt>Échéance</dt><dd class="${Q.exerciseLate(x) ? 't-bad strong' : ''}">${EH.fmtDateY(x.due)}${Q.exerciseLate(x) ? ' · en retard' : ''}</dd><dt>Statut</dt><dd>${exBadge(x)}</dd></dl></div>
      ${answerBlock(x)}
      ${!e.portal && x.status !== 'validated' ? C.callout('info', 'Espace bénéficiaire non activé : vérifiez l’exercice en séance puis validez-le ici.') : ''}
      ${st.mode === 'return' ? `<div class="section">${C.field({ name: 'reason', label: 'Ce qui doit être repris', type: 'textarea', required: true, error: st.errors.reason, value: st.values.reason, autofocus: true, help: 'Le bénéficiaire verra ce commentaire et pourra rendre l’exercice à nouveau.' })}<input type="hidden" name="version" value="${x.version}"></div>` : ''}`;
    let foot = '';
    if (w && x.status === 'submitted') foot = st.mode === 'return'
      ? C.btn('Annuler', { action: 'exercise-mode', data: { mode: '' } }) + C.btn('Renvoyer', { type: 'submit', variant: 'danger', icon: 'undo' })
      : `<span class="left">${C.btn('À reprendre', { action: 'exercise-mode', data: { mode: 'return' }, icon: 'undo' })}</span>` + C.btn('Valider', { action: 'review-exercise', data: { id: x.id, version: x.version }, variant: 'primary', icon: 'check' });
    else if (w && !e.portal && x.status !== 'validated') foot = C.btn('Marquer comme fait et valider', { action: 'review-exercise', data: { id: x.id, version: x.version }, variant: 'primary', icon: 'check' });
    return C.drawer({ title: esc(x.title), sub: `Exercice · ${esc(e.name)}`, body, foot, form: st.mode === 'return' ? 'exercise-return' : null });
  };

  /** Beneficiary: read the instructions and hand the exercise in. */
  EH.drawers.myExercise = (st) => {
    const me = S.ownEnt(), x = (S.data.exercises || []).find((y) => y.id === st.id);
    if (!me || !x || x.entrepreneurId !== me.id) return C.drawer({ title: 'Accès refusé', body: C.empty({ icon: 'shield', tone: 'bad', title: 'Accès refusé', text: 'Cet exercice ne fait pas partie de votre parcours.' }) });
    const editable = x.status === 'todo' || x.status === 'returned', v = Object.assign({ answer: x.answer, link: x.link }, st.values);
    const body = `${C.formError(st.errors)}
      ${x.status === 'returned' ? C.callout('warn', `<b>À reprendre :</b> ${esc(x.reviewComment)}`) : ''}
      ${x.status === 'submitted' ? C.callout('info', `Rendu le ${EH.fmtDateTime(x.submittedAt)}. Votre chargé de programme va le relire.`) : ''}
      ${x.status === 'validated' ? C.callout('ok', `Validé par votre chargé de programme${x.reviewComment ? ' : ' + esc(x.reviewComment) : '.'}`) : ''}
      <div class="section"><h3>Consigne</h3><p class="pre">${esc(x.instructions)}</p><p class="small ${Q.exerciseLate(x) ? 't-bad strong' : 'muted'}">À rendre le ${EH.fmtDateY(x.due)}${Q.exerciseLate(x) ? ' · en retard' : ''}</p></div>
      ${editable ? `<div class="section"><input type="hidden" name="version" value="${x.version}">
        ${C.field({ name: 'answer', label: 'Ce que j’ai fait', type: 'textarea', rows: 6, required: true, value: v.answer, error: st.errors.answer, autofocus: true, help: 'Résultats, chiffres, difficultés rencontrées.' })}
        <div style="height:12px"></div>${C.field({ name: 'link', label: 'Lien vers un document (facultatif)', type: 'url', value: v.link, error: st.errors.link, placeholder: 'https://…' })}</div>` : answerBlock(x)}`;
    return C.drawer({ title: esc(x.title), sub: 'Exercice donné par votre chargé de programme', body, form: editable ? 'my-exercise' : null,
      foot: editable ? C.btn('Annuler', { action: 'close-drawer' }) + C.btn('Rendre l’exercice', { type: 'submit', variant: 'primary', icon: 'send' }) : C.btn('Fermer', { action: 'close-drawer' }) });
  };

  EH.modals.funding = (m) => {
    const d = S.data, c = S.scope(), v = m.values, er = m.errors;
    const fs = Q.centreFunders(d, c).map((x) => x.partner);
    const ents = d.entrepreneurs.filter((e) => e.centre === c && e.stage !== 'candidat' && e.stage !== 'abandon').sort((a, b) => a.name.localeCompare(b.name));
    return C.modal({ title: 'Lier un financement à un projet', form: 'funding', body: `${C.formError(er)}<div class="form-grid">
      ${C.field({ name: 'partner', label: 'Bailleur de fonds', type: 'select', required: true, full: true, value: v.partner || m.partner, error: er.partner, options: [{ value: '', label: 'Choisir…' }, ...fs.map((p) => ({ value: p.id, label: p.name }))] })}
      ${C.field({ name: 'entrepreneur', label: 'Projet', type: 'select', required: true, full: true, value: v.entrepreneur || m.entId, error: er.entrepreneur, options: [{ value: '', label: 'Choisir…' }, ...ents.map((e) => ({ value: e.id, label: `${e.name} · ${e.idea}` }))] })}
      ${C.field({ name: 'kind', label: 'Type', type: 'select', required: true, value: v.kind, error: er.kind, options: ['', ...R.fundingKinds] })}
      ${C.field({ name: 'amount', label: 'Montant (DT)', type: 'number', value: v.amount, error: er.amount, min: 0 })}
      ${C.field({ name: 'date', label: 'Date d’accord', type: 'date', required: true, value: v.date || EH.TODAY, error: er.date })}
      ${C.field({ name: 'note', label: 'Objet', value: v.note, placeholder: 'Ex. : achat du matériel' })}
    </div>`, foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn('Lier le financement', { type: 'submit', variant: 'primary', icon: 'link' }) });
  };

  /* ---------- actions & forms ---------- */
  Object.assign(EH.actions, {
    'give-exercise': (el) => { if (!S.isOfficer()) return; EH.openDrawer('exercise', { entId: el && el.dataset ? el.dataset.id : null }); },
    'open-exercise': (el) => EH.openDrawer('exerciseView', { id: el.dataset.id }),
    'exercise-mode': (el) => { const st = EH.ui.drawer; st.mode = el.dataset.mode; st.errors = {}; EH.renderOverlays(true); },
    'review-exercise': (el) => {
      const res = EH.act.reviewExercise(el.dataset.id, 'validate', '', el.dataset.version);
      if (!res.ok) return EH.toast(res.errors._, { tone: 'error' });
      EH.closeDrawer(); EH.render(); EH.toast('Exercice validé.');
    },
    'add-funding': (el) => { if (!S.isOfficer()) return; EH.openModal('funding', { partner: el && el.dataset ? el.dataset.partner : null, entId: el && el.dataset ? el.dataset.ent : null }); },
    'my-open-exercise': (el) => EH.openDrawer('myExercise', { id: el.dataset.id })
  });
  EH.forms.exercise = (v) => {
    const st = EH.ui.drawer; st.values = v;
    EH.handle(EH.act.giveExercise(v), st, (r) => {
      EH.closeDrawer(); EH.render();
      const portal = r.items.filter((x) => Q.ent(S.data, x.entrepreneurId).portal).length;
      EH.toast(`Exercice donné à ${EH.plural(r.items.length, 'bénéficiaire')}${portal ? ` · ${portal} le ${portal > 1 ? 'voient' : 'voit'} dans son espace` : ''}.`);
    });
  };
  EH.forms['exercise-return'] = (v) => {
    const st = EH.ui.drawer; st.values = v;
    EH.handle(EH.act.reviewExercise(st.id, 'return', v.reason, v.version), st, () => { EH.closeDrawer(); EH.render(); EH.toast('Exercice renvoyé avec votre commentaire.'); });
  };
  EH.forms['my-exercise'] = (v) => {
    const st = EH.ui.drawer; st.values = v;
    EH.handle(EH.act.submitExercise(st.id, v, v.version), st, () => { EH.closeDrawer(); EH.render(); EH.toast('Exercice rendu : votre chargé de programme va le relire.'); });
  };
  EH.forms.funding = (v) => {
    const m = EH.ui.modal; m.values = v;
    const res = EH.act.addFunding(v);
    if (res.ok) { EH.closeModal(); EH.render(); if (EH.ui.drawer) EH.renderOverlays(); EH.toast(`Financement lié : ${esc(Q.partner(S.data, res.item.partner).name)} → ${esc(Q.ent(S.data, res.item.entrepreneurId).name)}.`); }
    else { m.errors = res.errors; EH.renderOverlays(true); }
  };

  /** Blocks for the entrepreneur profile. */
  EH.entIncubationBlocks = (d, e) => {
    const w = S.can.writeOperational(e.centre), ex = Q.exercisesOf(d, e.id).sort((a, b) => exRank(a) - exRank(b));
    const fu = (d.fundings || []).filter((f) => f.entrepreneurId === e.id);
    const exHtml = ex.length ? `<div class="panel">${ex.map((x) => `<div class="list-row">${C.ico('edit', Q.exerciseLate(x) ? 'bad' : x.status === 'validated' ? 'ok' : 'info')}<div class="body"><button type="button" class="link-btn" ${C.on('open-exercise', { id: x.id })}>${esc(x.title)}</button><div class="meta">Échéance ${EH.fmtDate(x.due)}</div></div><div class="row-actions">${exBadge(x)}</div></div>`).join('')}</div>` : '<p class="muted small">Aucun exercice donné.</p>';
    const fuHtml = fu.length ? `<div class="panel">${fu.map((f) => `<div class="list-row">${C.ico('handshake', 'accent')}<div class="body"><div class="title">${esc((Q.partner(d, f.partner) || {}).name || '—')}</div><div class="meta">${esc(f.kind)} · ${EH.fmtDate(f.date)}${f.note ? ' · ' + esc(f.note) : ''}</div></div><div class="row-actions"><b class="num">${f.amount ? money(f.amount) : '—'}</b></div></div>`).join('')}</div>` : '<p class="muted small">Aucun bailleur lié à ce projet.</p>';
    return `<div class="section"><h3>Exercices <span class="muted num">${ex.length}</span>${w && R.activeStages.includes(e.stage) ? ' ' + C.btn('Donner un exercice', { action: 'give-exercise', data: { id: e.id }, icon: 'plus', size: 'sm' }) : ''}</h3>${exHtml}</div>
      <div class="section"><h3>Bailleurs de fonds <span class="muted num">${fu.length}</span>${w && e.stage !== 'candidat' && e.stage !== 'abandon' ? ' ' + C.btn('Lier un financement', { action: 'add-funding', data: { ent: e.id }, icon: 'link', size: 'sm' }) : ''}</h3>${fuHtml}</div>`;
  };
  EH.exerciseBadge = exBadge;
})();
