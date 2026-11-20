// End-to-end check of the beneficiary feature (Défi 1). Dev-only: the app itself has no dependency.
// Usage: node tests/e2e.mjs
// Env: PLAYWRIGHT_PATH (playwright package dir), CHROME_PATH (Chromium/Chrome binary).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH || path.join(os.homedir(), '.npm/_npx/705bc6b22212b352/node_modules/playwright');
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', path.join(os.homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome')].find((p) => fs.existsSync(p));
const { chromium } = require(PW);
const URL = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const ev = (fn, arg) => page.evaluate(fn, arg);
const as = async (userId) => { await page.selectOption('#demo-user', userId); await page.waitForTimeout(150); };
const ids = async () => ev(() => {
  const d = EH.store.data, b = d.users.filter((u) => u.role === 'beneficiaire');
  const amira = b.find((u) => u.centre === 'djerba'), beja = b.find((u) => u.centre === 'beja');
  const pitch = d.activities.find((a) => a.centre === 'djerba' && a.title === 'Atelier pitch');
  return { amira: amira.id, amiraEnt: amira.entrepreneurId, beja: beja.id, bejaEnt: beja.entrepreneurId, pitch: pitch.id };
});
const deniedCount = () => ev(() => EH.store.data.audit.filter((a) => a.action === 'Accès refusé').length);

await page.goto(URL);
await ev(() => { localStorage.clear(); });
await page.reload();
const I = await ids();

/* ---------- 1. permissions ---------- */
await as(I.amira);
check('Beneficiary lands on Mon espace', (await ev(() => location.hash)) === '#mon-espace');
const navItems = await page.$$eval('.sidebar .nav-item', (n) => n.map((x) => x.textContent.trim()));
check('Beneficiary nav has 4 entries', navItems.length === 4, navItems.join(' | '));
let before = await deniedCount();
await ev((id) => EH.openDrawer('ent', { id }), I.bejaEnt);
check('Opening another entrepreneur is refused', !(await page.$('.drawer')));
check('…and logged in the audit trail', (await deniedCount()) === before + 1);
before = await deniedCount();
await ev(() => { location.hash = 'pilotage'; });
await page.waitForTimeout(150);
check('Route outside the menu is refused and logged', (await ev(() => location.hash)) !== '#pilotage' || (await ev(() => EH.ui.route)) === 'mon-espace');
check('…route denial logged', (await deniedCount()) === before + 1);
const otherActivity = await ev(() => EH.store.data.activities.find((a) => a.centre === 'beja').id);
before = await deniedCount();
await ev((id) => EH.openDrawer('myReport', { id }), otherActivity);
check('Report drawer of another centre is refused and logged', !(await page.$('.drawer')) && (await deniedCount()) === before + 1);
const leak = await page.textContent('#main');
check('Beneficiary pages show no KPI or other beneficiary', !/Taux|Engagement|Remise des rapports/.test(leak) && !leak.includes('Marwen'));
const direct = await ev(() => EH.act.reviewBeneficiaryReport(EH.store.data.beneficiaryReports[0].id, 'validate', '', null));
check('Store refuses a review by the beneficiary', direct.ok === false);

/* ---------- 2. workflow ---------- */
// PMO defines the programme template
await as('u-pmo');
let r = await ev(() => EH.act.saveRequirement('programme', 'p2', { format: 'form', dueDays: 3, mandatory: true, feedbackVisible: true, fields: [{ label: 'Ce que je retiens du pitch', type: 'text', required: true }, { label: 'Note de confiance', type: 'rating', required: true }, { label: 'Point à retravailler', type: 'text', required: false }] }, 1));
check('PMO saves programme template v2', r.ok && r.item.version === 2);
await page.goto(URL + '#programmes'); await page.waitForTimeout(100);
await ev(() => EH.openDrawer('programme', { id: 'p2' }));
check('Programme drawer shows the template', /Formulaire structuré/.test(await page.textContent('.drawer')));
await ev(() => EH.closeDrawer());

// Officer overrides on one activity, through the activity form
await as('u-djerba');
await ev((id) => EH.actions['edit-activity']({ dataset: { id } }), I.pitch);
await page.selectOption('.drawer [name=req_format]', 'form');
await page.waitForTimeout(100);
await page.fill('.drawer [name=rf_label_0]', 'Mon pitch en une phrase');
await page.check('.drawer [name=rf_req_0]');
await page.click('.drawer button[type=submit]');
await page.waitForTimeout(150);
r = await ev((id) => { const q = EH.store.data.reportingRequirements.filter((x) => x.activityId === id); return q.map((x) => x.format + ':' + x.version); }, I.pitch);
check('Officer override saved on the activity (form, v1)', r.join() === 'form:1', r.join());

// Activity done with Amira present
await ev((id) => EH.openDrawer('closeActivity', { id }), I.pitch);
const amiraBox = await page.$(`.drawer input[name=attendees][value="${I.amiraEnt}"]`);
check('Amira listed in attendance', !!amiraBox && (await amiraBox.isChecked()));
await page.click('.drawer button[type=submit]');
await page.waitForTimeout(150);
check('Activity closed', (await ev((id) => EH.q.activity(EH.store.data, id).status, I.pitch)) === 'done');

// Beneficiary gets the task, drafts, reloads, submits
await as(I.amira);
check('Task appears in Mon espace', (await page.textContent('#main')).includes('Atelier pitch'));
await ev((id) => EH.actions['my-open-report']({ dataset: { id } }), I.pitch);
await page.waitForSelector('.drawer form[data-form=breport]');
const qid = await ev((id) => EH.q.requirementOf(EH.store.data, EH.q.activity(EH.store.data, id)).fields[0].id, I.pitch);
await page.fill(`.drawer [name=ans_${qid}]`, 'Des dattes transformées pour les hôtels');
await page.waitForTimeout(100);
await page.reload();
await page.waitForTimeout(150);
await ev((id) => EH.actions['my-open-report']({ dataset: { id } }), I.pitch);
await page.waitForSelector('.drawer form[data-form=breport]');
check('Draft restored after reload', (await page.inputValue(`.drawer [name=ans_${qid}]`)) === 'Des dattes transformées pour les hôtels');
await page.fill(`.drawer [name=ans_${qid}]`, '');
await page.click('.drawer button[data-intent=send]');
await page.waitForTimeout(150);
check('Missing required field shows error next to it', !!(await page.$(`.drawer [name=ans_${qid}][aria-invalid=true]`)));
await page.fill(`.drawer [name=ans_${qid}]`, 'Des dattes transformées pour les hôtels');
await page.click('.drawer button[data-intent=send]');
await page.waitForTimeout(150);
let rep = await ev((a) => EH.q.breport(EH.store.data, a.pitch, a.amiraEnt), I);
check('Report sent (Soumis)', rep && rep.status === 'submitted');
check('Toast uses the button verb', /Rapport envoyé/.test(await page.textContent('#toast-root')));

// Officer returns it with a reason
await as('u-djerba');
check('Officer home lists the report to validate', /rapport.*bénéficiaire.*à valider/i.test(await page.textContent('#main')));
await ev((id) => EH.openDrawer('activity', { id }), I.pitch);
await page.click(`.drawer [data-action=return-breport-mode][data-id="${rep.id}"]`);
await page.click('.drawer form[data-form=return-breport] button[type=submit]');
await page.waitForTimeout(100);
check('Return without reason refused', (await ev((a) => EH.q.breport(EH.store.data, a.pitch, a.amiraEnt).status, I)) === 'submitted');
await page.fill('.drawer form[data-form=return-breport] [name=reason]', 'Précisez le prix de vente visé.');
await page.click('.drawer form[data-form=return-breport] button[type=submit]');
await page.waitForTimeout(150);
check('Report returned (À corriger)', (await ev((a) => EH.q.breport(EH.store.data, a.pitch, a.amiraEnt).status, I)) === 'returned');

// Optimistic lock: stale version is refused
const stale = await ev((a) => EH.act.reviewBeneficiaryReport(EH.q.breport(EH.store.data, a.pitch, a.amiraEnt).id, 'validate', '', 1), I);
check('Stale version refused (optimistic lock)', stale.ok === false);

// Beneficiary corrects and resends
await as(I.amira);
check('Returned report and reason visible', (await page.textContent('#main')).match(/corriger/i));
await ev((id) => EH.actions['my-open-report']({ dataset: { id } }), I.pitch);
await page.waitForSelector('.drawer form[data-form=breport]');
check('Officer comment shown to beneficiary', (await page.textContent('.drawer')).includes('Précisez le prix de vente visé.'));
await page.fill(`.drawer [name=ans_${qid}]`, 'Dattes pour hôtels, 12 DT le pot');
await page.click('.drawer button[data-intent=send]');
await page.waitForTimeout(150);
check('Corrected report resent', (await ev((a) => EH.q.breport(EH.store.data, a.pitch, a.amiraEnt).status, I)) === 'submitted');

// Officer validates
await as('u-djerba');
await ev((id) => EH.openDrawer('activity', { id }), I.pitch);
rep = await ev((a) => EH.q.breport(EH.store.data, a.pitch, a.amiraEnt), I);
await page.click(`.drawer [data-action=validate-breport][data-id="${rep.id}"]`);
await page.waitForTimeout(150);
check('Report validated', (await ev((a) => EH.q.breport(EH.store.data, a.pitch, a.amiraEnt).status, I)) === 'validated');
await ev(() => EH.closeDrawer());
const trail = await ev((a) => { const e = EH.q.ent(EH.store.data, a.amiraEnt); return EH.store.data.audit.filter((x) => x.object === `${e.name} · Atelier pitch`).map((x) => `${x.before}>${x.after}`); }, I);
check('Every state change audited with before/after', trail.length >= 4 && trail.every((t) => !t.includes('undefined')), trail.join(', '));

/* ---------- 3. persistence ---------- */
await page.reload();
await page.waitForTimeout(150);
check('Validated status persists after reload', (await ev((a) => EH.q.breport(EH.store.data, a.pitch, a.amiraEnt).status, I)) === 'validated');
check('Session persists after reload', (await ev(() => EH.store.session.userId)) === 'u-djerba');

/* ---------- 4. KPI consistency: profile, monthly report, dashboard ---------- */
const kpi = await ev((a) => {
  const d = EH.store.data, out = {};
  ['2026-10', '2026-11'].forEach((p) => {
    const prof = EH.q.beneficiaryStats(d, [a.amiraEnt], p);
    const fig = EH.q.reportFigures(d, 'djerba', p);
    const k = EH.q.kpis(d, 'djerba', p);
    out[p] = { prof: prof.reporting, fig: fig.reporting, dash: k.reporting, profE: prof.engagement, figE: fig.engagement, dashE: k.engagement, validated: k.validated };
  });
  return out;
}, I);
const same = (x, y) => (x == null && y == null) || Math.abs(x - y) < 1e-9;
for (const [p, v] of Object.entries(kpi)) {
  check(`Reporting rate identical (profile / report / dashboard) ${p}`, same(v.prof, v.fig) && same(v.fig, v.dash), `${v.prof} / ${v.fig} / ${v.dash}`);
  check(`Engagement identical ${p}`, same(v.profE, v.figE) && same(v.figE, v.dashE), `${v.profE} / ${v.figE} / ${v.dashE}`);
}
check('Nov reporting rate counts the new on-time report', kpi['2026-11'].prof === 100, String(kpi['2026-11'].prof));
await ev(() => EH.openDrawer('report', { id: 'r-djerba' }));
const reportText = await page.textContent('.drawer');
const figOct = await ev(() => EH.q.reportFigures(EH.store.data, 'djerba', '2026-10'));
const counts = `${figOct.reportsOnTime} / ${figOct.reportsDue}`;
check('Monthly report shows the same counts as the KPI', reportText.includes('Rapports bénéficiaires') && reportText.includes(counts) && Math.abs(100 * figOct.reportsOnTime / figOct.reportsDue - kpi['2026-10'].dash) < 1e-9, counts);
await ev(() => EH.closeDrawer());
await as('u-pmo');
await page.goto(URL + '#pilotage'); await page.waitForTimeout(150);
const tiles = await page.$$eval('.kpis .kpi', (n) => n.length);
check('Dashboard shows the two new KPI tiles (8)', tiles === 8);
const strip = await page.textContent('.kpis');
check('KPI tiles say Validé or Provisoire', /Remise des rapports/.test(strip) && /(Validé|Provisoire)/.test(strip));
const noData = await ev(() => EH.q.kpis(EH.store.data, 'siliana', '2026-10'));
check('Centre without beneficiaries gives "Pas de donnée" (null), not 0', noData.reporting === null && noData.engagement === null);
await ev(() => EH.openDrawer('ent', { id: EH.store.data.entrepreneurs.find((e) => e.name === 'Amira Ben Salem').id }));
check('Profile shows the Rapports block', /Rapports/.test(await page.textContent('.drawer')) && /Atelier pitch/.test(await page.textContent('.drawer')));
await ev(() => EH.closeDrawer());

/* ---------- 5. overdue case in alerts ---------- */
await page.goto(URL + '#alertes'); await page.waitForTimeout(150);
await page.click('.seg button:has-text("Rapport bénéficiaire en retard")');
await page.waitForTimeout(100);
const rows = await page.$$eval('.table tbody tr', (n) => n.map((x) => x.textContent));
check('Alerts list the overdue beneficiary reports (2)', rows.length === 2 && rows.some((t) => t.includes('Amira')), rows.map((t) => t.slice(0, 70)).join(' || '));

/* ---------- 5b. backlog merge: phases 1-2 (data model, planning) ---------- */
// Seeded demo cases (PBI-25)
const seededCases = await ev(() => {
  const d = EH.store.data;
  const mk = d.activities.find((a) => a.title === 'Atelier marketing digital');
  const compta = d.activities.find((a) => a.title === 'Formation comptabilité de base');
  return { rooms: d.rooms.length, allTimed: d.activities.every((a) => a.time && a.durationMin), clash: EH.q.conflicts(d, mk).map((c) => c.kind), compta: EH.q.activityStatus(compta), confirmedCount: d.activities.filter((a) => EH.q.activityStatus(a) === 'confirmed').length, alert: EH.q.alerts(d, null).filter((a) => a.type === 'conflict').length };
});
check('Every activity has a time slot and rooms exist', seededCases.allTimed && seededCases.rooms === 12);
check('Seeded room clash detected (room + staff)', seededCases.clash.includes('room') && seededCases.clash.includes('staff'), seededCases.clash.join());
check('Seeded unconfirmed speaker stays "Prévue"', seededCases.compta === 'planned');
check('Confirmed activities show "Confirmée"', seededCases.confirmedCount > 0);
check('Clash appears once in alerts', seededCases.alert === 1, String(seededCases.alert));

// Week view
await as('u-tozeur');
await page.goto(URL + '#activites'); await page.waitForTimeout(100);
await page.click('.seg button:has-text("Semaine")'); await page.waitForTimeout(100);
const week = await page.$$eval('.week .wday', (n) => n.map((x) => x.textContent));
check('Week view shows 7 days with the activity and its time', week.length === 7 && week.some((t) => t.includes('14:00') && t.includes('Formation comptabilité')));

// Plan through the form: online workshop needs a link, clash warns, "planifier quand même" logs it
await as('u-djerba');
await page.goto(URL + '#activites'); await page.waitForTimeout(100);
await ev(() => EH.actions['new-activity']());
await page.fill('.drawer [name=title]', 'Atelier réseaux sociaux');
await page.selectOption('.drawer [name=programme]', 'p1');
await page.selectOption('.drawer [name=type]', 'Atelier en ligne'); await page.waitForTimeout(100);
await page.fill('.drawer [name=date]', '2026-11-24');
await page.fill('.drawer [name=time]', '17:30');
await page.fill('.drawer [name=durationMin]', '90');
await page.selectOption('.drawer [name=room]', 'ro-djerba-1');
await page.fill('.drawer [name=budget]', '250');
await page.click('.drawer button[type=submit].primary'); await page.waitForTimeout(100);
check('Online workshop without link: error next to the field', !!(await page.$('.drawer [name=onlineLink][aria-invalid=true]')));
await page.fill('.drawer [name=onlineLink]', 'https://meet.exemple.tn/reseaux');
await page.click('.drawer button[type=submit].primary'); await page.waitForTimeout(100);
const clashText = (await page.textContent('.drawer')) || '';
check('Clash warning shown before saving', /Conflit de planning/.test(clashText) && /Salle déjà réservée/.test(clashText));
check('Nothing saved while the clash is unresolved', !(await ev(() => EH.store.data.activities.some((a) => a.title === 'Atelier réseaux sociaux'))));
await page.click('.drawer button[data-intent=force]'); await page.waitForTimeout(150);
const planned = await ev(() => { const a = EH.store.data.activities.find((x) => x.title === 'Atelier réseaux sociaux'); return a && { time: a.time, dur: a.durationMin, budget: a.budget, link: a.onlineLink, fs: a.facilitatorStatus, log: EH.store.data.audit.some((x) => x.action === 'Conflit de planning accepté' && x.object === a.title) }; });
check('"Planifier quand même" saves and logs the clash', planned && planned.time === '17:30' && planned.dur === 90 && planned.budget === 250 && planned.log, JSON.stringify(planned));
const newId = await ev(() => EH.store.data.activities.find((x) => x.title === 'Atelier réseaux sociaux').id);
await ev((id) => EH.openDrawer('activity', { id }), newId);
const dt = await page.textContent('.drawer');
check('Drawer shows time, room, link, budget and the clash', dt.includes('17 h 30') && dt.includes('Salle de formation') && dt.includes('meet.exemple.tn') && /250\s*DT/.test(dt) && /Conflit de planning/.test(dt));
await ev(() => EH.closeDrawer());

// Session 1-1 (C4): closing it creates the coaching session
const oneToOne = await ev(() => {
  const d = EH.store.data, e = d.entrepreneurs.find((x) => x.centre === 'djerba' && x.stage === 'incub');
  const r = EH.act.saveActivity({ title: 'Session 1-1 : prix de vente', programme: 'p1', cohort: 'co-djerba', type: 'Session 1-1', date: EH.TODAY, time: '08:00', durationMin: '60', participant: e.id, facilitator: 'pa11', staff: '' });
  if (!r.ok) return { err: JSON.stringify(r) };
  const before = d.sessions.filter((s) => s.entrepreneur === e.id).length;
  const c = EH.act.closeActivity(r.item.id, { status: 'done', attendees: [e.id] });
  return { ok: c.ok, expected: r.item.expected, added: d.sessions.filter((s) => s.entrepreneur === e.id).length - before };
});
check('Session 1-1 planned with one participant and becomes a coaching session', oneToOne.ok && oneToOne.expected === 1 && oneToOne.added === 1, JSON.stringify(oneToOne));
const noParticipant = await ev(() => EH.act.saveActivity({ title: 'Session 1-1 sans participant', programme: 'p1', cohort: 'co-djerba', type: 'Session 1-1', date: '2026-11-30', time: '08:00', durationMin: '60' }));
check('Session 1-1 without participant refused', !noParticipant.ok && !!noParticipant.errors.participant);

// v4 save is migrated to v5
const migrated = await ev(() => {
  const d = JSON.parse(JSON.stringify(EH.seed()));
  delete d.rooms; d.version = 4;
  d.activities = d.activities.filter((a) => !['Atelier marketing digital', 'Formation comptabilité de base'].includes(a.title));
  d.activities.forEach((a) => { ['time', 'durationMin', 'room', 'staff', 'facilitatorStatus', 'budget', 'equipment', 'content', 'supports', 'onlineLink', 'contact', 'participant'].forEach((k) => delete a[k]); a.duration = a.type === 'Formation' ? '1 jour' : '3 h'; });
  localStorage.removeItem('elife-hub:v5');
  localStorage.setItem('elife-hub:v4', JSON.stringify({ data: d, session: { userId: 'u-djerba' } }));
  EH.store.load();
  const x = EH.store.data;
  return { version: x.version, rooms: (x.rooms || []).length, timed: x.activities.every((a) => a.time), demo: x.activities.some((a) => a.title === 'Atelier marketing digital'), reports: x.beneficiaryReports.length };
});
check('v4 save migrated to v5 (rooms, time slots, demo cases, reports kept)', migrated.version === 5 && migrated.rooms === 12 && migrated.timed && migrated.demo && migrated.reports >= 10, JSON.stringify(migrated));
await ev(() => { localStorage.clear(); EH.store.load(); EH.render(); });
await page.reload(); await page.waitForTimeout(150);

/* ---------- 6. responsive (390 / 820 / 1440), no horizontal scroll ---------- */
const views = [['mon-espace'], ['mes-activites'], ['mes-rapports'], ['mon-parcours']];
for (const w of [390, 820, 1440]) {
  await page.setViewportSize({ width: w, height: 900 });
  await as(I.amira);
  for (const [route] of views) {
    await page.goto(URL + '#' + route); await page.waitForTimeout(120);
    const over = await ev(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`No horizontal scroll ${route} @${w}`, over <= 0, String(over));
  }
  await ev(() => { const o = EH.q.obligations(EH.store.data, EH.store.ownEnt()).find((x) => ['todo', 'draft', 'returned'].includes(x.status)); EH.actions['my-open-report']({ dataset: { id: o.activity.id } }); });
  await page.waitForTimeout(120);
  const foot = await page.$('.drawer .drawer-foot');
  const box = foot && (await foot.boundingBox());
  check(`Report submit bar visible at bottom @${w}`, !!box && box.y + box.height <= 900 + 1);
  if (w === 390) {
    const minH = await page.$$eval('.drawer .drawer-foot .btn', (b) => Math.min(...b.map((x) => x.getBoundingClientRect().height)));
    check('Touch targets ≥ 44px @390', minH >= 44, String(minH));
    await page.screenshot({ path: path.join(os.tmpdir(), 'elife-benef-390.png') });
  }
  await ev(() => EH.closeDrawer());
  await as('u-djerba');
  await page.goto(URL + '#activites'); await page.waitForTimeout(100);
  await ev(() => { EH.ui.f['act.view'] = 'week'; EH.render(); });
  check(`No horizontal scroll activity week view @${w}`, (await ev(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await ev(() => { EH.ui.f['act.view'] = 'list'; EH.actions['new-activity'](); });
  await page.waitForTimeout(100);
  check(`No horizontal scroll planning form @${w}`, (await ev(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && (await ev(() => { const dr = document.querySelector('.drawer-body'); return dr.scrollWidth <= dr.clientWidth; })));
  await ev(() => EH.closeDrawer());
  await as('u-pmo');
  await page.goto(URL + '#pilotage'); await page.waitForTimeout(120);
  check(`No horizontal scroll PMO dashboard @${w}`, (await ev(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
}

/* ---------- 7. keyboard + reduced motion ---------- */
await page.setViewportSize({ width: 1440, height: 900 });
await as(I.amira);
await page.keyboard.press('Tab');
check('Visible focus on keyboard navigation', await ev(() => { const el = document.activeElement; const s = getComputedStyle(el); return el !== document.body && (s.outlineStyle !== 'none' || s.boxShadow !== 'none'); }));

/* ---------- 8. PMO: rate charts, no audit page, report remarks ---------- */
await page.setViewportSize({ width: 1440, height: 900 });
await as('u-pmo');
await page.goto(URL + '#pilotage'); await page.waitForTimeout(120);
const pmoNav = await page.$$eval('.sidebar .nav-item', (n) => n.map((x) => x.textContent.trim()).join('|'));
check('PMO menu has no audit log', !/Journal/.test(pmoNav), pmoNav);
await ev(() => { location.hash = 'journal'; }); await page.waitForTimeout(120);
check('#journal is no longer a page', (await ev(() => EH.ui.route)) === 'pilotage');
check('Dashboard charts six rates (attendance included)', (await page.$$('#rate-charts .ring-card')).length === 6 && (await page.$$('#rate-charts .hbar-row')).length === 6 && !!(await page.$('#rate-charts svg.trend path.line')));
await page.click('#rate-charts .ring-card:nth-child(3)'); await page.waitForTimeout(80);
check('Picking a ring switches the chart', /Couverture coaching par centre/.test(await page.textContent('#rate-charts')));
check('Comparison table shows rate meters', (await page.$$('#main .table .meter')).length >= 18);
await ev(() => EH.openDrawer('report', { id: 'r-tozeur' }));
await page.click('.drawer [data-form=report-remark] button[type=submit]'); await page.waitForTimeout(60);
check('Empty remark refused', /Écrivez la remarque/.test(await page.textContent('.drawer')));
await page.fill('#fld-remark-d', 'Bonne explication de la baisse de présence : ajoutez le plan de rattrapage.');
await page.click('.drawer [data-form=report-remark] button[type=submit]'); await page.waitForTimeout(80);
check('PMO adds a remark on a report', /plan de rattrapage/.test(await page.textContent('.drawer .remarks')) && (await ev(() => EH.store.data.reports.find((r) => r.id === 'r-tozeur').remarks.length)) === 1);
await ev(() => EH.closeDrawer());
await as('u-tozeur');
await page.goto(URL + '#rapport'); await page.waitForTimeout(120);
check('Officer sees the PMO remark on his report', /plan de rattrapage/.test(await page.textContent('#main')));
await page.fill('#fld-remark', 'Plan de rattrapage : deux ateliers en décembre.');
await page.click('[data-form=report-remark] button[type=submit]'); await page.waitForTimeout(80);
check('Officer replies with a remark', (await ev(() => EH.store.data.reports.find((r) => r.id === 'r-tozeur').remarks.map((m) => m.role).join(','))) === 'pmo,officer');
check('Other centre cannot comment', (await ev(() => EH.act.addReportRemark('beja', '2026-10', 'test').ok)) === false);

/* ---------- 9. officer: candidate import from Excel ---------- */
await as('u-djerba');
await page.goto(URL + '#entrepreneurs'); await page.waitForTimeout(120);
const before9 = await ev(() => EH.store.data.entrepreneurs.length);
await page.click('[data-action=import-candidates]'); await page.waitForTimeout(80);
check('Import tab open with template button', !!(await page.$('.drawer [data-action=cand-template]')) && !!(await page.$('.drawer #import-file')));
await page.setInputFiles('.drawer #import-file', path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'candidats.xlsx'));
await page.waitForFunction(() => EH.ui.drawer && (EH.ui.drawer.analysis || EH.ui.drawer.importError), null, { timeout: 3000 });
const an = await ev(() => EH.ui.drawer.analysis ? EH.ui.drawer.analysis.summary : EH.ui.drawer.importError);
check('Excel file read (deflate + shared strings)', an && an.ok === 2 && an.duplicate === 2 && an.error === 3, JSON.stringify(an));
const impText = await page.textContent('.drawer');
check('Preview flags duplicates (existing + in file)', /Déjà inscrit/.test(impText) && /Doublon de la ligne 4/.test(impText));
check('Preview names the faulty field', /E-mail/.test(impText) && /Prénom/.test(impText) && /Secteur inconnu/.test(impText) && /date passée/.test(impText));
const amel = await ev(() => EH.ui.drawer.analysis.rows[0].values);
check('Excel date and sector normalised', amel.birth === '1998-03-14' && amel.sector === 'Tourisme', JSON.stringify(amel));
await page.click('.drawer [data-action=cand-import]'); await page.waitForTimeout(100);
check('Only valid rows inserted', (await ev(() => EH.store.data.entrepreneurs.length)) === before9 + 2);
check('Import logged with counts', await ev(() => EH.store.data.audit.some((a) => a.action === 'Candidats importés' && /2 doublon/.test(a.detail) && /3 ligne/.test(a.detail))));
const again = await ev(() => EH.act.analyzeImport(EH.sheet.readCsv('Prénom;Nom;Téléphone;Idée de projet\nAmel;Ben Youssef;+216 22 345 678;Maison\nNour;Saidi;+216 50 600 700;Savon artisanal')));
check('Re-import (CSV) ignores rows already inserted', again.ok && again.summary.duplicate === 1 && again.summary.ok === 1, JSON.stringify(again.summary));
const roundTrip = await ev(async () => { const blob = EH.sheet.writeXlsx([['Prénom', 'Nom', 'E-mail', 'Idée de projet'], ['Lina', 'Hamdi', 'lina@exemple.tn', 'Café']]); return EH.sheet.readXlsx(await blob.arrayBuffer()); });
check('Template writer produces a readable .xlsx', roundTrip[1] && roundTrip[1][0] === 'Lina' && roundTrip[0][3] === 'Idée de projet');
check('Missing column reported', /Colonnes obligatoires absentes/.test((await ev(() => EH.act.analyzeImport([['Nom', 'Téléphone'], ['X', '22 222 222']]))).errors._));
await page.click('[data-action=new-candidate]'); await page.waitForTimeout(80);
check('Manual tab still available', !!(await page.$('.drawer [name=firstName]')) && !!(await page.$('.drawer [data-action=cand-tab]')));
await ev(() => EH.closeDrawer());

/* ---------- 10. officer home: incubation (phases, exercises, funders) ---------- */
await page.goto(URL + '#aujourdhui'); await page.waitForTimeout(120);
check('Today page has the incubation section', /Incubation/.test(await page.textContent('#incubation')) && (await page.$$('#incubation .phase-card')).length === 3);
await ev(() => { EH.ui.f['td.inc'] = 'bailleurs'; EH.render(); });
const fund = await page.textContent('#incubation');
check('Funders listed with their linked projects', /Fonds Régional d'Amorçage Sud/.test(fund) && /Amira Ben Salem/.test(fund) && /8\s000\s*DT/.test(fund));
await page.click('#incubation [data-action=add-funding]'); await page.waitForTimeout(60);
const target = await ev(() => EH.store.data.entrepreneurs.find((e) => e.centre === 'djerba' && e.stage === 'suivi').id);
await page.selectOption('.modal [name=partner]', 'pa1'); await page.selectOption('.modal [name=entrepreneur]', target); await page.selectOption('.modal [name=kind]', 'Subvention'); await page.fill('.modal [name=amount]', '4000');
await page.click('.modal button[type=submit]'); await page.waitForTimeout(80);
check('Officer links a funder to a project', await ev((id) => EH.store.data.fundings.some((f) => f.entrepreneurId === id && f.amount === 4000), target));
await ev(() => { EH.ui.f['td.inc'] = 'exercices'; EH.render(); });
await page.click('#incubation .toolbar [data-action=give-exercise]'); await page.waitForTimeout(60);
await page.fill('.drawer [name=title]', 'Tester le prix auprès de trois clients');
await page.fill('.drawer [name=instructions]', 'Proposez deux prix et notez les réactions.');
await page.check(`.drawer [name=entrepreneurs][value="${I.amiraEnt}"]`);
await page.click('.drawer button[type=submit]'); await page.waitForTimeout(80);
const exId = await ev(() => (EH.store.data.exercises.find((x) => x.title === 'Tester le prix auprès de trois clients') || {}).id);
check('Officer gives an exercise', !!exId);
await as(I.amira);
check('Exercise becomes an action in Mon espace', /Tester le prix auprès de trois clients/.test(await page.textContent('#main')));
const otherEx = await ev((me) => EH.store.data.exercises.find((x) => x.entrepreneurId !== me).id, I.amiraEnt);
before = await deniedCount();
await ev((id) => EH.openDrawer('myExercise', { id }), otherEx);
check('Another beneficiary’s exercise is refused and logged', !(await page.$('.drawer')) && (await deniedCount()) === before + 1);
await ev((id) => EH.actions['my-open-exercise']({ dataset: { id } }), exId); await page.waitForTimeout(60);
await page.fill('.drawer [name=answer]', '25 DT accepté par 2 clients sur 3.');
await page.click('.drawer button[type=submit]'); await page.waitForTimeout(80);
check('Beneficiary hands the exercise in', (await ev((id) => EH.store.data.exercises.find((x) => x.id === id).status, exId)) === 'submitted');
await as('u-djerba');
check('Officer home lists the exercise to review', /Exercice rendu par Amira Ben Salem/.test(await page.textContent('#main')));
await ev((id) => EH.openDrawer('exerciseView', { id }), exId);
await page.click('.drawer [data-action=review-exercise]'); await page.waitForTimeout(80);
check('Officer validates the exercise', (await ev((id) => EH.store.data.exercises.find((x) => x.id === id).status, exId)) === 'validated');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL + '#aujourdhui'); await page.waitForTimeout(120);
check('No horizontal scroll officer home @390', (await ev(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
await page.setViewportSize({ width: 1440, height: 900 });

/* ---------- 11. Défi 1: speaker confirmation (PBI-10), J-1 reminder (PBI-08), attendance rate (PBI-13) ---------- */
await ev(() => { localStorage.clear(); EH.store.load(); EH.render(); });
await page.reload(); await page.waitForTimeout(150);
await as('u-djerba');
const W = await ev(() => { const d = EH.store.data, f = (t) => d.activities.find((a) => a.centre === 'djerba' && a.title === t).id; return { fin: f('Atelier financement participatif'), tomorrow: f('Mentorat pitch : répétition générale'), mentor: f('Mentorat collectif : stratégie de vente') }; });
check('Unconfirmed speaker at J-2 raises an alert', await ev((id) => EH.q.alerts(EH.store.data, null).some((a) => a.type === 'speaker' && a.ref === id), W.fin));
await page.goto(URL + '#aujourdhui'); await page.waitForTimeout(100);
check('Officer home asks to confirm the speaker and send the reminder', /Faire confirmer Mehdi Rekik/.test(await page.textContent('#main')) && /Envoyer le rappel J-1/.test(await page.textContent('#main')));
await ev((id) => EH.openDrawer('activity', { id }), W.fin);
check('Drawer warns about the unconfirmed speaker', /non confirmé à J-2/.test(await page.textContent('.drawer')));
await page.click('.drawer [data-action=speaker-status][data-status=confirmed]'); await page.waitForTimeout(80);
check('Speaker confirmed: status Confirmée, alert gone, logged', await ev((id) => { const d = EH.store.data, a = EH.q.activity(d, id); return a.facilitatorStatus === 'confirmed' && EH.q.activityStatus(a) === 'confirmed' && !EH.q.alerts(d, null).some((x) => x.type === 'speaker' && x.ref === id) && d.audit.some((x) => x.action === 'Intervenant confirmé' && x.object === a.title); }, W.fin));
await ev(() => EH.closeDrawer());
await as('u-tozeur');
const compta = await ev(() => EH.store.data.activities.find((a) => a.title === 'Formation comptabilité de base').id);
await ev((id) => EH.openDrawer('activity', { id }), compta);
await page.click('.drawer [data-action=speaker-refuse]'); await page.waitForTimeout(60);
await page.fill('.modal [name=reason]', 'Indisponible ce jour-là');
await page.click('.modal button[type=submit]'); await page.waitForTimeout(80);
check('Refusal sends the activity back to "Intervenant à trouver"', await ev((id) => { const a = EH.q.activity(EH.store.data, id); return !a.facilitator && EH.q.activityStatus(a) === 'draft' && a.speakerHistory.some((h) => h.status === 'refused' && /Indisponible/.test(h.reason)); }, compta));
await ev(() => EH.closeDrawer());
await as('u-djerba');
await ev((id) => EH.openDrawer('activity', { id }), W.tomorrow);
check('Reminder button labelled J-1 for tomorrow', /Envoyer le rappel J-1/.test(await page.textContent('.drawer')));
await page.click('.drawer [data-action=send-reminder]'); await page.waitForTimeout(80);
check('Reminder traced on the activity and logged', await ev((id) => { const d = EH.store.data, a = EH.q.activity(d, id); return a.reminders.length === 1 && a.reminders[0].participants > 0 && a.reminders[0].speaker === 'Ines Kallel' && !EH.q.needsReminder(a) && d.audit.some((x) => x.action === 'Rappel envoyé'); }, W.tomorrow));
check('Reminder visible on the drawer', /Envoyé le/.test(await page.textContent('.drawer')));
await ev(() => EH.closeDrawer());
const cancelledRem = await ev(() => { const d = EH.store.data, a = d.activities.find((x) => x.centre === 'djerba' && x.status === 'planned' && x.date > EH.TODAY && x.title === 'Rencontre avec les partenaires locaux'); a.status = 'cancelled'; const r = EH.act.sendReminder(a.id); a.status = 'planned'; return r; });
check('No reminder for a cancelled activity', !cancelledRem.ok && /annulée/.test(cancelledRem.errors._));
await ev((id) => EH.openDrawer('activity', { id }), W.mentor);
const mentorText = await page.textContent('.drawer');
const rate = await ev((id) => Math.round(EH.q.attendanceRate(EH.q.activity(EH.store.data, id))), W.mentor);
check('Attendance rate shown on a done activity', /Taux de présence/.test(mentorText) && mentorText.includes(rate + ' %'), String(rate));

/* ---------- 12. Défi 4: activity report pre-filled, submitted, validated (PBI-19/20) ---------- */
check('Late activity report flagged', /En retard/.test(await page.textContent('#activity-report')) && await ev(() => EH.q.alerts(EH.store.data, 'djerba').some((a) => a.type === 'areport')));
await page.click('#activity-report button[type=submit]:not([data-intent])'); await page.waitForTimeout(60);
check('Submitting without difficulties/needs is refused', /Indiquez les difficultés/.test(await page.textContent('#activity-report')));
await page.fill('#fld-ar-difficulties', 'Aucune.');
await page.fill('#fld-ar-needs', 'Un expert en vente en ligne.');
await page.click('#activity-report button[type=submit]:not([data-intent])'); await page.waitForTimeout(80);
check('Officer submits the activity report', (await ev((id) => EH.q.activityReportStatus(EH.store.data, EH.q.activity(EH.store.data, id)), W.mentor)) === 'submitted');
await ev(() => EH.closeDrawer());
await as('u-pmo');
await page.goto(URL + '#pilotage'); await page.waitForTimeout(100);
check('PMO "À valider" lists the activity report', /Rapport d'activité · Mentorat collectif : stratégie de vente · Djerba/.test(await page.textContent('#main')));
await ev((id) => EH.actions['open-activity-report']({ dataset: { id } }), W.mentor); await page.waitForTimeout(60);
await page.click('#activity-report [data-action=ar-validate]'); await page.waitForTimeout(80);
const arv = await ev((id) => { const d = EH.store.data, a = EH.q.activity(d, id), r = EH.q.activityReport(d, id); return { st: r.status, snapPresent: r.snapshot.present, present: a.attendees.length, rateEq: r.snapshot.rate === EH.q.attendanceRate(a), fig: EH.q.reportFigures(d, 'djerba', '2026-11') }; }, W.mentor);
check('PMO validates: report locked with figures equal to the record', arv.st === 'validated' && arv.snapPresent === arv.present && arv.rateEq, JSON.stringify(arv));
check('Monthly report counts validated activity reports', arv.fig.activityReportsValidated >= 1);
const relock = await ev((id) => { EH.store.switchUser('u-djerba'); const r = EH.act.saveActivityReport(id, { difficulties: 'x', needs: 'y' }, true); EH.store.switchUser('u-pmo'); return r; }, W.mentor);
check('A validated activity report cannot be edited', !relock.ok && /verrouillé/.test(relock.errors._));
await ev(() => EH.closeDrawer());
const bejaAr = await ev(() => EH.store.data.activityReports.find((r) => r.centre === 'beja').activityId);
await ev((id) => EH.actions['open-activity-report']({ dataset: { id } }), bejaAr); await page.waitForTimeout(60);
await page.click('#activity-report [data-action=ar-return-mode]'); await page.waitForTimeout(40);
await page.click('#activity-report button[type=submit]'); await page.waitForTimeout(40);
check('Return without a reason is refused', /motif du renvoi est obligatoire/i.test(await page.textContent('#activity-report')));
await page.fill('#fld-ar-reason', 'Précisez les besoins du mentor.');
await page.click('#activity-report button[type=submit]'); await page.waitForTimeout(80);
check('PMO returns an activity report with a reason', (await ev((id) => EH.q.activityReport(EH.store.data, id).status, bejaAr)) === 'returned');
check('Only the PMO validates', (await ev(() => { EH.store.switchUser('u-beja'); const id = EH.store.data.activityReports.find((r) => r.centre === 'sidibouzid').id; const r = EH.act.reviewActivityReport(id, 'validate'); EH.store.switchUser('u-pmo'); return r.ok; })) === false);
await ev(() => EH.closeDrawer());

/* ---------- 13. Défi 8: PMO dashboard by state, attendance, activity reports (PBI-21/22) ---------- */
await page.goto(URL + '#pilotage'); await page.waitForTimeout(100);
check('Comparison table: states, attendance and activity reports columns', /Activités par état/.test(await page.textContent('#main')) && /Présence/.test(await page.textContent('#main')) && /Rapports d'activité/.test(await page.textContent('#main')));
check('No horizontal scroll in the comparison table @1440', await ev(() => { const t = document.querySelector('#main .table-wrap'); return t.scrollWidth <= t.clientWidth; }));
const lekefOverdue = await ev(() => EH.store.data.activities.filter((a) => a.centre === 'lekef' && EH.q.activityStatus(a) === 'overdue').length);
await page.click('#main .table tr:nth-child(3) .st-chip.bad'); await page.waitForTimeout(100);
check('Clicking a figure opens the filtered list', (await ev(() => EH.ui.route)) === 'activites' && (await page.$$('#main .table tbody tr')).length === lekefOverdue && (await ev(() => EH.ui.f['act.status'])) === 'overdue', String(lekefOverdue));
const attCell = await ev(() => Math.round(EH.q.attendance(EH.store.data, ['djerba'], EH.q.lastClosedPeriod()).rate));
await page.goto(URL + '#pilotage'); await page.waitForTimeout(100);
check('Attendance per centre matches the selector', (await page.textContent('#main .table tr:nth-child(4)')).includes(attCell + ' %'), String(attCell));
check('New alert types listed (speaker J-3, late activity report)', /Intervenant non confirmé \(J-3\)/.test(await page.textContent('#main')) && /Rapport d'activité en retard/.test(await page.textContent('#main')));
check('Six-month trend explains months without data', /Mois sans donnée non tracés|Évolution/.test(await page.textContent('#rate-charts')));
check('Coverage trend no longer starts at 0 %', await ev(() => { const d = EH.store.data; return ['2026-06', '2026-07', '2026-08', '2026-09'].every((p) => (EH.q.kpis(d, null, p).coverage || 0) > 50); }));

/* ---------- 14. Défi 2: interview and committee before the selection decision (PBI-23) ---------- */
await as('u-djerba');
const cand = await ev(() => EH.store.data.entrepreneurs.find((e) => e.centre === 'djerba' && e.stage === 'candidat' && !e.interview).id);
check('Committee refused before the interview', (await ev((id) => EH.act.recordCommittee(id, { date: EH.TODAY, opinion: 'favorable', score: 4, comment: 'x' }).ok, cand)) === false);
await ev((id) => EH.openDrawer('ent', { id }), cand);
check('Profile shows the selection path', /Parcours de sélection/.test(await page.textContent('.drawer')));
await page.click('.drawer-tools [data-action=sel-interview]'); await page.waitForTimeout(60);
await page.click('.modal button[type=submit]'); await page.waitForTimeout(60);
check('Interview needs a score and a comment', /note de 1 à 5/.test(await page.textContent('.modal')) && /commentaire est obligatoire/i.test(await page.textContent('.modal')));
await page.check('.modal input[name=score][value="4"]');
await page.fill('.modal [name=comment]', 'Porteuse motivée, marché à tester.');
await page.click('.modal button[type=submit]'); await page.waitForTimeout(80);
await page.click('.drawer-tools [data-action=sel-committee]'); await page.waitForTimeout(60);
await page.check('.modal input[name=opinion][value=favorable]'); await page.check('.modal input[name=score][value="5"]');
await page.fill('.modal [name=comment]', 'Avis favorable du comité.');
await page.click('.modal button[type=submit]'); await page.waitForTimeout(80);
const selTxt = await page.textContent('.drawer');
check('Interview and committee in the timeline', /Entretien de sélection · 4\/5/.test(selTxt) && /Avis du comité : Favorable · 5\/5/.test(selTxt));
await page.click('.drawer-tools [data-action=select-decision]'); await page.waitForTimeout(60);
check('Decision modal recalls the committee opinion', /Avis du comité : Favorable/.test(await page.textContent('.modal')));
await ev(() => { EH.closeModal(); EH.closeDrawer(); });
check('Future interview date refused', (await ev(() => { const e = EH.store.data.entrepreneurs.find((x) => x.centre === 'djerba' && x.stage === 'candidat' && !x.interview); return e ? EH.act.recordInterview(e.id, { date: '2026-12-01', score: 3, comment: 'x' }).errors.date : 'none'; })) !== undefined);

/* ---------- 15. older save upgraded, other défis untouched ---------- */
const upgraded = await ev(() => { const d = JSON.parse(JSON.stringify(EH.store.data)); delete d.activityReports; localStorage.setItem('elife-hub:v5', JSON.stringify({ data: d, session: { userId: 'u-pmo' } })); EH.store.load(); return Array.isArray(EH.store.data.activityReports); });
check('Save without activity reports is upgraded on load', upgraded);
await ev(() => { localStorage.clear(); EH.store.load(); EH.render(); });
await page.reload(); await page.waitForTimeout(150);
await as('u-pmo');
const pmoNav2 = await page.$$eval('.sidebar .nav-item', (n) => n.map((x) => x.textContent.trim()).join('|'));
check('Défis 3, 5, 7 pages still in the menu', /Alertes/.test(pmoNav2) && /Partenaires/.test(pmoNav2) && /Connaissances/.test(pmoNav2), pmoNav2);
for (const w of [390, 820]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(URL + '#pilotage'); await page.waitForTimeout(100);
  check(`No horizontal scroll PMO dashboard (new columns) @${w}`, (await ev(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
}
await page.setViewportSize({ width: 1440, height: 900 });

check('No console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
