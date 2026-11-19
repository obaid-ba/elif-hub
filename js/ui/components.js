/* Reusable presentational components. Each returns an HTML string; no data access here. */
(function () {
  'use strict';
  const EH = window.EH;
  const esc = EH.esc, I = EH.icon;
  const C = (EH.c = {});
  const attrs = (o = {}) => Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ');

  /** data-action + data-* attributes for delegated events. */
  C.on = (action, data = {}) => attrs(Object.assign({ 'data-action': action }, Object.fromEntries(Object.entries(data).map(([k, v]) => ['data-' + k, v]))));

  C.btn = (label, { action, data, variant = '', icon, size, type = 'button', title, disabled, extra = '' } = {}) =>
    `<button type="${type}" class="btn ${variant} ${size || ''} ${!label ? 'icon' : ''}" ${action ? C.on(action, data) : ''} ${title ? `title="${esc(title)}" aria-label="${esc(title)}"` : ''} ${disabled ? 'disabled' : ''} ${extra}>${icon ? I(icon) : ''}${label ? `<span>${esc(label)}</span>` : ''}</button>`;

  C.badge = (text, tone = '', icon) => `<span class="badge ${tone}">${icon ? I(icon) : ''}${esc(text)}</span>`;
  C.statusBadge = (map, key) => { const s = map[key] || { label: key, tone: '' }; return C.badge(s.label, s.tone, s.icon); };
  C.avatar = (name) => `<span class="avatar" aria-hidden="true">${esc(EH.initials(name))}</span>`;
  C.ico = (icon, tone = '') => `<span class="ico ${tone}">${I(icon)}</span>`;

  C.info = (text) => `<button type="button" class="tipbtn" aria-label="${esc(text)}">${I('info')}<span class="tip" aria-hidden="true">${esc(text)}</span></button>`;

  C.pageHead = (title, sub, actions = '') =>
    `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;

  C.panel = ({ title, count, actions = '', body, foot, flush = true, id }) =>
    `<section class="panel" ${id ? `id="${id}"` : ''}>${title ? `<div class="panel-head"><h2>${esc(title)}${count != null ? ` <span class="count num">${count}</span>` : ''}</h2>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>` : ''}${flush ? body : `<div class="panel-body">${body}</div>`}${foot ? `<div class="panel-foot">${foot}</div>` : ''}</section>`;

  C.empty = ({ icon = 'checkCircle', tone = 'ok', title, text = '', action = '' }) =>
    `<div class="empty">${C.ico(icon, tone)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;

  C.kpi = ({ label, value, sub = '', info }) =>
    `<div class="kpi"><div class="kpi-label">${esc(label)}${info ? C.info(info) : ''}</div>${value == null ? '<div class="kpi-value nodata">Pas de donnée</div>' : `<div class="kpi-value num">${value}</div>`}<div class="kpi-sub">${sub}</div></div>`;

  /** cols: [{label, cls}] ; rows: [{cells:[html], attrs, cls}] */
  C.table = ({ cols, rows, empty, caption }) =>
    `<div class="table-wrap"><table class="table">${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ''}<thead><tr>${cols.map((c) => `<th scope="col" class="${c.cls || ''}">${c.label}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr class="${r.cls || ''}" ${r.attrs || ''}>${r.cells.map((cell, i) => `<td class="${cols[i].cls || ''}">${cell}</td>`).join('')}</tr>`).join('') : ''}</tbody></table>${rows.length ? '' : empty || ''}</div>`;

  C.seg = (key, options, value, label) =>
    `<div class="seg" role="group" aria-label="${esc(label || key)}">${options.map((o) => `<button type="button" aria-pressed="${o.value === value}" ${C.on('filter', { key, value: o.value })}>${esc(o.label)}${o.count != null ? `<span class="c">${o.count}</span>` : ''}</button>`).join('')}</div>`;

  C.filterSelect = (key, label, options, value) =>
    `<label class="sr-only" for="f-${key}">${esc(label)}</label><select id="f-${key}" class="select" style="width:auto" data-filter="${key}">${options.map((o) => `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;

  C.search = (key, placeholder, value) =>
    `<div class="search">${I('search')}<label class="sr-only" for="f-${key}">${esc(placeholder)}</label><input id="f-${key}" class="input" type="search" placeholder="${esc(placeholder)}" value="${esc(value || '')}" data-filter="${key}" autocomplete="off"></div>`;

  /* ---------- form fields ---------- */
  C.field = ({ name, label, type = 'text', value = '', required, options, placeholder, help, error, full, rows, min, max, id, autofocus, live }) => {
    const fid = id || 'fld-' + name;
    const a = attrs({ id: fid, name, placeholder, min, max, required: !!required, 'aria-invalid': error ? 'true' : null, 'aria-describedby': error || help ? fid + '-msg' : null, autofocus: !!autofocus, 'data-live': live || null });
    let control;
    if (type === 'select') control = `<select class="select" ${a}>${options.map((o) => { const v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
    else if (type === 'textarea') control = `<textarea class="textarea" rows="${rows || 3}" ${a}>${esc(value)}</textarea>`;
    else control = `<input class="input" type="${type}" value="${esc(value)}" ${a}>`;
    return `<div class="field ${full ? 'full' : ''}"><label for="${fid}">${esc(label)}${required ? '<span class="req" aria-hidden="true">*</span>' : ''}</label>${control}${error ? `<span class="error" id="${fid}-msg">${esc(error)}</span>` : help ? `<span class="help" id="${fid}-msg">${esc(help)}</span>` : ''}</div>`;
  };
  C.checks = ({ name, label, options, values = [], error, full = true, grid }) =>
    `<fieldset class="field ${full ? 'full' : ''}" style="border:0;padding:0;margin:0"><legend class="field-label" style="padding:0;margin-bottom:6px">${esc(label)}</legend><div class="${grid ? 'check-grid' : 'check-list'}">${options.map((o) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(o.value)}" ${values.includes(o.value) ? 'checked' : ''}>${esc(o.label)}${o.meta ? ` <span class="muted xs">${esc(o.meta)}</span>` : ''}</label>`).join('')}</div>${error ? `<span class="error">${esc(error)}</span>` : ''}</fieldset>`;
  C.radios = ({ name, label, options, value, error }) =>
    `<fieldset class="field full" style="border:0;padding:0;margin:0"><legend class="field-label" style="padding:0;margin-bottom:6px">${esc(label)}<span class="req" aria-hidden="true">*</span></legend><div class="radio-cards">${options.map((o) => `<label class="radio-card"><input type="radio" name="${name}" value="${esc(o.value)}" ${o.value === value ? 'checked' : ''}>${esc(o.label)}</label>`).join('')}</div>${error ? `<span class="error">${esc(error)}</span>` : ''}</fieldset>`;
  C.formError = (errors) => (errors && errors._ ? `<div class="callout bad" role="alert">${I('alert')}<div>${esc(errors._)}</div></div>` : '');

  C.callout = (tone, html, actions = '') => `<div class="callout ${tone}">${I(tone === 'ok' ? 'checkCircle' : tone === 'info' ? 'info' : 'alert')}<div>${html}${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  /* ---------- containers ---------- */
  C.drawer = ({ title, sub = '', tools = '', body, foot = '', wide, form, draft, draftKey }) => {
    const inner = `<div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;
    return `<div class="scrim" ${C.on('close-drawer')}></div><aside class="drawer ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div class="drawer-head"><div class="titles"><h2 id="drawer-title">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${C.btn('', { action: 'close-drawer', icon: 'x', variant: 'ghost', title: 'Fermer' })}</div>
      ${tools ? `<div class="drawer-tools">${tools}</div>` : ''}
      ${form ? `<form class="drawer-form" data-form="${form}" ${draft ? 'data-draft' : ''} ${draftKey ? `data-draft-key="${esc(draftKey)}"` : ''} novalidate style="display:contents">${inner}</form>` : inner}
    </aside>`;
  };
  C.modal = ({ title, body, foot, form }) => {
    const inner = `<div class="drawer-body">${body}</div><div class="drawer-foot">${foot}</div>`;
    return `<div class="scrim modal-scrim" ${C.on('close-modal')}></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="drawer-head"><div class="titles"><h2 id="modal-title">${title}</h2></div>${C.btn('', { action: 'close-modal', icon: 'x', variant: 'ghost', title: 'Fermer' })}</div>${form ? `<form data-form="${form}" novalidate>${inner}</form>` : inner}</div>`;
  };

  C.stageBar = (byStage) => {
    const parts = [...EH.REF.stages.map((s) => ({ n: byStage[s.id] || 0, c: s.color, l: s.label })), { n: byStage.abandon || 0, c: 'var(--bad)', l: 'Abandon' }];
    const tot = parts.reduce((a, p) => a + p.n, 0) || 1;
    const label = parts.filter((p) => p.n).map((p) => `${p.l} ${p.n}`).join(', ');
    return `<div class="stagebar" role="img" aria-label="${esc(label)}" title="${esc(label)}">${parts.map((p) => (p.n ? `<span style="width:${(100 * p.n) / tot}%;background:${p.c}"></span>` : '')).join('')}</div>`;
  };
  C.stageLegend = () => `<div class="legend">${EH.REF.stages.map((s) => `<span><i class="dot" style="background:${s.color}"></i>${s.label}</span>`).join('')}<span><i class="dot" style="background:var(--bad)"></i>Abandon</span></div>`;
  C.stageBadge = (stage) => (stage === 'abandon' ? C.badge('Abandon', 'bad') : stage === 'termine' ? C.badge('Terminé', 'ok') : C.badge(EH.stageLabel(stage), stage === 'candidat' ? '' : 'accent'));
})();
