/* Programmes (FR-01-01, FR-01-02): one framework, assigned to centres with a responsible officer. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF;

  const progress = (p) => {
    const tot = EH.days(p.start, p.end), done = Math.min(Math.max(EH.days(p.start, EH.TODAY), 0), tot);
    return Math.round((100 * done) / tot);
  };

  EH.pages.programmes = {
    label: 'Programmes', icon: 'layers',
    render() {
      const d = S.data, sc = S.scope();
      const list = d.programmes.filter((p) => !sc || p.centres.some((c) => c.centre === sc));
      const rows = list.map((p) => {
        const acts = d.activities.filter((a) => a.programme === p.id && (!sc || a.centre === sc));
        const done = acts.filter((a) => a.status === 'done').length;
        const pr = progress(p);
        return { cls: 'clickable', attrs: `${C.on('open-programme', { id: p.id })} tabindex="0"`, cells: [
          `<button class="link-btn" ${C.on('open-programme', { id: p.id })}>${esc(p.name)}</button><span class="sub">${esc(p.type)}</span>`,
          `<span class="nowrap">${EH.fmtDateY(p.start)} → ${EH.fmtDateY(p.end)}</span><div class="stagebar" style="margin-top:4px;max-width:160px" role="img" aria-label="${pr} % de la durée écoulée"><span style="width:${pr}%;background:var(--stage-3)"></span></div>`,
          esc(EH.partnerName(p.funder) || '—'),
          p.centres.length === 6 ? '6 centres' : esc(p.centres.map((c) => Q.centreName(d, c.centre)).join(', ')),
          `<span class="num">${done}/${acts.length}</span>`
        ] };
      });
      return C.pageHead('Programmes', S.isPmo() ? 'Le cadre commun : objectifs, dates, financeur et indicateurs, affecté aux centres avec un responsable.' : 'Les programmes affectés à votre centre. Vos activités s\'y rattachent.', S.isPmo() ? C.btn('Nouveau programme', { action: 'new-programme', icon: 'plus', variant: 'primary' }) : '') +
        C.panel({ body: C.table({ caption: 'Programmes', cols: [{ label: 'Programme' }, { label: 'Période' }, { label: 'Financeur', cls: 'hide-md' }, { label: 'Centres', cls: 'hide-sm' }, { label: 'Activités réalisées', cls: 'num' }], rows, empty: C.empty({ icon: 'layers', tone: '', title: 'Aucun programme', text: S.isPmo() ? 'Créez le premier programme.' : 'Aucun programme n\'est encore affecté à votre centre.' }) }) });
    }
  };

  EH.drawers.programme = (st) => {
    const d = S.data, p = Q.programme(d, st.id), sc = S.scope();
    const rows = p.centres.filter((c) => !sc || c.centre === sc).map((pc) => {
      const acts = d.activities.filter((a) => a.programme === p.id && a.centre === pc.centre);
      return { cells: [esc(Q.centreName(d, pc.centre)), esc(Q.user(d, pc.officer).name), `<span class="num">${acts.filter((a) => a.status === 'done').length}/${acts.length}</span>`, `<span class="num">${acts.filter((a) => a.status === 'planned' && a.date >= EH.TODAY).length}</span>`] };
    });
    const body = `<p>${esc(p.objectives || '')}</p>
      <dl class="dl"><dt>Type</dt><dd>${esc(p.type)}</dd><dt>Période</dt><dd>${EH.fmtDateY(p.start)} → ${EH.fmtDateY(p.end)} · ${progress(p)}${EH.NBSP}% écoulé</dd><dt>Financeur</dt><dd>${esc(EH.partnerName(p.funder) || '—')}</dd>
      <dt>Indicateurs suivis</dt><dd>${p.indicators.length ? p.indicators.map((k) => C.badge(R.kpis[k].label, 'outline')).join(' ') : '—'}</dd></dl>
      <div class="section"><h3>Centres et responsables</h3><div class="panel">${C.table({ cols: [{ label: 'Centre' }, { label: 'Responsable' }, { label: 'Réalisées', cls: 'num' }, { label: 'À venir', cls: 'num' }], rows })}</div></div>`;
    const tpl = Q.requirement(d, 'programme', p.id), real = tpl && tpl.format !== 'none';
    const acts = d.activities.filter((a) => a.programme === p.id && (!sc || a.centre === sc));
    const origin = EH.groupCount(acts, (a) => Q.requirementOrigin(d, a));
    const tplBody = real
      ? `<dl class="dl"><dt>Format</dt><dd>${esc(Q.formatLabel(tpl.format))}${tpl.format === 'form' ? ` · ${EH.plural(tpl.fields.length, 'question')}` : ''}</dd><dt>Échéance</dt><dd>${tpl.dueDays} jours après l'activité</dd><dt>Obligatoire</dt><dd>${tpl.mandatory ? 'Oui' : 'Non'}</dd><dt>Commentaire visible</dt><dd>${tpl.feedbackVisible ? 'Oui' : 'Non'}</dd><dt>Version</dt><dd>v${tpl.version}</dd></dl>`
      : `<p class="muted small">Aucun modèle : les activités de ce programme n'ont pas de rapport par défaut.</p>`;
    const tplSection = `<div class="section"><h3>Rapport demandé par défaut</h3>${tplBody}<p class="muted xs" style="margin-top:6px">${EH.plural(origin.inherited || 0, 'activité')} héritent du modèle · ${EH.plural(origin.override || 0, 'activité')} personnalisée${(origin.override || 0) > 1 ? 's' : ''} · ${EH.plural(origin.none || 0, 'activité')} sans rapport</p>${S.can.manageTemplates() ? `<div style="margin-top:8px">${C.btn('Modifier le modèle de rapport', { action: 'edit-programme-req', data: { id: p.id }, icon: 'edit', size: 'sm' })}</div>` : ''}</div>`;
    return C.drawer({ title: esc(p.name), sub: esc(p.type), body: body + tplSection, tools: C.btn('Voir les activités', { action: 'go', data: { route: 'activites', filters: JSON.stringify({ 'act.prog': p.id }) }, icon: 'calendar' }) });
  };

  EH.drawers.programmeForm = (st) => {
    const d = S.data, v = st.values, er = st.errors;
    const body = `${C.formError(er)}<div class="form-grid">
      ${C.field({ name: 'name', label: 'Nom', required: true, value: v.name, error: er.name, full: true, autofocus: true })}
      ${C.field({ name: 'type', label: 'Type', type: 'select', required: true, value: v.type, error: er.type, options: ['', ...R.programmeTypes] })}
      ${C.field({ name: 'funder', label: 'Financeur', type: 'select', value: v.funder, options: [{ value: '', label: 'Aucun' }, ...d.partners.filter((p) => p.type === 'Financeur').map((p) => ({ value: p.id, label: p.name }))] })}
      ${C.field({ name: 'start', label: 'Début', type: 'date', required: true, value: v.start, error: er.start })}
      ${C.field({ name: 'end', label: 'Fin', type: 'date', required: true, value: v.end, error: er.end })}
      ${C.field({ name: 'objectives', label: 'Objectifs', type: 'textarea', rows: 2, value: v.objectives, full: true })}
      ${C.checks({ name: 'centres', label: 'Centres (le chargé du centre devient responsable)', grid: true, values: v.centres || [], error: er.centres, options: d.centres.map((c) => ({ value: c.id, label: c.name, meta: Q.user(d, c.officer).name })) })}
      ${C.checks({ name: 'indicators', label: 'Indicateurs suivis dans le rapport', grid: true, values: v.indicators || ['active', 'execution'], options: Object.entries(R.kpis).map(([k, x]) => ({ value: k, label: x.label })) })}
    </div>`;
    return C.drawer({ title: 'Nouveau programme', sub: 'Il apparaîtra chez les chargés des centres choisis', form: 'programme', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn('Créer le programme', { type: 'submit', variant: 'primary' }), wide: true });
  };
  EH.forms.programme = (v) => {
    const st = EH.ui.drawer;
    st.values = v;
    const res = EH.act.createProgramme(v);
    EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(`« ${esc(r.item.name)} » créé et affecté à ${EH.plural(r.item.centres.length, 'centre')}.`); });
  };

  EH.drawers.programmeReq = (st) => {
    const p = Q.programme(S.data, st.id);
    if (!p || !S.can.manageTemplates()) return C.drawer({ title: 'Accès refusé', body: EH.denied('Ce modèle de rapport') });
    if (!st.reqInit) { EH.req.init(st, 'programme', p.id); st.reqInit = true; }
    const body = `${C.formError(st.errors)}<p class="small">Ce modèle est hérité par les activités du programme. Chaque chargé peut le personnaliser pour une activité. Une modification crée une nouvelle version : les rapports déjà remis restent attachés à celle à laquelle ils répondent.</p><div class="form-grid">${EH.req.section(st, 'programme')}</div>`;
    return C.drawer({ title: 'Modèle de rapport', sub: esc(p.name), form: 'programme-req', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn('Enregistrer', { type: 'submit', variant: 'primary' }), wide: true });
  };
  EH.forms['programme-req'] = (v) => {
    const st = EH.ui.drawer;
    EH.req.sync(st, v);
    const res = EH.act.saveRequirement('programme', st.id, EH.req.parse(v, 'programme'), EH.req.base(v));
    EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(r.changed ? `Modèle de rapport enregistré (version ${r.item.version}).` : 'Aucun changement.'); });
  };

  Object.assign(EH.actions, {
    'edit-programme-req': (el) => { if (S.can.manageTemplates()) EH.openDrawer('programmeReq', { id: el.dataset.id }); },
    'open-programme': (el) => EH.openDrawer('programme', { id: el.dataset.id }),
    'new-programme': () => { if (S.isPmo()) EH.openDrawer('programmeForm', {}); }
  });
})();
