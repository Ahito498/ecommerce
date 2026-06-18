import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectDB } from './db.js';
import { ensureSeeded } from './seed.js';
import productsRouter from './routes/products.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/products', productsRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Centralised error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  await connectDB();
  await ensureSeeded();
  app.listen(PORT, () => console.log(`✓  API listening on http://localhost:${PORT}`));
})().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
