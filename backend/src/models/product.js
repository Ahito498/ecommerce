import mongoose from 'mongoose';

/**
 * Catalog entry. The source dataset has no product-level identity, so each
 * entry represents a product CATEGORY, enriched with real aggregated stats
 * from the cleaned order/return transactions (see data/clean.js).
 * `id` is the category slug and is the public identifier used by the API/UI.
 */
const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true, index: true },
    tagline: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    priceMin: { type: Number, default: 0 },
    priceMax: { type: Number, default: 0 },
    description: { type: String, default: '' },
    accentColor: { type: String, default: '#475569' },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    unitsSold: { type: Number, default: 0 },
    returnRate: { type: Number, default: 0 },
    avgDeliveryDays: { type: Number, default: 0 },
    topIssue: { type: String, default: '' },
    topCity: { type: String, default: '' },
    topChannel: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        delete ret._id;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
      },
    },
  }
);

export const Product = mongoose.model('Product', productSchema);
