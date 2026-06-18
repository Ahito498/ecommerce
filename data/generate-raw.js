'use strict';

/**
 * Generate a realistic but INTENTIONALLY MESSY orders/returns dataset.
 *
 * The mess is deliberate so the cleaning step has real work to do. We inject:
 *   - exact and near-duplicate rows
 *   - inconsistent product-name and category spellings/casing/spacing
 *   - prices in many formats ("199", "199.00", "EGP 199", "2,499.00", "199,00")
 *   - several date formats and some blanks
 *   - inconsistent order statuses and stray/missing return reasons
 *   - invalid quantities (blank, 0, negative, "2.0")
 *   - a few broken rows missing the product identity or the order id
 *
 * Output: data/raw/orders_raw.csv  (~940 rows)
 *
 * Deterministic: uses a seeded RNG so regenerating produces the same file.
 */

const fs = require('fs');
const path = require('path');
const { stringify } = require('./lib/csv');
const { PRODUCTS } = require('./catalog');

// ----- seeded RNG (mulberry32) so the dataset is reproducible -------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260618);
const rand = () => rng();
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

// ----- messiness helpers ---------------------------------------------------

// Punctuation/spacing aliases the cleaner is expected to reconcile.
const NAME_ALIASES = {
  'Cotton T-Shirt': ['Cotton T-Shirt', 'Cotton Tshirt', 'Cotton T Shirt'],
  'USB-C Charger': ['USB-C Charger', 'USB C Charger', 'USBC Charger'],
  'Bluetooth Headphones': ['Bluetooth Headphones', 'Bluetooth Head Phones'],
  'Power Bank 20000mAh': ['Power Bank 20000mAh', 'Power Bank 20000 mAh'],
  '4K Monitor': ['4K Monitor', '4k Monitor'],
};

function messyName(canonical) {
  let base = canonical;
  if (NAME_ALIASES[canonical] && chance(0.5)) base = pick(NAME_ALIASES[canonical]);
  const r = rand();
  if (r < 0.25) base = base.toLowerCase();
  else if (r < 0.4) base = base.toUpperCase();
  if (chance(0.15)) base = base.replace(' ', '  '); // double internal space
  if (chance(0.15)) base = '  ' + base + ' '; // stray padding
  return base;
}

const CATEGORY_VARIANTS = {
  Electronics: ['Electronics', 'electronics', 'ELEC', 'Electronic', 'Electronics & Gadgets'],
  'Home & Kitchen': ['Home & Kitchen', 'home & kitchen', 'Home and Kitchen', 'HOME&KITCHEN', 'Kitchen'],
  Fashion: ['Fashion', 'fashion', 'Apparel', 'Clothing'],
  Beauty: ['Beauty', 'beauty', 'Beauty & Personal Care', 'Cosmetics'],
  Sports: ['Sports', 'sports', 'Sports & Fitness', 'Fitness'],
  Books: ['Books', 'books', 'Book'],
  Toys: ['Toys', 'toys', 'Toys & Games', 'Toy'],
  Grocery: ['Grocery', 'grocery', 'Groceries', 'Food'],
};
const messyCategory = (canonical) => pick(CATEGORY_VARIANTS[canonical]);

function messyPrice(base) {
  // Occasional sale price so the per-product median is the robust choice.
  let p = chance(0.15) ? base * 0.9 : base;
  // Rare invalid/outlier values the cleaner must reject.
  if (chance(0.02)) return pick(['0', '-50', '99999']);
  if (chance(0.06)) return ''; // missing -> imputed from siblings
  const r = rand();
  if (r < 0.3) return String(Math.round(p)); // "199"
  if (r < 0.55) return p.toFixed(2); // "199.00"
  if (r < 0.7) return pick(['EGP ', '$', 'EGP ']) + p.toFixed(2); // currency prefix
  if (r < 0.8) return p.toFixed(2) + ' EGP'; // currency suffix
  if (r < 0.9) return p.toFixed(2).replace('.', ','); // european decimal comma
  // thousands separator for larger numbers
  return p.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function messyDate(d) {
  if (chance(0.05)) return ''; // missing
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const r = rand();
  if (r < 0.4) return `${yyyy}-${mm}-${dd}`;
  if (r < 0.65) return `${dd}/${mm}/${yyyy}`;
  if (r < 0.85) return `${MON} ${dd}, ${yyyy}`;
  return `${yyyy}/${mm}/${dd}`;
}

const STATUS = {
  delivered: ['Delivered', 'delivered', 'DELIVERED', 'Completed', 'complete'],
  returned: ['Returned', 'returned', 'RET', 'Refunded', 'refunded'],
  cancelled: ['Cancelled', 'cancelled', 'Canceled', 'CANCEL'],
};
const RETURN_REASONS = ['Damaged', 'Defective', 'Wrong item', 'Wrong size', 'Changed mind', 'Late delivery', 'Not as described'];

const FIRST = ['Ahmed', 'Mona', 'Omar', 'Sara', 'Youssef', 'Layla', 'Khaled', 'Nour', 'Hassan', 'Dina', 'Tarek', 'Salma', 'Karim', 'Rana', 'Mahmoud', 'Heba', 'Amir', 'Yara', 'Sami', 'Lina'];
const LAST = ['Ali', 'Hassan', 'Ibrahim', 'Mostafa', 'Saleh', 'Farouk', 'Nasser', 'Adel', 'Zaki', 'Habib', 'Sabry', 'Mansour'];

function messyCustomer() {
  if (chance(0.04)) return ''; // missing name
  let name = `${pick(FIRST)} ${pick(LAST)}`;
  const r = rand();
  if (r < 0.2) name = name.toLowerCase();
  else if (r < 0.3) name = name.toUpperCase();
  if (chance(0.15)) name = ' ' + name + '  ';
  return name;
}

function messyQuantity() {
  if (chance(0.05)) return ''; // missing -> default 1
  if (chance(0.03)) return pick(['0', '-1']); // invalid -> clamp
  if (chance(0.05)) return randInt(1, 5) + '.0'; // "2.0"
  return String(randInt(1, 5));
}

// ----- build the dataset ---------------------------------------------------

const rows = [];
let orderSeq = 100000;
let lastOrderId = null;

function newOrderId() {
  orderSeq += 1;
  const id = `ORD-${orderSeq}`;
  return chance(0.15) ? id.toLowerCase() : id;
}

const startDate = new Date(2024, 0, 1).getTime();
const endDate = new Date(2025, 11, 31).getTime();

const BASE_ROWS = 880;
for (let i = 0; i < BASE_ROWS; i++) {
  const product = pick(PRODUCTS);

  // ~20% of lines belong to a multi-line order (share the previous order id
  // but a different product) — these are NOT duplicates.
  let orderId;
  if (lastOrderId && chance(0.2)) orderId = lastOrderId;
  else orderId = newOrderId();
  lastOrderId = orderId;

  const date = new Date(startDate + rand() * (endDate - startDate));

  // status mix: mostly delivered, ~18% returned, ~7% cancelled
  let statusKey = 'delivered';
  const sr = rand();
  if (sr < 0.18) statusKey = 'returned';
  else if (sr < 0.25) statusKey = 'cancelled';

  let returnReason = '';
  if (statusKey === 'returned') {
    returnReason = chance(0.1) ? '' : pick(RETURN_REASONS); // some returns miss a reason
  } else if (chance(0.03)) {
    returnReason = pick(RETURN_REASONS); // stray reason on a non-return -> cleared by cleaner
  }

  const priceStr = messyPrice(product.price);
  const qtyStr = messyQuantity();

  // total: sometimes present (and sometimes wrong), sometimes blank
  let totalStr = '';
  const qNum = parseInt(qtyStr, 10);
  if (chance(0.5) && !Number.isNaN(qNum) && qNum > 0) {
    const t = product.price * qNum * (chance(0.1) ? 1.1 : 1); // 10% are wrong
    totalStr = t.toFixed(2);
  }

  rows.push({
    order_id: orderId,
    order_date: messyDate(date),
    customer_name: messyCustomer(),
    product_sku: chance(0.1) ? '' : product.sku, // some rows miss the sku (resolved by name)
    product_name: messyName(product.name),
    category: messyCategory(product.category),
    unit_price: priceStr,
    quantity: qtyStr,
    total: totalStr,
    status: pick(STATUS[statusKey]),
    return_reason: returnReason,
  });
}

// Inject ~45 exact/near-duplicate rows (same order_id + sku).
for (let i = 0; i < 45; i++) {
  const src = rows[randInt(0, rows.length - 1)];
  const dup = { ...src };
  // Half are byte-for-byte; half differ only in formatting noise.
  if (chance(0.5)) {
    dup.product_name = messyName(
      // recover a canonical-ish name to re-mess; fall back to the existing one
      (PRODUCTS.find((p) => p.sku === src.product_sku) || {}).name || src.product_name
    );
    dup.unit_price = src.unit_price.trim();
    dup.customer_name = (src.customer_name || '').trim();
  }
  rows.push(dup);
}

// Inject ~15 broken rows missing the product identity or the order id.
for (let i = 0; i < 15; i++) {
  const product = pick(PRODUCTS);
  const broken = {
    order_id: chance(0.5) ? '' : newOrderId(),
    order_date: messyDate(new Date(startDate + rand() * (endDate - startDate))),
    customer_name: messyCustomer(),
    product_sku: '',
    product_name: chance(0.5) ? '' : '   ',
    category: chance(0.5) ? '' : messyCategory(product.category),
    unit_price: messyPrice(product.price),
    quantity: messyQuantity(),
    total: '',
    status: pick(STATUS.delivered),
    return_reason: '',
  };
  rows.push(broken);
}

// Shuffle so duplicates/broken rows aren't all at the end (Fisher–Yates).
for (let i = rows.length - 1; i > 0; i--) {
  const j = randInt(0, i);
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

const COLUMNS = ['order_id', 'order_date', 'customer_name', 'product_sku', 'product_name', 'category', 'unit_price', 'quantity', 'total', 'status', 'return_reason'];

const outPath = path.join(__dirname, 'raw', 'orders_raw.csv');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, stringify(rows, COLUMNS));

console.log(`Generated ${rows.length} raw rows -> ${path.relative(process.cwd(), outPath)}`);
