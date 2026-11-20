/* ELIFE Hub — shared helpers. Classic script: works when index.html is opened from disk. */
(function () {
  'use strict';
  const EH = (window.EH = window.EH || {});
  const NBSP = ' ';
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  /** Demo clock: the hackathon day, so seeded data and alerts stay consistent. */
  EH.TODAY = '2026-11-19';
  EH.NBSP = NBSP;

  EH.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  const parse = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  EH.days = (a, b) => Math.round((parse(b) - parse(a)) / 864e5); // b - a in days
  EH.addDays = (d, n) => new Date(parse(d) + n * 864e5).toISOString().slice(0, 10);
  EH.ago = (d) => EH.days(d, EH.TODAY);
  EH.monthOf = (d) => d.slice(0, 7);
  EH.fmtDate = (d) => (d ? Number(d.slice(8, 10)) + NBSP + MONTHS[+d.slice(5, 7) - 1] : '—');
  EH.fmtDateY = (d) => (d ? EH.fmtDate(d) + ' ' + d.slice(0, 4) : '—');
  EH.fmtDay = (d) => DAYS[new Date(parse(d)).getUTCDay()] + ' ' + EH.fmtDate(d);
  EH.fmtMonth = (p) => { const m = MONTHS_LONG[+p.slice(5, 7) - 1]; return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + p.slice(0, 4); };
  EH.fmtDateTime = (iso) => EH.fmtDate(iso.slice(0, 10)) + ', ' + iso.slice(11, 16);
  EH.relDays = (d) => {
    const n = EH.ago(d);
    if (n === 0) return "aujourd'hui";
    if (n === 1) return 'hier';
    if (n > 0) return 'il y a ' + n + NBSP + 'j';
    if (n === -1) return 'demain';
    return 'dans ' + -n + NBSP + 'j';
  };
  EH.periodEnd = (p) => { const y = +p.slice(0, 4), m = +p.slice(5, 7); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
  EH.periodDue = (p) => EH.addDays(EH.periodEnd(p), 5); // BR-04-01: day 5 of next month

  /** Times are 'HH:MM'; durations are minutes. */
  EH.toMin = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : 0);
  EH.fromMin = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  EH.fmtDuration = (m) => (!m ? '' : m >= 420 ? Math.round(m / 420 * 10) / 10 + ' jour' + (m >= 840 ? 's' : '') : m % 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m / 60 + ' h');
  EH.fmtTimeRange = (a) => (a.time ? `${a.time.replace(':', ' h ')}–${EH.fromMin(EH.toMin(a.time) + (a.durationMin || 0)).replace(':', ' h ')}` : '');
  EH.pct = (v) => (v == null ? null : Math.round(v) + NBSP + '%');
  EH.plural = (n, one, many) => n + NBSP + (n > 1 ? many || one + 's' : one);
  EH.nowIso = () => EH.TODAY + 'T' + new Date().toTimeString().slice(0, 8);

  let seq = Date.now() % 100000;
  EH.uid = (p) => p + '-' + (++seq).toString(36);

  EH.norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  EH.lev = (a, b) => {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  };
  EH.initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  EH.by = (k, dir = 1) => (a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0);
  EH.groupCount = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  EH.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
})();
