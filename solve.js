// Fast csv-reader 1.0.0 reimplementation: same {columns, rows, errors} for every {text, header}.
// Fast path: a line with no quote and no stray CR is cut with one slice + split. Slow path: field-by-field with
// cached indexOf jumps, reproducing csv-reader's broken-row policy exactly.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  // Cached positions of the next LF / CR / quote / comma at or after pos (len, len+1 when none).
  let nLF = -1, nCR = -1, nQ = -1, nC = -1;
  let lastValue = ''; // the field readUnq just finished (an out-parameter, so no result object is allocated per field)
  let ended = 0; // 0: field ended at a comma; 1: record ends (line break or end of text)

  // Reads unquoted text onto v up to a comma or line break; drops stray CRs. Returns the characters kept.
  function readUnq(v) {
    let added = 0;
    for (;;) {
      if (nLF < pos) { nLF = text.indexOf('\n', pos); if (nLF < 0) nLF = len; }
      if (nC < pos) { nC = text.indexOf(',', pos); if (nC < 0) nC = len; }
      if (nCR < pos) { nCR = text.indexOf('\r', pos); if (nCR < 0) nCR = len + 1; }
      const e = nC < nLF ? nC : nLF;
      if (nCR < e) {
        const cr = nCR;
        v += text.slice(pos, cr);
        added += cr - pos;
        if (text.charCodeAt(cr + 1) === 10) {
          pos = cr + 2;
          line++;
          ended = 1;
          lastValue = v;
          return added;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos = cr + 1;
        continue;
      }
      v += text.slice(pos, e);
      added += e - pos;
      if (e >= len) { pos = len; ended = 1; }
      else if (e === nC) { pos = e + 1; ended = 0; }
      else { pos = e + 1; line++; ended = 1; }
      lastValue = v;
      return added;
    }
  }
  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    let fields;
    let quoted = false;

    if (nLF < pos) { nLF = text.indexOf('\n', pos); if (nLF < 0) nLF = len; }
    if (nQ < pos) { nQ = text.indexOf('"', pos); if (nQ < 0) nQ = len + 1; }
    if (nCR < pos) { nCR = text.indexOf('\r', pos); if (nCR < 0) nCR = len + 1; }
    const end = nLF;
    // nQ/nCR are the first quote / CR at or after pos, so these tests say "none before this line's LF"; a CR
    // directly before the LF is the CRLF break itself and is cut off.
    if (nQ > end && (nCR > end || (nCR === end - 1 && end < len))) {
      // Fast path: no quote, no stray CR on this line.
      fields = text.slice(pos, nCR === end - 1 && end < len ? end - 1 : end).split(',');
      pos = end + 1;
      line++;
    } else {
      fields = [];
      do {
        quoted = text.charCodeAt(pos) === 34;
        if (!quoted) {
          if (nLF < pos) { nLF = text.indexOf('\n', pos); if (nLF < 0) nLF = len; }
          if (nC < pos) { nC = text.indexOf(',', pos); if (nC < 0) nC = len; }
          if (nCR < pos) { nCR = text.indexOf('\r', pos); if (nCR < 0) nCR = len + 1; }
          const e = nC < nLF ? nC : nLF;
          if (nCR > e) {
            // Plain unquoted field: no CR before its end.
            fields.push(text.slice(pos, e));
            if (e >= len) { pos = len; ended = 1; }
            else if (e === nC) { pos = e + 1; ended = 0; }
            else { pos = e + 1; line++; ended = 1; }
          } else if (nCR === e - 1 && e === nLF && e < len) {
            // Last field of a CRLF line.
            fields.push(text.slice(pos, e - 1));
            pos = e + 1;
            line++;
            ended = 1;
          } else {
            readUnq('');
            fields.push(lastValue);
          }
          continue;
        }
        const open = pos;
        let v = '';
        let p = pos + 1;
        let seg = p;
        let close = -1;
        for (;;) {
          const q = text.indexOf('"', p);
          if (q < 0) break;
          if (text.charCodeAt(q + 1) === 34) {
            v += text.slice(seg, q + 1);
            p = seg = q + 2;
            continue;
          }
          v += text.slice(seg, q);
          close = q;
          break;
        }
        if (close < 0) {
          // The quote never closes: a literal character; the text after it is read again as unquoted.
          pos = open + 1;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          readUnq('"');
          fields.push(lastValue);
          continue;
        }
        if (nLF < open) { nLF = text.indexOf('\n', open); if (nLF < 0) nLF = len; }
        if (nCR < open) { nCR = text.indexOf('\r', open); if (nCR < 0) nCR = len + 1; }
        if (nLF < close || nCR < close) {
          // Line breaks inside the quotes: each CRLF, lone CR and LF is one LF and one line.
          if (v.indexOf('\r') >= 0) v = v.replace(/\r\n?/g, '\n');
          for (let i = v.indexOf('\n'); i >= 0; i = v.indexOf('\n', i + 1)) line++;
        }
        pos = close + 1;
        if (pos >= len) { ended = 1; }
        else {
          const c = text.charCodeAt(pos);
          if (c === 44) { pos++; ended = 0; }
          else if (c === 10) { pos++; line++; ended = 1; }
          else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; ended = 1; }
          else {
            if (readUnq(v) > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
            fields.push(lastValue);
            continue;
          }
        }
        fields.push(v);
      } while (ended === 0);
    }

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    const n = fields.length;
    if (width < 0) width = n;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (n < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: n });
      for (let i = n; i < width; i++) fields.push('');
    } else if (n > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
