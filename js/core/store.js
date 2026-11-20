/* Store: data, session, permissions, persistence, audit and every business action.
   Pages never mutate data directly; they call EH.act.*, which validates, logs and saves. */
(function () {
  'use strict';
  const EH = window.EH;
  const Q = EH.q;
  const R = EH.REF;
  const KEY = 'elife-hub:v5', V4_KEY = 'elife-hub:v4', LEGACY_KEY = 'elife-hub:v3';

  const store = (EH.store = { data: null, session: { userId: 'u-pmo' }, listeners: [] });

  /* ---------- persistence (per-viewer convenience; falls back to memory) ---------- */
  /** v3 -> v4: adds the beneficiary role, requirements and reports. Falls back to the demo data if the save is too far from the seed. */
  store.migrate = (d) => {
    try { Object.assign(d, EH.seedBeneficiaryReporting(d), { version: 4 }); return d; } catch (e) { return null; }
  };
  /** v4 -> v5: rooms, time slots, budget, equipment, content (backlog merge). */
  store.migrate5 = (d) => {
    try { const x = EH.seedLogistics(d); d.rooms = x.rooms; d.version = 5; return d; } catch (e) { return null; }
  };
  store.load = () => {
    let saved = null;
    const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    saved = read(KEY);
    if (!saved) {
      const old = read(V4_KEY) || read(LEGACY_KEY);
      let d = old && old.data;
      if (d && d.version === 3) d = store.migrate(d);
      if (d && d.version === 4) d = store.migrate5(d);
      if (d) saved = { data: d, session: old.session };
    }
    if (saved && saved.data && saved.data.version === 5) { store.data = saved.data; store.session = saved.session || store.session; }
    else store.data = EH.seed();
    if (!store.user().id) store.session = { userId: 'u-pmo' };
    if (!store.data.exercises || !store.data.fundings) { try { Object.assign(store.data, EH.seedIncubation(store.data)); } catch (e) { store.data.exercises = store.data.exercises || []; store.data.fundings = store.data.fundings || []; } }
    store.ensureSnapshots();
  };
  store.save = () => { try { localStorage.setItem(KEY, JSON.stringify({ data: store.data, session: store.session })); } catch (e) { /* storage unavailable: keep in memory */ } };
  store.reset = () => { try { localStorage.removeItem(KEY); } catch (e) {} store.data = EH.seed(); store.ensureSnapshots(); store.save(); };
  store.ensureSnapshots = () => store.data.reports.forEach((r) => {
    if (r.status === 'approved' && !r.snapshot) r.snapshot = Q.snapshot(store.data, r.centre, r.period);
    else if (r.snapshot && !r.snapshot.reportingDetail) { const k = Q.snapshot(store.data, r.centre, r.period); ['reporting', 'reportingDetail', 'engagement', 'engagementDetail'].forEach((f) => (r.snapshot[f] = k[f])); }
  });

  /* ---------- session & permissions (section 3 of the PRD) ---------- */
  store.user = () => Q.user(store.data, store.session.userId);
  store.role = () => store.user().role;
  store.isPmo = () => store.role() === 'pmo';
  store.isOfficer = () => store.role() === 'officer';
  store.isBeneficiary = () => store.role() === 'beneficiaire';
  store.ownEnt = () => (store.isBeneficiary() ? Q.ent(store.data, store.user().entrepreneurId) : null);
  store.scope = () => (store.isPmo() ? null : store.user().centre); // null = all centres
  store.canSee = (centre) => !store.isBeneficiary() && (store.isPmo() || centre === store.scope() || centre === 'all');
  /** Record-level access: a beneficiary only ever reaches his own entrepreneur record and his cohort's activities. */
  store.canSeeEnt = (e) => !!e && (store.isPmo() || (store.isOfficer() && e.centre === store.scope()) || (store.isBeneficiary() && e.id === store.user().entrepreneurId));
  store.canSeeActivity = (a) => !!a && (store.isPmo() || (store.isOfficer() && a.centre === store.scope()) || (store.isBeneficiary() && Q.cohortActivities(store.data, store.ownEnt()).some((x) => x.id === a.id)));
  const can = (store.can = {
    writeOperational: (centre) => store.isOfficer() && centre === store.scope(), // activities, entrepreneurs, sessions
    manageProgrammes: () => store.isPmo(),
    validateReport: () => store.isPmo(), // BR-04-02, separation of duties
    submitReport: (centre) => store.isOfficer() && centre === store.scope(),
    managePartners: () => !store.isBeneficiary(), // PMO CRUA, officer CRU own records
    publishKnowledge: () => store.isPmo(),
    manageTemplates: () => store.isPmo(), // programme-level reporting template
    defineRequirement: (a) => store.isOfficer() && a.centre === store.scope(), // activity-level override
    reviewBeneficiaryReport: (centre) => store.isOfficer() && centre === store.scope()
  });
  store.switchUser = (id) => { store.session.userId = id; store.save(); };

  /* ---------- audit (FR-04-08) ---------- */
  store.log = (action, object, detail = '', centre = null, change = null) => {
    const entry = { id: EH.uid('au'), at: EH.nowIso(), user: store.session.userId, centre: centre || store.scope(), action, object, detail };
    if (change) { entry.before = change.before; entry.after = change.after; }
    store.data.audit.unshift(entry);
  };
  const commit = (result) => { store.save(); return result; };
  const fail = (errors) => ({ ok: false, errors: typeof errors === 'string' ? { _: errors } : errors });
  const required = (obj, fields) => {
    const e = {};
    fields.forEach(([k, label]) => { const v = obj[k]; if (v == null || String(v).trim() === '' || (Array.isArray(v) && !v.length)) e[k] = `${label} est obligatoire.`; });
    return e;
  };
  const noBenef = () => (store.isBeneficiary() ? fail('Action non autorisée pour votre profil.') : null);
  const locked = (centre, date) => Q.isLocked(store.data, centre, date);
  const LOCK_MSG = 'Cette date appartient à une période validée. Faites une demande de correction.';

  const A = (EH.act = {});

  /* ---- EC-12: access check with logging ---- */
  A.denied = (what, detail = '') => { store.log('Accès refusé', what, detail, store.scope()); store.save(); };
  A.guard = (centre, what) => {
    if (store.canSee(centre)) return true;
    A.denied(what, `Centre ${Q.centreName(store.data, centre)}`);
    return false;
  };
  A.guardEnt = (e) => {
    if (store.canSeeEnt(e)) return true;
    A.denied('Fiche ' + (e ? e.name : 'inconnue'), e ? `Centre ${Q.centreName(store.data, e.centre)}` : '');
    return false;
  };
  A.guardActivity = (a) => {
    if (store.canSeeActivity(a)) return true;
    A.denied('Activité ' + (a ? a.title : 'inconnue'), a ? `Centre ${Q.centreName(store.data, a.centre)}` : '');
    return false;
  };

  /* ---- programmes (FR-01-01, FR-01-02) ---- */
  A.createProgramme = (f) => {
    if (!can.manageProgrammes()) return fail('Seul le PMO crée les programmes.');
    const e = required(f, [['name', 'Le nom'], ['type', 'Le type'], ['start', 'La date de début'], ['end', 'La date de fin'], ['centres', 'Au moins un centre']]);
    if (f.start && f.end && f.end <= f.start) e.end = 'La date de fin doit être après la date de début.';
    if (Object.keys(e).length) return fail(e);
    const p = { id: EH.uid('p'), name: f.name.trim(), type: f.type, objectives: f.objectives || '', start: f.start, end: f.end, funder: f.funder || null, indicators: f.indicators || [], centres: f.centres.map((c) => ({ centre: c, officer: Q.centre(store.data, c).officer })), status: 'active' };
    store.data.programmes.push(p);
    p.centres.forEach((pc) => { if (!store.data.cohorts.some((c) => c.programme === p.id && c.centre === pc.centre)) store.data.cohorts.push({ id: EH.uid('co'), name: p.name, programme: p.id, centre: pc.centre, start: p.start, end: p.end }); });
    store.log('Programme créé', p.name, `${p.centres.length} centre(s)`, 'all');
    return commit({ ok: true, item: p });
  };

  /* ---- activities (FR-01-03, FR-01-04) ---- */
  A.saveActivity = (f, forceConflict) => {
    const centre = store.scope();
    if (!can.writeOperational(centre)) return fail('Seul le chargé du centre planifie ses activités.');
    const e = required(f, [['programme', 'Le programme'], ['type', 'Le type'], ['title', 'Le titre'], ['date', 'La date'], ['time', "L'heure"], ['cohort', 'La cohorte']]);
    if (f.date && locked(centre, f.date)) e.date = LOCK_MSG;
    if (f.time && !/^\d{2}:\d{2}$/.test(f.time)) e.time = "L'heure doit être au format HH:MM.";
    const durationMin = f.durationMin === '' || f.durationMin == null ? 180 : Number(f.durationMin);
    if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 720) e.durationMin = 'La durée doit être comprise entre 15 et 720 minutes.';
    const budget = f.budget === '' || f.budget == null ? null : Number(f.budget);
    if (budget != null && (!Number.isFinite(budget) || budget < 0)) e.budget = 'Le budget doit être un montant positif.';
    if (f.onlineLink && !/^https?:\/\/\S+$/.test(f.onlineLink.trim())) e.onlineLink = 'Le lien doit commencer par http:// ou https://.';
    if (f.type === 'Atelier en ligne' && !(f.onlineLink || '').trim()) e.onlineLink = 'Un atelier en ligne a besoin de son lien Meet ou Zoom.';
    if (f.room && !(store.data.rooms || []).some((r) => r.id === f.room && r.centre === centre)) e.room = 'Choisissez une salle de votre centre.';
    if (f.type === 'Session 1-1' && !f.participant) e.participant = 'Choisissez le participant de la session.';
    const rr = f.requirement ? normalizeRequirement(f.requirement, 'activity') : null;
    if (rr && rr.errors) Object.assign(e, rr.errors);
    if (Object.keys(e).length) return fail(e);
    const prev = f.id ? Q.activity(store.data, f.id) : null;
    if (prev && locked(centre, prev.date)) return fail(LOCK_MSG);
    const fields = {
      programme: f.programme, cohort: f.cohort, type: f.type, title: f.title.trim(), date: f.date, time: f.time, durationMin, duration: EH.fmtDuration(durationMin),
      location: f.location || '', room: f.room || null, facilitator: f.facilitator || null, staff: f.staff ? [f.staff] : [],
      expected: f.type === 'Session 1-1' ? 1 : +f.expected || 0, participant: f.type === 'Session 1-1' ? f.participant : null,
      budget, equipment: Array.isArray(f.equipment) ? f.equipment : f.equipment ? [f.equipment] : [],
      content: (f.content || '').trim(), supports: (f.supports || '').trim(), onlineLink: (f.onlineLink || '').trim(), contact: (f.contact || '').trim()
    };
    fields.facilitatorStatus = !fields.facilitator ? null : prev && prev.facilitator === fields.facilitator ? prev.facilitatorStatus : 'proposed';
    // PBI-06: clashes are warned, then allowed with an explicit "planifier quand même" (logged)
    const clashes = Q.conflicts(store.data, Object.assign({ id: f.id || null, centre, status: 'planned' }, fields));
    if (clashes.length && !forceConflict) return { ok: false, conflicts: clashes };
    let a;
    if (prev) {
      a = Object.assign(prev, fields);
      store.log('Activité modifiée', a.title, EH.fmtDate(a.date), centre);
    } else {
      a = Object.assign({ id: EH.uid('a'), centre, status: 'planned', attendees: [], notes: '' }, fields);
      store.data.activities.push(a);
      store.log('Activité planifiée', a.title, a.facilitator ? `${EH.fmtDate(a.date)} à ${a.time}` : 'Intervenant à trouver', centre);
    }
    if (clashes.length) store.log('Conflit de planning accepté', a.title, clashes.map((c) => c.text).join(' · '), centre);
    if (rr) applyRequirement('activity', a.id, rr.value, a.title, centre);
    return commit({ ok: true, item: a, draft: !a.facilitator, clashes });
  };
  A.closeActivity = (id, f) => {
    const a = Q.activity(store.data, id);
    if (!can.writeOperational(a.centre)) return fail('Action réservée au chargé du centre.');
    if (locked(a.centre, a.date)) return fail(LOCK_MSG);
    if (f.facilitator) a.facilitator = f.facilitator;
    if (f.status === 'done' && !a.facilitator) return fail({ facilitator: 'Choisissez l\'intervenant avant de marquer l\'activité réalisée.' });
    if (f.status === 'postponed' && !f.newDate) return fail({ newDate: 'Indiquez la nouvelle date.' });
    if (f.status === 'cancelled' && !(f.notes || '').trim()) return fail({ notes: "Indiquez le motif de l'annulation." });
    a.attendees = f.status === 'done' ? f.attendees || [] : [];
    a.notes = f.notes || '';
    if (f.status === 'postponed') { a.date = f.newDate; a.status = 'planned'; }
    else a.status = f.status;
    if (a.status === 'done' && a.type === 'Session 1-1' && a.participant && a.attendees.includes(a.participant) && !store.data.sessions.some((x) => x.activity === a.id)) {
      store.data.sessions.push({ id: EH.uid('se'), entrepreneur: a.participant, centre: a.centre, date: a.date, type: 'Coaching', coach: a.facilitator, topic: a.title, nextAction: '', nextDue: null, activity: a.id });
    }
    const label = { done: 'Activité réalisée', postponed: 'Activité reportée', cancelled: 'Activité annulée' }[f.status];
    store.log(label, a.title, f.status === 'done' ? EH.plural(a.attendees.length, 'présent') : a.notes || EH.fmtDate(a.date), a.centre);
    return commit({ ok: true, item: a });
  };

  /* ---- entrepreneurs (FR-02) ---- */
  /** Field checks shared by the manual form and the spreadsheet import. */
  const candidateErrors = (f) => {
    const e = required(f, [['firstName', 'Le prénom'], ['lastName', 'Le nom'], ['idea', "L'idée de projet"]]);
    if (!f.phone && !f.email) e.phone = 'Indiquez un téléphone ou un e-mail.';
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.email = "L'adresse e-mail n'est pas valide.";
    if (f.phone && !/^\+?[\d\s.\-()]{8,20}$/.test(f.phone)) e.phone = 'Le téléphone doit contenir au moins 8 chiffres.';
    if (f.birth && (!/^\d{4}-\d{2}-\d{2}$/.test(f.birth) || isNaN(Date.parse(f.birth)) || f.birth > EH.TODAY)) e.birth = 'La date de naissance doit être une date passée (JJ/MM/AAAA).';
    if (f.sector && !R.sectors.includes(f.sector)) e.sector = `Secteur inconnu : choisir parmi ${R.sectors.join(', ')}.`;
    if (f.source && !R.sources.includes(f.source)) e.source = `Source inconnue : choisir parmi ${R.sources.join(', ')}.`;
    return e;
  };
  const newCandidate = (f, centre) => ({ id: EH.uid('e'), firstName: f.firstName.trim(), lastName: f.lastName.trim(), name: f.firstName.trim() + ' ' + f.lastName.trim(), gender: f.gender || '', birth: f.birth || '', phone: f.phone || '', email: f.email || '', centre, cohort: null, sector: f.sector || '', idea: f.idea.trim(), source: f.source || '', maturity: null, stage: 'candidat', history: [{ stage: 'candidat', date: EH.TODAY }], abandonReason: null, version: 1 });

  /* ---- spreadsheet import: one verdict per row (insert / ignored duplicate / error) ---- */
  const COLS = { firstName: 'Prénom', lastName: 'Nom', phone: 'Téléphone', email: 'E-mail', birth: 'Date de naissance', sector: 'Secteur', idea: 'Idée de projet', source: 'Source' };
  A.IMPORT_COLUMNS = COLS;
  const HEADER_ALIASES = {
    firstName: ['prenom', 'first name', 'firstname', 'prenoms'], lastName: ['nom', 'last name', 'lastname', 'nom de famille'],
    phone: ['telephone', 'tel', 'phone', 'mobile', 'gsm', 'numero'], email: ['e mail', 'email', 'mail', 'courriel', 'adresse e mail'],
    birth: ['date de naissance', 'naissance', 'birth', 'date naissance'], sector: ['secteur', 'sector', 'secteur d activite'],
    idea: ['idee de projet', 'idee', 'projet', 'idea', 'description du projet'], source: ['source', 'comment a t il connu elife', 'connu par', 'canal']
  };
  const matchList = (v, list) => { const n = EH.norm(v); return list.find((x) => EH.norm(x) === n) || v; };
  const toIsoDate = (v) => {
    if (v === '' || v == null) return '';
    if (typeof v === 'number') return EH.sheet ? EH.sheet.serialToDate(v) : String(v);
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (/^\d{4,5}$/.test(s) && EH.sheet) return EH.sheet.serialToDate(+s);
    return s;
  };
  /** rows: raw sheet rows (first non-empty row = headers). Pure: nothing is written. */
  A.analyzeImport = (rows) => {
    const centre = store.scope();
    if (!can.writeOperational(centre)) return fail('Seul le chargé du centre importe des candidats.');
    const start = rows.findIndex((r) => r && r.some((c) => String(c).trim() !== ''));
    if (start < 0) return fail('Le fichier est vide.');
    const header = rows[start].map((h) => EH.norm(h));
    const map = {};
    Object.entries(HEADER_ALIASES).forEach(([k, al]) => { const i = header.findIndex((h) => al.includes(h)); if (i >= 0) map[k] = i; });
    const missing = ['firstName', 'lastName', 'idea'].filter((k) => map[k] == null);
    if (missing.length) return fail(`Colonnes obligatoires absentes : ${missing.map((k) => COLS[k]).join(', ')}. Téléchargez le modèle pour voir les en-têtes attendus.`);
    if (map.phone == null && map.email == null) return fail('Il faut au moins une colonne Téléphone ou E-mail.');
    const seen = [], out = [];
    rows.slice(start + 1).forEach((r, i) => {
      if (!r || !r.some((c) => String(c).trim() !== '')) return;
      const cell = (k) => (map[k] == null || r[map[k]] == null ? '' : String(r[map[k]]).trim());
      const v = { firstName: cell('firstName'), lastName: cell('lastName'), phone: cell('phone'), email: cell('email').toLowerCase(), birth: toIsoDate(map.birth == null ? '' : r[map.birth]), sector: cell('sector') && matchList(cell('sector'), R.sectors), idea: cell('idea'), source: cell('source') && matchList(cell('source'), R.sources) };
      const line = start + i + 2;
      const errors = candidateErrors(v);
      if (Object.keys(errors).length) { out.push({ line, values: v, status: 'error', errors }); return; }
      const dup = Q.duplicateEntrepreneur(store.data, v)[0];
      const inFile = Q.duplicateEntrepreneur({ entrepreneurs: seen }, v)[0];
      if (dup) out.push({ line, values: v, status: 'duplicate', reason: dup.centre === centre ? `Déjà inscrit dans votre centre : ${dup.name} (${EH.stageLabel(dup.stage)})` : `Déjà inscrit au centre de ${Q.centreName(store.data, dup.centre)}` });
      else if (inFile) out.push({ line, values: v, status: 'duplicate', reason: `Doublon de la ligne ${inFile.line} du fichier` });
      else { out.push({ line, values: v, status: 'ok' }); seen.push({ line, name: v.firstName + ' ' + v.lastName, phone: v.phone, email: v.email, birth: v.birth }); }
    });
    if (!out.length) return fail('Aucune ligne de données sous les en-têtes.');
    const count = (s) => out.filter((x) => x.status === s).length;
    return { ok: true, rows: out, summary: { ok: count('ok'), duplicate: count('duplicate'), error: count('error') } };
  };
  /** Inserts the valid rows of a fresh analysis; duplicates are ignored, rows with errors are left out. */
  A.importCandidates = (rows) => {
    const an = A.analyzeImport(rows);
    if (!an.ok) return an;
    const centre = store.scope(), items = an.rows.filter((x) => x.status === 'ok').map((x) => newCandidate(x.values, centre));
    if (!items.length) return fail('Aucune ligne à insérer : toutes les lignes sont des doublons ou contiennent une erreur.');
    store.data.entrepreneurs.push(...items);
    store.log('Candidats importés', `Import de ${EH.plural(items.length, 'candidat')}`, `${an.summary.duplicate} doublon(s) ignoré(s) · ${an.summary.error} ligne(s) en erreur`, centre);
    return commit({ ok: true, items, summary: an.summary });
  };

  A.registerCandidate = (f, override) => {
    const centre = store.scope();
    if (!can.writeOperational(centre)) return fail('Seul le chargé du centre inscrit les candidats.');
    const e = candidateErrors(f);
    if (Object.keys(e).length) return fail(e);
    const dups = Q.duplicateEntrepreneur(store.data, f);
    if (dups.length && !override) {
      // EC-05: other centres only reveal the centre name, never personal data
      return { ok: false, duplicates: dups.map((x) => (x.centre === centre ? { id: x.id, name: x.name, own: true, stage: x.stage } : { own: false, centre: Q.centreName(store.data, x.centre) })) };
    }
    if (dups.length && override && !(override.reason || '').trim()) return fail({ override: 'Le motif est obligatoire pour enregistrer malgré le doublon.' });
    const x = newCandidate(f, centre);
    store.data.entrepreneurs.push(x);
    store.log('Candidat inscrit', x.name, override ? `Doublon forcé : ${override.reason}` : x.idea, centre);
    return commit({ ok: true, item: x });
  };
  A.decideSelection = (id, f) => {
    const x = Q.ent(store.data, id);
    if (!can.writeOperational(x.centre)) return fail('Action réservée au chargé du centre.');
    const e = required(f, [['decision', 'La décision'], ['reason', 'Le motif']]);
    if (f.decision === 'selected' && !f.cohort) e.cohort = 'Choisissez une cohorte.';
    if (Object.keys(e).length) return fail(e);
    x.selection = { decision: f.decision, reason: f.reason, date: EH.TODAY };
    if (f.decision === 'selected') { x.cohort = f.cohort; x.stage = 'preinc'; x.history.push({ stage: 'preinc', date: EH.TODAY, note: 'Sélectionné : ' + f.reason }); }
    x.version++;
    store.log('Décision de sélection', x.name, R.selection.find((s) => s.id === f.decision).label + ' · ' + f.reason, x.centre);
    return commit({ ok: true, item: x });
  };
  /** BR-02-03 / BR-02-04: forward moves free; backward or abandon need a reason; history kept. */
  A.moveStage = (id, to, reason, version) => {
    const x = Q.ent(store.data, id);
    if (!can.writeOperational(x.centre)) return fail('Action réservée au chargé du centre.');
    if (version != null && version !== x.version) return fail('Cette fiche a été modifiée entre-temps. Rechargez-la (EC-08).');
    if (to === x.stage) return fail({ to: "Choisissez une autre étape que l'étape actuelle." });
    const from = EH.stageIndex(x.stage), dest = EH.stageIndex(to);
    const needsReason = to === 'abandon' || x.stage === 'abandon' || dest < from;
    if (needsReason && !(reason || '').trim()) return fail({ reason: to === 'abandon' ? "Le motif d'abandon est obligatoire." : 'Un retour en arrière exige un motif.' });
    if (x.stage === 'candidat' && to !== 'abandon') return fail({ to: 'Enregistrez d\'abord la décision de sélection.' });
    x.history.push({ stage: to, date: EH.TODAY, note: reason || '' });
    if (to === 'abandon') {
      x.abandonReason = reason;
      store.data.deliverables.filter((d) => d.entrepreneur === id && d.status === 'expected').forEach((d) => (d.status = 'closed')); // EC-07
    }
    const prev = x.stage;
    x.stage = to; x.version++;
    store.log(to === 'abandon' ? 'Abandon déclaré' : 'Étape modifiée', x.name, `${EH.stageLabel(prev)} → ${EH.stageLabel(to)}${reason ? ' · ' + reason : ''}`, x.centre);
    return commit({ ok: true, item: x, from: prev });
  };
  /** FR-02-05: a session in ≤ 6 fields. */
  A.logSession = (f) => {
    const x = Q.ent(store.data, f.entrepreneur);
    const e = required(f, [['entrepreneur', "L'entrepreneur"], ['date', 'La date'], ['coach', 'Le coach'], ['topic', 'Le sujet']]);
    if (x && !can.writeOperational(x.centre)) return fail('Action réservée au chargé du centre.');
    if (f.date > EH.TODAY) e.date = 'Une séance ne peut pas être datée dans le futur.';
    if (x && f.date && locked(x.centre, f.date)) e.date = LOCK_MSG;
    if (f.nextAction && !f.nextDue) e.nextDue = "Indiquez l'échéance de la prochaine action.";
    if (Object.keys(e).length) return fail(e);
    const s = { id: EH.uid('se'), entrepreneur: x.id, centre: x.centre, date: f.date, type: f.type || 'Coaching', coach: f.coach, topic: f.topic.trim(), nextAction: (f.nextAction || '').trim(), nextDue: f.nextDue || null };
    store.data.sessions.push(s);
    store.log('Séance saisie', x.name, `${s.type} · ${s.topic}`, x.centre);
    return commit({ ok: true, item: s });
  };
  A.setDeliverable = (id, status) => {
    const d = store.data.deliverables.find((x) => x.id === id);
    const x = Q.ent(store.data, d.entrepreneur);
    if (!can.writeOperational(x.centre)) return fail('Action réservée au chargé du centre.');
    d.status = status;
    store.log('Livrable mis à jour', `${d.title} · ${x.name}`, { submitted: 'Déposé', validated: 'Validé', expected: 'Attendu' }[status], x.centre);
    return commit({ ok: true });
  };

  /* ---- partners (FR-05) ---- */
  A.createPartner = (f, force) => {
    if (noBenef()) return noBenef();
    const e = required(f, [['name', 'Le nom'], ['type', 'Le type'], ['region', 'La région']]);
    if (Object.keys(e).length) return fail(e);
    const sim = Q.similarPartners(store.data, f.name);
    if (sim.length && !force) return { ok: false, similar: sim };
    const p = { id: EH.uid('pa'), name: f.name.trim(), type: f.type, region: f.region.trim(), contact: f.contact || '', phone: f.phone || '', email: f.email || '', createdBy: store.scope() || 'pmo' };
    store.data.partners.push(p);
    store.log('Partenaire ajouté', p.name, p.type, store.scope() || 'all');
    return commit({ ok: true, item: p });
  };
  A.addCollaboration = (f) => {
    if (noBenef()) return noBenef();
    const e = required(f, [['partner', 'Le partenaire'], ['centre', 'Le centre'], ['programme', 'Le programme'], ['contribution', 'Le type de contribution'], ['start', 'La date de début']]);
    if (f.end && f.start && f.end < f.start) e.end = 'La fin doit être après le début.';
    if (!store.isPmo() && f.centre !== store.scope()) e.centre = 'Vous ne pouvez enregistrer que les collaborations de votre centre.';
    if (Object.keys(e).length) return fail(e);
    const c = { id: EH.uid('cb'), partner: f.partner, centre: f.centre, programme: f.programme, contribution: f.contribution, start: f.start, end: f.end || null, status: !f.end || f.end >= EH.TODAY ? 'active' : 'ended' };
    store.data.collaborations.push(c);
    store.log('Collaboration enregistrée', Q.partner(store.data, f.partner).name, `${c.contribution} · ${Q.programme(store.data, c.programme).name}`, f.centre);
    return commit({ ok: true, item: c });
  };

  /* ---- knowledge (FR-07) ---- */
  A.addKnowledge = (f) => {
    if (noBenef()) return noBenef();
    const e = required(f, [['type', 'Le type'], ['title', 'Le titre'], ['summary', 'Le résumé']]);
    if (f.type === 'Leçon apprise' && !f.activity && !f.programme) e.activity = "Une leçon apprise doit citer l'activité ou le programme source (BR-07-03).";
    if (f.link && !/^https?:\/\//.test(f.link)) e.link = 'Le lien doit commencer par http:// ou https://.';
    if (Object.keys(e).length) return fail(e);
    const act = f.activity ? Q.activity(store.data, f.activity) : null;
    const k = { id: EH.uid('k'), type: f.type, title: f.title.trim(), summary: f.summary.trim(), link: f.link || '', tags: (f.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean), centre: store.scope() || 'all', activity: f.activity || null, programme: f.programme || (act ? act.programme : null), status: store.isPmo() ? 'published' : 'draft', review: EH.addDays(EH.TODAY, 365), author: store.session.userId, created: EH.TODAY };
    store.data.knowledge.unshift(k);
    store.log('Connaissance ajoutée', k.title, k.status === 'draft' ? 'Brouillon, en attente de validation' : 'Publiée', k.centre);
    return commit({ ok: true, item: k });
  };
  A.setKnowledgeStatus = (id, status) => {
    if (!can.publishKnowledge()) return fail('Seul le PMO publie ou archive.');
    const k = store.data.knowledge.find((x) => x.id === id);
    k.status = status;
    if (status === 'published' && k.review < EH.TODAY) k.review = EH.addDays(EH.TODAY, 365);
    store.log({ published: 'Connaissance publiée', archived: 'Connaissance archivée' }[status], k.title, '', k.centre);
    return commit({ ok: true, item: k });
  };
  A.renewKnowledge = (id) => {
    if (!can.publishKnowledge()) return fail('Seul le PMO renouvelle un contenu.');
    const k = store.data.knowledge.find((x) => x.id === id);
    k.review = EH.addDays(EH.TODAY, 365); k.status = 'published';
    store.log('Connaissance renouvelée', k.title, 'Révision dans 12 mois', k.centre);
    return commit({ ok: true, item: k });
  };

  /* ---- reports (FR-04) ---- */
  const ensureReport = (centre, period) => {
    let r = Q.report(store.data, centre, period);
    if (!r) { r = { id: EH.uid('r'), centre, period, status: 'draft', comment: '', submitted: null, approved: null, returnReason: null, snapshot: null, version: 1 }; store.data.reports.push(r); }
    return r;
  };
  A.submitReport = (centre, period, comment) => {
    if (!can.submitReport(centre)) return fail('Seul le chargé du centre soumet son rapport.');
    const r = ensureReport(centre, period);
    if (r.status === 'submitted' || r.status === 'approved') return fail('Ce rapport est déjà soumis.');
    const checks = Q.qualityChecks(store.data, centre, period);
    if (checks.length && !(comment || '').trim()) return fail({ comment: `${EH.plural(checks.length, 'alerte qualité')} : expliquez-les dans le commentaire (EC-10).` });
    r.status = 'submitted'; r.comment = comment || ''; r.submitted = EH.nowIso(); r.returnReason = null;
    store.log('Rapport soumis', `Rapport ${EH.fmtMonth(period).toLowerCase()} · ${Q.centreName(store.data, centre)}`, checks.length ? `${checks.length} alerte(s) qualité commentée(s)` : '', centre);
    return commit({ ok: true, item: r });
  };
  A.approveReport = (id) => {
    if (!can.validateReport()) return fail('Seul le PMO valide les rapports.');
    const r = store.data.reports.find((x) => x.id === id);
    if (r.status !== 'submitted') return fail('Seul un rapport soumis peut être validé.');
    r.status = 'approved'; r.approved = EH.nowIso(); r.snapshot = Q.snapshot(store.data, r.centre, r.period);
    store.log('Rapport validé', `Rapport ${EH.fmtMonth(r.period).toLowerCase()} · ${Q.centreName(store.data, r.centre)}`, 'Période verrouillée', r.centre);
    return commit({ ok: true, item: r });
  };
  A.returnReport = (id, reason) => {
    if (!can.validateReport()) return fail('Seul le PMO renvoie les rapports.');
    if (!(reason || '').trim()) return fail({ reason: 'Le motif du renvoi est obligatoire.' });
    const r = store.data.reports.find((x) => x.id === id);
    r.status = 'returned'; r.returnReason = reason.trim();
    store.log('Rapport renvoyé', `Rapport ${EH.fmtMonth(r.period).toLowerCase()} · ${Q.centreName(store.data, r.centre)}`, reason, r.centre);
    return commit({ ok: true, item: r });
  };
  /** Remarks on a monthly report: a thread between the PMO and the centre. They never change the figures, so a validated (locked) report still accepts them. */
  A.addReportRemark = (centre, period, text) => {
    if (!store.isPmo() && !can.submitReport(centre)) return fail('Seuls le PMO et le chargé du centre peuvent commenter ce rapport.');
    const t = String(text || '').trim();
    if (!t) return fail({ remark: 'Écrivez la remarque avant de l’ajouter.' });
    if (t.length > 1000) return fail({ remark: '1 000 caractères au maximum.' });
    const r = ensureReport(centre, period);
    r.remarks = r.remarks || [];
    const m = { id: EH.uid('rm'), by: store.session.userId, role: store.role(), at: EH.nowIso(), text: t };
    r.remarks.push(m);
    store.log('Remarque sur le rapport', `Rapport ${EH.fmtMonth(period).toLowerCase()} · ${Q.centreName(store.data, centre)}`, t.length > 80 ? t.slice(0, 80) + '…' : t, centre);
    return commit({ ok: true, item: m, report: r });
  };
  A.requestCorrection = (reportId, text) => {
    if (noBenef()) return noBenef();
    if (!(text || '').trim()) return fail({ text: 'Décrivez la correction demandée.' });
    const r = store.data.reports.find((x) => x.id === reportId);
    const c = { id: EH.uid('cr'), report: reportId, centre: r.centre, text: text.trim(), by: store.session.userId, at: EH.nowIso(), status: 'open' };
    store.data.corrections.push(c);
    store.log('Demande de correction', `Rapport ${EH.fmtMonth(r.period).toLowerCase()} · ${Q.centreName(store.data, r.centre)}`, text, r.centre);
    return commit({ ok: true, item: c });
  };
  A.resolveCorrection = (id, approve) => {
    if (!store.isPmo()) return fail('Seul le PMO traite les corrections.');
    const c = store.data.corrections.find((x) => x.id === id);
    const r = store.data.reports.find((x) => x.id === c.report);
    c.status = approve ? 'approved' : 'rejected';
    if (approve) { r.status = 'draft'; r.snapshot = null; r.approved = null; r.version++; }
    store.log(approve ? 'Correction acceptée' : 'Correction refusée', `Rapport ${EH.fmtMonth(r.period).toLowerCase()} · ${Q.centreName(store.data, r.centre)}`, approve ? `Période rouverte, version ${r.version}` : '', r.centre);
    return commit({ ok: true });
  };

  /* ---- reporting requirements (Défi 1): immutable versions, an edit creates version + 1 ---- */
  const reqSummary = (r) => (r ? `v${r.version} · ${Q.formatLabel(r.format)}${r.format !== 'none' && r.format !== 'inherit' ? ` · ${r.dueDays} j` : ''}` : 'Aucun');
  const normalizeRequirement = (input, scope) => {
    const e = {};
    const formats = [...R.reportFormats.map((x) => x.id), 'none', ...(scope === 'activity' ? ['inherit'] : [])];
    const format = input.format || (scope === 'activity' ? 'inherit' : 'none');
    if (!formats.includes(format)) e.req_format = 'Choisissez un format de rapport.';
    const real = R.reportFormats.some((x) => x.id === format);
    let dueDays = R.DEFAULT_DUE_DAYS, fields = [];
    if (real) {
      const raw = input.dueDays == null || input.dueDays === '' ? R.DEFAULT_DUE_DAYS : Number(input.dueDays);
      if (!Number.isInteger(raw) || raw < 0 || raw > 60) e.req_dueDays = "L'échéance doit être un nombre entier de jours, entre 0 et 60.";
      else dueDays = raw;
    }
    if (format === 'form') {
      const list = (input.fields || []).filter((x) => x && (String(x.label || '').trim() || x.type));
      if (!list.length) e.req_fields = 'Ajoutez au moins une question.';
      if (list.length > R.MAX_FIELDS) e.req_fields = `Huit questions au maximum (${list.length} saisies).`;
      list.forEach((x, i) => {
        const opts = x.type === 'choice' ? (Array.isArray(x.options) ? x.options : String(x.options || '').split(',')).map((o) => String(o).trim()).filter(Boolean) : [];
        if (!String(x.label || '').trim()) e['rf_' + i] = "L'intitulé de la question est obligatoire.";
        else if (!R.fieldTypes.some((t) => t.id === x.type)) e['rf_' + i] = 'Choisissez un type de réponse.';
        else if (x.type === 'choice' && opts.length < 2) e['rf_' + i] = 'Indiquez au moins deux choix, séparés par des virgules.';
        fields.push({ id: x.id || 'q' + (i + 1), label: String(x.label || '').trim(), type: x.type, required: !!x.required, ...(x.type === 'choice' ? { options: opts } : {}) });
      });
      const ids = new Set(); fields.forEach((x, i) => { if (ids.has(x.id)) x.id = 'q' + (i + 1) + 'x' + i; ids.add(x.id); });
    }
    if (Object.keys(e).length) return { errors: e };
    return { value: { format, fields, dueDays: real ? dueDays : 0, mandatory: real ? input.mandatory !== false && input.mandatory !== 'no' : false, feedbackVisible: real ? input.feedbackVisible !== false && input.feedbackVisible !== 'no' : false } };
  };
  const sigOf = (r) => JSON.stringify([r.format, r.fields, r.dueDays, r.mandatory, r.feedbackVisible]);
  /** Creates version + 1 unless nothing changed. Caller has already checked rights and conflicts. */
  const applyRequirement = (scope, target, v, label, centre) => {
    const cur = Q.requirement(store.data, scope, target);
    if (cur && sigOf(cur) === sigOf(v)) return { rec: cur, changed: false };
    if (!cur && (v.format === 'inherit' || (scope === 'programme' && v.format === 'none'))) return { rec: null, changed: false };
    const rec = Object.assign({ id: EH.uid('rq'), scope, programmeId: scope === 'programme' ? target : null, activityId: scope === 'activity' ? target : null, version: (cur ? cur.version : 0) + 1 }, v);
    store.data.reportingRequirements.push(rec);
    store.log(cur ? 'Rapport demandé modifié' : 'Rapport demandé défini', label, `${reqSummary(cur)} → ${reqSummary(rec)}`, centre, { before: reqSummary(cur), after: reqSummary(rec) });
    return { rec, changed: true };
  };
  A.saveRequirement = (scope, target, input, baseVersion) => {
    let label, centre;
    if (scope === 'programme') {
      const p = Q.programme(store.data, target);
      if (!p || !can.manageTemplates()) return fail('Seul le PMO définit le modèle de rapport d’un programme.');
      label = 'Modèle de rapport · ' + p.name; centre = 'all';
    } else {
      const a = Q.activity(store.data, target);
      if (!a || !can.defineRequirement(a)) return fail('Seul le chargé du centre définit le rapport de ses activités.');
      label = 'Rapport demandé · ' + a.title; centre = a.centre;
    }
    const cur = Q.requirement(store.data, scope, target);
    if (baseVersion != null && baseVersion !== '' && (cur ? cur.version : 0) !== +baseVersion) return fail('Le rapport demandé a été modifié entre-temps. Rouvrez-le pour voir la dernière version.');
    const rr = normalizeRequirement(input, scope);
    if (rr.errors) return fail(rr.errors);
    const res = applyRequirement(scope, target, rr.value, label, centre);
    return commit({ ok: true, item: res.rec, changed: res.changed });
  };

  /* ---- beneficiary reports (Défi 1) ---- */
  const BR = R.beneficiaryReportStatus;
  const CONFLICT = 'Ce rapport a été modifié entre-temps. Fermez-le et rouvrez-le pour voir la dernière version.';
  const answerErrors = (req, a) => {
    const e = {}, blank = (v) => v == null || String(v).trim() === '';
    if (req.format === 'free' && blank(a.text)) e.ans_text = 'Le compte rendu est obligatoire.';
    if (req.format === 'deliverable') {
      if (blank(a.link)) e.ans_link = 'Indiquez le lien vers votre livrable.';
      else if (!/^https?:\/\/\S+$/.test(String(a.link).trim())) e.ans_link = 'Le lien doit commencer par http:// ou https://.';
    }
    if (req.format === 'form') req.fields.forEach((f) => {
      const v = a[f.id];
      if (blank(v)) { if (f.required) e['ans_' + f.id] = `« ${f.label} » est obligatoire.`; return; }
      if (f.type === 'number' && !Number.isFinite(Number(v))) e['ans_' + f.id] = 'Indiquez un nombre.';
      if (f.type === 'rating' && !['1', '2', '3', '4', '5'].includes(String(v))) e['ans_' + f.id] = 'Choisissez une note de 1 à 5.';
      if (f.type === 'choice' && !f.options.includes(v)) e['ans_' + f.id] = 'Choisissez une des réponses proposées.';
    });
    return e;
  };
  const cleanAnswers = (req, a = {}) => {
    const out = {}, put = (k) => { if (a[k] != null && String(a[k]).trim() !== '') out[k] = String(a[k]).trim(); };
    if (req.format === 'free') put('text');
    if (req.format === 'deliverable') { put('link'); put('note'); }
    if (req.format === 'form') req.fields.forEach((f) => put(f.id));
    if (req.format === 'presence') out.confirmed = '1';
    return out;
  };
  /** Shared preconditions of the beneficiary's two write actions. */
  const myObligation = (activityId, version) => {
    const e = store.ownEnt();
    if (!e) return { err: fail('Action réservée au bénéficiaire concerné.') };
    const a = Q.activity(store.data, activityId);
    if (!A.guardActivity(a)) return { err: fail('Cette activité ne fait pas partie de votre parcours. La tentative a été enregistrée.') };
    const o = Q.obligations(store.data, e).find((x) => x.activity.id === a.id);
    if (!o) return { err: fail("Aucun rapport n'est attendu pour cette activité.") };
    if (version != null && version !== '' && +version !== (o.report ? o.report.version : 0)) return { err: fail(CONFLICT) };
    if (o.report && (o.report.status === 'submitted' || o.report.status === 'validated')) return { err: fail(o.report.status === 'validated' ? 'Ce rapport est validé : demandez une correction au chargé du centre.' : 'Ce rapport est en cours de relecture : vous ne pouvez plus le modifier.') };
    return { e, a, o };
  };
  const objectOf = (e, a) => `${e.name} · ${a.title}`;
  A.saveReportDraft = (activityId, answers, version) => {
    const m = myObligation(activityId, version);
    if (m.err) return m.err;
    const { e, a, o } = m, clean = cleanAnswers(o.requirement, answers);
    let rep = o.report;
    const before = BR[o.status].label;
    if (!rep) {
      rep = { id: EH.uid('br'), activityId: a.id, entrepreneurId: e.id, requirementId: o.requirement.id, requirementVersion: o.requirement.version, answers: clean, status: 'draft', createdAt: EH.TODAY, submittedAt: null, firstSubmittedAt: null, reviewedBy: null, reviewedAt: null, reviewComment: '', version: 1 };
      store.data.beneficiaryReports.push(rep);
    } else { rep.answers = clean; rep.status = 'draft'; rep.version++; }
    if (before !== BR.draft.label) store.log('Rapport bénéficiaire enregistré', objectOf(e, a), `${before} → ${BR.draft.label}`, e.centre, { before, after: BR.draft.label });
    return commit({ ok: true, item: rep });
  };
  A.sendBeneficiaryReport = (activityId, answers, version) => {
    const m = myObligation(activityId, version);
    if (m.err) return m.err;
    const { e, a, o } = m, clean = cleanAnswers(o.requirement, answers);
    const errs = answerErrors(o.requirement, clean);
    if (Object.keys(errs).length) return fail(errs);
    let rep = o.report;
    const before = BR[o.status].label, now = EH.nowIso();
    if (!rep) {
      rep = { id: EH.uid('br'), activityId: a.id, entrepreneurId: e.id, requirementId: o.requirement.id, requirementVersion: o.requirement.version, answers: clean, status: 'submitted', createdAt: EH.TODAY, submittedAt: now, firstSubmittedAt: now, reviewedBy: null, reviewedAt: null, reviewComment: '', version: 1 };
      store.data.beneficiaryReports.push(rep);
    } else { rep.answers = clean; rep.status = 'submitted'; rep.submittedAt = now; rep.firstSubmittedAt = rep.firstSubmittedAt || now; rep.version++; }
    const onTime = now.slice(0, 10) <= o.due;
    store.log('Rapport bénéficiaire envoyé', objectOf(e, a), `${before} → ${BR.submitted.label}${onTime ? '' : ' · après l’échéance du ' + EH.fmtDate(o.due)}`, e.centre, { before, after: BR.submitted.label });
    return commit({ ok: true, item: rep, onTime });
  };
  /** Officer: validate, or return with a mandatory reason. */
  A.reviewBeneficiaryReport = (id, decision, comment, version) => {
    const rep = store.data.beneficiaryReports.find((x) => x.id === id);
    if (!rep) return fail('Rapport introuvable.');
    const e = Q.ent(store.data, rep.entrepreneurId), a = Q.activity(store.data, rep.activityId);
    if (!can.reviewBeneficiaryReport(a.centre)) return fail('Action réservée au chargé du centre.');
    if (version != null && version !== '' && +version !== rep.version) return fail(CONFLICT);
    if (rep.status !== 'submitted') return fail('Seul un rapport soumis peut être relu.');
    if (decision === 'return' && !String(comment || '').trim()) return fail({ reason: 'Le motif du renvoi est obligatoire.' });
    const before = BR.submitted.label, after = decision === 'validate' ? BR.validated.label : BR.returned.label;
    rep.status = decision === 'validate' ? 'validated' : 'returned';
    rep.reviewedBy = store.session.userId; rep.reviewedAt = EH.nowIso(); rep.reviewComment = String(comment || '').trim(); rep.version++;
    store.log(decision === 'validate' ? 'Rapport bénéficiaire validé' : 'Rapport bénéficiaire renvoyé', objectOf(e, a), `${before} → ${after}${rep.reviewComment ? ' · ' + rep.reviewComment : ''}`, a.centre, { before, after });
    return commit({ ok: true, item: rep });
  };
  /** A validated report is read-only: the beneficiary asks, the officer decides (like the monthly report). */
  A.requestBeneficiaryCorrection = (reportId, text) => {
    const e = store.ownEnt(), rep = store.data.beneficiaryReports.find((x) => x.id === reportId);
    if (!e || !rep || rep.entrepreneurId !== e.id) { A.denied('Rapport bénéficiaire', 'Rapport d’un autre bénéficiaire'); return fail('Action réservée au bénéficiaire concerné.'); }
    if (rep.status !== 'validated') return fail('Seul un rapport validé nécessite une demande de correction.');
    if (!String(text || '').trim()) return fail({ text: 'Décrivez la correction demandée.' });
    if (store.data.beneficiaryCorrections.some((c) => c.report === reportId && c.status === 'open')) return fail('Une demande de correction est déjà en attente.');
    const a = Q.activity(store.data, rep.activityId);
    const c = { id: EH.uid('bc'), report: reportId, entrepreneurId: e.id, centre: e.centre, text: text.trim(), by: store.session.userId, at: EH.nowIso(), status: 'open' };
    store.data.beneficiaryCorrections.push(c);
    store.log('Correction de rapport demandée', objectOf(e, a), text.trim(), e.centre);
    return commit({ ok: true, item: c });
  };
  A.resolveBeneficiaryCorrection = (id, approve) => {
    const c = store.data.beneficiaryCorrections.find((x) => x.id === id);
    if (!c) return fail('Demande introuvable.');
    const rep = store.data.beneficiaryReports.find((x) => x.id === c.report), a = Q.activity(store.data, rep.activityId), e = Q.ent(store.data, rep.entrepreneurId);
    if (!can.reviewBeneficiaryReport(a.centre)) return fail('Action réservée au chargé du centre.');
    c.status = approve ? 'approved' : 'rejected';
    if (approve) { rep.status = 'returned'; rep.reviewComment = 'Correction acceptée : ' + c.text; rep.reviewedBy = store.session.userId; rep.reviewedAt = EH.nowIso(); rep.version++; }
    store.log(approve ? 'Correction de rapport acceptée' : 'Correction de rapport refusée', objectOf(e, a), approve ? `${BR.validated.label} → ${BR.returned.label}` : '', a.centre, approve ? { before: BR.validated.label, after: BR.returned.label } : null);
    return commit({ ok: true, item: rep });
  };

  /* ---- incubation follow-up: exercises (become actions for the beneficiary) and funders linked to projects ---- */
  const EX = R.exerciseStatus;
  const EX_CONFLICT = 'Cet exercice a été modifié entre-temps. Fermez-le et rouvrez-le pour voir la dernière version.';
  A.giveExercise = (f) => {
    const centre = store.scope();
    if (!can.writeOperational(centre)) return fail('Seul le chargé du centre donne des exercices.');
    const ids = (Array.isArray(f.entrepreneurs) ? f.entrepreneurs : [f.entrepreneurs]).filter(Boolean);
    const e = required(f, [['title', 'Le titre'], ['instructions', 'La consigne'], ['due', "L'échéance"]]);
    if (!ids.length) e.entrepreneurs = 'Choisissez au moins un bénéficiaire.';
    if (f.due && f.due < EH.TODAY) e.due = "L'échéance ne peut pas être dans le passé.";
    const targets = ids.map((id) => Q.ent(store.data, id));
    if (targets.some((x) => !x || x.centre !== centre || !R.activeStages.includes(x.stage))) e.entrepreneurs = 'Choisissez des entrepreneurs actifs de votre centre.';
    if (Object.keys(e).length) return fail(e);
    const items = targets.map((x) => ({ id: EH.uid('ex'), entrepreneurId: x.id, centre, stage: x.stage, title: f.title.trim(), instructions: f.instructions.trim(), givenAt: EH.TODAY, due: f.due, status: 'todo', answer: '', link: '', submittedAt: null, reviewedAt: null, reviewComment: '', createdBy: store.session.userId, version: 1 }));
    store.data.exercises.push(...items);
    store.log('Exercice donné', items[0].title, `${targets.map((x) => x.name).join(', ')} · échéance ${EH.fmtDate(f.due)}`, centre);
    return commit({ ok: true, items });
  };
  /** Beneficiary hands in his own exercise. */
  A.submitExercise = (id, f, version) => {
    const me = store.ownEnt(), x = store.data.exercises.find((y) => y.id === id);
    if (!me || !x || x.entrepreneurId !== me.id) { A.denied('Exercice', 'Exercice d’un autre bénéficiaire'); return fail('Cet exercice ne fait pas partie de votre parcours. La tentative a été enregistrée.'); }
    if (version != null && version !== '' && +version !== x.version) return fail(EX_CONFLICT);
    if (x.status === 'submitted' || x.status === 'validated') return fail(x.status === 'validated' ? 'Cet exercice est déjà validé.' : 'Cet exercice est en cours de relecture.');
    const e = {};
    if (!String(f.answer || '').trim()) e.answer = 'Décrivez ce que vous avez fait.';
    if (f.link && !/^https?:\/\/\S+$/.test(String(f.link).trim())) e.link = 'Le lien doit commencer par http:// ou https://.';
    if (Object.keys(e).length) return fail(e);
    const before = EX[x.status].label;
    Object.assign(x, { answer: String(f.answer).trim(), link: String(f.link || '').trim(), status: 'submitted', submittedAt: EH.nowIso() }); x.version++;
    store.log('Exercice rendu', `${me.name} · ${x.title}`, `${before} → ${EX.submitted.label}`, x.centre, { before, after: EX.submitted.label });
    return commit({ ok: true, item: x });
  };
  /** Officer: validate or ask to redo (reason required). For an entrepreneur without a space, the officer may validate directly. */
  A.reviewExercise = (id, decision, comment, version) => {
    const x = store.data.exercises.find((y) => y.id === id);
    if (!x) return fail('Exercice introuvable.');
    if (!can.writeOperational(x.centre)) return fail('Action réservée au chargé du centre.');
    if (version != null && version !== '' && +version !== x.version) return fail(EX_CONFLICT);
    const ent = Q.ent(store.data, x.entrepreneurId);
    if (x.status !== 'submitted' && !(decision === 'validate' && !ent.portal && x.status !== 'validated')) return fail('Seul un exercice rendu peut être relu.');
    if (decision === 'return' && !String(comment || '').trim()) return fail({ reason: 'Expliquez ce qui doit être repris.' });
    const before = EX[x.status].label;
    x.status = decision === 'validate' ? 'validated' : 'returned'; x.reviewComment = String(comment || '').trim(); x.reviewedAt = EH.nowIso(); x.version++;
    store.log(decision === 'validate' ? 'Exercice validé' : 'Exercice à reprendre', `${ent.name} · ${x.title}`, `${before} → ${EX[x.status].label}${x.reviewComment ? ' · ' + x.reviewComment : ''}`, x.centre, { before, after: EX[x.status].label });
    return commit({ ok: true, item: x });
  };
  A.addFunding = (f) => {
    const centre = store.scope();
    if (!can.writeOperational(centre)) return fail('Seul le chargé du centre lie un financement à un projet.');
    const e = required(f, [['partner', 'Le bailleur'], ['entrepreneur', 'Le projet'], ['kind', 'Le type de financement'], ['date', 'La date']]);
    const p = f.partner && Q.partner(store.data, f.partner), x = f.entrepreneur && Q.ent(store.data, f.entrepreneur);
    if (f.partner && !p) e.partner = 'Bailleur inconnu.';
    if (f.entrepreneur && (!x || x.centre !== centre)) e.entrepreneur = 'Choisissez un projet de votre centre.';
    if (f.kind && !R.fundingKinds.includes(f.kind)) e.kind = 'Type de financement inconnu.';
    const amount = f.amount === '' || f.amount == null ? null : Number(f.amount);
    if (amount != null && (!Number.isFinite(amount) || amount <= 0)) e.amount = 'Le montant doit être un nombre positif (en DT).';
    if (Object.keys(e).length) return fail(e);
    if (store.data.fundings.some((y) => y.partner === p.id && y.entrepreneurId === x.id && y.kind === f.kind)) return fail({ entrepreneur: 'Ce financement est déjà lié à ce projet.' });
    const item = { id: EH.uid('fu'), partner: p.id, entrepreneurId: x.id, centre, kind: f.kind, amount, date: f.date, note: String(f.note || '').trim() };
    store.data.fundings.push(item);
    store.log('Financement lié', `${p.name} → ${x.name}`, `${f.kind}${amount ? ' · ' + amount + ' DT' : ''}`, centre);
    return commit({ ok: true, item });
  };

  /** CSV export without personal data (FR-04-06, NFR-03). */
  A.exportCsv = (period) => {
    if (!store.isPmo()) return '';
    const d = store.data;
    const head = ['Centre', 'Période', 'Statut du rapport', 'Données', 'Entrepreneurs actifs', 'Exécution des activités (%)', 'Couverture coaching (%)', "Taux d'abandon (%)", 'Séances', 'Partenaires actifs', 'Remise des rapports bénéficiaires (%)', 'Engagement des bénéficiaires (%)'];
    const rows = d.centres.map((c) => {
      const k = Q.kpis(d, c.id, period);
      const f = (v) => (v == null ? 'pas de donnée' : Math.round(v));
      return [c.name, period, R.reportStatus[Q.reportStatus(Q.report(d, c.id, period))].label, k.validated ? 'validé' : 'provisoire', f(k.active), f(k.execution), f(k.coverage), f(k.abandon), k.sessions, k.partners, f(k.reporting), f(k.engagement)];
    });
    store.log('Export consolidé', `Export ${EH.fmtMonth(period).toLowerCase()}`, 'CSV sans données personnelles', 'all');
    store.save();
    return [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  };
})();
