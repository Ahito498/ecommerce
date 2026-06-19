'use strict';

/**
 * Tiny, dependency-free CSV utilities.
 * Handles quoted fields, escaped quotes (""), embedded commas/newlines and CRLF.
 * Good enough for the well-formed files this project produces; not a full RFC parser.
 */

/** Parse a CSV string into an array of row objects keyed by the header row. */
function parse(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  // Normalise line endings, but keep them inside quoted fields intact.
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip the escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      // Handle CRLF as a single break.
      if (ch === '\r' && next === '\n') i++;
      record.push(field);
      rows.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // Flush trailing field/record (file may not end in newline).
  if (field !== '' || record.length > 0) {
    record.push(field);
    rows.push(record);
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });
}

/** Quote a single CSV field when it contains a delimiter, quote or newline. */
function quote(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Serialise an array of row objects to a CSV string using the given column order. */
function stringify(records, columns) {
  const cols =
    columns || (records.length ? Object.keys(records[0]) : []);
  const lines = [cols.map(quote).join(',')];
  for (const rec of records) {
    lines.push(cols.map((c) => quote(rec[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = { parse, stringify };
