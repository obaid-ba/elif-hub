/* ELIFE Hub demo video v3 « pitch » — défis 1, 2, 4, 8, without captions or music, slowed down to ≈ 40 s per défi
   so the presenter can explain over it. Same scenario as v2 (frozen in video/v2/), played through a time warp.
   v1 is frozen in video/v1/.
   Every visual is a pure function of time t (seconds). App interactions are real: they fire once, in order,
   when the timeline crosses their time. The app's timers and clock run on the video clock (10:15 on 19 Nov),
   so toasts and timestamps look natural. render.mjs calls window.renderFrame(i) for i = 0..FRAMES-1. */
(function () {
  'use strict';
  const FPS = 60;
  /** Team shown on the closing card (Collaboration criterion). Empty → "Équipe ELIFE Hub". */
  const TEAM = [];
  const $s = (id) => document.getElementById(id);
  const iframe = $s('app'), cam = $s('cam'), spotEl = $s('spot'), cursorEl = $s('cursor'), ripple = cursorEl.querySelector('.ripple');
  const W = () => iframe.contentWindow, D = () => iframe.contentDocument;
  const WIN = { x: 192, y: 72 + 36 }; // app origin in world (stage) coordinates

  /* ---------- easing & helpers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const prog = (t, t0, dur) => clamp((t - t0) / dur, 0, 1);
  const env = (t, t0, t1, fi = 0.4, fo = 0.35) => (t < t0 || t > t1 ? 0 : Math.min(prog(t, t0, fi), 1 - prog(t, t1 - fo, fo)));
  const strip = (html) => String(html || '').replace(/<[^>]+>/g, '');

  /* ---------- registries ---------- */
  const events = [], camKeys = [], curKeys = [], clicks = [], captions = [], cards = [], spots = [], fulls = [], wipes = [], typers = [], scrolls = [], visibility = [], rings = [], flows = [], banners = [], urls = [], whooshes = [];
  const at = (t, fn) => events.push({ t, fn, done: false });

  /* ---------- app element lookup ---------- */
  const q = (sel, root) => (root || D()).querySelector(sel);
  const qa = (sel, root) => [...(root || D()).querySelectorAll(sel)];
  const row = (text, root) => qa('.list-row', root).find((r) => r.textContent.includes(text));
  const rowBtn = (text, sel = 'button', root) => { const r = row(text, root); return r && r.querySelector(sel); };
  const ddOf = (label) => { const dt = qa('.drawer dt').find((x) => x.textContent.trim().startsWith(label)); return dt && dt.nextElementSibling; };
  const sectionOf = (title, root = '.drawer') => { const h = qa(`${root} .section h3`).find((x) => x.textContent.trim().startsWith(title)); return h && h.parentElement; };
  const panelOf = (title) => qa('#main section.panel').find((p) => ((p.querySelector('h2') || {}).textContent || '').trim().startsWith(title));
  const nav = (route) => q(`.sidebar a.nav-item[href="#${route}"]`);
  const rectOf = (el) => { if (!el || !el.getBoundingClientRect) return null; const r = el.getBoundingClientRect(); return { x: WIN.x + r.left, y: WIN.y + r.top, w: r.width, h: r.height }; };
  const setField = (el, value) => { if (!el) return; el.value = value; el.dispatchEvent(new (W().Event)('input', { bubbles: true })); el.dispatchEvent(new (W().Event)('change', { bubbles: true })); };

  /* ---------- camera ---------- */
  const cam0 = { fx: 960, fy: 540, s: 1 };
  const focus = (get, s, dx = 0, dy = 0) => () => {
    const r = rectOf(get());
    if (!r) return null;
    let fx = r.x + r.w / 2 + dx, fy = r.y + r.h / 2 + dy;
    fx = 1920 / s <= 1536 ? clamp(fx, 192 + 960 / s, 1728 - 960 / s) : 960;
    fy = 1080 / s <= 936 ? clamp(fy, 72 + 540 / s, 1008 - 540 / s) : 540;
    return { fx, fy, s };
  };
  const wide = () => ({ ...cam0 });
  const camTo = (t, dur, getter) => camKeys.push({ t, dur, getter, from: null, to: null });
  let camNow = { ...cam0 };
  const camAt = (t) => {
    let c = { ...cam0 };
    for (const k of camKeys) {
      if (t < k.t) break;
      if (!k.to) { k.from = { ...c }; k.to = k.getter() || { ...c }; }
      const e = easeIO(prog(t, k.t, k.dur));
      c = { fx: lerp(k.from.fx, k.to.fx, e), fy: lerp(k.from.fy, k.to.fy, e), s: lerp(k.from.s, k.to.s, e) };
    }
    return c;
  };
  const toStage = (wx, wy, c = camNow) => ({ x: 960 - c.s * c.fx + c.s * wx, y: 540 - c.s * c.fy + c.s * wy });

  /* ---------- cursor ---------- */
  let cursorPos = { x: 1500, y: 980 };
  const cursorTo = (t, dur, get, ox = 0, oy = 0) => curKeys.push({ t, dur, get, ox, oy, from: null });
  const cursorAt = (t) => {
    let key = null;
    for (const k of curKeys) { if (t < k.t) break; if (!k.from) k.from = { ...cursorPos }; key = k; }
    if (!key) return { x: 1500, y: 980 };
    const r = rectOf(key.get());
    const target = r ? toStage(r.x + r.w / 2 + key.ox, r.y + r.h / 2 + key.oy) : key.last || key.from;
    if (r) key.last = target;
    const e = easeIO(prog(t, key.t, key.dur));
    const arc = Math.sin(Math.PI * e) * Math.min(40, Math.hypot(target.x - key.from.x, target.y - key.from.y) * 0.08);
    return { x: lerp(key.from.x, target.x, e), y: lerp(key.from.y, target.y, e) - arc };
  };
  const click = (t, get, fn) => { clicks.push(t); at(t, () => { const el = get(); if (fn) fn(el); else if (el) el.click(); }); };
  /** Cursor travel + click + focus ring, the common gesture. */
  const press = (t, get, { travel = 0.8, fn, ring = true } = {}) => { cursorTo(t, travel, get); if (ring) rings.push({ t0: t + travel * 0.4, t1: t + travel + 0.45, get, el: null }); click(t + travel + 0.15, get, fn); return t + travel + 0.15; };
  const showCursor = (t0, t1) => visibility.push({ t0, t1 });

  /* ---------- overlays ---------- */
  const caption = (t0, t1, c) => captions.push({ t0, t1, ...c });
  const ICONS = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    check: '<path d="m5 12 5 5 9-10"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-2.5-5.1"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a9 9 0 1 1 17.4 0"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;
  const card = (t0, t1, get, html, { icon = 'check', tone = '', side = 'left', gap = 26, live } = {}) => {
    const el = document.createElement('div');
    el.className = 'card'; el.style.opacity = 0;
    el.innerHTML = `<span class="ic ${tone}">${svg(icon)}</span><div>${html}</div>`;
    $s('cards').appendChild(el);
    cards.push({ t0, t1, get, el, side, gap, last: null, live, filled: false });
  };
  const spot = (t0, t1, get, pad = 10) => spots.push({ t0, t1, get, pad });
  const full = (t0, t1, build, animate, { fi = 0.5, fo = 0.5 } = {}) => {
    const el = document.createElement('div');
    el.className = 'fs'; el.style.opacity = 0; el.style.visibility = 'hidden';
    el.innerHTML = build();
    $s('full').appendChild(el);
    fulls.push({ t0, t1, el, animate, fi, fo });
  };
  const wipe = (tMid, label, sub, onMid) => {
    const box = $s('wipe');
    const disc = document.createElement('div'); disc.className = 'w';
    const lab = document.createElement('div'); lab.className = 'label'; lab.innerHTML = `${label}<small>${sub}</small>`;
    box.append(disc, lab);
    wipes.push({ tMid, disc, lab });
    at(tMid, onMid);
  };
  const type = (t0, t1, get, text) => typers.push({ t0, t1, get, text, n: -1 });
  const scroll = (t0, dur, getTop) => scrolls.push({ t0, dur, getTop, from: null, to: null });
  /** Workflow bar for a section: label + steps; marks = start time of each step. */
  const flow = (t0, t1, def, title, steps, marks) => flows.push({ t0, t1, def, title, steps, marks, html: null });
  const banner = (t0, t1, text) => banners.push({ t0, t1, text });
  const typeUrl = (t0, t1, text, back) => urls.push({ t0, t1, text, back });

  /* ---------- app control ---------- */
  const app = {
    as: (userId, route) => { const w = W(); w.EH.store.switchUser(userId); w.EH.ui.drawer = null; w.EH.ui.modal = null; w.EH.ui.f = {}; w.location.hash = route; w.EH.ui.route = route; w.EH.render(); w.scrollTo(0, 0); },
    closeDrawer: () => { const w = W(); if (w.EH.ui.modal) w.EH.closeModal(); if (w.EH.ui.drawer) w.EH.closeDrawer(); }
  };
  const role = (txt) => ($s('role').textContent = txt);
  const topOf = (get, offset = 90) => () => { const el = get(); return el ? el.getBoundingClientRect().top + W().scrollY - offset : W().scrollY; };

  /* ---------- virtual clock for the app's timers and Date ---------- */
  let vnow = 0, timerSeq = 1;
  const timers = new Map();
  const patchClock = () => {
    const w = W();
    w.setTimeout = (fn, ms, ...a) => { const id = timerSeq++; timers.set(id, { at: vnow + (ms || 0), fn, a }); return id; };
    w.clearTimeout = (id) => timers.delete(id);
    const RealDate = w.Date, BASE = new RealDate(2026, 10, 19, 10, 15, 0).getTime();
    class VDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(BASE + vnow); } static now() { return BASE + vnow; } }
    w.Date = VDate;
    try { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }); } catch (e) {}
  };
  const runTimers = () => {
    for (;;) {
      let next = null;
      for (const [id, tm] of timers) if (tm.at <= vnow && (!next || tm.at < next[1].at)) next = [id, tm];
      if (!next) break;
      timers.delete(next[0]);
      try { typeof next[1].fn === 'function' && next[1].fn(...next[1].a); } catch (e) { console.error(e); }
    }
  };

  /* =====================================================================================
     SCENARIO v2 (≈ 2 min) — see PLAN-v2.md
     ===================================================================================== */
  const RING = (size, dash) => `<svg class="logo-ring" viewBox="0 0 100 100" style="width:${size}px;height:${size}px"><circle class="ring-a" cx="50" cy="50" r="38" fill="none" stroke="#5645D4" stroke-width="9" stroke-dasharray="${dash}" stroke-linecap="butt" transform="rotate(-90 50 50)"/><circle class="ring-c" cx="50" cy="50" r="12" fill="#0A1530"/></svg>`;
  const halos = '<i class="halo h1"></i><i class="halo h2"></i>';
  const appear = (el, sel, t, start, dur = 0.6, dy = 22) => el.querySelectorAll(sel).forEach((x, i) => { const k = easeOut(prog(t, start + i * 0.18, dur)); x.style.opacity = k; x.style.transform = `translateY(${(1 - k) * dy}px)`; });
  const DEFIS = [
    ['1', 'Programmes et activités', 'Planifier, confirmer, rappeler, clôturer.'],
    ['2', 'Parcours entrepreneur', 'De la candidature à l’espace bénéficiaire.'],
    ['4', 'Centralisation et reporting', 'Rapports pré-remplis, validés, consolidés.'],
    ['8', 'Pilotage et décision', 'Mesurer, comparer, alerter, agir.']
  ];

  /** Full-screen section card (problem / answer / workflow preview). */
  const sectionCard = (t0, n, title, problem, keywords, steps) => full(t0, t0 + 3.8, () => `${halos}<div class="sec">
      <span class="chip">Défi ${n}</span><h2>${title}</h2>
      <div class="row"><div class="box"><small>Le problème</small><p>${problem}</p></div>
      <div class="box ans"><small>Notre réponse</small><div class="kw">${keywords.map((k) => `<span>${k}</span>`).join('')}</div></div></div>
      <div class="steps">${steps.map((s, i) => `<span class="st"><b>${i + 1}</b>${s}</span>`).join('<span class="ar">→</span>')}</div></div>`,
  (el, t) => {
    const h = easeOut(prog(t, 0.05, 0.6));
    el.querySelector('.chip').style.opacity = h; el.querySelector('h2').style.opacity = h; el.querySelector('h2').style.transform = `translateY(${(1 - h) * 18}px)`;
    appear(el, '.box', t, 0.35); appear(el, '.kw span', t, 0.7, 0.35, 10); el.querySelectorAll('.st, .ar').forEach((x, i) => { const k = easeOut(prog(t, 1.1 + i * 0.08, 0.35)); x.style.opacity = k; });
  }, { fi: 0.45, fo: 0.45 });

  // 0 · Opening (0–3.6)
  full(0, 3.7, () => `${halos}<div class="fs-center">${RING(170, '0 240')}<div class="brand">ELIFE <span>Hub</span></div><div class="tag">Le pilotage du programme d'incubation ELIFE</div></div>`, (el, t) => {
    const k = easeIO(prog(t, 0.1, 1.2));
    el.querySelector('.ring-a').setAttribute('stroke-dasharray', `${29 * k} ${11 * k + (1 - k) * 40}`);
    el.querySelector('.ring-a').setAttribute('transform', `rotate(${-90 + 120 * easeOut(prog(t, 0.1, 1.8))} 50 50)`);
    const c = el.querySelector('.ring-c'); c.style.transformOrigin = '50px 50px'; c.style.transform = `scale(${easeOut(prog(t, 0.6, 0.5))})`;
    const b = easeOut(prog(t, 0.9, 0.7)), g = easeOut(prog(t, 1.4, 0.7));
    Object.assign(el.querySelector('.brand').style, { opacity: b, transform: `translateY(${(1 - b) * 22}px)` });
    Object.assign(el.querySelector('.tag').style, { opacity: g });
  }, { fi: 0.01, fo: 0.45 });

  // 1 · Summary (3.4–7.2)
  full(3.4, 7.3, () => `${halos}<div class="fs-center"><div class="headline" style="font-size:60px">6 centres, 1 PMO, des bénéficiaires.<br><b>4 défis traités en profondeur.</b></div><div class="tiles">${DEFIS.map(([n, h, p]) => `<div class="tile"><span class="n">${n}</span><h3>${h}</h3><p>${p}</p></div>`).join('')}</div></div>`, (el, t) => {
    const h = easeOut(prog(t, 0.1, 0.6)); const hd = el.querySelector('.headline'); hd.style.opacity = h; hd.style.transform = `translateY(${(1 - h) * 16}px)`;
    appear(el, '.tile', t, 0.6, 0.6, 30);
  }, { fi: 0.45, fo: 0.45 });

  /* ---------------- DÉFI 1 · Programmes et activités (7.0–37.0) ---------------- */
  const D1 = ['Planifier', 'Confirmer', 'Rappeler', 'Clôturer'];
  sectionCard(7.0, '1', 'Gestion intégrée des programmes et des activités', 'Plusieurs programmes en parallèle, des oublis et des conflits.', ['Planning partagé', 'Intervenant confirmé', 'Présences numériques'], D1);
  flow(10.6, 36.8, '1', 'Programmes et activités', D1, [10.6, 19.4, 24.0, 28.0]);
  camTo(10.4, 0.01, wide);
  showCursor(10.9, 34.8);
  // Planifier: real form, conflict detected, corrected
  press(10.9, () => q('#main [data-action=new-activity]'), { travel: 0.9 });
  camTo(12.2, 0.8, focus(() => q('#fld-programme'), 1.38, 0, 140));
  type(12.9, 13.8, () => q('#fld-title'), 'Atelier prix et marges');
  at(13.9, () => { setField(q('#fld-programme'), 'p1'); setField(q('#fld-type'), 'Atelier'); });
  cursorTo(13.9, 0.5, () => q('#fld-date'));
  at(14.4, () => setField(q('#fld-date'), '2026-11-24'));
  cursorTo(14.45, 0.4, () => q('#fld-time'));
  at(14.85, () => setField(q('#fld-time'), '16:30'));
  cursorTo(14.9, 0.45, () => q('#fld-room'));
  at(15.35, () => setField(q('#fld-room'), 'ro-djerba-1'));
  press(15.4, () => q('.drawer .drawer-foot button.primary[type=submit]'), { travel: 0.6 });
  camTo(16.3, 0.7, focus(() => q('.drawer .callout.warn'), 1.45, 0, 60));
  caption(16.5, 19.3, { kicker: 'Planifier', title: 'Conflit détecté <b>avant</b> l’enregistrement', sub: 'Même salle, même créneau : on change l’heure.' });
  cursorTo(17.3, 0.6, () => q('#fld-time'));
  at(18.0, () => setField(q('#fld-time'), '10:00'));
  press(18.2, () => q('.drawer .drawer-foot button.primary[type=submit]'), { travel: 0.55 });
  // Confirmer
  press(19.3, () => nav('aujourdhui'), { travel: 0.65, ring: false });
  camTo(20.2, 0.7, focus(() => q('#main .grid-2 > section.panel'), 1.32, 0, -60));
  press(20.6, () => rowBtn('Faire confirmer', 'button'), { travel: 0.8 });
  camTo(21.8, 0.7, focus(() => ddOf('Intervenant'), 1.5, 0, 40));
  press(22.3, () => q('.drawer [data-action=speaker-status]'), { travel: 0.75 });
  caption(22.4, 25.4, { kicker: 'Confirmer', title: 'Intervenant <b>confirmé</b> en un clic', sub: 'Sans réponse à J-3 : alerte au chargé et au PMO.' });
  // Rappeler
  camTo(23.9, 0.7, focus(() => ddOf('Rappel'), 1.45, 0, -40));
  press(24.0, () => q('.drawer [data-action=send-reminder]'), { travel: 0.75 });
  card(25.2, 27.8, () => ddOf('Rappel'), '<span>Tracé sur l’activité</span><small>E-mail simulé dans le prototype · envoi réel via n8n prévu</small>', { icon: 'bell', side: 'left' });
  caption(25.6, 27.9, { kicker: 'Rappeler', title: 'Rappel J-1 <b>tracé</b>' });
  // Clôturer
  at(28.0, app.closeDrawer);
  camTo(28.0, 0.6, focus(() => q('#main .grid-2 > section.panel'), 1.32, 0, -60));
  press(28.1, () => rowBtn('Clôturer « Atelier pitch »', 'button'), { travel: 0.75 });
  const checks = () => qa('.drawer .check-list label.check');
  const notAmira = (n) => () => checks().filter((l) => !l.textContent.includes('Amira'))[n];
  camTo(29.2, 0.6, focus(() => q('.drawer .check-list'), 1.45));
  cursorTo(29.9, 0.5, notAmira(1), -150, 0); click(30.55, notAmira(1), (el) => el && el.querySelector('input').click());
  cursorTo(30.7, 0.45, notAmira(4), -150, 0); click(31.3, notAmira(4), (el) => el && el.querySelector('input').click());
  caption(30.0, 34.6, { kicker: 'Clôturer', title: 'Présences cochées, <b>taux calculé</b>', sub: 'La cohorte est pré-remplie ; le rapport du mois se met à jour.' });
  press(31.4, () => q('.drawer .drawer-foot button[type=submit]'), { travel: 0.55 });
  at(32.2, () => { const b = q('.drawer-body'); if (b) b.scrollTop = 0; if (D().activeElement) D().activeElement.blur(); });
  camTo(32.3, 0.6, focus(() => ddOf('Taux de présence'), 1.6, 0, 30));
  card(33.0, 35.0, () => ddOf('Taux de présence'), '<span>Taux de présence</span><small>Repris dans le rapport et le tableau de bord</small>', { icon: 'gauge', side: 'right', gap: 60 });
  banner(35.1, 37.1, 'Chaque activité suivie, de la planification à la clôture.');

  /* ---------------- DÉFI 2 · Parcours entrepreneur (37.0–66.2) ---------------- */
  const D2 = ['Candidature', 'Sélection', 'Accompagnement', 'Espace bénéficiaire'];
  sectionCard(37.0, '2', 'Parcours d’incubation et suivi des entrepreneurs', 'Chaque parcours est différent, et son suivi est dispersé.', ['Sélection tracée', 'Étapes et exercices', 'Espace bénéficiaire'], D2);
  at(37.8, () => { app.as('u-djerba', 'entrepreneurs'); });
  camTo(40.4, 0.01, wide);
  flow(40.6, 66.0, '2', 'Parcours entrepreneur', D2, [40.6, 46.2, 50.6, 55.0]);
  showCursor(40.8, 54.6);
  // Candidature: real Excel import
  press(40.8, () => q('#main [data-action=import-candidates]'), { travel: 0.8 });
  at(41.95, async () => {
    const buf = await (await fetch('../tests/fixtures/candidats.xlsx')).arrayBuffer();
    const w = W(), f = new w.File([buf], 'candidats.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dt = new w.DataTransfer(); dt.items.add(f);
    const input = q('#import-file'); input.files = dt.files; input.dispatchEvent(new w.Event('change', { bubbles: true }));
  });
  camTo(42.4, 0.7, focus(() => q('.drawer .imp-summary'), 1.42, 0, 80));
  caption(42.6, 45.9, { kicker: 'Candidature', title: 'Import Excel <b>contrôlé</b>', sub: 'Doublons ignorés, erreurs signalées, lignes valides insérées.' });
  press(43.7, () => q('.drawer [data-action=cand-import]'), { travel: 0.75 });
  // Sélection: candidate with interview + committee
  const candName = () => (W().EH.store.data.entrepreneurs.find((e) => e.centre === 'djerba' && e.stage === 'candidat' && e.committee) || {}).name;
  const entLink = (name) => () => qa('#main .link-btn').find((b) => b.textContent.trim() === name());
  camTo(45.0, 0.6, wide);
  press(45.3, entLink(candName), { travel: 0.8 });
  camTo(46.5, 0.7, focus(() => sectionOf('Parcours de sélection'), 1.45, 0, 20));
  card(47.3, 49.9, () => sectionOf('Parcours de sélection'), '<span>Entretien 3/5 · comité favorable</span><small>Décision de sélection à prendre</small>', { icon: 'users', side: 'left' });
  caption(46.8, 50.1, { kicker: 'Sélection', title: 'Une sélection <b>tracée</b>', sub: 'Entretien, avis du comité, décision.' });
  // Accompagnement: search Amira, open her file
  at(50.4, app.closeDrawer);
  camTo(50.4, 0.5, wide);
  cursorTo(50.5, 0.5, () => q('#f-ent\\.q'));
  type(51.05, 51.6, () => q('#f-ent\\.q'), 'Amira');
  press(51.9, entLink(() => 'Amira Ben Salem'), { travel: 0.55 });
  camTo(52.7, 0.6, focus(() => q('.drawer .stepper'), 1.45, 0, 60));
  camTo(53.6, 0.7, focus(() => sectionOf('Exercices'), 1.45, 0, 0));
  caption(52.8, 54.8, { kicker: 'Accompagnement', title: 'Tout le <b>parcours</b>, au même endroit', sub: 'Étapes, séances, livrables, exercices.' });
  // Espace bénéficiaire
  wipe(55.4, 'Bénéficiaire', 'Amira, porteuse de projet', () => {
    app.closeDrawer();
    const amira = W().EH.store.data.users.find((u) => u.role === 'beneficiaire' && u.centre === 'djerba');
    app.as(amira.id, 'mon-espace'); role('Bénéficiaire · Amira');
  });
  camTo(55.8, 0.01, wide);
  camTo(55.9, 0.7, focus(() => row('Atelier pitch'), 1.36, 0, 60));
  showCursor(56.2, 64.6);
  press(56.2, () => rowBtn('Atelier pitch', 'button'), { travel: 0.7 });
  camTo(57.2, 0.7, focus(() => q('.drawer .form-grid'), 1.42, 0, 20));
  caption(56.4, 60.4, { kicker: 'Espace bénéficiaire', title: 'Le bénéficiaire devient <b>acteur</b>', sub: 'Il rend ses rapports et ses exercices en ligne.' });
  at(57.8, () => {
    const fields = qa('.drawer .form-grid input, .drawer .form-grid textarea');
    const texts = fields.filter((f) => ['text', 'url', 'number'].includes(f.type) || f.tagName === 'TEXTAREA');
    const radios = [...new Set(fields.filter((f) => f.type === 'radio').map((f) => f.name))];
    const VAL = (f) => (f.type === 'url' ? 'https://drive.exemple.tn/pitch-amira' : f.type === 'number' ? '6' : f.tagName === 'TEXTAREA' ? 'Pitch de 3 minutes répété avec la mentore.' : 'Clarté du message');
    const span = 1.6 / Math.max(1, texts.length);
    texts.forEach((f, i) => typers.push({ t0: 57.85 + i * span, t1: 57.85 + (i + 1) * span - 0.1, get: () => f, text: VAL(f), n: -1 }));
    radios.forEach((n, i) => at(58.3 + i * 0.3, () => { const opts = qa(`.drawer input[name="${n}"]`); const o = opts[Math.min(opts.length - 1, 3)]; if (o) { o.checked = true; o.dispatchEvent(new (W().Event)('input', { bubbles: true })); } }));
    events.sort((a, b) => a.t - b.t);
  });
  press(59.4, () => q('.drawer .drawer-foot button[data-intent=send]'), { travel: 0.6 });
  // refused access, typed in the address bar
  camTo(60.6, 0.7, () => ({ fx: 960, fy: 72 + 300 / 1.6, s: 1.6 }));
  typeUrl(60.9, 61.8, 'elife-hub/#entrepreneurs', 64.6);
  at(62.0, () => { W().location.hash = 'entrepreneurs'; });
  card(62.3, 64.4, () => q('#toast-root .toast'), '<span>Refusé et enregistré au journal</span><small>Chacun ne voit que ses propres données</small>', { icon: 'shield', tone: 'bad', side: 'bottom' });
  caption(62.2, 64.6, { kicker: 'Espace bénéficiaire', title: 'Il ne voit <b>que ses données</b>' });
  camTo(64.3, 0.6, wide);
  banner(64.4, 66.3, 'Le parcours complet, de la candidature à la sortie.');

  /* ---------------- DÉFI 4 · Centralisation et reporting (66.2–90.0) ---------------- */
  const D4 = ['Pré-remplir', 'Soumettre', 'Valider', 'Consolider'];
  sectionCard(66.2, '4', 'Centralisation des données et reporting', 'Six centres, des chiffres consolidés à la main.', ['Base partagée', 'Rapport pré-rempli', 'Validé et verrouillé'], D4);
  at(66.9, () => { app.as('u-djerba', 'aujourdhui'); role('Chargé · Djerba'); });
  camTo(69.6, 0.01, wide);
  flow(69.8, 89.8, '4', 'Centralisation et reporting', D4, [69.8, 73.6, 77.4, 83.2]);
  showCursor(69.9, 87.6);
  camTo(69.8, 0.6, focus(() => q('#main .grid-2 > section.panel'), 1.32, 0, -60));
  press(70.0, () => rowBtn("Rédiger le rapport d'activité · « Mentorat", 'button'), { travel: 0.75 });
  at(70.95, () => { const s = q('#activity-report'); if (s) s.scrollIntoView({ block: 'start' }); });
  camTo(71.1, 0.7, focus(() => q('#activity-report .panel'), 1.5));
  card(71.9, 74.0, () => q('#activity-report .panel'), '<span>Pré-rempli depuis la fiche</span><small>Présents, taux, intervenant, budget</small>', { icon: 'file', side: 'left' });
  caption(71.4, 73.8, { kicker: 'Pré-remplir', title: '<b>Rien</b> à ressaisir' });
  camTo(73.6, 0.6, focus(() => q('#activity-report form'), 1.45));
  type(74.2, 75.1, () => q('#fld-ar-difficulties'), 'Salle un peu petite pour le groupe.');
  type(75.2, 76.1, () => q('#fld-ar-needs'), 'Un mentor en vente en ligne.');
  caption(74.0, 77.1, { kicker: 'Soumettre', title: 'Le chargé ajoute <b>le qualitatif</b>', sub: 'Difficultés et besoins d’appui, puis il soumet au PMO.' });
  press(76.1, () => q('#activity-report button[type=submit]:not([data-intent])'), { travel: 0.55 });
  wipe(77.7, 'PMO central', 'Validation', () => { app.closeDrawer(); app.as('u-pmo', 'pilotage'); role('PMO central'); });
  const validatePanel = () => panelOf('À valider');
  camTo(78.0, 0.01, wide);
  scroll(78.1, 0.8, topOf(validatePanel, 120));
  camTo(78.8, 0.6, focus(validatePanel, 1.36));
  caption(78.6, 82.6, { kicker: 'Valider', title: 'Le PMO valide et <b>verrouille</b>', sub: 'Les chiffres validés sont figés, identiques partout.' });
  showCursor(78.9, 87.6);
  press(78.9, () => { const p = validatePanel(); return p && rowBtn('Djerba', 'button', p); }, { travel: 0.75 });
  at(79.85, () => { const s = q('#activity-report'); if (s) s.scrollIntoView({ block: 'start' }); });
  camTo(80.0, 0.6, focus(() => q('#activity-report'), 1.32, 0, -140));
  press(80.2, () => q('#activity-report [data-action=ar-validate]'), { travel: 0.7 });
  card(81.3, 83.1, () => q('#activity-report h3'), '<span>Validé et verrouillé</span><small>Chiffres figés à la validation</small>', { icon: 'lock', tone: 'ok', side: 'left' });
  at(83.2, app.closeDrawer);
  press(83.3, () => nav('rapports'), { travel: 0.6, ring: false });
  camTo(84.2, 0.7, focus(() => q('#main [data-action=export-csv]'), 1.3, -300, 120));
  press(84.9, () => q('#main [data-action=export-csv]'), { travel: 0.7 });
  caption(84.4, 88.0, { kicker: 'Consolider', title: '<b>6 centres</b>, un seul export', sub: 'Sans fichier à fusionner, sans données personnelles.' });
  banner(88.0, 90.0, 'Une seule source de vérité, plus de consolidation manuelle.');

  /* ---------------- DÉFI 8 · Pilotage et décision (90.0–111.2) ---------------- */
  const D8 = ['Mesurer', 'Comparer', 'Alerter', 'Agir'];
  sectionCard(90.0, '8', 'Pilotage stratégique et aide à la décision', 'Le PMO manque d’une vision globale pour décider.', ['Indicateurs fiables', 'Centres comparés', 'Alertes utiles'], D8);
  at(90.7, () => { app.as('u-pmo', 'pilotage'); });
  camTo(93.4, 0.01, wide);
  flow(93.6, 111.0, '8', 'Pilotage et décision', D8, [93.6, 97.6, 101.4, 105.0]);
  showCursor(95.0, 108.6);
  camTo(93.7, 0.7, focus(() => q('#main .kpis'), 1.3));
  caption(94.0, 97.4, { kicker: 'Mesurer', title: 'Indicateurs <b>validés ou provisoires</b>', sub: 'Chaque formule est expliquée, jamais de 0 trompeur.' });
  scroll(95.2, 0.8, topOf(() => q('#rate-charts'), 90));
  camTo(95.4, 0.7, focus(() => q('#rate-charts'), 1.16, 0, 30));
  press(95.6, () => qa('#rate-charts .ring-card').find((b) => /Présence/.test(b.textContent)), { travel: 0.75 });
  scroll(97.6, 0.8, topOf(() => panelOf('Comparaison des centres'), 90));
  camTo(98.0, 0.7, focus(() => panelOf('Comparaison des centres'), 1.22, 0, -40));
  caption(98.4, 101.2, { kicker: 'Comparer', title: 'Qui a <b>besoin d’appui</b> ?', sub: 'Activités par état, présence, rapports : centre par centre.' });
  scroll(101.4, 0.7, topOf(() => panelOf('Alertes'), 110));
  camTo(101.8, 0.7, focus(() => panelOf('Alertes'), 1.36));
  let alertsStart = null;
  card(102.6, 105.0, () => (panelOf('Alertes') || {}).querySelector && panelOf('Alertes').querySelector('h2'), '', {
    icon: 'trend', tone: 'ok', side: 'left',
    live: () => { const now = W().EH.q.alerts(W().EH.store.data, null).length; return `<span>Alertes : ${alertsStart} → ${now}</span><small>Depuis le début de la démo, grâce aux actions du chargé</small>`; }
  });
  caption(102.2, 104.9, { kicker: 'Alerter', title: 'Les alertes <b>avant</b> le problème' });
  scroll(105.0, 0.7, topOf(() => panelOf('Comparaison des centres'), 90));
  const kefChip = () => { const tr = qa('#main .table tbody tr').find((r) => r.textContent.includes('Le Kef')); return tr && tr.querySelector('.st-chip.bad'); };
  camTo(105.5, 0.6, focus(kefChip, 1.36, 0, 40));
  press(105.7, kefChip, { travel: 0.75 });
  camTo(106.9, 0.6, focus(() => q('#main .table'), 1.2, 0, -60));
  caption(107.0, 109.4, { kicker: 'Agir', title: 'Du chiffre <b>à l’action</b>, en un clic' });
  banner(109.3, 111.2, 'Le PMO voit tout et agit au bon endroit.');

  /* ---------------- Recap + under the hood (111.2–116.4) ---------------- */
  full(111.2, 116.5, () => `${halos}<div class="fs-center"><div class="headline" style="font-size:60px">4 défis, <b>un seul fil</b></div><div class="tiles">${DEFIS.map(([n, h, p]) => `<div class="tile"><span class="ok">${svg('check')}</span><span class="n">${n}</span><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
    <div class="capot"><span><b>Sans serveur</b> · s’ouvre en un double-clic</span><span><b>Droits par rôle</b> · accès refusés journalisés</span><span><b>150 tests</b> automatiques</span></div></div>`, (el, t) => {
    const h = easeOut(prog(t, 0.1, 0.6)); const hd = el.querySelector('.headline'); hd.style.opacity = h;
    appear(el, '.tile', t, 0.4, 0.5, 26); appear(el, '.capot span', t, 1.6, 0.5, 14);
  }, { fi: 0.5, fo: 0.45 });

  /* ---------------- Closing (116.2–121.5) ---------------- */
  full(116.2, 121.6, () => `${halos}<div class="fs-center">${RING(140, '29 11')}<div class="brand">ELIFE <span>Hub</span></div><div class="tag">Six centres. Un seul fil.</div>
    <div class="team">${TEAM.length ? 'Équipe : ' + TEAM.join(' · ') : 'Équipe ELIFE Hub'}</div>
    <div class="credit">Prototype réalisé pour le hackathon ELIFE Incubation Workflow · ELIFE NextGen Fest 2026</div>
    <div class="foot">Coordination, partenaires et connaissances sont aussi dans la plateforme.</div></div>`, (el, t) => {
    el.querySelector('.ring-a').setAttribute('transform', `rotate(${-90 + 90 * easeOut(prog(t, 0, 2.5))} 50 50)`);
    appear(el, '.brand, .tag, .team, .credit, .foot', t, 0.3, 0.6, 16);
  }, { fi: 0.5, fo: 0.01 });

  const DURATION = 121.5; // scenario length (seconds, v2 timing)

  /* ---------- v3 pitch: what is shown, and the slow-motion time warp ---------- */
  const SHOW = { captions: false, banners: false, cards: true };
  const SECTION_SECONDS = 40; // each défi (section card + workflow demo) lasts this long in the video
  /** [scenario start, scenario end, video length] — the opening and the ending keep their real speed. */
  const WARP = [[0, 7.0, 7.0], [7.0, 37.0, SECTION_SECONDS], [37.0, 66.2, SECTION_SECONDS], [66.2, 90.0, SECTION_SECONDS], [90.0, 111.2, SECTION_SECONDS], [111.2, DURATION, DURATION - 111.2]];
  let vacc = 0;
  const SEG = WARP.map(([s0, s1, len]) => { const g = { s0, s1, v0: vacc, v1: vacc + len }; vacc += len; return g; });
  const VDURATION = vacc;
  const toScene = (tv) => { const g = SEG.find((x) => tv < x.v1) || SEG[SEG.length - 1]; return g.s0 + (Math.min(tv, g.v1) - g.v0) * (g.s1 - g.s0) / (g.v1 - g.v0); };
  const toVideo = (ts) => { const g = SEG.find((x) => ts < x.s1) || SEG[SEG.length - 1]; return g.v0 + (Math.min(ts, g.s1) - g.s0) * (g.v1 - g.v0) / (g.s1 - g.s0); };
  const SECTIONS = [['1', 'Programmes et activités'], ['2', 'Parcours entrepreneur'], ['4', 'Centralisation et reporting'], ['8', 'Pilotage et décision']].map(([n, title], i) => ({ n, title, v0: SEG[i + 1].v0, v1: SEG[i + 1].v1 }));
  events.sort((a, b) => a.t - b.t);
  camKeys.sort((a, b) => a.t - b.t);
  curKeys.sort((a, b) => a.t - b.t);
  whooshes.push(...fulls.map((f) => f.t0).filter((t) => t > 1));

  /* =====================================================================================
     FRAME RENDERING
     ===================================================================================== */
  const update = (t) => {
    camNow = camAt(t);
    cam.style.transform = `translate(${960 - camNow.s * camNow.fx}px, ${540 - camNow.s * camNow.fy}px) scale(${camNow.s})`;

    for (const ty of typers) {
      if (t < ty.t0) continue;
      const n = Math.round(ty.text.length * prog(t, ty.t0, ty.t1 - ty.t0));
      if (n !== ty.n) { const f = ty.get(); if (f) { f.value = ty.text.slice(0, n); f.dispatchEvent(new (W().Event)('input', { bubbles: true })); } ty.n = n; }
    }
    for (const sc of scrolls) {
      if (t < sc.t0 || t > sc.t0 + sc.dur + 0.05) continue;
      if (sc.to == null) { sc.from = W().scrollY; sc.to = sc.getTop(); }
      W().scrollTo(0, lerp(sc.from, sc.to, easeIO(prog(t, sc.t0, sc.dur))));
    }

    let sp = null;
    for (const s of spots) { const o = env(t, s.t0, s.t1, 0.5, 0.5); if (o > 0) sp = { s, o }; }
    if (sp) { const el = sp.s.get(); const r = el && el.getBoundingClientRect(); if (r) Object.assign(spotEl.style, { left: r.left - sp.s.pad + 'px', top: r.top - sp.s.pad + 'px', width: r.width + 2 * sp.s.pad + 'px', height: r.height + 2 * sp.s.pad + 'px', opacity: sp.o }); }
    else spotEl.style.opacity = 0;

    // captions
    let cap = null;
    for (const c of (SHOW.captions ? captions : [])) { const o = env(t, c.t0, c.t1, 0.4, 0.3); if (o > 0) cap = { c, o, k: easeOut(prog(t, c.t0, 0.5)) }; }
    const capEl = $s('caption');
    if (cap) {
      if (capEl.dataset.id !== String(cap.c.t0)) { $s('cap-kicker').innerHTML = cap.c.kicker || ''; $s('cap-title').innerHTML = cap.c.title || ''; $s('cap-sub').innerHTML = cap.c.sub || ''; capEl.dataset.id = String(cap.c.t0); }
      capEl.style.opacity = cap.o; capEl.style.transform = `translateY(${(1 - cap.k) * 22}px)`;
    } else capEl.style.opacity = 0;
    const capBox = cap ? capEl.getBoundingClientRect() : null;

    // annotation cards (kept clear of the caption area)
    for (const c of cards) {
      const o = SHOW.cards ? env(t, c.t0, c.t1, 0.4, 0.3) : 0;
      if (o <= 0) { c.el.style.opacity = 0; continue; }
      if (c.live && !c.filled) { c.el.querySelector('div').innerHTML = c.live(); c.filled = true; }
      const el = c.get(); const r = el ? rectOf(el) : null;
      if (r) c.last = r;
      const rr = c.last; if (!rr) { c.el.style.opacity = 0; continue; }
      const a = toStage(rr.x, rr.y), b = toStage(rr.x + rr.w, rr.y + rr.h);
      const cw = c.el.offsetWidth, ch = c.el.offsetHeight, k = easeOut(prog(t, c.t0, 0.5));
      let x, y;
      if (c.side === 'left') { x = a.x - cw - c.gap; y = (a.y + b.y) / 2 - ch / 2; }
      else if (c.side === 'right') { x = b.x + c.gap; y = (a.y + b.y) / 2 - ch / 2; }
      else if (c.side === 'top') { x = (a.x + b.x) / 2 - cw / 2; y = a.y - ch - c.gap; }
      else { x = (a.x + b.x) / 2 - cw / 2; y = b.y + c.gap; }
      x = clamp(x, 40, 1880 - cw); y = clamp(y, 90, 1000 - ch);
      if (capBox && x < capBox.right + 20 && y + ch > capBox.top - 20) y = capBox.top - 30 - ch;
      Object.assign(c.el.style, { left: x + 'px', top: y + 'px', opacity: o, transform: `scale(${0.92 + 0.08 * k})` });
    }

    // focus rings on clicked elements
    for (const r of rings) {
      const o = env(t, r.t0, r.t1, 0.2, 0.25);
      if (!r.el) { r.el = document.createElement('div'); r.el.className = 'fring'; $s('rings').appendChild(r.el); }
      if (o <= 0) { r.el.style.opacity = 0; continue; }
      const rr = rectOf(r.get()); if (!rr) { r.el.style.opacity = 0; continue; }
      const a = toStage(rr.x, rr.y), b = toStage(rr.x + rr.w, rr.y + rr.h), pad = 6 + 4 * Math.sin(t * 9) * 0.5;
      Object.assign(r.el.style, { left: a.x - pad + 'px', top: a.y - pad + 'px', width: b.x - a.x + 2 * pad + 'px', height: b.y - a.y + 2 * pad + 'px', opacity: o });
    }

    // workflow bar
    const flowEl = $s('flow');
    let fl = null;
    for (const f of flows) { const o = env(t, f.t0, f.t1, 0.45, 0.35); if (o > 0) fl = { f, o }; }
    if (fl) {
      const cur = fl.f.marks.reduce((m, mk, i) => (t >= mk ? i : m), 0);
      const key = fl.f.t0 + ':' + cur;
      if (flowEl.dataset.key !== key) {
        flowEl.innerHTML = `<span class="def">Défi ${fl.f.def} <span>· ${fl.f.title}</span></span>` + fl.f.steps.map((s, i) => `${i ? '<span class="sep"></span>' : ''}<span class="step ${i < cur ? 'done' : i === cur ? 'on' : ''}"><i>${i < cur ? '✓' : i + 1}</i>${s}</span>`).join('');
        flowEl.dataset.key = key;
      }
      flowEl.style.opacity = fl.o; flowEl.style.transform = `translateX(-50%) translateY(${(1 - easeOut(prog(t, fl.f.t0, 0.5))) * -16}px)`;
    } else flowEl.style.opacity = 0;

    // result banner
    const bn = $s('banner');
    let bb = null;
    for (const b of (SHOW.banners ? banners : [])) { const o = env(t, b.t0, b.t1, 0.35, 0.3); if (o > 0) bb = { b, o }; }
    if (bb) { if (bn.dataset.id !== String(bb.b.t0)) { $s('banner-text').textContent = bb.b.text; bn.dataset.id = String(bb.b.t0); } bn.style.opacity = bb.o; bn.style.transform = `translateX(-50%) scale(${0.94 + 0.06 * easeOut(prog(t, bb.b.t0, 0.4))})`; }
    else bn.style.opacity = 0;

    // address bar typing
    const ut = $s('url-text'), caret = $s('url-caret');
    const u = urls.find((x) => t >= x.t0 && t < x.back);
    if (u) { const n = Math.round(u.text.length * prog(t, u.t0, u.t1 - u.t0)); ut.textContent = u.text.slice(0, Math.max(1, n)); ut.className = 'typed'; caret.style.opacity = t < u.t1 + 0.3 && Math.floor(t * 3) % 2 === 0 ? 1 : 0; }
    else { ut.textContent = 'ELIFE Hub'; ut.className = ''; caret.style.opacity = 0; }

    // full-screen scenes
    for (const f of fulls) {
      const o = env(t, f.t0, f.t1, f.fi, f.fo);
      f.el.style.opacity = o; f.el.style.visibility = o > 0 ? 'visible' : 'hidden';
      if (o > 0) f.animate(f.el, t - f.t0);
    }

    // role transitions (v1 style)
    for (const w of wipes) {
      const a = prog(t, w.tMid - 0.5, 0.5), out = prog(t, w.tMid + 0.35, 0.45);
      const on = t >= w.tMid - 0.5 && t <= w.tMid + 0.8;
      const r = 1300 * easeIO(a);
      Object.assign(w.disc.style, { width: 2 * r + 'px', height: 2 * r + 'px', background: '#5645D4', opacity: on ? 1 - easeIO(out) : 0 });
      Object.assign(w.lab.style, { opacity: on ? Math.min(prog(t, w.tMid - 0.3, 0.25), 1 - easeIO(out)) : 0 });
    }

    // cursor
    const vis = visibility.reduce((m, v) => Math.max(m, env(t, v.t0, v.t1, 0.3, 0.3)), 0);
    cursorPos = cursorAt(t);
    Object.assign(cursorEl.style, { opacity: vis, transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)` });
    let rp = 0, rs = 0;
    for (const c of clicks) { const k = prog(t, c, 0.45); if (t >= c && k < 1) { rp = 1 - k; rs = 0.4 + 0.9 * easeOut(k); } }
    Object.assign(ripple.style, { opacity: rp * 0.9, transform: `scale(${rs})` });
    cursorEl.querySelector('svg').style.transform = clicks.some((c) => t >= c && t < c + 0.12) ? 'scale(.86)' : '';
  };

  let lastFrame = -1;
  window.renderFrame = async (i) => {
    const t = toScene(i / FPS); // video time → scenario time (slow motion inside each défi)
    if (i <= lastFrame) return;
    lastFrame = i; vnow = t * 1000;
    for (const e of events) if (!e.done && e.t <= t) { e.done = true; try { await e.fn(); } catch (err) { console.error('event', e.t, err); } }
    runTimers();
    update(t);
  };

  /* ---------- setup: fresh demo data, officer of Djerba on the activities page ---------- */
  const SRT = () => [...captions.map((c) => ({ t0: c.t0, t1: c.t1, text: [c.kicker, strip(c.title), strip(c.sub)].filter(Boolean).join(' — ') })), ...banners.map((b) => ({ t0: b.t0, t1: b.t1, text: 'Résultat — ' + b.text }))].sort((a, b) => a.t0 - b.t0);
  window.VIDEO = { FPS, DURATION: VDURATION, FRAMES: Math.round(VDURATION * FPS), clicks: clicks.map(toVideo).sort((a, b) => a - b), wipes: [...wipes.map((w) => w.tMid), ...whooshes].map(toVideo).sort((a, b) => a - b), scenes: fulls.map((f) => [toVideo(f.t0), toVideo(f.t1)]), subtitles: SRT().map((s) => ({ ...s, t0: toVideo(s.t0), t1: toVideo(s.t1) })), sections: SECTIONS, audio: { music: false, clicks: 0.5, whoosh: 0.35 }, notesOnly: !SHOW.captions };
  window.stageReady = new Promise((resolve) => {
    const go = async () => {
      const w = W();
      try { w.localStorage.clear(); } catch (e) {}
      w.EH.store.reset();
      const st = w.document.createElement('style');
      st.textContent = '::-webkit-scrollbar{width:0;height:0} html{scrollbar-width:none;scroll-behavior:auto!important}';
      w.document.head.appendChild(st);
      patchClock();
      app.as('u-djerba', 'activites'); role('Chargé · Djerba');
      alertsStart = w.EH.q.alerts(w.EH.store.data, null).length;
      await document.fonts.ready; await w.document.fonts.ready;
      update(0);
      resolve(true);
    };
    if (iframe.contentWindow && iframe.contentWindow.EH && iframe.contentDocument.readyState === 'complete') go();
    else iframe.addEventListener('load', go, { once: true });
  });

  const params = new URLSearchParams(location.search);
  window.stageReady.then(async () => {
    if (params.has('t')) { const n = Math.round(+params.get('t') * FPS); for (let i = 0; i <= n; i++) await window.renderFrame(i); }
    if (params.get('play') === '1') {
      const start = performance.now() - (params.has('t') ? +params.get('t') * 1000 : 0);
      let busy = false;
      const loop = async () => { const i = Math.floor(((performance.now() - start) / 1000) * FPS); if (i < window.VIDEO.FRAMES) { if (!busy) { busy = true; await window.renderFrame(i); busy = false; } requestAnimationFrame(loop); } };
      requestAnimationFrame(loop);
    }
  });
})();
