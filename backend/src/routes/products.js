import { Router } from 'express';
import { Product } from '../models/product.js';

const router = Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  name: { name: 1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  rating: { rating: -1 },
  popular: { unitsSold: -1 },
};

/**
 * GET /api/products
 * Query: category, search, sort, page, limit
 * Returns a paginated list: { items, total, page, limit, pages }.
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, search, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));

    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ name: rx }, { description: rx }, { category: rx }];
    }

    const sortBy = SORTS[sort] || SORTS.name;
    const [items, total] = await Promise.all([
      Product.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/categories
 * Returns [{ category, count }] for building the category filter.
 * Declared before "/:id" so it is not captured by the id param.
 */
router.get('/categories', async (_req, res, next) => {
  try {
    const rows = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(rows.map((r) => ({ category: r._id, count: r.count })));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * Looks up by SKU id or slug.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ $or: [{ id }, { slug: id }] });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

export default router;
