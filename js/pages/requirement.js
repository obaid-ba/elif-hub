/* Compact "Rapport demandé" section shared by the activity drawer (officer override) and the programme drawer (PMO template).
   Flat field names so EH.formData works: req_format, req_dueDays, req_mandatory, req_feedback, req_base, rf_{id,label,type,req,opts}_<i>. */
(function () {
  'use strict';
  const EH = window.EH;
  const C = EH.c, Q = EH.q, S = EH.store, esc = EH.esc, R = EH.REF;

  const blank = () => ({ id: '', label: '', type: 'text', required: false, options: '' });
  const idxs = (v) => { const out = []; for (let i = 0; ('rf_label_' + i) in v; i++) out.push(i); return out; };
  const fieldsFrom = (v) => idxs(v).map((i) => ({
    id: v['rf_id_' + i] || '', label: v['rf_label_' + i] || '', type: v['rf_type_' + i] || 'text',
    required: Array.isArray(v['rf_req_' + i]) ? v['rf_req_' + i].length > 0 : !!v['rf_req_' + i], options: v['rf_opts_' + i] || ''
  }));
  const nextId = (fields) => 'q' + (Math.max(0, ...fields.map((f) => +(/^q(\d+)$/.exec(f.id) || [0, 0])[1])) + 1);
  const isReal = (format) => R.reportFormats.some((f) => f.id === format);

  const EHreq = (EH.req = {});

  /** Seeds st.values / st.reqFields from the current requirement record (own override, or the programme template). */
  EHreq.init = (st, scope, target) => {
    const rec = Q.requirement(S.data, scope, target), real = rec && isReal(rec.format);
    st.values = Object.assign({}, st.values, {
      req_format: rec ? rec.format : scope === 'activity' ? 'inherit' : 'none',
      req_dueDays: real ? rec.dueDays : R.DEFAULT_DUE_DAYS,
      req_mandatory: real && !rec.mandatory ? 'no' : 'yes',
      req_feedback: real && !rec.feedbackVisible ? 'no' : 'yes',
      req_base: rec ? rec.version : 0
    });
    st.reqFields = rec && rec.format === 'form' ? rec.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required, options: (f.options || []).join(', ') })) : [];
  };
  /** Keeps the canonical question list in step with the submitted values (call before re-rendering after a store error). */
  EHreq.sync = (st, v) => { st.values = Object.assign({}, st.values, v); st.reqFields = fieldsFrom(v); };

  EHreq.parse = (v, scope = 'activity') => {
    const used = new Set(fieldsFrom(v).map((f) => f.id).filter(Boolean));
    const fields = fieldsFrom(v).map((f) => { if (!f.id) { f.id = nextId([...used].map((id) => ({ id }))); used.add(f.id); } return f; })
      .map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required, options: f.options }));
    return { format: v.req_format || (scope === 'activity' ? 'inherit' : 'none'), fields, dueDays: v.req_dueDays, mandatory: v.req_mandatory !== 'no', feedbackVisible: v.req_feedback !== 'no' };
  };
  EHreq.base = (v) => v.req_base;

  const yesNo = (name, label, value, error, help) => C.field({ name, label, type: 'select', value, error, help, options: [{ value: 'yes', label: 'Oui' }, { value: 'no', label: 'Non' }] });

  const fieldRow = (f, i, er) => `<div class="req-row" role="group" aria-label="Question ${i + 1}">
    <input type="hidden" name="rf_id_${i}" value="${esc(f.id)}">
    ${C.field({ name: 'rf_label_' + i, label: `Question ${i + 1}`, value: f.label, error: er['rf_' + i], required: true, full: true, placeholder: 'Ex. : Ce que j\'ai retenu' })}
    ${C.field({ name: 'rf_type_' + i, label: 'Type de réponse', type: 'select', value: f.type, options: R.fieldTypes.map((t) => ({ value: t.id, label: t.label })), live: 'reqType' })}
    ${f.type === 'choice' ? C.field({ name: 'rf_opts_' + i, label: 'Choix possibles', value: f.options, placeholder: 'Séparés par des virgules' }) : ''}
    <div class="req-row-tools"><label class="check"><input type="checkbox" name="rf_req_${i}" ${f.required ? 'checked' : ''}>Obligatoire</label>${C.btn('', { action: 'req-remove', data: { i }, icon: 'x', size: 'sm', variant: 'ghost', title: `Supprimer la question ${i + 1}` })}</div>
  </div>`;

  /** scope: 'activity' | 'programme'. opts.programme = programme id (to describe what an activity would inherit). */
  EHreq.section = (st, scope, opts = {}) => {
    const v = st.values || {}, er = st.errors || {}, d = S.data;
    const format = v.req_format || (scope === 'activity' ? 'inherit' : 'none');
    const real = isReal(format);
    const tpl = opts.programme && Q.requirement(d, 'programme', opts.programme);
    const inherited = tpl && tpl.format !== 'none' ? `${Q.formatLabel(tpl.format)}, ${tpl.dueDays} j après l'activité` : 'aucun rapport';
    const formatOpts = [...(scope === 'activity' ? [{ value: 'inherit', label: `Hériter du programme (${inherited})` }] : []), { value: 'none', label: 'Aucun rapport' }, ...R.reportFormats.map((f) => ({ value: f.id, label: f.label }))];
    let note = '';
    if (format === 'none') note = C.callout('info', scope === 'activity' ? 'Aucun rapport demandé pour cette activité.' : 'Aucun modèle : les activités de ce programme n\'ont pas de rapport par défaut, sauf si le chargé en définit un.');
    else if (format === 'inherit') note = `<p class="help">Rapport hérité du modèle du programme : ${esc(inherited)}.</p>`;
    else if (real) note = `<p class="help">${esc(R.reportFormats.find((f) => f.id === format).hint)}</p>`;
    const fields = st.reqFields || [];
    const questions = format === 'form' ? `<div class="req-questions">${fields.map((f, i) => fieldRow(f, i, er)).join('')}
      ${er.req_fields ? `<span class="error" role="alert">${esc(er.req_fields)}</span>` : ''}
      <div>${C.btn('Ajouter une question', { action: 'req-add', icon: 'plus', size: 'sm', disabled: fields.length >= R.MAX_FIELDS })} <span class="muted xs">${fields.length} sur ${R.MAX_FIELDS}</span></div></div>` : '';
    const settings = real ? `<div class="form-grid">
      ${C.field({ name: 'req_dueDays', label: "Échéance (jours après l'activité)", type: 'number', min: 0, max: 60, value: v.req_dueDays == null ? R.DEFAULT_DUE_DAYS : v.req_dueDays, error: er.req_dueDays })}
      ${yesNo('req_mandatory', 'Rapport obligatoire', v.req_mandatory || 'yes', null)}
      ${yesNo('req_feedback', 'Le bénéficiaire voit votre commentaire', v.req_feedback || 'yes', null)}</div>` : '';
    return `<fieldset class="req-box field full"><legend class="field-label">Rapport demandé aux bénéficiaires</legend>
      <input type="hidden" name="req_base" value="${esc(v.req_base == null ? 0 : v.req_base)}">
      ${C.field({ name: 'req_format', label: 'Format du rapport', type: 'select', value: format, options: formatOpts, error: er.req_format, live: 'reqFormat' })}
      ${note}${questions}${settings}</fieldset>`;
  };

  /* ---------- structural changes re-render the drawer (same pattern as EH.live.stageTo) ---------- */
  const current = (el) => { const st = EH.ui.drawer, form = el.closest('form'); if (!st || !form) return null; EHreq.sync(st, EH.formData(form)); return st; };
  const refocus = (id) => { EH.renderOverlays(); const t = id && document.getElementById(id); if (t) t.focus(); };
  EH.live.reqFormat = (el) => {
    const st = current(el); if (!st) return;
    if (st.values.req_format === 'form' && !st.reqFields.length) st.reqFields = [Object.assign(blank(), { id: 'q1' })];
    st.errors = {}; refocus('fld-req_format');
  };
  EH.live.reqType = (el) => { const st = current(el); if (st) refocus(el.id); };
  Object.assign(EH.actions, {
    'req-add': (el) => {
      const st = current(el); if (!st) return;
      if (st.reqFields.length >= R.MAX_FIELDS) return EH.toast(`Huit questions au maximum.`, { tone: 'error' });
      st.reqFields.push(Object.assign(blank(), { id: nextId(st.reqFields) })); st.errors = {};
      refocus('fld-rf_label_' + (st.reqFields.length - 1));
    },
    'req-remove': (el) => {
      const st = current(el); if (!st) return;
      st.reqFields.splice(+el.dataset.i, 1); st.errors = {};
      refocus(st.reqFields.length ? 'fld-rf_label_' + Math.min(+el.dataset.i, st.reqFields.length - 1) : 'fld-req_format');
    }
  });
})();
