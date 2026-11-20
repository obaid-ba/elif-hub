/* Spreadsheet import/export without a library: reads .xlsx (zip + XML, inflated with the browser's
   DecompressionStream) and .csv, and writes a small .xlsx template (stored zip, inline strings). */
(function () {
  'use strict';
  const EH = window.EH;
  const X = (EH.sheet = {});

  /* ---------- zip ---------- */
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const inflate = async (bytes) => {
    if (typeof DecompressionStream === 'undefined') throw new Error('Votre navigateur ne sait pas lire les fichiers Excel. Enregistrez le fichier en CSV puis importez-le.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  /** Returns { name: Uint8Array } for the entries whose name passes `want`. */
  const unzip = async (buf, want) => {
    const b = new Uint8Array(buf);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx) valide.");
    const n = u16(b, eocd + 10);
    let p = u32(b, eocd + 16);
    const out = {}, dec = new TextDecoder();
    for (let i = 0; i < n; i++) {
      if (u32(b, p) !== 0x02014b50) break;
      const method = u16(b, p + 10), size = u32(b, p + 20), nameLen = u16(b, p + 28), extra = u16(b, p + 30), comment = u16(b, p + 32), local = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extra + comment;
      if (!want(name)) continue;
      const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      const data = b.subarray(start, start + size);
      out[name] = method === 0 ? data : method === 8 ? await inflate(data) : null;
    }
    return out;
  };

  /* ---------- xlsx reader ---------- */
  const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const xml = (bytes) => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  const byTag = (node, tag) => [...node.getElementsByTagName('*')].filter((x) => x.localName === tag);
  /** First worksheet as an array of rows (arrays of strings/numbers). */
  X.readXlsx = async (buf) => {
    const files = await unzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n));
    let sheetPath = null;
    if (files['xl/workbook.xml'] && files['xl/_rels/workbook.xml.rels']) {
      const first = byTag(xml(files['xl/workbook.xml']), 'sheet')[0];
      const rid = first && [...first.attributes].find((a) => a.localName === 'id' && a.name !== 'sheetId');
      const rel = rid && byTag(xml(files['xl/_rels/workbook.xml.rels']), 'Relationship').find((r) => r.getAttribute('Id') === rid.value);
      if (rel) { const t = rel.getAttribute('Target').replace(/^\/?(xl\/)?/, ''); sheetPath = 'xl/' + t; }
    }
    if (!sheetPath || !files[sheetPath]) sheetPath = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).sort()[0];
    if (!sheetPath) throw new Error('Le classeur ne contient aucune feuille.');
    const shared = files['xl/sharedStrings.xml'] ? byTag(xml(files['xl/sharedStrings.xml']), 'si').map((si) => byTag(si, 't').map((t) => t.textContent).join('')) : [];
    const rows = [];
    byTag(xml(files[sheetPath]), 'row').forEach((row) => {
      const r = +row.getAttribute('r') - 1, line = [];
      byTag(row, 'c').forEach((c, i) => {
        const ref = c.getAttribute('r'), idx = ref ? colIndex(ref) : i, t = c.getAttribute('t');
        const v = byTag(c, 'v')[0];
        let val = '';
        if (t === 's') val = shared[+(v && v.textContent)] || '';
        else if (t === 'inlineStr') val = byTag(c, 't').map((x) => x.textContent).join('');
        else if (t === 'b') val = v && v.textContent === '1' ? 'VRAI' : 'FAUX';
        else if (v) val = t === 'str' || t === 'e' ? v.textContent : (isNaN(+v.textContent) ? v.textContent : +v.textContent);
        line[idx] = val;
      });
      rows[isNaN(r) ? rows.length : r] = Array.from(line, (x) => (x == null ? '' : x));
    });
    return Array.from(rows, (x) => x || []);
  };

  /* ---------- csv reader (; or , separated, quoted fields) ---------- */
  X.readCsv = (text) => {
    text = text.replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  };

  /** Reads a File (xlsx, xls refused, csv) into rows. */
  X.readFile = async (file) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xls')) throw new Error('Ancien format .xls non pris en charge : enregistrez le fichier au format .xlsx ou .csv.');
    if (name.endsWith('.csv') || file.type === 'text/csv') return X.readCsv(await file.text());
    return X.readXlsx(await file.arrayBuffer());
  };

  /** Excel serial day (1900 system) -> 'YYYY-MM-DD'. */
  X.serialToDate = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5).toISOString().slice(0, 10);

  /* ---------- xlsx writer (stored zip) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const zip = (entries) => {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const le = (n, bytes) => { const a = new Uint8Array(bytes); for (let i = 0; i < bytes; i++) a[i] = (n >>> (8 * i)) & 0xff; return a; };
    entries.forEach(([name, text]) => {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const head = [le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(nb.length, 2), le(0, 2), nb];
      const cen = [le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(nb.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(offset, 4), nb];
      parts.push(...head, data); central.push(...cen);
      offset += head.reduce((n, x) => n + x.length, 0) + data.length;
    });
    const cenSize = central.reduce((n, x) => n + x.length, 0);
    const end = [le(0x06054b50, 4), le(0, 2), le(0, 2), le(entries.length, 2), le(entries.length, 2), le(cenSize, 4), le(offset, 4), le(0, 2)];
    return new Blob([...parts, ...central, ...end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
  const xesc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  /** rows: array of arrays of strings. Returns a Blob of a one-sheet .xlsx. */
  X.writeXlsx = (rows, sheetName = 'Feuille1') => {
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => `<c r="${colName(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xesc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml', sheet]
    ]);
  };

  X.download = (blob, filename) => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
