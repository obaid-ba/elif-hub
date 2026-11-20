/* Derived data: KPIs, alerts, report figures, quality checks.
   Pure functions of the data object, so the dashboard, the report and the alerts
   always agree (PBI-20: "totaux identiques aux fiches et au tableau de bord"). */
(function () {
  'use strict';
  const EH = window.EH;
  const R = EH.REF;
  const Q = (EH.q = {});

  /* ---------- basic lookups ---------- */
  Q.centre = (d, id) => d.centres.find((c) => c.id === id);
  Q.centreName = (d, id) => (id === 'all' ? 'Tous les centres' : (Q.centre(d, id) || {}).name || '—');
  Q.user = (d, id) => d.users.find((u) => u.id === id) || { name: '—' };
  Q.partner = (d, id) => d.partners.find((p) => p.id === id);
  Q.programme = (d, id) => d.programmes.find((p) => p.id === id);
  Q.ent = (d, id) => d.entrepreneurs.find((e) => e.id === id);
  Q.activity = (d, id) => d.activities.find((a) => a.id === id);

  /* ---------- entrepreneurs ---------- */
  Q.inScope = (list, centre) => (centre ? list.filter((x) => x.centre === centre) : list);
  Q.sessionsOf = (d, entId) => d.sessions.filter((s) => s.entrepreneur === entId).sort(EH.by('date', -1));
  Q.lastSession = (d, entId) => {
    let best = null;
    for (const s of d.sessions) if (s.entrepreneur === entId && (!best || s.date > best.date)) best = s;
    return best;
  };
  Q.isActive = (e) => R.activeStages.includes(e.stage);
  /** EC-06: active entrepreneur without a session for 30 days. */
  Q.atRisk = (d, e) => {
    if (!Q.isActive(e)) return false;
    const last = Q.lastSession(d, e.id);
    const since = last ? last.date : (e.history.find((h) => h.stage === 'preinc') || {}).date;
    return !since || EH.ago(since) > R.RISK_DAYS;
  };
  Q.daysWithoutSession = (d, e) => {
    const last = Q.lastSession(d, e.id);
    const since = last ? last.date : (e.history.find((h) => h.stage === 'preinc') || {}).date;
    return since ? EH.ago(since) : null;
  };
  Q.stageDate = (e, stage) => (e.history.filter((h) => h.stage === stage).slice(-1)[0] || {}).date;

  /* ---------- activities ---------- */
  /** Display status: planned + past date + grace → overdue (EC-02); no facilitator → draft (EC-01). */
  Q.activityStatus = (a) => {
    if (a.status === 'planned' && EH.ago(a.date) > R.OVERDUE_GRACE) return 'overdue';
    if (a.status === 'planned' && !a.facilitator) return 'draft';
    if (a.status === 'planned' && a.facilitatorStatus === 'confirmed') return 'confirmed';
    return a.status;
  };
  /** PBI-06: same room, same speaker or same staff member on an overlapping slot. Only future planned activities count. */
  Q.conflicts = (d, a) => {
    if (a.status !== 'planned' || !a.date || !a.time || a.date < EH.TODAY) return [];
    const s0 = EH.toMin(a.time), e0 = s0 + (a.durationMin || 0), out = [];
    d.activities.forEach((b) => {
      if (b.id === a.id || b.status !== 'planned' || b.date !== a.date || !b.time) return;
      const s1 = EH.toMin(b.time), e1 = s1 + (b.durationMin || 0);
      if (!(s0 < e1 && s1 < e0)) return;
      const slot = `« ${b.title} » (${Q.centreName(d, b.centre)}, ${b.time})`;
      if (a.room && a.room === b.room) out.push({ kind: 'room', other: b.id, text: `Salle déjà réservée : ${slot}` });
      if (a.facilitator && a.facilitator === b.facilitator) out.push({ kind: 'speaker', other: b.id, text: `Intervenant déjà pris : ${slot}` });
      if ((a.staff || []).some((u) => (b.staff || []).includes(u))) out.push({ kind: 'staff', other: b.id, text: `Membre du staff déjà pris : ${slot}` });
    });
    return out;
  };
  Q.needsClosing = (a) => a.status === 'planned' && a.date <= EH.TODAY;
  /** PBI-13: attendance rate of a done activity (null = no data). */
  Q.attendanceRate = (a) => (a.status === 'done' && a.expected > 0 ? (100 * a.attendees.length) / a.expected : null);
  /** Weighted attendance of the done activities of some centres over a period (null = no data). */
  Q.attendance = (d, ids, period) => {
    const acts = d.activities.filter((a) => ids.includes(a.centre) && a.status === 'done' && a.expected > 0 && (!period || Q.inPeriod(a.date, period)));
    const present = acts.reduce((n, a) => n + a.attendees.length, 0), expected = acts.reduce((n, a) => n + a.expected, 0);
    return { rate: expected ? (100 * present) / expected : null, present, expected, activities: acts.length };
  };
  /** PBI-10: speaker still "proposed" when the activity is within SPEAKER_CONFIRM_DAYS. */
  Q.speakerUnconfirmed = (a) => a.status === 'planned' && !!a.facilitator && a.facilitatorStatus === 'proposed' && a.date >= EH.TODAY && EH.days(EH.TODAY, a.date) <= R.SPEAKER_CONFIRM_DAYS;
  /** PBI-08: people a reminder goes to (cohort or 1-1 participant, plus the speaker). */
  Q.reminderRecipients = (d, a) => {
    const ents = a.type === 'Session 1-1' && a.participant ? [Q.ent(d, a.participant)].filter(Boolean) : d.entrepreneurs.filter((e) => e.centre === a.centre && e.cohort === a.cohort && R.activeStages.includes(e.stage));
    const sp = a.facilitator && Q.partner(d, a.facilitator);
    return { participants: ents, speaker: sp || null, count: ents.length + (sp ? 1 : 0) };
  };
  Q.needsReminder = (a) => a.status === 'planned' && a.date === EH.addDays(EH.TODAY, 1) && !(a.reminders || []).length;

  /* ---------- activity reports (PBI-19/20) ---------- */
  Q.activityReport = (d, actId) => (d.activityReports || []).find((r) => r.activityId === actId) || null;
  Q.activityReportExpected = (a) => a.status === 'done' && a.date >= R.ACTIVITY_REPORT_START;
  Q.activityReportDue = (a) => EH.addDays(a.date, R.ACTIVITY_REPORT_DAYS);
  /** Effective status: todo when expected and not written yet. */
  Q.activityReportStatus = (d, a) => { const r = Q.activityReport(d, a.id); return r ? r.status : Q.activityReportExpected(a) ? 'todo' : null; };
  Q.activityReportLate = (d, a) => { const s = Q.activityReportStatus(d, a); return (s === 'todo' || s === 'draft' || s === 'returned') && Q.activityReportDue(a) < EH.TODAY; };
  /** Pre-filled figures: the same fields as the activity record, so the numbers always match. */
  Q.activityReportFigures = (d, a) => {
    const sp = a.facilitator && Q.partner(d, a.facilitator);
    const obs = Q.activityObligations(d, a);
    return { expected: a.expected, present: a.attendees.length, rate: Q.attendanceRate(a), speaker: sp ? sp.name : null, speakerStatus: a.facilitatorStatus || null, budget: a.budget != null ? a.budget : null,
      breportsValidated: obs.filter((o) => o.status === 'validated').length, breportsExpected: obs.length, date: a.date, title: a.title, type: a.type };
  };
  Q.inPeriod = (date, period) => date && date.slice(0, 7) === period;

  /* ---------- beneficiary reporting (Défi 1) ---------- */
  const reqTarget = (r) => (r.scope === 'programme' ? r.programmeId : r.activityId);
  Q.requirementVersions = (d, scope, target) => d.reportingRequirements.filter((r) => r.scope === scope && reqTarget(r) === target).sort(EH.by('version'));
  Q.requirement = (d, scope, target) => Q.requirementVersions(d, scope, target).slice(-1)[0] || null;
  Q.requirementById = (d, id) => d.reportingRequirements.find((r) => r.id === id) || null;
  const ownReq = (d, a) => { const o = Q.requirement(d, 'activity', a.id); return o && o.format !== 'inherit' ? o : null; };
  /** Effective requirement of an activity: its own override, else the programme template. null = no reporting. */
  Q.requirementOf = (d, a) => {
    const r = ownReq(d, a) || Q.requirement(d, 'programme', a.programme);
    return r && r.format !== 'none' ? r : null;
  };
  /** 'override' | 'inherited' | 'none' (explicitly or because the programme has no template). */
  Q.requirementOrigin = (d, a) => {
    const own = ownReq(d, a);
    if (own) return own.format === 'none' ? 'none' : 'override';
    const t = Q.requirement(d, 'programme', a.programme);
    return t && t.format !== 'none' ? 'inherited' : 'none';
  };
  Q.formatLabel = (id) => (id === 'inherit' ? 'Hérité du programme' : (R.reportFormats.find((f) => f.id === id) || { label: 'Aucun rapport' }).label);
  Q.reportDue = (a, req) => EH.addDays(a.date, req.dueDays);
  Q.breport = (d, actId, entId) => d.beneficiaryReports.find((r) => r.activityId === actId && r.entrepreneurId === entId) || null;
  Q.cohortActivities = (d, e) => (e && e.cohort ? d.activities.filter((a) => a.centre === e.centre && a.cohort === e.cohort) : []);

  /** One reporting duty: the beneficiary attended a done activity that asks for a report. */
  Q.obligation = (d, a, e, rep, req) => {
    const status = rep ? rep.status : 'todo';
    const due = Q.reportDue(a, req);
    const late = req.mandatory && due < EH.TODAY && (status === 'todo' || status === 'draft');
    return { activity: a, entrepreneur: e, report: rep, requirement: req, status, due, late, daysLate: late ? EH.ago(due) : 0, optional: !req.mandatory };
  };
  const obligationOf = (d, a, e) => {
    if (a.status !== 'done' || !a.attendees.includes(e.id)) return null;
    const rep = Q.breport(d, a.id, e.id);
    const req = rep ? Q.requirementById(d, rep.requirementId) : Q.requirementOf(d, a);
    return req && req.format !== 'none' ? Q.obligation(d, a, e, rep, req) : null;
  };
  Q.obligations = (d, e) => (e && e.portal ? d.activities.map((a) => obligationOf(d, a, e)).filter(Boolean).sort(EH.by('due')) : []);
  /** Review queue of an activity: one entry per attendee whose espace is activated. */
  Q.activityObligations = (d, a) => a.attendees.map((id) => Q.ent(d, id)).filter((e) => e && e.portal).map((e) => obligationOf(d, a, e)).filter(Boolean);

  /**
   * Single source for the reporting rate and the engagement rate (profile, monthly report, dashboard).
   * period = 'YYYY-MM' (activity date) or null for all time. null rates mean "Pas de donnée".
   */
  Q.beneficiaryStats = (d, entIds, period) => {
    let due = 0, onTime = 0, late = 0, done = 0, attended = 0, people = 0;
    d.entrepreneurs.filter((e) => e.portal && entIds.includes(e.id)).forEach((e) => {
      people++;
      Q.cohortActivities(d, e).filter((a) => a.status === 'done' && (!period || Q.inPeriod(a.date, period))).forEach((a) => { done++; if (a.attendees.includes(e.id)) attended++; });
      Q.obligations(d, e).filter((o) => !o.optional && (!period || Q.inPeriod(o.activity.date, period))).forEach((o) => {
        const sent = o.report && o.report.firstSubmittedAt;
        if (!sent && o.due >= EH.TODAY) return;
        due++;
        if (sent && sent.slice(0, 10) <= o.due) onTime++;
        if (o.late) late++;
      });
    });
    const num = attended + onTime, den = done + due;
    return { people, due, onTime, late, done, attended, reporting: due ? (100 * onTime) / due : null, engagement: den ? (100 * num) / den : null, engagementDetail: { num, den }, reportingDetail: { onTime, due } };
  };

  /* ---------- partners ---------- */
  Q.partnerActivity = (d, pid) => ({
    activities: d.activities.filter((a) => a.facilitator === pid),
    sessions: d.sessions.filter((s) => s.coach === pid),
    collaborations: d.collaborations.filter((c) => c.partner === pid)
  });
  Q.partnerLastInteraction = (d, pid) => {
    const x = Q.partnerActivity(d, pid);
    const dates = [...x.activities.filter((a) => a.status === 'done').map((a) => a.date), ...x.sessions.map((s) => s.date), ...x.collaborations.filter((c) => c.status === 'active').map(() => EH.TODAY)];
    return dates.sort().pop() || null;
  };
  Q.partnerActive = (d, pid) => { const l = Q.partnerLastInteraction(d, pid); return !!l && EH.ago(l) <= R.INACTIVE_MONTHS * 30; };
  Q.partnerCentres = (d, pid) => {
    const x = Q.partnerActivity(d, pid);
    const set = new Set([...x.activities.map((a) => a.centre), ...x.sessions.map((s) => s.centre), ...x.collaborations.map((c) => c.centre)]);
    if (set.has('all')) return d.centres.map((c) => c.id);
    return [...set];
  };
  /** FR-05-02 / EC-13: fuzzy name match. */
  Q.similarPartners = (d, name) => {
    const n = EH.norm(name);
    if (n.length < 3) return [];
    return d.partners.filter((p) => {
      const m = EH.norm(p.name);
      return m === n || m.includes(n) || n.includes(m) || EH.lev(m, n) <= Math.max(2, Math.floor(n.length / 6));
    });
  };

  /* ---------- duplicates (BR-02-05) ---------- */
  Q.duplicateEntrepreneur = (d, x) => {
    const phone = (x.phone || '').replace(/\D/g, '');
    const email = (x.email || '').trim().toLowerCase();
    const name = EH.norm(x.firstName + ' ' + x.lastName);
    return d.entrepreneurs.filter((e) =>
      (phone && e.phone.replace(/\D/g, '') === phone) ||
      (email && e.email.toLowerCase() === email) ||
      (x.birth && e.birth === x.birth && EH.norm(e.name) === name));
  };

  /* ---------- knowledge ---------- */
  Q.knowledgeStatus = (k) => (k.status === 'published' && k.review < EH.TODAY ? 'review' : k.status);

  /* ---------- reports ---------- */
  Q.report = (d, centre, period) => d.reports.find((r) => r.centre === centre && r.period === period);
  /** Effective status: a draft or returned report past its due date shows as late (EC-09). */
  Q.reportStatus = (r) => {
    if (!r) return 'draft';
    if ((r.status === 'draft' || r.status === 'returned') && EH.TODAY > EH.periodDue(r.period)) return r.status === 'returned' ? 'returned' : 'late';
    return r.status;
  };
  Q.isLocked = (d, centre, date) => {
    const r = Q.report(d, centre, date.slice(0, 7));
    return !!r && r.status === 'approved';
  };

  /** FR-04-02: monthly report generated from recorded data. */
  Q.reportFigures = (d, centre, period) => {
    const acts = d.activities.filter((a) => a.centre === centre && Q.inPeriod(a.date, period));
    const done = acts.filter((a) => a.status === 'done');
    const ses = d.sessions.filter((s) => s.centre === centre && Q.inPeriod(s.date, period));
    const ents = d.entrepreneurs.filter((e) => e.centre === centre);
    const moves = [];
    ents.forEach((e) => e.history.forEach((h) => { if (Q.inPeriod(h.date, period)) moves.push({ e, h }); }));
    const byStage = {};
    R.stages.forEach((s) => (byStage[s.id] = ents.filter((e) => e.stage === s.id).length));
    byStage.abandon = ents.filter((e) => e.stage === 'abandon').length;
    const partnerIds = new Set([...done.map((a) => a.facilitator).filter(Boolean), ...ses.map((s) => s.coach)]);
    const bs = Q.beneficiaryStats(d, ents.map((e) => e.id), period);
    return {
      reportsDue: bs.due, reportsOnTime: bs.onTime, reportsLate: bs.late, reporting: bs.reporting, engagement: bs.engagement, engagementDetail: bs.engagementDetail, beneficiaries: bs.people,
      activitiesPlanned: acts.length,
      activitiesDone: done.length,
      activitiesCancelled: acts.filter((a) => a.status === 'cancelled').length,
      activitiesOpen: acts.filter((a) => a.status === 'planned').length,
      participants: done.reduce((n, a) => n + a.attendees.length, 0),
      attendance: Q.attendance(d, [centre], period).rate,
      activityReportsExpected: done.filter(Q.activityReportExpected).length,
      activityReportsValidated: done.filter((a) => Q.activityReportStatus(d, a) === 'validated').length,
      sessions: ses.length,
      coached: new Set(ses.map((s) => s.entrepreneur)).size,
      newApplicants: moves.filter((m) => m.h.stage === 'candidat').length,
      stageMoves: moves.filter((m) => m.h.stage !== 'candidat').length,
      abandons: moves.filter((m) => m.h.stage === 'abandon').length,
      partners: partnerIds.size,
      byStage
    };
  };

  /** FR-04-05 / PBI-23: data-quality checks, each with a link to fix. */
  Q.qualityChecks = (d, centre, period) => {
    const out = [];
    d.activities.filter((a) => a.centre === centre && Q.inPeriod(a.date, period)).forEach((a) => {
      if (a.status === 'planned' && a.date < EH.TODAY) out.push({ kind: 'activity', id: a.id, text: `« ${a.title} » du ${EH.fmtDate(a.date)} n'est pas clôturée` });
      if (!a.facilitator && a.status !== 'cancelled') out.push({ kind: 'activity', id: a.id, text: `« ${a.title} » n'a pas d'intervenant` });
      if (a.status === 'done' && a.attendees.length === 0) out.push({ kind: 'activity', id: a.id, text: `« ${a.title} » est réalisée sans présences saisies` });
    });
    const ents = d.entrepreneurs.filter((e) => e.centre === centre);
    const seen = {};
    ents.forEach((e) => {
      const key = e.phone.replace(/\D/g, '');
      if (seen[key]) out.push({ kind: 'ent', id: e.id, text: `Doublon possible : ${e.name} et ${seen[key].name} (même téléphone)` });
      seen[key] = e;
    });
    return out;
  };

  /* ---------- KPIs (BR-08-01 to 03) ---------- */
  /**
   * centre: id or null (all). period: 'YYYY-MM'. Returns values (null = no data) and validation state.
   * Validated: approved report snapshot for every centre in scope; otherwise live and provisional.
   */
  Q.kpis = (d, centre, period) => {
    const ids = centre ? [centre] : d.centres.map((c) => c.id);
    const approved = ids.filter((id) => { const r = Q.report(d, id, period); return r && r.status === 'approved' && r.snapshot; });
    const live = Q.liveKpis(d, ids, period);
    if (approved.length === ids.length && ids.length) {
      const snaps = approved.map((id) => Q.report(d, id, period).snapshot);
      return Object.assign(Q.mergeSnapshots(snaps), { validated: true, approvedCount: approved.length, total: ids.length, live });
    }
    return Object.assign(live, { validated: false, approvedCount: approved.length, total: ids.length });
  };
  Q.liveKpis = (d, ids, period) => {
    const ents = d.entrepreneurs.filter((e) => ids.includes(e.centre));
    const active = ents.filter(Q.isActive);
    const byStage = {};
    R.stages.forEach((s) => (byStage[s.id] = ents.filter((e) => e.stage === s.id).length));
    byStage.abandon = ents.filter((e) => e.stage === 'abandon').length;
    const ref = period === EH.TODAY.slice(0, 7) ? EH.TODAY : EH.periodEnd(period);
    const acts = d.activities.filter((a) => ids.includes(a.centre) && Q.inPeriod(a.date, period) && a.date <= EH.TODAY);
    const done = acts.filter((a) => a.status === 'done').length;
    const cancelled = acts.filter((a) => a.status === 'cancelled').length;
    const open = acts.filter((a) => a.status === 'planned').length;
    const covered = active.filter((e) => d.sessions.some((s) => s.entrepreneur === e.id && s.date <= ref && EH.days(s.date, ref) <= R.RISK_DAYS)).length;
    const entered = ents.filter((e) => e.history.some((h) => h.stage === 'incub')).length;
    const partnersActive = d.partners.filter((p) => Q.partnerActive(d, p.id) && Q.partnerCentres(d, p.id).some((c) => ids.includes(c))).length;
    const bs = Q.beneficiaryStats(d, ents.map((e) => e.id), period);
    const att = Q.attendance(d, ids, period);
    return {
      attendance: att.rate, attendanceDetail: { present: att.present, expected: att.expected },
      reporting: bs.reporting, reportingDetail: bs.reportingDetail, engagement: bs.engagement, engagementDetail: bs.engagementDetail,
      active: ents.length ? active.length : null,
      byStage,
      execution: done + cancelled + open ? (100 * done) / (done + cancelled + open) : null,
      executionDetail: { done, cancelled, open },
      coverage: active.length ? (100 * covered) / active.length : null,
      coverageDetail: { covered, active: active.length },
      abandon: entered ? (100 * byStage.abandon) / entered : null,
      entered,
      sessions: d.sessions.filter((s) => ids.includes(s.centre) && Q.inPeriod(s.date, period)).length,
      partners: partnersActive
    };
  };
  Q.snapshot = (d, centre, period) => { const k = Q.liveKpis(d, [centre], period); delete k.validated; return JSON.parse(JSON.stringify(k)); };
  Q.mergeSnapshots = (snaps) => {
    const sum = (f) => snaps.reduce((n, s) => n + (f(s) || 0), 0);
    const byStage = {};
    Object.keys(snaps[0].byStage).forEach((k) => (byStage[k] = sum((s) => s.byStage[k])));
    const ex = { done: sum((s) => s.executionDetail.done), cancelled: sum((s) => s.executionDetail.cancelled), open: sum((s) => s.executionDetail.open) };
    const cov = { covered: sum((s) => s.coverageDetail.covered), active: sum((s) => s.coverageDetail.active) };
    const entered = sum((s) => s.entered);
    const tot = ex.done + ex.cancelled + ex.open;
    const rep = { onTime: sum((s) => (s.reportingDetail || {}).onTime), due: sum((s) => (s.reportingDetail || {}).due) };
    const eng = { num: sum((s) => (s.engagementDetail || {}).num), den: sum((s) => (s.engagementDetail || {}).den) };
    const att = { present: sum((s) => (s.attendanceDetail || {}).present), expected: sum((s) => (s.attendanceDetail || {}).expected) };
    return {
      attendance: att.expected ? (100 * att.present) / att.expected : null, attendanceDetail: att,
      reporting: rep.due ? (100 * rep.onTime) / rep.due : null, reportingDetail: rep, engagement: eng.den ? (100 * eng.num) / eng.den : null, engagementDetail: eng,
      active: sum((s) => s.active), byStage,
      execution: tot ? (100 * ex.done) / tot : null, executionDetail: ex,
      coverage: cov.active ? (100 * cov.covered) / cov.active : null, coverageDetail: cov,
      abandon: entered ? (100 * byStage.abandon) / entered : null, entered,
      sessions: sum((s) => s.sessions), partners: sum((s) => s.partners)
    };
  };

  /* ---------- alerts (FR-08-03, PBI-40) ---------- */
  Q.alerts = (d, centre) => {
    const ids = centre ? [centre] : d.centres.map((c) => c.id);
    const out = [];
    d.activities.filter((a) => ids.includes(a.centre) && Q.activityStatus(a) === 'overdue').forEach((a) =>
      out.push({ type: 'activity', centre: a.centre, ref: a.id, title: a.title, detail: `Prévue le ${EH.fmtDate(a.date)}, non clôturée`, days: EH.ago(a.date), sev: 'bad' }));
    const seenPair = new Set();
    d.activities.filter((a) => ids.includes(a.centre)).forEach((a) => {
      const list = Q.conflicts(d, a).filter((c) => !seenPair.has([c.other, a.id].join()));
      if (!list.length) return;
      list.forEach((c) => seenPair.add([a.id, c.other].join()));
      out.push({ type: 'conflict', centre: a.centre, ref: a.id, title: a.title, detail: `${EH.fmtDate(a.date)} à ${a.time} · ${list.map((c) => c.text).join(' · ')}`, days: null, sev: 'warn' });
    });
    d.activities.filter((a) => ids.includes(a.centre) && Q.speakerUnconfirmed(a)).forEach((a) =>
      out.push({ type: 'speaker', centre: a.centre, ref: a.id, title: a.title, detail: `${EH.fmtDay(a.date)} · ${(Q.partner(d, a.facilitator) || {}).name || 'Intervenant'} n'a pas confirmé (J-${EH.days(EH.TODAY, a.date)})`, days: null, sev: EH.days(EH.TODAY, a.date) <= 1 ? 'bad' : 'warn' }));
    d.activities.filter((a) => ids.includes(a.centre) && Q.activityReportLate(d, a)).forEach((a) =>
      out.push({ type: 'areport', centre: a.centre, ref: a.id, title: a.title, detail: `Rapport d'activité ${R.activityReportStatus[Q.activityReportStatus(d, a)].label.toLowerCase()}, attendu le ${EH.fmtDate(Q.activityReportDue(a))}`, days: EH.ago(Q.activityReportDue(a)), sev: 'bad' }));
    d.entrepreneurs.filter((e) => ids.includes(e.centre) && Q.atRisk(d, e)).forEach((e) =>
      out.push({ type: 'risk', centre: e.centre, ref: e.id, title: e.name, detail: `${EH.stageLabel(e.stage)} · sans séance depuis ${Q.daysWithoutSession(d, e)} jours`, days: Q.daysWithoutSession(d, e) - R.RISK_DAYS, sev: 'warn' }));
    d.entrepreneurs.filter((e) => e.portal && ids.includes(e.centre)).forEach((e) => Q.obligations(d, e).filter((o) => o.late).forEach((o) =>
      out.push({ type: 'breport', centre: e.centre, ref: o.activity.id, title: `${e.name} · ${o.activity.title}`, detail: `${R.beneficiaryReportStatus[o.status].label}, à rendre le ${EH.fmtDate(o.due)}`, days: o.daysLate, sev: 'bad' })));
    const period = Q.lastClosedPeriod();
    ids.forEach((c) => {
      const r = Q.report(d, c, period);
      const st = Q.reportStatus(r);
      if (st === 'late' || st === 'returned') out.push({ type: 'report', centre: c, ref: r ? r.id : null, title: `Rapport ${EH.fmtMonth(period).toLowerCase()}`, detail: st === 'late' ? `Non soumis, attendu le ${EH.fmtDate(EH.periodDue(period))}` : 'Renvoyé, en attente de correction', days: EH.ago(EH.periodDue(period)), sev: 'bad' });
    });
    d.entrepreneurs.filter((e) => ids.includes(e.centre) && e.stage === 'abandon').forEach((e) => {
      const h = e.history.find((x) => x.stage === 'abandon');
      if (h && EH.monthOf(h.date) === EH.monthOf(EH.TODAY)) out.push({ type: 'abandon', centre: e.centre, ref: e.id, title: e.name, detail: `Abandon le ${EH.fmtDate(h.date)} · ${e.abandonReason || 'motif non précisé'}`, days: null, sev: 'info' });
    });
    const rank = { bad: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev] || (b.days || 0) - (a.days || 0));
  };
  Q.ALERT_TYPES = {
    activity: { label: 'Activité non clôturée', icon: 'calendar' },
    risk: { label: 'Sans séance depuis 30 j', icon: 'user' },
    breport: { label: 'Rapport bénéficiaire en retard', icon: 'report' },
    conflict: { label: 'Conflit de planning', icon: 'clock' },
    speaker: { label: 'Intervenant non confirmé (J-3)', icon: 'handshake' },
    areport: { label: "Rapport d'activité en retard", icon: 'file' },
    report: { label: 'Rapport en retard', icon: 'report' },
    abandon: { label: 'Abandon ce mois-ci', icon: 'trendDown' }
  };
  Q.lastClosedPeriod = () => { const t = EH.TODAY; const y = +t.slice(0, 4), m = +t.slice(5, 7) - 1; return m ? `${y}-${String(m).padStart(2, '0')}` : `${y - 1}-12`; };
  Q.currentPeriod = () => EH.TODAY.slice(0, 7);

  /** Centre health for the comparison table. */
  Q.centreHealth = (d, centre, period) => {
    const k = Q.kpis(d, centre, period);
    const alerts = Q.alerts(d, centre);
    const bad = alerts.filter((a) => a.sev === 'bad').length;
    if (bad >= 2 || (k.coverage != null && k.coverage < 60)) return 'bad';
    if (bad || alerts.length > 2 || (k.coverage != null && k.coverage < 80)) return 'warn';
    return 'ok';
  };

  /* ---------- incubation follow-up ---------- */
  /** Phase progress of an active entrepreneur: days in the current phase against the expected length. */
  Q.phaseProgress = (e) => {
    const since = Q.stageDate(e, e.stage) || EH.TODAY, target = R.phaseTargets[e.stage] || null;
    const days = Math.max(0, EH.ago(since));
    return { since, days, target, pct: target ? (100 * days) / target : null, over: !!target && days > target };
  };
  Q.exercisesOf = (d, entId) => (d.exercises || []).filter((x) => x.entrepreneurId === entId);
  Q.exerciseLate = (x) => (x.status === 'todo' || x.status === 'returned') && x.due < EH.TODAY;
  /** Funders relevant to a centre: programme funders, "Financement" collaborations and funders already linked to a project. */
  Q.centreFunders = (d, centre) => {
    const ids = new Set();
    d.programmes.filter((p) => p.funder && p.centres.some((pc) => pc.centre === centre)).forEach((p) => ids.add(p.funder));
    d.collaborations.filter((c) => c.contribution === 'Financement' && (c.centre === centre || c.centre === 'all')).forEach((c) => ids.add(c.partner));
    (d.fundings || []).filter((f) => f.centre === centre).forEach((f) => ids.add(f.partner));
    d.partners.filter((p) => p.type === 'Financeur').forEach((p) => ids.add(p.id));
    return [...ids].map((id) => Q.partner(d, id)).filter(Boolean).map((p) => ({
      partner: p,
      programmes: d.programmes.filter((x) => x.funder === p.id && x.centres.some((pc) => pc.centre === centre)),
      collaborations: d.collaborations.filter((c) => c.partner === p.id && c.contribution === 'Financement' && (c.centre === centre || c.centre === 'all')),
      projects: (d.fundings || []).filter((f) => f.partner === p.id && f.centre === centre).map((f) => ({ funding: f, ent: Q.ent(d, f.entrepreneurId) })).filter((x) => x.ent)
    })).sort((a, b) => b.projects.length - a.projects.length || a.partner.name.localeCompare(b.partner.name));
  };
})();
