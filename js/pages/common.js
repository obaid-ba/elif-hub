/* Helpers shared by several pages. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc;

  EH.centreOptions = (allLabel = 'Tous les centres') => [{ value: '', label: allLabel }, ...S.data.centres.map((c) => ({ value: c.id, label: c.name }))];
  EH.programmeOptions = (centre, empty) => {
    const list = S.data.programmes.filter((p) => !centre || p.centres.some((pc) => pc.centre === centre));
    return [...(empty ? [{ value: '', label: empty }] : []), ...list.map((p) => ({ value: p.id, label: p.name }))];
  };
  EH.coachOptions = (empty = 'Choisir…') => [{ value: '', label: empty }, ...S.data.partners.filter((p) => p.type === 'Expert').map((p) => ({ value: p.id, label: `${p.name} · ${p.contact}` })), ...S.data.partners.filter((p) => p.type !== 'Expert').map((p) => ({ value: p.id, label: p.name }))];
  EH.partnerName = (id) => { const p = id && Q.partner(S.data, id); return p ? p.name : null; };
  EH.entLink = (e) => `<button type="button" class="link-btn" ${C.on('open-ent', { id: e.id })}>${esc(e.name)}</button>`;
  EH.activityLink = (a) => `<button type="button" class="link-btn" ${C.on('open-activity', { id: a.id })}>${esc(a.title)}</button>`;
  EH.f = (key, def = '') => (EH.ui.f[key] != null ? EH.ui.f[key] : def);

  EH.copy = (text, done) => {
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); done(ok);
    };
    try { navigator.clipboard.writeText(text).then(() => done(true), fallback); } catch (e) { fallback(); }
  };

  /** Shared "Accès refusé" body (EC-12). */
  EH.denied = (what) => C.empty({ icon: 'shield', tone: 'bad', title: 'Accès refusé', text: `${esc(what)} appartient à un autre centre. La tentative a été enregistrée dans le journal.` });

  /** KPI strip used by the PMO dashboard and the centre drawer. */
  EH.kpiStrip = (k, { compact } = {}) => {
    const R = EH.REF.kpis;
    const prov = k.validated ? 'Validé' : 'Provisoire';
    const n = (v) => (v == null ? null : Math.round(v) + EH.NBSP + '%');
    const cells = [
      C.kpi({ label: R.active.label, value: k.active, sub: `${k.byStage.preinc} pré-inc. · ${k.byStage.incub} incub. · ${k.byStage.suivi} suivi`, info: R.active.formula }),
      C.kpi({ label: 'Exécution', value: n(k.execution), sub: k.execution == null ? 'Aucune activité sur la période' : `${k.executionDetail.done} réalisées sur ${k.executionDetail.done + k.executionDetail.open + k.executionDetail.cancelled} · ${prov}`, info: R.execution.formula }),
      C.kpi({ label: 'Couverture coaching', value: n(k.coverage), sub: k.coverage == null ? '' : `${k.coverageDetail.covered} sur ${k.coverageDetail.active} actifs · ${prov}`, info: R.coverage.formula }),
      C.kpi({ label: 'Abandon', value: n(k.abandon), sub: k.abandon == null ? 'Personne entré en incubation' : `${k.byStage.abandon} abandon${k.byStage.abandon > 1 ? 's' : ''} · ${prov}`, info: R.abandon.formula }),
      C.kpi({ label: 'Séances', value: k.sessions, sub: prov, info: R.sessions.formula }),
      C.kpi({ label: R.partners.label, value: k.partners, sub: 'Sur 6 mois glissants', info: R.partners.formula }),
      C.kpi({ label: R.reporting.label, value: n(k.reporting), sub: k.reporting == null ? 'Aucun rapport dû sur la période' : `${k.reportingDetail.onTime} remis à temps sur ${k.reportingDetail.due} · ${prov}`, info: R.reporting.formula }),
      C.kpi({ label: R.engagement.label, value: n(k.engagement), sub: k.engagement == null ? 'Aucune donnée sur la période' : `${k.engagementDetail.num} sur ${k.engagementDetail.den} · ${prov}`, info: R.engagement.formula })
    ];
    return `<div class="panel kpis ${compact ? 'compact' : ''}">${cells.join('')}</div>`;
  };
})();
