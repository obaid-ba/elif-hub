/* Alerts list (FR-08-03, PBI-40): centre, item, days late, link — and a direct action. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc;

  const actionFor = (a) => {
    if (a.type === 'activity') return { label: S.can.writeOperational(a.centre) ? 'Clôturer' : 'Ouvrir', action: S.can.writeOperational(a.centre) ? 'close-activity' : 'open-activity' };
    if (a.type === 'breport' || a.type === 'conflict') return { label: 'Ouvrir', action: 'open-activity' };
    if (a.type === 'risk') return { label: S.can.writeOperational(a.centre) ? 'Saisir une séance' : 'Ouvrir la fiche', action: S.can.writeOperational(a.centre) ? 'new-session' : 'open-ent' };
    if (a.type === 'report') return { label: 'Ouvrir', action: S.isPmo() ? 'open-report' : 'go-report' };
    return { label: 'Ouvrir la fiche', action: 'open-ent' };
  };
  const toneOf = (a) => (a.sev === 'bad' ? 'bad' : a.sev === 'warn' ? 'warn' : 'info');

  /** Compact alert row, shared by the centre drawer and the officer's day view. */
  EH.alertRow = (a) => {
    const t = Q.ALERT_TYPES[a.type], act = actionFor(a);
    return `<div class="list-row">${C.ico(t.icon, toneOf(a))}<div class="body"><div class="title">${esc(a.title)}</div><div class="meta">${esc(a.detail)}</div></div><div class="row-actions">${a.ref ? C.btn(act.label, { action: act.action, data: { id: a.ref }, size: 'sm' }) : ''}</div></div>`;
  };

  EH.pages.alertes = {
    label: 'Alertes', icon: 'bell',
    render() {
      const d = S.data;
      const all = Q.alerts(d, null);
      const type = EH.f('al.type', ''), centre = EH.f('al.centre', '');
      const list = all.filter((a) => (!type || a.type === type) && (!centre || a.centre === centre));
      const counts = EH.groupCount(all.filter((a) => !centre || a.centre === centre), (a) => a.type);
      const typeSeg = C.seg('al.type', [{ value: '', label: 'Toutes', count: all.filter((a) => !centre || a.centre === centre).length }, ...Object.entries(Q.ALERT_TYPES).map(([k, v]) => ({ value: k, label: v.label, count: counts[k] || 0 }))], type, "Type d'alerte");
      const rows = list.map((a) => {
        const act = actionFor(a), t = Q.ALERT_TYPES[a.type];
        return { cells: [
          `<span class="nowrap" style="display:inline-flex;gap:8px;align-items:center">${C.ico(t.icon, toneOf(a))}<span class="hide-sm">${t.label}</span></span>`,
          esc(Q.centreName(d, a.centre)),
          `<span class="strong">${esc(a.title)}</span><span class="sub">${esc(a.detail)}</span>`,
          a.days != null && a.days > 0 ? `<span class="num ${a.sev === 'bad' ? 't-bad' : 't-warn'}">${a.days}${EH.NBSP}j</span>` : '<span class="muted">—</span>',
          a.ref ? C.btn(act.label, { action: act.action, data: { id: a.ref }, size: 'sm' }) : ''
        ] };
      });
      return C.pageHead('Alertes', 'Ce qui demande une intervention, du plus urgent au moins urgent. Les alertes disparaissent dès que la donnée est corrigée.') +
        `<div class="toolbar">${typeSeg}<span class="spacer"></span>${C.filterSelect('al.centre', 'Centre', EH.centreOptions(), centre)}</div>` +
        C.panel({ body: C.table({ caption: 'Alertes', cols: [{ label: 'Type' }, { label: 'Centre' }, { label: 'Élément' }, { label: 'Retard', cls: 'num' }, { label: '', cls: 'actions' }], rows, empty: C.empty({ title: 'Aucune alerte', text: 'Rien ne demande votre attention pour ce filtre.' }) }) });
    }
  };
  EH.actions['go-report'] = () => EH.go('rapport');
})();
