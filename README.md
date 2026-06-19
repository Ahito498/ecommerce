# ecommerce (working title)

A small but complete storefront demo: an **Angular** frontend, a **Node.js + Express + MongoDB** products API, and a **data‑cleaning pipeline** that turns the real, messy UrbanSouq orders/returns dataset into a clean, category‑level catalog the app serves.

> The name `ecommerce` is a placeholder until the client picks a brand — it lives in a couple of obvious spots (page title, header) and is easy to change.

## Scope

In scope (and implemented):

- ✅ Responsive Angular UI — **product list** and **product detail** pages
- ✅ Simple **products API** (Node.js + Express + MongoDB via Mongoose)
- ✅ **Add to cart** (client‑side cart with persistence)
- ✅ **Data cleaning** of an orders/returns dataset (duplicates, inconsistent values, missing data) before use

Intentionally **out of scope**: authentication, an admin dashboard, and an order/checkout system. The Checkout button is shown but disabled.

## Architecture

```
┌────────────┐      /api (proxy)      ┌──────────────┐        ┌──────────┐
│  Angular   │ ─────────────────────▶ │ Express API  │ ─────▶ │ MongoDB  │
│ (port 4200)│                        │ (port 3000)  │        │          │
└────────────┘                        └──────────────┘        └──────────┘
                                              ▲
                                              │ seeded from
                                      data/clean/products.json
                                              ▲
                                              │ produced by
                              data/clean.js  ◀── data/raw/orders_raw.csv
```

The catalog the API serves is **derived from cleaned transaction data**, not hand‑written — see [`data/README.md`](data/README.md).

## Project structure

```
ecommerce/
├── data/                 # Data-cleaning pipeline (plain Node, no deps)
│   ├── clean.js          #   cleans raw -> products.json + orders_clean.csv + report
│   ├── lib/csv.js        #   tiny CSV parse/stringify
│   ├── raw/              #   raw input (the client's real export)
│   └── clean/            #   cleaned outputs (consumed by the API)
├── backend/              # Express + Mongoose API
│   └── src/
│       ├── server.js     #   app entry
│       ├── db.js         #   Mongo connection (+ zero-config in-memory fallback)
│       ├── seed.js       #   loads data/clean/products.json into Mongo
│       ├── models/       #   Product schema
│       └── routes/       #   /api/products endpoints
├── frontend/             # Angular app (standalone components, signals)
│   └── src/app/
│       ├── pages/        #   product-list, product-detail, cart
│       ├── components/   #   product-card, product-image
│       └── services/     #   product.service, cart.service
├── docker-compose.yml    # Optional local MongoDB
└── package.json          # Convenience scripts
```

## Prerequisites

- **Node.js 18+** and npm
- **MongoDB** — optional. If you don't set `MONGODB_URI`, the backend starts a throwaway in‑memory MongoDB automatically (it downloads a small binary on first run). For a persistent database use Docker or MongoDB Atlas (below).

## Quick start

From the repository root:

```bash
# 1. Install dependencies for both apps
npm run install:all

# 2. (Optional) re-run the data cleaning — outputs are already committed
npm run data

# 3. Start the API  (terminal 1)
npm run start:backend      # http://localhost:3000

# 4. Start the frontend  (terminal 2)
npm run start:frontend     # http://localhost:4200
```

Open **http://localhost:4200**. With no `MONGODB_URI`, the API spins up an in‑memory MongoDB and auto‑seeds the 38 products on startup — no database setup required.

## Using a persistent MongoDB

Pick either option, then create `backend/.env` from `backend/.env.example`.

**Docker:**

```bash
docker compose up -d mongo
echo "MONGODB_URI=mongodb://127.0.0.1:27017" > backend/.env
npm run seed            # load the catalog into Mongo
npm run start:backend
```

**MongoDB Atlas:** set `MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net` in `backend/.env`, then `npm run seed`.

## API

Base URL: `http://localhost:3000/api`

| Method & path | Description |
| --- | --- |
| `GET /health` | Health check |
| `GET /products` | List products. Query: `category`, `search`, `sort` (`name`, `price-asc`, `price-desc`, `rating`, `popular`), `page`, `limit`. Returns `{ items, total, page, limit, pages }`. |
| `GET /products/categories` | Categories with product counts |
| `GET /products/:id` | One product by SKU id **or** slug |

Example:

```bash
curl "http://localhost:3000/api/products?category=Electronics&sort=price-desc&limit=3"
curl "http://localhost:3000/api/products/wireless-mouse"
```

## Data cleaning

`data/clean.js` cleans the real UrbanSouq orders/returns export (`data/raw/orders_raw.csv`, ~940 rows). The dataset has **no product‑level identity** — its only product dimension is the category — so the catalog is derived at the **category** level, with each category enriched by real aggregated stats. Current run:

- **940 → 913** clean transaction rows (removed 27 duplicate lines)
- Normalised category (18 spellings → 6), order status (15 → 5), issue reason and data source, and **city names across Arabic⇄English, typos and separators** (62 → 15, e.g. `cair0` / `القاهرة` → Cairo)
- Rejected sentinel/garbage numerics (`-999`, `1000000`) and out‑of‑range values
- Derived **6 category products** with median price, average rating, units sold, return rate, average delivery time and top city/channel/return‑reason

See [`data/README.md`](data/README.md) and the generated [`data/clean/cleaning_report.md`](data/clean/cleaning_report.md). **To use a different dataset**, replace `data/raw/orders_raw.csv` and adjust the column mapping in `clean.js` (documented in data/README).

## Notes for the client

- The product images are clean generated placeholders (accent colour + initials) — no external assets. Swap in real photos by adding an `image` URL to each product.
- Currency is set in one place: `STORE_CURRENCY` in `frontend/src/app/pipes/money.pipe.ts` (currently `EGP`).
- The cart is frontend‑only (state in a signal, mirrored to `localStorage`); there is no orders backend by design.

## Tech

Angular 22 · TypeScript · Node.js · Express · MongoDB / Mongoose
