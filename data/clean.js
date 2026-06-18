'use strict';

/**
 * Clean the raw orders/returns data and derive a product catalog for the app.
 *
 * Reads : data/raw/orders_raw.csv
 * Writes: data/clean/orders_clean.csv   (analysis-ready transactions)
 *         data/clean/products.json      (catalog consumed by the API/seed)
 *         data/clean/cleaning_report.md  (before/after summary)
 *
 * Cleaning steps:
 *   1. Trim and collapse whitespace on every field.
 *   2. Resolve each row to a master product by SKU, else by a normalised name
 *      key (case/spacing/punctuation insensitive). Unresolvable rows are dropped.
 *   3. Drop rows missing a usable order id.
 *   4. Parse prices written in many formats (currency symbols, thousands commas,
 *      european decimal commas); reject non-positive/outlier values.
 *   5. Parse quantities; impute missing and clamp invalid to 1.
 *   6. Parse dates from several formats to ISO (yyyy-mm-dd).
 *   7. Normalise status to {delivered, returned, cancelled} and clear return
 *      reasons that sit on non-returned rows; label missing reasons "Unspecified".
 *   8. Impute any still-missing price from the product's median price.
 *   9. Remove duplicate transaction lines (same order id + SKU).
 *  10. Derive one catalog entry per product with a data-driven price and stats.
 */

const fs = require('fs');
const path = require('path');
const { parse, stringify } = require('./lib/csv');
const { PRODUCTS, ACCENTS } = require('./catalog');

// ----- lookups -------------------------------------------------------------
const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const masterBySku = new Map(PRODUCTS.map((p) => [p.sku.toUpperCase(), p]));
const masterByKey = new Map(PRODUCTS.map((p) => [normKey(p.name), p]));

// ----- field parsers -------------------------------------------------------
const collapse = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function titleCase(s) {
  return collapse(s)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parsePrice(raw) {
  const original = String(raw || '').trim();
  if (!original) return { value: null, status: 'missing' };
  // Strip currency symbols/words and spaces.
  let s = original.replace(/egp/gi, '').replace(/\$/g, '').replace(/[a-z]/gi, '').trim();
  const hadFormatting = s !== original.trim() || /[,]/.test(s);
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, ''); // 2,499.00 -> thousands comma
  } else if (s.includes(',')) {
    s = /^\d+,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const value = parseFloat(s);
  if (Number.isNaN(value)) return { value: null, status: 'missing' };
  if (value <= 0 || value > 50000) return { value: null, status: 'invalid' }; // outlier -> impute later
  return { value, status: hadFormatting ? 'reformatted' : 'ok' };
}

function parseQuantity(raw) {
  const s = String(raw || '').trim();
  if (!s) return { value: 1, status: 'imputed' };
  const n = parseFloat(s);
  if (Number.isNaN(n) || n <= 0) return { value: 1, status: 'invalid' };
  return { value: Math.floor(n), status: s.includes('.') ? 'reformatted' : 'ok' };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let y, mo, d;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) [, y, mo, d] = m.map(Number);
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    d = +m[1]; mo = +m[2]; y = +m[3];
  } else if ((m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})$/))) {
    mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1; d = +m[2]; y = +m[3];
  } else return null;
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function normStatus(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (['delivered', 'completed', 'complete'].includes(s)) return 'delivered';
  if (['returned', 'ret', 'refunded'].includes(s)) return 'returned';
  if (['cancelled', 'canceled', 'cancel'].includes(s)) return 'cancelled';
  return 'unknown';
}

const median = (nums) => {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Deterministic small hash so synthesised rating/stock are stable per product.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// ----- run -----------------------------------------------------------------
const raw = parse(fs.readFileSync(path.join(__dirname, 'raw', 'orders_raw.csv'), 'utf8'));

const stats = {
  rawRows: raw.length,
  droppedMissingOrderId: 0,
  droppedUnresolved: 0,
  duplicatesRemoved: 0,
  pricesReformatted: 0,
  pricesImputed: 0,
  pricesInvalid: 0,
  quantitiesImputed: 0,
  quantitiesInvalid: 0,
  datesUnparseable: 0,
  namesNormalised: 0,
  categoriesNormalised: 0,
  reasonsCleared: 0,
  reasonsFilled: 0,
};

const cleaned = [];
for (const row of raw) {
  const orderId = collapse(row.order_id).toUpperCase();
  if (!orderId) { stats.droppedMissingOrderId++; continue; }

  // Resolve product: prefer SKU, fall back to normalised name.
  const sku = collapse(row.product_sku).toUpperCase();
  let product = (sku && masterBySku.get(sku)) || masterByKey.get(normKey(row.product_name));
  if (!product) { stats.droppedUnresolved++; continue; }

  if (collapse(row.product_name) !== product.name) stats.namesNormalised++;
  if (collapse(row.category) !== product.category) stats.categoriesNormalised++;

  const price = parsePrice(row.unit_price);
  if (price.status === 'reformatted') stats.pricesReformatted++;
  if (price.status === 'invalid') stats.pricesInvalid++;

  const qty = parseQuantity(row.quantity);
  if (qty.status === 'imputed') stats.quantitiesImputed++;
  if (qty.status === 'invalid') stats.quantitiesInvalid++;

  const date = parseDate(row.order_date);
  if (row.order_date && !date) stats.datesUnparseable++;

  const status = normStatus(row.status);

  let reason = collapse(row.return_reason);
  if (status !== 'returned') {
    if (reason) stats.reasonsCleared++;
    reason = '';
  } else if (!reason) {
    reason = 'Unspecified';
    stats.reasonsFilled++;
  }

  cleaned.push({
    order_id: orderId,
    order_date: date || '',
    customer_name: row.customer_name ? titleCase(row.customer_name) : '',
    product_sku: product.sku,
    product_name: product.name,
    category: product.category,
    unit_price: price.value, // may be null -> imputed below
    quantity: qty.value,
    status,
    return_reason: reason,
  });
}

// Impute missing/invalid prices from each product's median observed price.
const pricesBySku = new Map();
for (const r of cleaned) {
  if (r.unit_price != null) {
    if (!pricesBySku.has(r.product_sku)) pricesBySku.set(r.product_sku, []);
    pricesBySku.get(r.product_sku).push(r.unit_price);
  }
}
const medianPrice = new Map();
for (const p of PRODUCTS) {
  const observed = pricesBySku.get(p.sku) || [];
  medianPrice.set(p.sku, observed.length ? median(observed) : p.price);
}
for (const r of cleaned) {
  if (r.unit_price == null) {
    r.unit_price = Math.round(medianPrice.get(r.product_sku) * 100) / 100;
    stats.pricesImputed++;
  }
  r.line_total = Math.round(r.unit_price * r.quantity * 100) / 100;
}

// Remove duplicate transaction lines (same order id + SKU), keeping the first.
const seen = new Set();
const deduped = [];
for (const r of cleaned) {
  const key = `${r.order_id}|${r.product_sku}`;
  if (seen.has(key)) { stats.duplicatesRemoved++; continue; }
  seen.add(key);
  deduped.push(r);
}

// Derive the product catalog from the cleaned transactions.
const bySku = new Map();
for (const r of deduped) {
  if (!bySku.has(r.product_sku)) bySku.set(r.product_sku, []);
  bySku.get(r.product_sku).push(r);
}
const products = [];
for (const p of PRODUCTS) {
  const lines = bySku.get(p.sku);
  if (!lines || !lines.length) continue; // only products that actually appear
  const deliveredQty = lines.filter((l) => l.status === 'delivered').reduce((s, l) => s + l.quantity, 0);
  const returnedLines = lines.filter((l) => l.status === 'returned').length;
  const soldLines = lines.filter((l) => l.status !== 'cancelled').length;
  const derivedPrice = Math.round(median(lines.map((l) => l.unit_price)) * 100) / 100;
  const h = hash(p.sku);
  products.push({
    id: p.sku,
    slug: slugify(p.name),
    name: p.name,
    category: p.category,
    price: derivedPrice,
    description: p.description,
    accentColor: ACCENTS[p.category] || '#475569',
    rating: Math.round((3.6 + h * 1.3) * 10) / 10,
    ratingCount: 20 + Math.floor(h * 480),
    stock: 12 + Math.floor(hash(p.sku + 'stock') * 188),
    unitsSold: deliveredQty,
    returnRate: soldLines ? Math.round((returnedLines / soldLines) * 1000) / 10 : 0,
  });
}
products.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

// ----- write outputs -------------------------------------------------------
const outDir = path.join(__dirname, 'clean');
fs.mkdirSync(outDir, { recursive: true });

const CLEAN_COLUMNS = ['order_id', 'order_date', 'customer_name', 'product_sku', 'product_name', 'category', 'unit_price', 'quantity', 'line_total', 'status', 'return_reason'];
fs.writeFileSync(path.join(outDir, 'orders_clean.csv'), stringify(deduped, CLEAN_COLUMNS));
fs.writeFileSync(path.join(outDir, 'products.json'), JSON.stringify(products, null, 2) + '\n');

const categories = [...new Set(products.map((p) => p.category))].sort();
const report = `# Data Cleaning Report

Generated from \`data/raw/orders_raw.csv\` by \`data/clean.js\`.

## Summary

| Metric | Value |
| --- | ---: |
| Raw rows read | ${stats.rawRows} |
| Dropped — missing order id | ${stats.droppedMissingOrderId} |
| Dropped — unresolvable product | ${stats.droppedUnresolved} |
| Duplicate lines removed | ${stats.duplicatesRemoved} |
| **Clean transaction rows** | **${deduped.length}** |
| Products derived | ${products.length} |
| Categories normalised to | ${categories.length} |

## Field-level fixes

| Fix | Count |
| --- | ---: |
| Product names normalised (case/spacing/punctuation) | ${stats.namesNormalised} |
| Category labels normalised | ${stats.categoriesNormalised} |
| Prices re-parsed from currency/comma formats | ${stats.pricesReformatted} |
| Prices imputed (missing/invalid → product median) | ${stats.pricesImputed} |
| Prices rejected as invalid (≤0 or outlier) | ${stats.pricesInvalid} |
| Quantities imputed (missing → 1) | ${stats.quantitiesImputed} |
| Quantities clamped (invalid → 1) | ${stats.quantitiesInvalid} |
| Dates left blank (unparseable) | ${stats.datesUnparseable} |
| Return reasons cleared (set on non-returns) | ${stats.reasonsCleared} |
| Return reasons filled ("Unspecified") | ${stats.reasonsFilled} |

## Canonical categories

${categories.map((c) => `- ${c} (${products.filter((p) => p.category === c).length} products)`).join('\n')}

## Outputs

- \`clean/orders_clean.csv\` — ${deduped.length} analysis-ready rows
- \`clean/products.json\` — ${products.length} products consumed by the API
`;
fs.writeFileSync(path.join(outDir, 'cleaning_report.md'), report);

console.log(`Cleaned ${stats.rawRows} -> ${deduped.length} rows; derived ${products.length} products.`);
console.log(`Dropped: ${stats.droppedMissingOrderId} (no id) + ${stats.droppedUnresolved} (unresolved); removed ${stats.duplicatesRemoved} duplicates.`);
