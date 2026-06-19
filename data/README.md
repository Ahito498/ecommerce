# Data pipeline

`data/clean.js` cleans the client's real orders/returns export and derives the
catalog the app serves. It is plain Node.js with **no dependencies**.

```
clean.js        cleans raw/orders_raw.csv -> clean/{orders_clean.csv, products.json, cleaning_report.md}
lib/csv.js      tiny dependency-free CSV parse/stringify (handles BOM, quotes)
raw/            raw input  (orders_raw.csv = the client's real export)
clean/          cleaned outputs (products.json is consumed by the API seed)
```

Run it:

```bash
node clean.js        # or: npm run data   (from repo root)
```

## The dataset

`raw/orders_raw.csv` is a ~940-row orders/returns export from the **UrbanSouq**
store, with 20 columns: `order_record_id, order_id, order_name (customer),
business_name, city, order_date, product_category, order_status, net_amount,
data_source, created_by, quantity, unit_price, discount_pct, customer_rating,
delivery_days, device_type, marketing_channel, warehouse, issue_reason`.

**Important:** the data has **no product-level identity** — there is no product
name or SKU, only a `product_category`. So a true product catalog cannot be
built from it. Instead the catalog is derived at the **category** level: each of
the 6 categories (Beauty, Books, Electronics, Fashion, Home, Sports) becomes one
storefront entry, enriched with real aggregated statistics.

## What `clean.js` does

1. Read the CSV (BOM-aware).
2. Normalise **category** (18 spellings → 6), **order status** (15 → 5),
   **issue reason** (separators/case → canonical) and **data source** (29 → ~8).
3. Unify **city** names across case, typos and separators, and Arabic⇄English
   (`cair0` / `القاهرة` → Cairo, `alex` / `اسكندرية` → Alexandria, etc.).
4. Parse numerics and **reject sentinels/garbage** (`-999`, `1000000`) and
   out-of-range values (price ≤0 or far above the legit ceiling, rating outside
   1–5, etc.).
5. Parse dates to ISO; title-case customer names.
6. Drop duplicate transaction lines (same `order_record_id`).
7. Derive one catalog entry per category: median price + price range, average
   rating, units sold (completed orders), return rate, average delivery days,
   and the top city / channel / return reason.

Outputs:

- `clean/orders_clean.csv` — analysis-ready transactions (normalised columns)
- `clean/products.json` — the 6 category products the API seeds from
- `clean/cleaning_report.md` — before/after counts for every fix

## Using a different dataset

Replace `raw/orders_raw.csv` with the new file and re-run `node clean.js`.
If the column names differ, update the field reads in the per-row loop of
`clean.js` (e.g. `product_category`, `order_status`, `unit_price`, `quantity`,
`customer_rating`, `issue_reason`, `city`, `order_date`). If the new data **does**
have a product name/SKU column, the catalog can instead be grouped by product
rather than by category — ask and this can be switched over quickly.
