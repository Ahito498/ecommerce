import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { connectDB, disconnectDB } from './db.js';
import { Product } from './models/product.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The catalog produced by the data-cleaning pipeline.
const PRODUCTS_PATH = path.resolve(__dirname, '../../data/clean/products.json');

export async function loadProducts() {
  const raw = await readFile(PRODUCTS_PATH, 'utf8');
  return JSON.parse(raw);
}

/** Seed the catalog only if the collection is empty (used on server startup). */
export async function ensureSeeded() {
  const count = await Product.countDocuments();
  if (count > 0) return count;
  const products = await loadProducts();
  await Product.insertMany(products);
  console.log(`✓  Seeded ${products.length} products (collection was empty).`);
  return products.length;
}

// When run directly (`npm run seed`): drop and re-insert the whole catalog.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  (async () => {
    if (!process.env.MONGODB_URI) {
      console.warn('Note: MONGODB_URI is not set, so this seeds an ephemeral in-memory DB and has no lasting effect.');
      console.warn('      Set MONGODB_URI to seed a persistent database. (The server also auto-seeds when empty.)');
    }
    await connectDB();
    const products = await loadProducts();
    await Product.deleteMany({});
    await Product.insertMany(products);
    console.log(`✓  Reseeded ${products.length} products.`);
    await disconnectDB();
    process.exit(0);
  })().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
