# ecommerce (working title)

A small but complete storefront demo: an **Angular** frontend, a **Node.js + Express + MongoDB** products API, and a **data‑cleaning pipeline** that turns a messy orders/returns dataset into the clean product catalog the app serves.

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
├── data/                 # Data generation + cleaning pipeline (plain Node, no deps)
│   ├── catalog.js        #   product master (display metadata)
│   ├── generate-raw.js   #   creates a messy orders/returns CSV (~940 rows)
│   ├── clean.js          #   cleans it -> products.json + orders_clean.csv + report
│   ├── raw/              #   generated input
│   └── clean/            #   generated outputs (consumed by the API)
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

# 2. (Optional) regenerate the cleaned data — outputs are already committed
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

The brief was to clean an orders/returns dataset before using it. Since no real file was provided, `data/generate-raw.js` produces a realistic, **intentionally messy** dataset (~940 rows) and `data/clean.js` cleans it. The pipeline is deterministic (seeded), so re‑running yields the same files. Current run:

- **940 → 879** clean transaction rows
- Dropped **6** rows with no order id + **9** with an unresolvable product; removed **46** duplicate lines
- Normalised hundreds of inconsistent product names, category labels and price formats; imputed missing prices from each product's median
- Derived **38** products across **8** categories

See [`data/README.md`](data/README.md) and the generated [`data/clean/cleaning_report.md`](data/clean/cleaning_report.md). **To use a real dataset**, drop it in and point `clean.js` at it (the column mapping is documented there).

## Notes for the client

- The product images are clean generated placeholders (accent colour + initials) — no external assets. Swap in real photos by adding an `image` URL to each product.
- Currency is set in one place: `STORE_CURRENCY` in `frontend/src/app/pipes/money.pipe.ts` (currently `EGP`).
- The cart is frontend‑only (state in a signal, mirrored to `localStorage`); there is no orders backend by design.

## Tech

Angular 22 · TypeScript · Node.js · Express · MongoDB / Mongoose
