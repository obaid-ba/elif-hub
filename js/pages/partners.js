/* Partners and ecosystem (FR-05): shared directory, duplicate check, collaborations, contributions. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF;

  EH.pages.partenaires = {
    label: 'Partenaires', icon: 'handshake',
    render() {
      const d = S.data;
      const q = EH.norm(EH.f('pa.q', '')), type = EH.f('pa.type', ''), centre = EH.f('pa.centre', S.isPmo() ? '' : '');
      const base = d.partners.filter((p) => !q || EH.norm(p.name + ' ' + p.contact + ' ' + p.region).includes(q)).filter((p) => !centre || Q.partnerCentres(d, p.id).includes(centre));
      const counts = EH.groupCount(base, (p) => p.type);
      const list = base.filter((p) => !type || p.type === type).sort((a, b) => a.name.localeCompare(b.name));
      const rows = list.map((p) => {
        const x = Q.partnerActivity(d, p.id), last = Q.partnerLastInteraction(d, p.id), active = Q.partnerActive(d, p.id);
        const cs = Q.partnerCentres(d, p.id);
        return { cls: 'clickable', attrs: `${C.on('open-partner', { id: p.id })} tabindex="0"`, cells: [
          `<button class="link-btn" ${C.on('open-partner', { id: p.id })}>${esc(p.name)}</button><span class="sub">${esc(p.contact)}</span>`,
          esc(p.type), esc(p.region),
          cs.length === 6 ? '6 centres' : cs.length ? esc(cs.map((c) => Q.centreName(d, c)).join(', ')) : '<span class="muted">—</span>',
          `<span class="num">${x.activities.length + x.sessions.length}</span>`,
          last ? EH.relDays(last) : '<span class="muted">Jamais</span>',
          active ? C.badge('Actif', 'ok') : C.badge('Inactif', 'warn')
        ] };
      });
      const seg = C.seg('pa.type', [{ value: '', label: 'Tous', count: base.length }, ...R.partnerTypes.filter((t) => counts[t]).map((t) => ({ value: t, label: t, count: counts[t] }))], type, 'Type');
      return C.pageHead('Partenaires', 'Annuaire partagé par les six centres : une seule fiche par partenaire, ses contributions sont comptées automatiquement.', C.btn('Ajouter un partenaire', { action: 'new-partner', icon: 'plus', variant: 'primary' })) +
        `<div class="toolbar">${C.search('pa.q', 'Rechercher un partenaire…', EH.f('pa.q', ''))}${C.filterSelect('pa.centre', 'Centre', EH.centreOptions(), centre)}</div><div class="toolbar" style="overflow-x:auto">${seg}</div>` +
        C.panel({ body: C.table({ caption: 'Annuaire des partenaires', cols: [{ label: 'Partenaire' }, { label: 'Type', cls: 'hide-sm' }, { label: 'Région', cls: 'hide-md' }, { label: 'Centres', cls: 'hide-md' }, { label: 'Interventions', cls: 'num' }, { label: 'Dernière interaction', cls: 'hide-sm' }, { label: 'Statut' }], rows, empty: C.empty({ icon: 'search', tone: '', title: 'Aucun partenaire', text: 'Aucun résultat. Vérifiez l\'orthographe, puis ajoutez-le s\'il n\'existe pas.', action: C.btn('Ajouter un partenaire', { action: 'new-partner', icon: 'plus' }) }) }), foot: `<span class="muted xs">Inactif : aucune interaction depuis ${R.INACTIVE_MONTHS} mois (BR-05-02, à confirmer).</span>` });
    }
  };

  EH.drawers.partner = (st) => {
    const d = S.data, p = Q.partner(d, st.id);
    const x = Q.partnerActivity(d, p.id);
    const byCentre = {};
    [...x.activities.map((a) => ({ c: a.centre, k: 'a' })), ...x.sessions.map((s) => ({ c: s.centre, k: 's' }))].forEach(({ c, k }) => { byCentre[c] = byCentre[c] || { a: 0, s: 0 }; byCentre[c][k]++; });
    const v = st.values, er = st.errors;
    const scopeC = S.scope();
    const collabForm = st.addCollab ? `<form data-form="collab" novalidate class="panel" style="padding:var(--s-4)"><div class="form-grid">
        ${C.formError(er)}
        ${C.field({ name: 'centre', label: 'Centre', type: 'select', required: true, value: v.centre || scopeC || '', error: er.centre, options: S.isPmo() ? [{ value: '', label: 'Choisir…' }, { value: 'all', label: 'Tous les centres' }, ...d.centres.map((c) => ({ value: c.id, label: c.name }))] : [{ value: scopeC, label: Q.centreName(d, scopeC) }] })}
        ${C.field({ name: 'programme', label: 'Programme', type: 'select', required: true, value: v.programme, error: er.programme, options: EH.programmeOptions(scopeC, 'Choisir…') })}
        ${C.field({ name: 'contribution', label: 'Contribution', type: 'select', required: true, value: v.contribution, error: er.contribution, options: ['', ...R.contributionTypes] })}
        ${C.field({ name: 'start', label: 'Début', type: 'date', required: true, value: v.start || EH.TODAY, error: er.start })}
        ${C.field({ name: 'end', label: 'Fin', type: 'date', value: v.end, error: er.end })}
      </div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">${C.btn('Annuler', { action: 'collab-toggle' })}${C.btn('Enregistrer la collaboration', { type: 'submit', variant: 'primary' })}</div></form>` : '';
    const body = `
      <dl class="dl"><dt>Type</dt><dd>${esc(p.type)}</dd><dt>Région</dt><dd>${esc(p.region)}</dd><dt>Contact</dt><dd>${esc(p.contact)}<br>${esc(p.phone)}<br>${esc(p.email)}</dd>
      <dt>Statut</dt><dd>${Q.partnerActive(d, p.id) ? C.badge('Actif', 'ok') : C.badge('Inactif', 'warn')}</dd></dl>
      <div class="section"><h3>Collaborations <span class="muted num">${x.collaborations.length}</span>${st.addCollab ? '' : C.btn('Ajouter', { action: 'collab-toggle', icon: 'plus', size: 'sm' })}</h3>${collabForm}
        ${x.collaborations.length ? `<div class="panel">${x.collaborations.map((c) => `<div class="list-row">${C.ico('handshake', c.status === 'active' ? 'ok' : '')}<div class="body"><div class="title">${esc(c.contribution)} · ${esc((Q.programme(d, c.programme) || {}).name || '')}</div><div class="meta">${esc(Q.centreName(d, c.centre))} · ${EH.fmtDateY(c.start)} → ${c.end ? EH.fmtDateY(c.end) : 'en cours'}</div></div>${c.status === 'active' ? C.badge('En cours', 'ok') : C.badge('Terminée', 'outline')}</div>`).join('')}</div>` : (st.addCollab ? '' : '<p class="muted small">Aucune collaboration enregistrée.</p>')}</div>
      <div class="section"><h3>Contributions par centre</h3>${Object.keys(byCentre).length ? C.table({ cols: [{ label: 'Centre' }, { label: 'Activités animées', cls: 'num' }, { label: 'Séances', cls: 'num' }], rows: Object.entries(byCentre).map(([c, n]) => ({ cells: [esc(Q.centreName(d, c)), `<span class="num">${n.a}</span>`, `<span class="num">${n.s}</span>`] })) }) : '<p class="muted small">Aucune intervention enregistrée.</p>'}</div>
      ${x.activities.length ? `<div class="section"><h3>Dernières activités animées</h3><div class="panel">${x.activities.slice().sort(EH.by('date', -1)).slice(0, 5).map((a) => `<div class="list-row">${C.ico('calendar')}<div class="body">${EH.activityLink(a)}<div class="meta">${EH.fmtDateY(a.date)} · ${esc(Q.centreName(d, a.centre))}</div></div>${C.statusBadge(R.activityStatus, Q.activityStatus(a))}</div>`).join('')}</div></div>` : ''}`;
    return C.drawer({ title: esc(p.name), sub: esc(p.type) + ' · ' + esc(p.region), body });
  };

  EH.drawers.partnerForm = (st) => {
    const v = st.values, er = st.errors;
    const sim = st.similar ? C.callout('warn', `<b>Partenaire${st.similar.length > 1 ? 's' : ''} au nom proche déjà dans l'annuaire :</b><ul style="margin:6px 0 0;padding-left:18px">${st.similar.map((p) => `<li><button type="button" class="link-btn" ${C.on('open-partner', { id: p.id })}>${esc(p.name)}</button> · ${esc(p.type)}, ${esc(p.region)}</li>`).join('')}</ul><p style="margin-top:6px">Ouvrez la fiche existante pour éviter un doublon, ou confirmez qu'il s'agit d'un autre partenaire.</p>`) : '';
    const body = `${C.formError(er)}${sim}<div class="form-grid">
      ${C.field({ name: 'name', label: 'Nom', required: true, value: v.name, error: er.name, full: true, autofocus: true, help: "L'annuaire vérifie les noms proches avant création." })}
      ${C.field({ name: 'type', label: 'Type', type: 'select', required: true, value: v.type, error: er.type, options: ['', ...R.partnerTypes] })}
      ${C.field({ name: 'region', label: 'Région', required: true, value: v.region, error: er.region })}
      ${C.field({ name: 'contact', label: 'Personne de contact ou spécialité', value: v.contact, full: true })}
      ${C.field({ name: 'phone', label: 'Téléphone', type: 'tel', value: v.phone })}
      ${C.field({ name: 'email', label: 'E-mail', type: 'email', value: v.email })}
    </div>`;
    return C.drawer({ title: 'Ajouter un partenaire', sub: 'Visible par les six centres', form: 'partner', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn(st.similar ? "Créer quand même" : 'Ajouter', { type: 'submit', variant: 'primary' }) });
  };
  EH.forms.partner = (v) => {
    const st = EH.ui.drawer;
    const nameChanged = st.values.name !== v.name;
    st.values = v;
    const res = EH.act.createPartner(v, st.similar && !nameChanged);
    if (res.similar) { st.similar = res.similar; st.errors = {}; EH.renderOverlays(true); return; }
    EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(`${esc(r.item.name)} ajouté à l'annuaire.`, { label: 'Ajouter une collaboration', action: () => EH.openDrawer('partner', { id: r.item.id, addCollab: true }) }); });
  };
  EH.forms.collab = (v) => {
    const st = EH.ui.drawer;
    st.values = v;
    const res = EH.act.addCollaboration(Object.assign({ partner: st.id }, v));
    EH.handle(res, st, () => { st.addCollab = false; st.values = {}; st.errors = {}; EH.renderOverlays(); EH.render(); EH.toast('Collaboration enregistrée.'); });
  };

  Object.assign(EH.actions, {
    'open-partner': (el) => EH.openDrawer('partner', { id: el.dataset.id }),
    'new-partner': () => EH.openDrawer('partnerForm', {}),
    'collab-toggle': () => { const st = EH.ui.drawer; st.addCollab = !st.addCollab; st.errors = {}; EH.renderOverlays(true); }
  });
})();
