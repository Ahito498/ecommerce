import mongoose from 'mongoose';

/**
 * Product catalog entry. Mirrors the objects produced by the data-cleaning
 * pipeline (data/clean/products.json). `id` is the human-readable SKU and is
 * the public identifier used by the API and the frontend.
 */
const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    accentColor: { type: String, default: '#475569' },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    unitsSold: { type: Number, default: 0 },
    returnRate: { type: Number, default: 0 },
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
