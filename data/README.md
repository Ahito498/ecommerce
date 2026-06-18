# Data pipeline

This folder turns a messy orders/returns dataset into the clean product catalog the app serves. It is plain Node.js with **no dependencies**, and it is **deterministic** (seeded), so re‑running produces identical files.

```
catalog.js        product master — display metadata + seed prices
generate-raw.js   creates raw/orders_raw.csv (~940 intentionally messy rows)
clean.js          cleans it -> clean/orders_clean.csv, clean/products.json, clean/cleaning_report.md
lib/csv.js        tiny dependency-free CSV parse/stringify
```

Run it:

```bash
node generate-raw.js   # or: npm run data:generate   (from repo root)
node clean.js          # or: npm run data:clean
```

## Why generated data?

No real dataset was supplied, so `generate-raw.js` fabricates a realistic orders/returns file **with deliberate mess** so the cleaning step has real work to do:

- exact and near‑duplicate rows
- inconsistent product names (case, spacing, punctuation: `USB-C` / `USB C` / `USBC`)
- inconsistent category labels (`Electronics` / `electronics` / `ELEC` / `Electronics & Gadgets`)
- prices in many formats (`199`, `199.00`, `EGP 199`, `2,499.00`, `199,00`) plus missing/invalid values
- several date formats and some blanks
- inconsistent order statuses (`Delivered` / `RET` / `Refunded` / `cancelled`) and stray/missing return reasons
- invalid quantities (blank, `0`, `-1`, `2.0`)
- a few broken rows missing the product identity or the order id

## What `clean.js` does

1. Trim/collapse whitespace on every field.
2. Resolve each row to a product in `catalog.js` by **SKU**, else by a normalised **name key** (case/spacing/punctuation insensitive). Unresolvable rows are dropped.
3. Drop rows with no usable order id.
4. Parse prices written with currency symbols, thousands commas and european decimal commas; reject non‑positive/outlier values.
5. Parse quantities (impute missing → 1, clamp invalid → 1).
6. Parse dates from several formats to ISO `yyyy-mm-dd`.
7. Normalise status to `{delivered, returned, cancelled}`; clear return reasons on non‑returns; label missing reasons `Unspecified`.
8. Impute any still‑missing price from the product's **median** observed price.
9. Remove duplicate transaction lines (same order id + SKU).
10. Derive one catalog entry per product with a data‑driven price (median) and stats (units sold, return rate).

Outputs:

- `clean/orders_clean.csv` — analysis‑ready transactions
- `clean/products.json` — the catalog the API seeds from
- `clean/cleaning_report.md` — before/after counts for every fix

## Using a real dataset

Replace `raw/orders_raw.csv` with your file and adjust the two things `clean.js` depends on:

- **Column names** read in the per‑row loop (`order_id`, `product_sku`, `product_name`, `category`, `unit_price`, `quantity`, `status`, `return_reason`, `order_date`).
- **Product resolution** — either keep `catalog.js` as your product master, or change the lookup so products are derived purely from the transaction columns.

The field parsers (price/date/quantity/status) are written to tolerate the kinds of mess listed above, so they should carry over to real data with little change.
