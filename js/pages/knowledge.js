/* Knowledge base (FR-07): add, search and filter, PMO validation, review dates. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF;
  const KS = R.knowledgeStatus;

  /** Visibility (BR-07-01): drafts only for their centre and the PMO. */
  const visible = (k) => S.isPmo() || k.status === 'published' || k.centre === S.scope();

  EH.pages.connaissances = {
    label: 'Connaissances', icon: 'book',
    render() {
      const d = S.data, pmo = S.isPmo();
      const q = EH.norm(EH.f('kn.q', '')), type = EH.f('kn.type', ''), centre = EH.f('kn.centre', ''), status = EH.f('kn.status', '');
      const all = d.knowledge.filter(visible).filter((k) => k.status !== 'archived' || status === 'archived');
      const base = all.filter((k) => (!q || EH.norm(k.title + ' ' + k.summary + ' ' + k.tags.join(' ')).includes(q)) && (!type || k.type === type) && (!centre || k.centre === centre));
      const counts = EH.groupCount(base, Q.knowledgeStatus);
      const list = base.filter((k) => !status || Q.knowledgeStatus(k) === status).sort((a, b) => (Q.knowledgeStatus(a) === 'draft' ? -1 : 0) - (Q.knowledgeStatus(b) === 'draft' ? -1 : 0) || b.created.localeCompare(a.created));
      const rows = list.map((k) => {
        const st = Q.knowledgeStatus(k);
        return `<div class="list-row" style="align-items:flex-start">${C.ico('book', st === 'draft' ? '' : st === 'review' ? 'warn' : 'accent')}<div class="body"><button class="link-btn" ${C.on('open-knowledge', { id: k.id })}>${esc(k.title)}</button><div class="meta" style="margin:2px 0 6px;color:var(--ink-2)">${esc(k.summary.length > 160 ? k.summary.slice(0, 157) + '…' : k.summary)}</div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${C.badge(k.type, 'outline')}${k.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}<span class="muted xs">${esc(Q.centreName(d, k.centre))} · ${EH.fmtDateY(k.created)}</span></div></div><div class="row-actions">${C.statusBadge(KS, st)}${pmo && st === 'draft' ? C.btn('Publier', { action: 'kn-status', data: { id: k.id, status: 'published' }, size: 'sm', variant: 'primary' }) : ''}</div></div>`;
      }).join('');
      const seg = C.seg('kn.status', [{ value: '', label: 'Tous', count: base.length }, { value: 'published', label: 'Publiés', count: counts.published || 0 }, { value: 'draft', label: pmo ? 'À valider' : 'Brouillons', count: counts.draft || 0 }, { value: 'review', label: 'À réviser', count: counts.review || 0 }, ...(pmo ? [{ value: 'archived', label: 'Archivés' }] : [])], status, 'Statut');
      const emptyText = q ? `Aucun contenu ne parle de « ${esc(EH.f('kn.q', ''))} ». Élargissez les filtres ou partagez le premier retour d'expérience sur ce sujet.` : 'Aucun contenu pour ces filtres.';
      return C.pageHead('Connaissances', pmo ? 'Mémoire des six centres. Les contenus des centres sont publiés après votre validation.' : 'Retrouvez ce que les autres centres ont appris, et partagez vos propres leçons.', C.btn('Ajouter', { action: 'new-knowledge', icon: 'plus', variant: 'primary' })) +
        `<div class="toolbar">${C.search('kn.q', 'Rechercher un titre, un tag…', EH.f('kn.q', ''))}${C.filterSelect('kn.type', 'Type', [{ value: '', label: 'Tous les types' }, ...R.knowledgeTypes.map((t) => ({ value: t, label: t }))], type)}${C.filterSelect('kn.centre', 'Centre', EH.centreOptions(), centre)}</div><div class="toolbar" style="overflow-x:auto">${seg}</div>` +
        C.panel({ body: rows || C.empty({ icon: 'search', tone: '', title: 'Aucun résultat', text: emptyText, action: C.btn('Ajouter le premier contenu', { action: 'new-knowledge', icon: 'plus' }) }) });
    }
  };

  EH.drawers.knowledge = (st) => {
    const d = S.data, k = d.knowledge.find((x) => x.id === st.id);
    if (!visible(k)) return C.drawer({ title: 'Accès refusé', body: EH.denied('Ce brouillon') });
    const s = Q.knowledgeStatus(k), act = k.activity && Q.activity(d, k.activity), p = k.programme && Q.programme(d, k.programme);
    const tools = S.can.publishKnowledge() ? [
      s === 'draft' ? C.btn('Publier pour tous les centres', { action: 'kn-status', data: { id: k.id, status: 'published' }, variant: 'primary', icon: 'checkCircle' }) : '',
      s === 'review' ? C.btn('Renouveler 12 mois', { action: 'kn-renew', data: { id: k.id }, variant: 'primary', icon: 'reset' }) : '',
      s !== 'archived' ? C.btn('Archiver', { action: 'kn-status', data: { id: k.id, status: 'archived' }, icon: 'archive' }) : C.btn('Republier', { action: 'kn-status', data: { id: k.id, status: 'published' } })
    ].join('') : '';
    const body = `
      ${s === 'draft' ? C.callout('info', S.isPmo() ? 'Brouillon : visible par son centre et par vous. Publiez-le pour le partager aux six centres.' : 'Brouillon : le PMO doit le valider avant qu\'il soit visible des autres centres.') : ''}
      ${s === 'review' ? C.callout('warn', `Date de révision dépassée (${EH.fmtDateY(k.review)}) : vérifiez qu'il est toujours valable avant de l'utiliser.`) : ''}
      <p style="line-height:1.6">${esc(k.summary)}</p>
      ${k.link ? `<p><a href="${esc(k.link)}" target="_blank" rel="noopener">${EH.icon('link')} Ouvrir le document</a></p>` : ''}
      <dl class="dl"><dt>Type</dt><dd>${esc(k.type)}</dd><dt>Centre source</dt><dd>${esc(Q.centreName(d, k.centre))}</dd>
        <dt>Activité source</dt><dd>${act ? EH.activityLink(act) : '<span class="muted">—</span>'}</dd><dt>Programme</dt><dd>${esc(p ? p.name : '—')}</dd>
        <dt>Auteur</dt><dd>${esc(Q.user(d, k.author).name)}</dd><dt>Révision</dt><dd>${EH.fmtDateY(k.review)}</dd>
        <dt>Tags</dt><dd>${k.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join(' ') || '—'}</dd></dl>`;
    return C.drawer({ title: esc(k.title), sub: C.statusBadge(KS, s), tools, body });
  };

  EH.drawers.knowledgeForm = (st) => {
    const d = S.data, sc = S.scope();
    const v = Object.assign({ type: st.preset ? 'Leçon apprise' : '' }, st.values, st.preset ? { activity: st.preset } : {}), er = st.errors;
    const acts = Q.inScope(d.activities, sc).filter((a) => a.status === 'done').sort(EH.by('date', -1));
    const body = `${C.formError(er)}<div class="form-grid">
      ${C.field({ name: 'type', label: 'Type', type: 'select', required: true, value: v.type, error: er.type, options: ['', ...R.knowledgeTypes], full: true })}
      ${C.field({ name: 'title', label: 'Titre', required: true, value: v.title, error: er.title, full: true, autofocus: true, placeholder: 'Ce que vous avez appris, en une phrase' })}
      ${C.field({ name: 'summary', label: 'Résumé', type: 'textarea', rows: 4, required: true, value: v.summary, error: er.summary, full: true, help: 'Le contexte, ce qui a marché ou non, et le conseil pour les autres centres.' })}
      ${C.field({ name: 'activity', label: 'Activité source', type: 'select', value: v.activity, error: er.activity, full: true, options: [{ value: '', label: 'Aucune' }, ...acts.map((a) => ({ value: a.id, label: `${a.title} · ${EH.fmtDate(a.date)}${sc ? '' : ' · ' + Q.centreName(d, a.centre)}` }))], help: 'Obligatoire pour une leçon apprise.' })}
      ${C.field({ name: 'tags', label: 'Tags', value: v.tags, placeholder: 'pitch, présence', help: 'Séparés par des virgules.' })}
      ${C.field({ name: 'link', label: 'Lien (fichier ou page)', type: 'url', value: v.link, error: er.link, placeholder: 'https://…' })}
    </div>`;
    return C.drawer({ title: 'Ajouter une connaissance', sub: S.isPmo() ? 'Publiée directement pour les six centres' : 'Enregistrée en brouillon, publiée après validation du PMO', form: 'knowledge', body, foot: C.btn('Annuler', { action: 'close-drawer' }) + C.btn('Enregistrer', { type: 'submit', variant: 'primary' }) });
  };
  EH.forms.knowledge = (v) => {
    const st = EH.ui.drawer;
    st.values = v; st.preset = null;
    const res = EH.act.addKnowledge(v);
    EH.handle(res, st, (r) => { EH.closeDrawer(); EH.render(); EH.toast(r.item.status === 'draft' ? 'Enregistré en brouillon. Le PMO le publiera pour les six centres.' : 'Publié pour les six centres.'); });
  };

  Object.assign(EH.actions, {
    'open-knowledge': (el) => EH.openDrawer('knowledge', { id: el.dataset.id }),
    'new-knowledge': (el) => EH.openDrawer('knowledgeForm', { preset: el && el.dataset ? el.dataset.activity : null }),
    'kn-status': (el) => { const r = EH.act.setKnowledgeStatus(el.dataset.id, el.dataset.status); if (!r.ok) return EH.toast(r.errors._, { tone: 'error' }); EH.render(); if (EH.ui.drawer) EH.renderOverlays(); EH.toast(el.dataset.status === 'published' ? 'Publié : visible par les six centres.' : 'Archivé.'); },
    'kn-renew': (el) => { const r = EH.act.renewKnowledge(el.dataset.id); if (r.ok) { EH.render(); EH.renderOverlays(); EH.toast('Contenu renouvelé pour 12 mois.'); } }
  });
})();
