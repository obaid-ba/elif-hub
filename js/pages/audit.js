/* Audit log (FR-04-08): who did what, when. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc;

  EH.pages.journal = {
    label: "Journal d'audit", icon: 'history',
    render() {
      const d = S.data;
      const centre = EH.f('au.centre', ''), action = EH.f('au.action', ''), q = EH.norm(EH.f('au.q', ''));
      const actions = [...new Set(d.audit.map((a) => a.action))].sort();
      const list = d.audit.filter((a) => (!centre || a.centre === centre) && (!action || a.action === action) && (!q || EH.norm(a.object + ' ' + a.detail).includes(q)));
      const rows = list.slice(0, 200).map((a) => ({ cells: [
        `<span class="nowrap num">${EH.fmtDateTime(a.at)}</span>`,
        esc(Q.user(d, a.user).name),
        a.action === 'Accès refusé' ? C.badge(a.action, 'bad', 'shield') : esc(a.action),
        `${esc(a.object)}${a.detail ? `<span class="sub">${esc(a.detail)}</span>` : ''}`,
        esc(a.centre ? Q.centreName(d, a.centre) : '—')
      ] }));
      return C.pageHead("Journal d'audit", 'Chaque création, modification, validation et tentative d\'accès refusée est enregistrée.') +
        `<div class="toolbar">${C.search('au.q', 'Rechercher…', EH.f('au.q', ''))}${C.filterSelect('au.action', 'Action', [{ value: '', label: 'Toutes les actions' }, ...actions.map((x) => ({ value: x, label: x }))], action)}${C.filterSelect('au.centre', 'Centre', EH.centreOptions(), centre)}</div>` +
        C.panel({ body: C.table({ caption: "Journal d'audit", cols: [{ label: 'Date' }, { label: 'Utilisateur' }, { label: 'Action' }, { label: 'Objet' }, { label: 'Centre', cls: 'hide-sm' }], rows, empty: C.empty({ icon: 'history', tone: '', title: 'Aucune entrée', text: 'Rien pour ces filtres.' }) }), foot: `<span class="muted xs">${EH.plural(list.length, 'entrée')}${list.length > 200 ? ' · 200 plus récentes affichées' : ''}</span>` });
    }
  };
})();
