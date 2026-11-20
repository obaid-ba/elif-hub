/* ELIFE Hub demo video — engine + scenario.
   Every visual is a pure function of time t (seconds). App interactions are real: they are fired once,
   in order, when the timeline crosses their time. The iframe's timers run on the video clock, so toasts
   last as long in the video as in real life. render.mjs calls window.renderFrame(i) for i = 0..FRAMES-1. */
(function () {
  'use strict';
  const FPS = 60;
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
  /** 0→1 fade in over fi, hold, 1→0 fade out over fo, inside [t0, t1]. */
  const env = (t, t0, t1, fi = 0.4, fo = 0.35) => (t < t0 || t > t1 ? 0 : Math.min(prog(t, t0, fi), 1 - prog(t, t1 - fo, fo)));

  /* ---------- registries ---------- */
  const events = [], camKeys = [], curKeys = [], clicks = [], captions = [], cards = [], spots = [], fulls = [], wipes = [], typers = [], scrolls = [], visibility = [];
  const at = (t, fn) => events.push({ t, fn, done: false });

  /* ---------- app element lookup ---------- */
  const q = (sel, root) => (root || D()).querySelector(sel);
  const row = (text, root) => [...(root || D()).querySelectorAll('.list-row')].find((r) => r.textContent.includes(text));
  const rowBtn = (text, sel = 'button', root) => { const r = row(text, root); return r && r.querySelector(sel); };
  const drawer = () => q('.drawer');
  const ddOf = (label) => { const dt = [...D().querySelectorAll('.drawer dt')].find((x) => x.textContent.trim().startsWith(label)); return dt && dt.nextElementSibling; };
  const rectOf = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: WIN.x + r.left, y: WIN.y + r.top, w: r.width, h: r.height }; };

  /* ---------- camera ---------- */
  const cam0 = { fx: 960, fy: 540, s: 1 };
  /** Focus an app element (getter) at scale s; the view is kept inside the window frame. */
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
    let p = { x: 1500, y: 980 }, key = null;
    for (const k of curKeys) {
      if (t < k.t) break;
      if (!k.from) k.from = { ...cursorPos };
      key = k;
    }
    if (!key) return p;
    const el = key.get(), r = el && el.getBoundingClientRect ? rectOf(el) : null;
    const target = r ? toStage(r.x + r.w / 2 + key.ox, r.y + r.h / 2 + key.oy) : key.last || key.from;
    if (r) key.last = target;
    const e = easeIO(prog(t, key.t, key.dur));
    // slight arc for a natural hand movement
    const arc = Math.sin(Math.PI * e) * Math.min(40, Math.hypot(target.x - key.from.x, target.y - key.from.y) * 0.08);
    return { x: lerp(key.from.x, target.x, e), y: lerp(key.from.y, target.y, e) - arc };
  };
  /** Click: ripple + real action (fn receives the element). */
  const click = (t, get, fn) => { clicks.push(t); at(t, () => { const el = get(); if (fn) fn(el); else if (el) el.click(); }); };
  const showCursor = (t0, t1) => visibility.push({ t0, t1 });

  /* ---------- overlays ---------- */
  const caption = (t0, t1, c) => captions.push({ t0, t1, ...c });
  const ICONS = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    check: '<path d="m5 12 5 5 9-10"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-2.5-5.1"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>', gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a9 9 0 1 1 17.4 0"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>', layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;
  /** Annotation card anchored to an app element; side: 'left' | 'right' | 'top' | 'bottom'. */
  const card = (t0, t1, get, html, { icon = 'check', tone = '', side = 'left', gap = 26 } = {}) => {
    const el = document.createElement('div');
    el.className = 'card'; el.style.opacity = 0;
    el.innerHTML = `<span class="ic ${tone}">${svg(icon)}</span><div>${html}</div>`;
    $s('cards').appendChild(el);
    cards.push({ t0, t1, get, el, side, gap, last: null });
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
  /** Types text into a field, character by character, between t0 and t1 (real input events). */
  const type = (t0, t1, get, text) => typers.push({ t0, t1, get, text, n: -1 });
  /** Smooth scroll of the app window or of an element. */
  const scroll = (t0, dur, getEl, getTop) => scrolls.push({ t0, dur, getEl, getTop, from: null, to: null });

  /* ---------- app control ---------- */
  const app = {
    as: (userId, route) => { const w = W(); w.EH.store.switchUser(userId); w.EH.ui.drawer = null; w.EH.ui.modal = null; w.EH.ui.f = {}; w.location.hash = route; w.EH.ui.route = route; w.EH.render(); w.scrollTo(0, 0); },
    closeDrawer: () => { const w = W(); if (w.EH.ui.modal) w.EH.closeModal(); if (w.EH.ui.drawer) w.EH.closeDrawer(); },
    role: (txt) => at(currentT, () => ($s('role').textContent = txt))
  };
  let currentT = 0;
  const role = (t, txt) => at(t, () => ($s('role').textContent = txt));

  /* ---------- virtual clock for the app's timers ---------- */
  let vnow = 0, timerSeq = 1;
  const timers = new Map();
  const patchTimers = () => {
    const w = W();
    w.setTimeout = (fn, ms, ...a) => { const id = timerSeq++; timers.set(id, { at: vnow + (ms || 0), fn, a }); return id; };
    w.clearTimeout = (id) => timers.delete(id);
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
     SCENARIO (≈ 98 s)
     ===================================================================================== */
  const RING = (size, dash) => `<svg class="logo-ring" viewBox="0 0 100 100" style="width:${size}px;height:${size}px"><circle class="ring-a" cx="50" cy="50" r="38" fill="none" stroke="#5645D4" stroke-width="9" stroke-dasharray="${dash}" stroke-linecap="butt" transform="rotate(-90 50 50)"/><circle class="ring-c" cx="50" cy="50" r="12" fill="#0A1530"/></svg>`;
  const halos = '<i class="halo h1"></i><i class="halo h2"></i>';

  // 1 · Opening (0–5): the ring draws itself, then the name.
  full(0, 5.2, () => `${halos}<div class="fs-center">${RING(180, '0 240')}<div class="brand">ELIFE <span>Hub</span></div><div class="tag">Le pilotage du programme d'incubation ELIFE</div></div>`, (el, t) => {
    const k = easeIO(prog(t, 0.2, 1.6));
    const seg = 29 * k, gap = 11 * k + (1 - k) * 40; // dashes appear around the ring
    el.querySelector('.ring-a').setAttribute('stroke-dasharray', `${seg} ${gap}`);
    el.querySelector('.ring-a').setAttribute('transform', `rotate(${-90 + 120 * easeOut(prog(t, 0.2, 2.2))} 50 50)`);
    el.querySelector('.ring-c').style.transform = `scale(${easeOut(prog(t, 0.9, 0.6))})`; el.querySelector('.ring-c').style.transformOrigin = '50px 50px';
    const b = easeOut(prog(t, 1.4, 0.8)), g = easeOut(prog(t, 2.0, 0.8));
    Object.assign(el.querySelector('.brand').style, { opacity: b, transform: `translateY(${(1 - b) * 24}px)` });
    Object.assign(el.querySelector('.tag').style, { opacity: g, transform: `translateY(${(1 - g) * 16}px)` });
  }, { fi: 0.01, fo: 0.6 });

  // 2 · Problem (5–12): six centres, scattered files, no link between them.
  const CENTRES = [['Béja', 330, 250], ['Siliana', 1420, 230], ['Le Kef', 220, 640], ['Djerba', 1500, 650], ['Tozeur', 520, 860], ['Sidi Bouzid', 1180, 880]];
  const FILES = [[560, 330, -8], [1260, 380, 10], [430, 470, 6], [1560, 470, -12], [760, 760, 9], [1360, 760, -6], [980, 190, 4]];
  full(5, 12.3, () => `${halos}<div class="headline" style="position:relative;z-index:2">Six centres.<br>Des fichiers <b>partout</b>.</div>${CENTRES.map(([n, x, y], i) => `<div class="pill" data-i="${i}" style="left:${x}px;top:${y}px"><i></i>${n}</div>`).join('')}${FILES.map(([x, y, r], i) => `<div class="file ${i % 3 === 0 ? 'x' : ''}" data-f="${i}" style="left:${x}px;top:${y}px;transform:rotate(${r}deg)"></div>`).join('')}`, (el, t) => {
    el.querySelectorAll('.pill').forEach((p) => { const i = +p.dataset.i, k = easeOut(prog(t, 0.2 + i * 0.12, 0.6)); p.style.opacity = k; p.style.translate = `0 ${Math.sin((t + i) * 1.3) * 6 + (1 - k) * 30}px`; });
    el.querySelectorAll('.file').forEach((f) => { const i = +f.dataset.f, k = easeOut(prog(t, 1.0 + i * 0.1, 0.5)); f.style.opacity = k * 0.95; f.style.translate = `${Math.cos((t + i) * 0.9) * 5}px ${Math.sin((t * 1.1 + i)) * 7}px`; });
    const h = easeOut(prog(t, 0.6, 0.8)); const hd = el.querySelector('.headline'); hd.style.opacity = h; hd.style.transform = `translateY(${(1 - h) * 20}px)`;
  });

  // 3 · Introduction (12–18.5): the centres converge into one platform, revealing the real app (PMO view).
  full(12, 16.6, () => `${halos}<div class="headline" style="position:relative;z-index:2">Une plateforme.<br><b>Un seul fil.</b></div>${CENTRES.map(([n, x, y], i) => `<div class="pill" data-i="${i}" data-x="${x}" data-y="${y}" style="left:${x}px;top:${y}px"><i></i>${n}</div>`).join('')}`, (el, t) => {
    el.querySelectorAll('.pill').forEach((p) => { const k = easeIO(prog(t, 0.8, 1.6)); const x = +p.dataset.x, y = +p.dataset.y; p.style.translate = `${(880 - x) * k}px ${(600 - y) * k}px`; p.style.scale = String(1 - 0.5 * k); p.style.opacity = 1 - prog(t, 2.0, 0.5); });
    const h = easeOut(prog(t, 1.4, 0.8)); const hd = el.querySelector('.headline'); hd.style.opacity = h; hd.style.transform = `scale(${0.96 + 0.04 * h})`;
  }, { fi: 0.01, fo: 0.9 });
  role(0, 'PMO central');
  camTo(12, 0.01, () => ({ fx: 960, fy: 560, s: 0.9 }));
  camTo(15.7, 2.6, wide);
  caption(16.8, 18.4, { title: 'Six centres, un PMO, des bénéficiaires : <b>ensemble</b>.' });

  // transition → officer
  wipe(19.0, 'Chargé de programme', 'Centre de Djerba', () => { app.as('u-djerba', 'aujourdhui'); $s('role').textContent = 'Chargé · Djerba'; });

  // 4 · Officer home (19.4–25)
  const todoPanel = () => q('#main .grid-2 > section.panel');
  camTo(19.5, 0.01, wide);
  camTo(19.8, 1.0, focus(todoPanel, 1.32, 0, -40));
  spot(20.4, 24.6, todoPanel, 6);
  caption(20.0, 24.8, { kicker: 'Chargé de programme · Djerba', title: "Chaque matin, l'<b>essentiel</b>", sub: 'Tout ce qui est à faire, trié par urgence, à un clic.' });
  showCursor(20.6, 52.4);
  cursorTo(20.6, 1.2, () => row('Rapport octobre'), 160, 0);
  cursorTo(22.0, 1.2, () => row('Clôturer « Atelier pitch »'), 200, 0);

  // 5 · Speaker confirmation (25–35)
  const confirmRowBtn = () => rowBtn('Faire confirmer', 'button');
  cursorTo(25.0, 1.0, confirmRowBtn);
  click(26.1, confirmRowBtn);
  camTo(26.4, 0.9, focus(() => ddOf('Intervenant'), 1.42, 0, 30));
  card(27.3, 31.2, () => q('.drawer .callout'), '<span>Alerte J-3</span><small>Visible aussi par le PMO</small>', { icon: 'alert', tone: 'warn', side: 'left' });
  const confirmBtn = () => q('.drawer [data-action=speaker-status]');
  cursorTo(28.3, 1.0, confirmBtn);
  click(29.5, confirmBtn);
  caption(29.8, 34.6, { title: 'Intervenant <b>confirmé</b> en un clic', sub: "Proposé → Confirmé : l'activité passe en « Confirmée »." });
  card(30.0, 34.4, () => ddOf('Intervenant'), '<span>Confirmé</span><small>Journalisé automatiquement</small>', { icon: 'check', tone: 'ok', side: 'left' });

  // 6 · Reminder (35–42)
  const remindBtn = () => q('.drawer [data-action=send-reminder]');
  camTo(34.8, 0.9, focus(() => ddOf('Rappel'), 1.38, 0, -60));
  cursorTo(35.0, 1.1, remindBtn);
  click(36.4, remindBtn);
  card(37.0, 41.6, () => ddOf('Rappel'), '<span>Tracé sur l\'activité</span><small>Participants + intervenant</small>', { icon: 'bell', side: 'left' });
  caption(37.2, 41.8, { title: 'Rappel envoyé, <b>tracé</b>', sub: 'Personne n’oublie l’heure, le lieu ou le lien.' });

  // 7 · Closing with attendance (42–53)
  at(42.0, app.closeDrawer);
  camTo(42.0, 0.9, focus(todoPanel, 1.32, 0, -40));
  const closeRowBtn = () => rowBtn('Clôturer « Atelier pitch »', 'button');
  cursorTo(42.6, 1.0, closeRowBtn);
  click(43.9, closeRowBtn);
  const checks = () => [...D().querySelectorAll('.drawer .check-list label.check')];
  const notAmira = (n) => () => checks().filter((l) => !l.textContent.includes('Amira'))[n];
  camTo(44.2, 0.9, focus(() => q('.drawer .check-list'), 1.38, 0, 0));
  cursorTo(45.2, 0.9, notAmira(1), -150, 0);
  click(46.3, notAmira(1), (el) => el && el.querySelector('input').click());
  cursorTo(46.6, 0.7, notAmira(4), -150, 0);
  click(47.5, notAmira(4), (el) => el && el.querySelector('input').click());
  caption(45.0, 48.6, { title: 'Les présences, <b>sans papier</b>', sub: 'La cohorte est déjà pré-remplie.' });
  const closeSubmit = () => q('.drawer .drawer-foot button[type=submit]');
  camTo(47.8, 0.8, focus(closeSubmit, 1.3, -200, -200));
  cursorTo(47.8, 0.9, closeSubmit);
  click(48.9, closeSubmit);
  at(49.0, () => { const b = q('.drawer-body'); if (b) b.scrollTop = 0; if (D().activeElement) D().activeElement.blur(); });
  camTo(49.2, 0.9, focus(() => ddOf('Taux de présence'), 1.42, 0, 40));
  card(49.8, 53.0, () => ddOf('Taux de présence'), '<span>Taux de présence calculé</span><small>Repris dans le rapport et le tableau de bord</small>', { icon: 'gauge', side: 'left' });
  caption(49.6, 53.2, { title: 'Activité clôturée, <b>chiffres à jour</b>', sub: 'Les rapports des bénéficiaires présents sont créés.' });

  // 8 · Beneficiary (53.5–64)
  wipe(54.0, 'Bénéficiaire', 'Amira, porteuse de projet', () => {
    app.closeDrawer();
    const amira = W().EH.store.data.users.find((u) => u.role === 'beneficiaire' && u.centre === 'djerba');
    app.as(amira.id, 'mon-espace'); $s('role').textContent = 'Bénéficiaire · Amira';
  });
  const pitchBtn = () => rowBtn('Atelier pitch', 'button');
  camTo(54.4, 0.01, wide);
  camTo(54.6, 0.9, focus(() => row('Atelier pitch'), 1.35, 0, 60));
  caption(54.8, 58.8, { kicker: 'Bénéficiaire · Amira', title: 'Le bénéficiaire devient <b>acteur</b>', sub: 'Ses rapports et ses exercices sont des actions.' });
  showCursor(55.2, 63.2);
  cursorTo(55.2, 1.0, pitchBtn);
  click(56.4, pitchBtn);
  camTo(56.7, 0.9, focus(() => q('.drawer .form-grid'), 1.4, 0, 20));
  // fill whatever the requirement asks (deliverable link, free text, or structured form)
  at(57.4, () => {
    const fields = [...D().querySelectorAll('.drawer .form-grid input, .drawer .form-grid textarea')];
    const texts = fields.filter((f) => ['text', 'url', 'number'].includes(f.type) || f.tagName === 'TEXTAREA');
    const radios = [...new Set(fields.filter((f) => f.type === 'radio').map((f) => f.name))];
    const VAL = (f) => (f.type === 'url' ? 'https://drive.exemple.tn/pitch-amira' : f.type === 'number' ? '6' : f.tagName === 'TEXTAREA' ? 'Pitch de 3 minutes répété, structure revue avec la mentore.' : 'Clarté du message');
    const span = 3.2 / Math.max(1, texts.length);
    texts.forEach((f, i) => type(57.5 + i * span, 57.5 + (i + 1) * span - 0.15, () => f, VAL(f)));
    radios.forEach((n, i) => at(58.2 + i * 0.4, () => { const opts = D().querySelectorAll(`.drawer input[name="${n}"]`); const o = opts[Math.min(opts.length - 1, 3)]; if (o) { o.checked = true; o.dispatchEvent(new (W().Event)('input', { bubbles: true })); } }));
    events.sort((a, b) => a.t - b.t);
  });
  const sendBtn = () => q('.drawer .drawer-foot button[data-intent=send]');
  cursorTo(60.9, 0.9, sendBtn);
  click(62.0, sendBtn);
  caption(62.2, 64.2, { title: 'Rapport <b>envoyé</b> au chargé', sub: 'Amira ne voit que son propre parcours.' });
  card(62.4, 64.2, () => q('#toast-root .toast'), '<span>Accès limité à son espace</span><small>Toute autre tentative est refusée et enregistrée</small>', { icon: 'shield', side: 'top' });

  // 9 · Activity report (64.5–74)
  wipe(65.0, 'Chargé de programme', 'Le rapport d’activité', () => { app.as('u-djerba', 'aujourdhui'); $s('role').textContent = 'Chargé · Djerba'; });
  const arRowBtn = () => rowBtn("Rédiger le rapport d'activité · « Mentorat", 'button');
  camTo(65.4, 0.01, wide);
  camTo(65.5, 0.8, focus(todoPanel, 1.32, 0, -60));
  showCursor(65.6, 84.4);
  cursorTo(65.6, 1.0, arRowBtn);
  click(66.8, arRowBtn);
  const arFigures = () => q('#activity-report .panel');
  camTo(67.1, 0.9, focus(arFigures, 1.42, 0, 0));
  card(67.8, 70.6, arFigures, '<span>Pré-rempli depuis la fiche</span><small>Présence, intervenant, budget</small>', { icon: 'file', side: 'left' });
  caption(67.9, 73.4, { title: '<b>Rien</b> à ressaisir', sub: 'Le chargé ajoute seulement difficultés et besoins d’appui.' });
  camTo(69.6, 0.9, focus(() => q('#activity-report form'), 1.42, 0, 0));
  type(70.0, 71.3, () => q('#fld-ar-difficulties'), 'Salle un peu petite pour le groupe.');
  type(71.5, 72.6, () => q('#fld-ar-needs'), 'Un mentor en vente en ligne.');
  const arSubmit = () => q('#activity-report button[type=submit]:not([data-intent])');
  cursorTo(72.4, 0.8, arSubmit);
  click(73.4, arSubmit);

  // 10 · PMO (74.5–86)
  wipe(75.0, 'PMO central', 'Six centres en direct', () => { app.closeDrawer(); app.as('u-pmo', 'pilotage'); $s('role').textContent = 'PMO central'; });
  const validatePanel = () => [...D().querySelectorAll('#main section.panel')].find((p) => /À valider/.test((p.querySelector('h2') || {}).textContent || ''));
  const examineBtn = () => { const p = validatePanel(); return p && rowBtn('Djerba', 'button', p); };
  camTo(75.4, 0.01, wide);
  scroll(75.5, 1.1, () => null, () => { const p = validatePanel(); return p ? p.getBoundingClientRect().top + W().scrollY - 120 : 0; });
  camTo(76.6, 0.8, focus(validatePanel, 1.36, 0, 0));
  caption(75.8, 79.8, { kicker: 'PMO central', title: 'Valider, <b>verrouiller</b>', sub: 'Les chiffres validés sont figés et identiques partout.' });
  cursorTo(76.8, 1.0, examineBtn);
  click(78.0, examineBtn);
  const arValidate = () => q('#activity-report [data-action=ar-validate]');
  camTo(78.2, 0.8, focus(() => q('#activity-report'), 1.3, 0, -120));
  cursorTo(78.4, 0.9, arValidate);
  click(79.5, arValidate);
  card(79.8, 82.0, () => q('#activity-report h3'), '<span>Validé et verrouillé</span><small>Chiffres figés à la validation</small>', { icon: 'lock', tone: 'ok', side: 'left' });
  at(82.1, app.closeDrawer);
  scroll(82.1, 1.0, () => null, () => { const r = q('#rate-charts'); return r ? r.getBoundingClientRect().top + W().scrollY - 90 : 0; });
  camTo(82.3, 0.9, focus(() => q('#rate-charts'), 1.14, 0, 40));
  const presenceRing = () => [...D().querySelectorAll('#rate-charts .ring-card')].find((b) => /Présence/.test(b.textContent));
  cursorTo(82.6, 0.9, presenceRing);
  click(83.7, presenceRing);
  caption(82.6, 86.2, { title: 'Le PMO voit <b>tout</b>, en direct', sub: 'Par centre : présence, activités, rapports, alertes.' });

  // 11 · Benefits (86–92)
  const BEN = [['file', 'Moins de saisie', 'Rapports pré-remplis, import Excel des candidats.'], ['gauge', 'Plus de visibilité', 'Alertes et tableau de bord des six centres, en direct.'], ['lock', 'Données fiables', 'Validées, verrouillées, identiques partout.']];
  full(86.2, 92.4, () => `${halos}<div class="fs-center"><div class="headline" style="font-size:64px">Ce que ça <b>change</b></div><div class="benefits">${BEN.map(([i, h, p], k) => `<div class="benefit" data-k="${k}"><div class="ic">${svg(i)}</div><h3>${h}</h3><p>${p}</p></div>`).join('')}</div></div>`, (el, t) => {
    const h = easeOut(prog(t, 0.2, 0.7)); const hd = el.querySelector('.headline'); hd.style.opacity = h; hd.style.transform = `translateY(${(1 - h) * 18}px)`;
    el.querySelectorAll('.benefit').forEach((b) => { const k = easeOut(prog(t, 0.7 + +b.dataset.k * 0.45, 0.7)); b.style.opacity = k; b.style.transform = `translateY(${(1 - k) * 40}px)`; });
  }, { fi: 0.6, fo: 0.5 });

  // 12 · Closing (92–98)
  full(92.0, 98.5, () => `${halos}<div class="fs-center">${RING(150, '29 11')}<div class="brand">ELIFE <span>Hub</span></div><div class="tag">Six centres. Un seul fil.</div><div class="credit">Prototype réalisé pour le hackathon ELIFE Incubation Workflow · ELIFE NextGen Fest 2026</div></div>`, (el, t) => {
    el.querySelector('.ring-a').setAttribute('transform', `rotate(${-90 + 90 * easeOut(prog(t, 0, 2.5))} 50 50)`);
    const b = easeOut(prog(t, 0.4, 0.8)), g = easeOut(prog(t, 0.9, 0.8)), c = easeOut(prog(t, 1.5, 0.8));
    Object.assign(el.querySelector('.brand').style, { opacity: b, transform: `translateY(${(1 - b) * 20}px)` });
    Object.assign(el.querySelector('.tag').style, { opacity: g });
    Object.assign(el.querySelector('.credit').style, { opacity: c });
  }, { fi: 0.6, fo: 0.01 });

  const DURATION = 98.5;
  events.sort((a, b) => a.t - b.t);
  camKeys.sort((a, b) => a.t - b.t);
  curKeys.sort((a, b) => a.t - b.t);

  /* =====================================================================================
     FRAME RENDERING
     ===================================================================================== */
  const update = (t) => {
    camNow = camAt(t);
    cam.style.transform = `translate(${960 - camNow.s * camNow.fx}px, ${540 - camNow.s * camNow.fy}px) scale(${camNow.s})`;

    // typing
    for (const ty of typers) {
      if (t < ty.t0) continue;
      const n = Math.round(ty.text.length * prog(t, ty.t0, ty.t1 - ty.t0));
      if (n !== ty.n) { const f = ty.get(); if (f) { f.value = ty.text.slice(0, n); f.dispatchEvent(new (W().Event)('input', { bubbles: true })); } ty.n = n; }
    }
    // scrolling
    for (const sc of scrolls) {
      if (t < sc.t0) continue;
      if (sc.to == null) { sc.from = W().scrollY; sc.to = sc.getTop(); }
      W().scrollTo(0, lerp(sc.from, sc.to, easeIO(prog(t, sc.t0, sc.dur))));
    }

    // spotlight
    let sp = null;
    for (const s of spots) { const o = env(t, s.t0, s.t1, 0.5, 0.5); if (o > 0) sp = { s, o }; }
    if (sp) { const el = sp.s.get(); const r = el && el.getBoundingClientRect(); if (r) Object.assign(spotEl.style, { left: r.left - sp.s.pad + 'px', top: r.top - sp.s.pad + 'px', width: r.width + 2 * sp.s.pad + 'px', height: r.height + 2 * sp.s.pad + 'px', opacity: sp.o }); }
    else spotEl.style.opacity = 0;

    // captions
    let cap = null;
    for (const c of captions) { const o = env(t, c.t0, c.t1, 0.45, 0.35); if (o > 0) cap = { c, o, k: easeOut(prog(t, c.t0, 0.6)) }; }
    const capEl = $s('caption');
    if (cap) {
      if (capEl.dataset.id !== String(cap.c.t0)) { $s('cap-kicker').innerHTML = cap.c.kicker || ''; $s('cap-title').innerHTML = cap.c.title || ''; $s('cap-sub').innerHTML = cap.c.sub || ''; capEl.dataset.id = String(cap.c.t0); }
      capEl.style.opacity = cap.o; capEl.style.transform = `translateY(${(1 - cap.k) * 24}px)`;
    } else capEl.style.opacity = 0;

    // cards
    for (const c of cards) {
      const o = env(t, c.t0, c.t1, 0.4, 0.3);
      if (o <= 0) { c.el.style.opacity = 0; continue; }
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
      x = clamp(x, 40, 1880 - cw); y = clamp(y, 40, 1000 - ch);
      Object.assign(c.el.style, { left: x + 'px', top: y + 'px', opacity: o, transform: `scale(${0.92 + 0.08 * k})` });
    }

    // full-screen scenes
    for (const f of fulls) {
      const o = env(t, f.t0, f.t1, f.fi, f.fo);
      f.el.style.opacity = o; f.el.style.visibility = o > 0 ? 'visible' : 'hidden';
      if (o > 0) f.animate(f.el, t - f.t0);
    }

    // wipes (role transitions)
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
    const t = i / FPS;
    if (i <= lastFrame) return;
    lastFrame = i; currentT = t; vnow = t * 1000;
    for (const e of events) if (!e.done && e.t <= t) { e.done = true; try { e.fn(); } catch (err) { console.error('event', e.t, err); } }
    runTimers();
    update(t);
  };

  /* ---------- setup: fresh demo data, PMO dashboard ---------- */
  window.VIDEO = { FPS, DURATION, FRAMES: Math.round(DURATION * FPS), clicks: clicks.slice().sort((a, b) => a - b), wipes: wipes.map((w) => w.tMid), scenes: fulls.map((f) => [f.t0, f.t1]) };
  window.stageReady = new Promise((resolve) => {
    const go = async () => {
      const w = W();
      try { w.localStorage.clear(); } catch (e) {}
      w.EH.store.reset();
      const st = w.document.createElement('style');
      st.textContent = '::-webkit-scrollbar{width:0;height:0} html{scrollbar-width:none;scroll-behavior:auto!important}';
      w.document.head.appendChild(st);
      app.as('u-pmo', 'pilotage');
      patchTimers();
      await document.fonts.ready; await w.document.fonts.ready;
      update(0);
      resolve(true);
    };
    if (iframe.contentWindow && iframe.contentWindow.EH && iframe.contentDocument.readyState === 'complete') go();
    else iframe.addEventListener('load', go, { once: true });
  });

  // ?play=1 : real-time preview in a browser ; ?t=SEC : jump (renders every frame up to SEC)
  const params = new URLSearchParams(location.search);
  window.stageReady.then(async () => {
    if (params.has('t')) { const n = Math.round(+params.get('t') * FPS); for (let i = 0; i <= n; i++) await window.renderFrame(i); }
    if (params.get('play') === '1') {
      const start = performance.now() - (params.has('t') ? +params.get('t') * 1000 : 0);
      const loop = () => { const i = Math.floor(((performance.now() - start) / 1000) * FPS); if (i < window.VIDEO.FRAMES) { window.renderFrame(i); requestAnimationFrame(loop); } };
      requestAnimationFrame(loop);
    }
  });
})();
