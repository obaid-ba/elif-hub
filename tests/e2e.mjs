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
  await as('u-pmo');
  await page.goto(URL + '#pilotage'); await page.waitForTimeout(120);
  check(`No horizontal scroll PMO dashboard @${w}`, (await ev(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
}

/* ---------- 7. keyboard + reduced motion ---------- */
await page.setViewportSize({ width: 1440, height: 900 });
await as(I.amira);
await page.keyboard.press('Tab');
check('Visible focus on keyboard navigation', await ev(() => { const el = document.activeElement; const s = getComputedStyle(el); return el !== document.body && (s.outlineStyle !== 'none' || s.boxShadow !== 'none'); }));

check('No console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
