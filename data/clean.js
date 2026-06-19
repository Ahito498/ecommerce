'use strict';

/**
 * Clean the real orders/returns dataset (UrbanSouq) and derive a catalog.
 *
 * Reads : data/raw/orders_raw.csv   (client's real export, ~940 rows)
 * Writes: data/clean/orders_clean.csv   (analysis-ready transactions)
 *         data/clean/products.json      (catalog consumed by the API/seed)
 *         data/clean/cleaning_report.md  (before/after summary)
 *
 * The dataset has NO product-level identity — the only product dimension is
 * `product_category`. So the catalog is built at the CATEGORY level: each of
 * the 6 categories becomes one storefront entry, enriched with REAL aggregated
 * stats from the cleaned transactions (median price, average rating, units
 * sold, return rate, average delivery time, top issue/city/channel).
 *
 * Cleaning highlights:
 *   - normalise category (19 spellings -> 6), order status (16 -> 5),
 *     issue reason (20 -> 5), data source (30 -> ~8)
 *   - unify city names across case/typos/separators and Arabic⇄English
 *     (e.g. cair0/القاهرة -> Cairo, alex/اسكندرية -> Alexandria)
 *   - reject sentinel/garbage numerics (-999, 1000000) and out-of-range values
 *   - parse dates to ISO, drop duplicate transaction lines
 */

const fs = require('fs');
const path = require('path');
const { parse, stringify } = require('./lib/csv');

// ----- category display metadata (accent + short tagline) ------------------
const CATEGORY_META = {
  Electronics: { accent: '#2563eb', tagline: 'Gadgets, devices and accessories' },
  Fashion: { accent: '#db2777', tagline: 'Clothing, footwear and style' },
  Beauty: { accent: '#9333ea', tagline: 'Skincare, cosmetics and care' },
  Home: { accent: '#0d9488', tagline: 'Home, kitchen and living' },
  Sports: { accent: '#ea580c', tagline: 'Fitness and outdoor gear' },
  Books: { accent: '#ca8a04', tagline: 'Books and reading' },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_META);

// ----- normalisers ---------------------------------------------------------
const collapse = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const sepWords = (s) => collapse(String(s ?? '').replace(/[-_]+/g, ' ')).toLowerCase();
const titleFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const titleWords = (s) => s.split(' ').map(titleFirst).join(' ');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function normCategory(raw) {
  const k = collapse(raw).toLowerCase();
  const map = { beauty: 'Beauty', fashion: 'Fashion', books: 'Books', book: 'Books', home: 'Home', sports: 'Sports', sport: 'Sports', electronics: 'Electronics' };
  return map[k] || '';
}

function normStatus(raw) {
  const k = collapse(raw).toLowerCase();
  return ['cancelled', 'pending', 'processing', 'returned', 'completed'].includes(k) ? k : '';
}

function normIssue(raw) {
  const k = sepWords(raw);
  if (!k) return '';
  return titleFirst(k); // "missing documents" -> "Missing documents"
}

function normSource(raw) {
  const k = sepWords(raw);
  if (!k) return '';
  return k
    .split(' ')
    .map((w) => (['crm', 'erp', 'pos'].includes(w) ? w.toUpperCase() : titleFirst(w)))
    .join(' ');
}

const CITY_ALIASES = {
  cairo: 'Cairo', cair0: 'Cairo', القاهرة: 'Cairo',
  giza: 'Giza', gizaa: 'Giza', الجيزة: 'Giza',
  alexandria: 'Alexandria', alex: 'Alexandria', اسكندرية: 'Alexandria',
  mansoura: 'Mansoura', 'el mansoura': 'Mansoura',
  assiut: 'Assiut', asyut: 'Assiut', أسيوط: 'Assiut',
  'beni suef': 'Beni Suef', 'بني سويف': 'Beni Suef',
  zagazig: 'Zagazig', tanta: 'Tanta', luxor: 'Luxor', aswan: 'Aswan',
  fayoum: 'Fayoum', ismailia: 'Ismailia', suez: 'Suez', minya: 'Minya', qena: 'Qena',
};
function normCity(raw) {
  const k = sepWords(raw);
  if (!k) return '';
  return CITY_ALIASES[k] || titleWords(k);
}

/** Parse a number, rejecting blanks, sentinels (-999, 1000000) and out-of-range values. */
function num(raw, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const s = collapse(raw);
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n === -999 || n === 1000000) return null; // known sentinels
  if (n < min || n > max) return null;
  return integer ? Math.round(n) : n;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(raw) {
  const s = collapse(raw);
  if (!s) return '';
  let m, y, mo, d;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) [, y, mo, d] = m.map(Number);
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else if ((m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})$/))) { mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1; d = +m[2]; y = +m[3]; }
  else return '';
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}`;
}

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
function mode(values) {
  const counts = {};
  let best = null, bestN = 0;
  for (const v of values) {
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > bestN) { bestN = counts[v]; best = v; }
  }
  return best;
}

// ----- run -----------------------------------------------------------------
const raw = parse(fs.readFileSync(path.join(__dirname, 'raw', 'orders_raw.csv'), 'utf8'));

const stats = {
  rawRows: raw.length,
  duplicatesRemoved: 0,
  categoriesNormalised: 0,
  categoryMissing: 0,
  statusNormalised: 0,
  statusMissing: 0,
  issuesNormalised: 0,
  sourcesNormalised: 0,
  citiesNormalised: 0,
  pricesRejected: 0,
  quantitiesRejected: 0,
  ratingsRejected: 0,
  datesUnparseable: 0,
  rawCategoryVariants: new Set(),
  rawStatusVariants: new Set(),
  rawIssueVariants: new Set(),
  rawSourceVariants: new Set(),
  rawCityVariants: new Set(),
};

// First pass: clean every row.
const cleanedAll = [];
for (const r of raw) {
  if (collapse(r.product_category)) stats.rawCategoryVariants.add(collapse(r.product_category));
  if (collapse(r.order_status)) stats.rawStatusVariants.add(collapse(r.order_status));
  if (collapse(r.issue_reason)) stats.rawIssueVariants.add(collapse(r.issue_reason));
  if (collapse(r.data_source)) stats.rawSourceVariants.add(collapse(r.data_source));
  if (collapse(r.city)) stats.rawCityVariants.add(collapse(r.city));

  const category = normCategory(r.product_category);
  if (!category) stats.categoryMissing++;
  else if (collapse(r.product_category) !== category) stats.categoriesNormalised++;

  const status = normStatus(r.order_status);
  if (!status) stats.statusMissing++;
  else if (collapse(r.order_status) !== status) stats.statusNormalised++;

  const issue = normIssue(r.issue_reason);
  if (issue && collapse(r.issue_reason) !== issue) stats.issuesNormalised++;
  const source = normSource(r.data_source);
  if (source && collapse(r.data_source) !== source) stats.sourcesNormalised++;
  const city = normCity(r.city);
  if (city && collapse(r.city) !== city) stats.citiesNormalised++;

  // Legit unit prices sit well under 20k; treat anything far above as garbage.
  const unit_price = num(r.unit_price, { min: 0.01, max: 50000 });
  if (collapse(r.unit_price) && unit_price === null) stats.pricesRejected++;
  const quantity = num(r.quantity, { min: 1, max: 100000, integer: true });
  if (collapse(r.quantity) && quantity === null) stats.quantitiesRejected++;
  const customer_rating = num(r.customer_rating, { min: 1, max: 5, integer: true });
  if (collapse(r.customer_rating) && customer_rating === null) stats.ratingsRejected++;
  const discount_pct = num(r.discount_pct, { min: 0, max: 100 });
  const delivery_days = num(r.delivery_days, { min: 0, max: 365, integer: true });
  const net_amount = num(r.net_amount, { min: 0.01, max: 5000000 });

  const order_date = parseDate(r.order_date);
  if (collapse(r.order_date) && !order_date) stats.datesUnparseable++;

  cleanedAll.push({
    order_record_id: collapse(r.order_record_id).toUpperCase(),
    order_id: collapse(r.order_id).toUpperCase(),
    customer_name: r.order_name ? titleWords(collapse(r.order_name).toLowerCase()) : '',
    city,
    order_date,
    category,
    order_status: status,
    quantity: quantity ?? '',
    unit_price: unit_price ?? '',
    discount_pct: discount_pct ?? '',
    net_amount: net_amount ?? '',
    customer_rating: customer_rating ?? '',
    delivery_days: delivery_days ?? '',
    data_source: source,
    marketing_channel: collapse(r.marketing_channel),
    warehouse: collapse(r.warehouse),
    device_type: collapse(r.device_type),
    issue_reason: issue,
  });
}

// Drop duplicate transaction lines (same order_record_id), keeping the first.
const seen = new Set();
const cleaned = [];
for (const r of cleanedAll) {
  const key = r.order_record_id;
  if (key && seen.has(key)) { stats.duplicatesRemoved++; continue; }
  if (key) seen.add(key);
  cleaned.push(r);
}

const storeName = mode(raw.map((r) => collapse(r.business_name))) || 'the store';

// ----- derive the catalog (one entry per category) -------------------------
const byCat = new Map();
for (const r of cleaned) {
  if (!r.category) continue;
  if (!byCat.has(r.category)) byCat.set(r.category, []);
  byCat.get(r.category).push(r);
}

const num0 = (v) => (typeof v === 'number' ? v : null);
const products = [];
for (const category of CATEGORY_ORDER) {
  const lines = byCat.get(category);
  if (!lines || !lines.length) continue;

  const prices = lines.map((l) => num0(l.unit_price)).filter((x) => x !== null);
  const ratings = lines.map((l) => num0(l.customer_rating)).filter((x) => x !== null);
  const deliveries = lines.map((l) => num0(l.delivery_days)).filter((x) => x !== null);
  const notCancelled = lines.filter((l) => l.order_status && l.order_status !== 'cancelled');
  const returned = lines.filter((l) => l.order_status === 'returned');
  const unitsSold = lines
    .filter((l) => l.order_status === 'completed')
    .reduce((s, l) => s + (num0(l.quantity) || 0), 0);

  const price = median(prices);
  products.push({
    id: slugify(category),
    slug: slugify(category),
    name: category,
    category,
    tagline: CATEGORY_META[category].tagline,
    price: price !== null ? Math.round(price * 100) / 100 : 0,
    priceMin: prices.length ? Math.round(Math.min(...prices) * 100) / 100 : 0,
    priceMax: prices.length ? Math.round(Math.max(...prices) * 100) / 100 : 0,
    description:
      `Browse the ${category} range at ${storeName}. ${CATEGORY_META[category].tagline}. ` +
      `Based on ${lines.length} real orders` +
      (ratings.length ? `, rated ${(Math.round(mean(ratings) * 10) / 10)}/5 on average` : '') +
      (deliveries.length ? `, delivered in ~${Math.round(mean(deliveries))} days` : '') +
      '.',
    accentColor: CATEGORY_META[category].accent,
    rating: ratings.length ? Math.round(mean(ratings) * 10) / 10 : 0,
    ratingCount: ratings.length,
    orders: lines.length,
    unitsSold,
    returnRate: notCancelled.length ? Math.round((returned.length / notCancelled.length) * 1000) / 10 : 0,
    avgDeliveryDays: deliveries.length ? Math.round(mean(deliveries)) : 0,
    topIssue: mode(returned.map((l) => l.issue_reason)) || mode(lines.map((l) => l.issue_reason)) || '—',
    topCity: mode(lines.map((l) => l.city)) || '—',
    topChannel: mode(lines.map((l) => l.marketing_channel)) || '—',
  });
}
products.sort((a, b) => b.orders - a.orders);

// ----- write outputs -------------------------------------------------------
const outDir = path.join(__dirname, 'clean');
fs.mkdirSync(outDir, { recursive: true });

const COLS = ['order_record_id', 'order_id', 'customer_name', 'city', 'order_date', 'category', 'order_status', 'quantity', 'unit_price', 'discount_pct', 'net_amount', 'customer_rating', 'delivery_days', 'data_source', 'marketing_channel', 'warehouse', 'device_type', 'issue_reason'];
fs.writeFileSync(path.join(outDir, 'orders_clean.csv'), stringify(cleaned, COLS));
fs.writeFileSync(path.join(outDir, 'products.json'), JSON.stringify(products, null, 2) + '\n');

const report = `# Data Cleaning Report

Source: \`data/raw/orders_raw.csv\` — the real ${storeName} orders/returns export.
Generated by \`data/clean.js\`.

> The dataset has no product-level identity, so the catalog is derived at the
> **category** level: each category becomes one storefront entry enriched with
> real aggregated statistics.

## Summary

| Metric | Value |
| --- | ---: |
| Raw rows read | ${stats.rawRows} |
| Duplicate lines removed (same order_record_id) | ${stats.duplicatesRemoved} |
| **Clean transaction rows** | **${cleaned.length}** |
| Category-level products derived | ${products.length} |

## Normalisation (messy variants → canonical)

| Field | Raw distinct variants | Canonical | Rows normalised |
| --- | ---: | ---: | ---: |
| Category | ${stats.rawCategoryVariants.size} | ${products.length} | ${stats.categoriesNormalised} |
| Order status | ${stats.rawStatusVariants.size} | 5 | ${stats.statusNormalised} |
| Issue reason | ${stats.rawIssueVariants.size} | — | ${stats.issuesNormalised} |
| Data source | ${stats.rawSourceVariants.size} | — | ${stats.sourcesNormalised} |
| City (incl. Arabic⇄English, typos) | ${stats.rawCityVariants.size} | ${new Set(cleaned.map((r) => r.city).filter(Boolean)).size} | ${stats.citiesNormalised} |

## Invalid / missing data handled

| Fix | Count |
| --- | ---: |
| Prices rejected (sentinels -999/1000000, ≤0, out of range) | ${stats.pricesRejected} |
| Quantities rejected (sentinels / invalid) | ${stats.quantitiesRejected} |
| Ratings rejected (outside 1–5) | ${stats.ratingsRejected} |
| Category missing/unmapped | ${stats.categoryMissing} |
| Order status missing | ${stats.statusMissing} |
| Dates left blank (unparseable) | ${stats.datesUnparseable} |

## Derived catalog

| Category | Orders | Median price | Avg rating | Return rate | Top city |
| --- | ---: | ---: | ---: | ---: | --- |
${products.map((p) => `| ${p.name} | ${p.orders} | ${p.price} | ${p.rating} | ${p.returnRate}% | ${p.topCity} |`).join('\n')}

## Outputs

- \`clean/orders_clean.csv\` — ${cleaned.length} analysis-ready rows
- \`clean/products.json\` — ${products.length} category products consumed by the API
`;
fs.writeFileSync(path.join(outDir, 'cleaning_report.md'), report);

console.log(`Cleaned ${stats.rawRows} -> ${cleaned.length} rows (removed ${stats.duplicatesRemoved} duplicates).`);
console.log(`Derived ${products.length} category products: ${products.map((p) => `${p.name}(${p.orders})`).join(', ')}`);
console.log(`Rejected numerics — prices:${stats.pricesRejected} qty:${stats.quantitiesRejected} ratings:${stats.ratingsRejected}`);
