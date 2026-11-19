/* App shell: routing, rendering, overlays and delegated events. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, I = EH.icon, esc = EH.esc, Q = EH.q, S = EH.store;

  EH.pages = EH.pages || {};
  EH.drawers = EH.drawers || {};
  EH.modals = EH.modals || {};
  EH.forms = EH.forms || {};
  EH.actions = EH.actions || {};
  const ui = (EH.ui = { route: null, f: {}, drawer: null, modal: null, toasts: [], menu: null, navOpen: false, returnFocus: null });

  const NAV = {
    pmo: [
      { group: 'Pilotage', items: ['pilotage', 'alertes', 'rapports'] },
      { group: 'Programme', items: ['programmes', 'entrepreneurs', 'activites'] },
      { group: 'Écosystème', items: ['partenaires', 'connaissances'] },
      { group: 'Administration', items: ['journal'] }
    ],
    officer: [
      { group: 'Mon centre', items: ['aujourdhui', 'entrepreneurs', 'activites', 'rapport'] },
      { group: 'Ressources', items: ['programmes', 'partenaires', 'connaissances'] }
    ],
    beneficiaire: [
      { group: 'Mon incubation', items: ['mon-espace', 'mes-activites', 'mes-rapports', 'mon-parcours'] }
    ]
  };
  const role = () => (S.isPmo() ? 'pmo' : S.isBeneficiary() ? 'beneficiaire' : 'officer');
  /** A beneficiary may only trigger these generic actions plus the ones prefixed "my-" (his own pages). */
  const BENEF_GENERIC = new Set(['go', 'close-drawer', 'close-modal', 'toggle-nav', 'filter', 'toast-action', 'confirm-ok', 'reset-demo']);
  EH.benefActionAllowed = (name) => BENEF_GENERIC.has(name) || name.startsWith('my-');
  const allowed = () => NAV[role()].flatMap((g) => g.items);
  const home = () => allowed()[0];

  /* ---------- routing (plain #name, as the artifact host requires) ---------- */
  EH.go = (route, filters) => {
    if (filters) Object.assign(ui.f, filters);
    ui.drawer = null;
    if (location.hash.slice(1) === route) { ui.route = route; render(); window.scrollTo(0, 0); }
    else location.hash = route;
  };
  const readRoute = (silent) => {
    const r = location.hash.slice(1);
    if (!silent && r && S.isBeneficiary() && EH.pages[r] && !allowed().includes(r)) {
      EH.act.denied('Page ' + EH.pages[r].label, 'Profil bénéficiaire');
      EH.toast("Cette page n'est pas accessible depuis votre espace. La tentative a été enregistrée.", { tone: 'error' });
    }
    ui.route = allowed().includes(r) ? r : home();
    ui.navOpen = false;
  };
  window.addEventListener('hashchange', () => { readRoute(); ui.menu = null; render(); window.scrollTo(0, 0); });

  /* ---------- overlays ---------- */
  const BENEF_DRAWERS = ['myActivity', 'myReport'];
  /** Record-level gate for beneficiaries (EC-12): refused and logged. Other roles keep their per-drawer checks. */
  const drawerAllowed = (type, props) => {
    if (!S.isBeneficiary()) return true;
    if (type === 'ent') return EH.act.guardEnt(Q.ent(S.data, props.id));
    if (BENEF_DRAWERS.includes(type)) return EH.act.guardActivity(Q.activity(S.data, props.id));
    EH.act.denied('Volet ' + type, 'Profil bénéficiaire');
    return false;
  };
  EH.openDrawer = (type, props = {}) => {
    if (!drawerAllowed(type, props)) { EH.toast("Accès refusé : cet élément ne fait pas partie de votre espace. La tentative a été enregistrée.", { tone: 'error' }); return; }
    ui.returnFocus = document.activeElement; ui.drawer = Object.assign({ type, values: {}, errors: {} }, props); ui.menu = null; renderOverlays(true); };
  EH.closeDrawer = () => { ui.drawer = null; renderOverlays(); restoreFocus(); };
  EH.openModal = (type, props = {}) => { ui.modalReturn = document.activeElement; ui.modal = Object.assign({ type, values: {}, errors: {} }, props); renderOverlays(true); };
  EH.closeModal = () => { ui.modal = null; renderOverlays(); if (ui.modalReturn && document.body.contains(ui.modalReturn)) ui.modalReturn.focus(); };
  const restoreFocus = () => { if (ui.returnFocus && document.body.contains(ui.returnFocus)) ui.returnFocus.focus(); };

  let toastSeq = 0;
  EH.toast = (text, opts = {}) => {
    const t = { id: ++toastSeq, text, tone: opts.tone || 'ok', action: opts.action, label: opts.label };
    ui.toasts = [t];
    renderToasts();
    clearTimeout(EH.toast.timer);
    EH.toast.timer = setTimeout(() => { ui.toasts = []; renderToasts(); }, opts.action ? 7000 : 3800);
  };

  /* ---------- rendering ---------- */
  const navCount = (id) => {
    const d = S.data, sc = S.scope();
    if (id === 'alertes') return { n: Q.alerts(d, null).length, alert: true };
    if (id === 'rapports') return { n: d.reports.filter((r) => r.status === 'submitted').length + d.corrections.filter((c) => c.status === 'open').length };
    if (EH.benefNavCount && S.isBeneficiary()) return EH.benefNavCount(id);
    if (id === 'aujourdhui') return { n: EH.todayItems ? EH.todayItems().length : 0 };
    if (id === 'connaissances' && S.isPmo()) return { n: d.knowledge.filter((k) => k.status === 'draft').length };
    if (id === 'rapport' && sc) { const st = Q.reportStatus(Q.report(d, sc, Q.lastClosedPeriod())); return st === 'late' || st === 'returned' ? { n: 1, alert: true } : null; }
    return null;
  };

  const sidebar = () => {
    const u = S.user();
    const groups = NAV[role()].map((g) => `<div class="nav-group">${g.group}</div>` + g.items.map((id) => {
      const p = EH.pages[id]; const c = navCount(id);
      return `<a class="nav-item" href="#${id}" ${ui.route === id ? 'aria-current="page"' : ''}>${I(p.icon)}<span>${p.label}</span>${c && c.n ? `<span class="nav-count ${c.alert ? 'alert' : ''}">${c.n}</span>` : ''}</a>`;
    }).join('')).join('');
    const opts = S.data.users.map((x) => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${x.role === 'pmo' ? 'PMO central' : x.role === 'beneficiaire' ? 'Bénéficiaire · ' + x.name : 'Chargé · ' + Q.centreName(S.data, x.centre)}</option>`).join('');
    return `<nav class="sidebar" aria-label="Navigation principale">
      <div class="brand">${EH.logo(26)}<span>ELIFE <span class="brand-sub">Hub</span></span></div>
      ${groups}
      <div class="profile">
        <div class="profile-row">${C.avatar(u.name)}<div><div class="profile-name">${esc(u.name)}</div><div class="profile-role">${u.role === 'pmo' ? 'PMO central · 6 centres' : u.role === 'beneficiaire' ? 'Bénéficiaire · ' + esc(Q.centreName(S.data, u.centre)) : 'Chargé de programme · ' + esc(Q.centreName(S.data, u.centre))}</div></div></div>
        <div class="demo-switch"><label for="demo-user">Profil de démonstration</label><div class="row"><select id="demo-user" class="select" data-switch-user>${opts}</select>${C.btn('', { action: 'reset-demo', icon: 'reset', title: 'Réinitialiser les données de démonstration' })}</div></div>
      </div>
    </nav>`;
  };

  const quickActions = () => (S.isBeneficiary() ? [] : S.isPmo()
    ? [['new-programme', 'Programme', 'layers'], ['new-partner', 'Partenaire', 'handshake'], ['new-knowledge', 'Connaissance', 'book']]
    : [['new-session', 'Séance de coaching', 'message', 'S'], ['new-candidate', 'Candidat', 'userPlus', 'C'], ['new-activity', 'Activité', 'calendar', 'A'], ['new-knowledge', 'Connaissance', 'book'], ['new-partner', 'Partenaire', 'handshake']]);

  const topbar = () => {
    const sc = S.scope();
    const ctx = S.isBeneficiary() ? `<b>Mon espace</b> · Centre de ${esc(Q.centreName(S.data, sc))}` : sc ? `<b>Centre de ${esc(Q.centreName(S.data, sc))}</b> · Cohorte 2026` : '<b>Six centres</b> · Programme ELIFE';
    const menu = ui.menu === 'new' ? `<div class="menu" role="menu">${quickActions().map(([a, l, i, k]) => `<button role="menuitem" ${C.on(a)}>${I(i)}${l}${k ? `<small>${k}</small>` : ''}</button>`).join('')}</div>` : '';
    return `<header class="topbar">
      ${C.btn('', { action: 'toggle-nav', icon: 'menu', variant: 'ghost menu-toggle', title: 'Ouvrir le menu' })}
      <div class="context">${ctx}</div>
      <div class="right"><span class="sync">Données en direct · ${EH.fmtDay(EH.TODAY)}</span>
        ${S.isBeneficiary() ? '' : `<div class="menu-wrap">${C.btn('Nouveau', { action: 'toggle-menu', icon: 'plus', variant: 'primary', extra: `aria-haspopup="menu" aria-expanded="${ui.menu === 'new'}"` })}${menu}</div>`}
      </div>
    </header>`;
  };

  const render = (EH.render = () => {
    const page = EH.pages[ui.route];
    const app = document.getElementById('app');
    const active = document.activeElement;
    const focusId = active && active.id, caret = active && active.selectionStart;
    app.innerHTML = `<div class="app ${ui.navOpen ? 'nav-open' : ''} ${S.isBeneficiary() ? 'benef' : ''}">${sidebar()}${ui.navOpen ? `<div class="nav-scrim" ${C.on('toggle-nav')}></div>` : ''}<div class="content">${topbar()}<main id="main" tabindex="-1">${page.render()}</main></div></div><div id="overlay-root"></div><div class="toasts" id="toast-root" aria-live="polite"></div>`;
    document.title = page.label + ' · ELIFE Hub';
    renderOverlays();
    renderToasts();
    if (focusId) { const el = document.getElementById(focusId); if (el && el.closest('#main,.sidebar,.topbar')) { el.focus(); if (caret != null && el.setSelectionRange && el.type !== 'date') try { el.setSelectionRange(caret, caret); } catch (e) {} } }
  });
  EH.refresh = () => render();

  const renderOverlays = (focus) => {
    const root = document.getElementById('overlay-root');
    if (!root) return;
    let html = '';
    if (ui.drawer) html += EH.drawers[ui.drawer.type](ui.drawer);
    if (ui.modal) html += EH.modals[ui.modal.type](ui.modal);
    root.innerHTML = html;
    document.body.style.overflow = ui.drawer || ui.modal ? 'hidden' : '';
    if (focus || (ui.drawer && ui.drawer.errors && Object.keys(ui.drawer.errors).length) || (ui.modal && ui.modal.errors && Object.keys(ui.modal.errors).length)) {
      const box = root.querySelector(ui.modal ? '.modal' : '.drawer');
      if (box) {
        const target = box.querySelector('[aria-invalid="true"]') || box.querySelector('[autofocus]') || box.querySelector('.drawer-body input:not([type=hidden]), .drawer-body select, .drawer-body textarea') || box.querySelector('button');
        if (target) target.focus();
      }
    }
  };
  EH.renderOverlays = renderOverlays;
  const renderToasts = () => {
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.innerHTML = ui.toasts.map((t) => `<div class="toast ${t.tone}" role="status">${I(t.tone === 'error' ? 'alert' : 'checkCircle')}<span>${t.text}</span>${t.action ? `<button class="btn sm" ${C.on('toast-action', { id: t.id })}>${esc(t.label)}</button>` : ''}</div>`).join('');
  };

  /* ---------- forms ---------- */
  EH.formData = (form) => {
    const fd = new FormData(form), out = {};
    const multi = new Set([...form.querySelectorAll('input[type=checkbox][name]')].map((i) => i.name));
    for (const [k] of fd) out[k] = multi.has(k) ? fd.getAll(k) : fd.get(k);
    multi.forEach((k) => { if (!(k in out)) out[k] = []; });
    return out;
  };
  /** Standard handling of a store result inside a drawer/modal form. */
  EH.handle = (res, target, onOk) => {
    if (res.ok) { onOk(res); return true; }
    if (res.errors) { target.errors = res.errors; renderOverlays(); }
    return false;
  };

  /* ---------- events ---------- */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (ui.menu && !ev.target.closest('.menu-wrap')) { ui.menu = null; if (!el) { render(); return; } }
    if (!el) return;
    const fn = EH.actions[el.dataset.action];
    if (fn && S.isBeneficiary() && !EH.benefActionAllowed(el.dataset.action)) {
      ev.preventDefault();
      EH.act.denied('Action ' + el.dataset.action, 'Profil bénéficiaire');
      EH.toast('Action non autorisée pour votre profil. La tentative a été enregistrée.', { tone: 'error' });
      return;
    }
    if (fn) { ev.preventDefault(); fn(el, ev); }
  });
  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('[data-form]');
    if (!form) return;
    ev.preventDefault();
    const fn = EH.forms[form.dataset.form];
    if (fn) fn(EH.formData(form), form, ev.submitter);
  });
  const onFilter = (el) => { ui.f[el.dataset.filter] = el.value; render(); };
  const debounced = EH.debounce(onFilter, 160);
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.filter) { el.type === 'search' ? debounced(el) : onFilter(el); }
    if (el.dataset.live && EH.live[el.dataset.live]) EH.live[el.dataset.live](el);
    else if (el.form && el.form.hasAttribute('data-draft') && EH.live.draft) EH.live.draft(el);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('[data-switch-user]')) { S.switchUser(el.value); ui.drawer = null; ui.modal = null; ui.f = {}; readRoute(true); location.hash = home(); render(); EH.toast(`Vous êtes maintenant ${esc(S.user().name)} (${S.isPmo() ? 'PMO' : S.isBeneficiary() ? 'bénéficiaire du centre de ' + esc(Q.centreName(S.data, S.scope())) : 'chargé de ' + esc(Q.centreName(S.data, S.scope()))}).`); }
    else if (el.dataset.filter && el.tagName === 'SELECT') onFilter(el);
    if (el.dataset.live && EH.live[el.dataset.live]) EH.live[el.dataset.live](el);
  });
  EH.live = EH.live || {};

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (ui.menu) { ui.menu = null; render(); return; }
      if (ui.modal) { EH.closeModal(); return; }
      if (ui.drawer) { EH.closeDrawer(); return; }
      if (ui.navOpen) { ui.navOpen = false; render(); }
    }
    // focus trap inside dialogs
    if (ev.key === 'Tab' && (ui.drawer || ui.modal)) {
      const box = document.querySelector(ui.modal ? '.modal' : '.drawer');
      const f = [...box.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
    // keyboard shortcuts for officers (outside fields)
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (!typing && !ui.drawer && !ui.modal && !ev.ctrlKey && !ev.metaKey && !ev.altKey && S.isOfficer()) {
      const map = { s: 'new-session', c: 'new-candidate', a: 'new-activity' };
      const k = ev.key.toLowerCase();
      if (map[k]) { ev.preventDefault(); EH.actions[map[k]](); }
    }
    // Enter on clickable rows
    if (ev.key === 'Enter' && ev.target.matches('tr[data-action]')) EH.actions[ev.target.dataset.action](ev.target, ev);
  });

  Object.assign(EH.actions, {
    'close-drawer': () => EH.closeDrawer(),
    'close-modal': () => EH.closeModal(),
    'toggle-nav': () => { ui.navOpen = !ui.navOpen; render(); },
    'toggle-menu': () => { ui.menu = ui.menu === 'new' ? null : 'new'; render(); const m = document.querySelector('.menu button'); if (m) m.focus(); },
    filter: (el) => { ui.f[el.dataset.key] = el.dataset.value; render(); },
    go: (el) => EH.go(el.dataset.route, el.dataset.filters ? JSON.parse(el.dataset.filters) : null),
    'toast-action': (el) => { const t = ui.toasts.find((x) => x.id === +el.dataset.id); ui.toasts = []; renderToasts(); if (t && t.action) t.action(); },
    'reset-demo': () => EH.openModal('confirm', { title: 'Réinitialiser la démonstration ?', text: 'Toutes les saisies faites pendant la démonstration seront effacées et les données d\'exemple restaurées.', confirm: 'Réinitialiser', danger: true, onConfirm: () => { S.reset(); ui.f = {}; ui.drawer = null; EH.closeModal(); readRoute(true); render(); EH.toast('Données de démonstration restaurées.'); } })
  });

  EH.modals.confirm = (m) => C.modal({ title: esc(m.title), body: `<p>${esc(m.text)}</p>`, foot: C.btn('Annuler', { action: 'close-modal' }) + C.btn(m.confirm, { action: 'confirm-ok', variant: m.danger ? 'danger' : 'primary' }) });
  EH.actions['confirm-ok'] = () => ui.modal && ui.modal.onConfirm && ui.modal.onConfirm();

  /* ---------- boot ---------- */
  EH.boot = () => {
    S.load();
    readRoute();
    render();
  };
})();
