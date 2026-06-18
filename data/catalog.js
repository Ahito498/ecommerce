'use strict';

/**
 * Product master (display metadata).
 *
 * In a real store this is the canonical product table maintained by the
 * merchandising team. The order/return transactions are noisy references to
 * these products. The cleaning pipeline normalises the transactions and then
 * joins back to this master to enrich the derived catalog with a description
 * and an accent colour for the placeholder image.
 *
 * `price` here is only the seed used to generate realistic (and intentionally
 * messy) transaction prices; the price the app actually shows is re-derived
 * from the cleaned transactions to prove the cleaning worked.
 */

const ACCENTS = {
  Electronics: '#2563eb',
  'Home & Kitchen': '#0d9488',
  Fashion: '#db2777',
  Beauty: '#9333ea',
  Sports: '#ea580c',
  Books: '#ca8a04',
  Toys: '#dc2626',
  Grocery: '#16a34a',
};

const PRODUCTS = [
  // Electronics
  { sku: 'ELC-001', name: 'Wireless Mouse', category: 'Electronics', price: 199.0, description: 'A lightweight wireless mouse with silent clicks and a precise optical sensor for everyday work and play.' },
  { sku: 'ELC-002', name: 'Mechanical Keyboard', category: 'Electronics', price: 549.0, description: 'A tactile mechanical keyboard with hot-swappable switches and per-key backlighting.' },
  { sku: 'ELC-003', name: 'Bluetooth Headphones', category: 'Electronics', price: 799.0, description: 'Over-ear Bluetooth headphones with active noise cancellation and 30 hours of battery life.' },
  { sku: 'ELC-004', name: 'USB-C Charger', category: 'Electronics', price: 149.0, description: 'A compact 65W USB-C charger that fast-charges phones, tablets and laptops.' },
  { sku: 'ELC-005', name: '4K Monitor', category: 'Electronics', price: 2499.0, description: 'A 27-inch 4K UHD monitor with accurate colours and an ergonomic adjustable stand.' },
  { sku: 'ELC-006', name: 'HD Webcam', category: 'Electronics', price: 329.0, description: 'A 1080p HD webcam with auto-focus and a built-in noise-reducing microphone.' },
  { sku: 'ELC-007', name: 'Power Bank 20000mAh', category: 'Electronics', price: 279.0, description: 'A 20000mAh power bank with dual USB outputs and fast pass-through charging.' },
  { sku: 'ELC-008', name: 'Smart Watch', category: 'Electronics', price: 1199.0, description: 'A smart watch with heart-rate tracking, GPS and a bright always-on display.' },

  // Home & Kitchen
  { sku: 'HOM-001', name: 'Ceramic Mug Set', category: 'Home & Kitchen', price: 159.0, description: 'A set of four hand-glazed ceramic mugs, microwave and dishwasher safe.' },
  { sku: 'HOM-002', name: 'Stainless Steel Pan', category: 'Home & Kitchen', price: 389.0, description: 'A tri-ply stainless steel frying pan with even heat distribution and a stay-cool handle.' },
  { sku: 'HOM-003', name: 'Electric Kettle', category: 'Home & Kitchen', price: 249.0, description: 'A 1.7L electric kettle with rapid boil and automatic shut-off.' },
  { sku: 'HOM-004', name: 'Knife Block Set', category: 'Home & Kitchen', price: 459.0, description: 'A six-piece knife block set forged from high-carbon stainless steel.' },
  { sku: 'HOM-005', name: 'Air Fryer', category: 'Home & Kitchen', price: 899.0, description: 'A 5.5L air fryer that cooks crispy food with little to no oil.' },
  { sku: 'HOM-006', name: 'Glass Storage Jars', category: 'Home & Kitchen', price: 129.0, description: 'A set of airtight glass storage jars with bamboo lids for a tidy pantry.' },

  // Fashion
  { sku: 'FSH-001', name: 'Cotton T-Shirt', category: 'Fashion', price: 119.0, description: 'A soft 100% cotton crew-neck t-shirt with a relaxed everyday fit.' },
  { sku: 'FSH-002', name: 'Denim Jacket', category: 'Fashion', price: 549.0, description: 'A classic denim jacket with a washed finish and durable stitching.' },
  { sku: 'FSH-003', name: 'Running Shoes', category: 'Fashion', price: 699.0, description: 'Breathable running shoes with responsive cushioning and a grippy outsole.' },
  { sku: 'FSH-004', name: 'Leather Wallet', category: 'Fashion', price: 229.0, description: 'A slim genuine-leather wallet with RFID-blocking card slots.' },
  { sku: 'FSH-005', name: 'Wool Scarf', category: 'Fashion', price: 179.0, description: 'A warm merino-wool scarf that is soft against the skin and not itchy.' },
  { sku: 'FSH-006', name: 'Baseball Cap', category: 'Fashion', price: 99.0, description: 'An adjustable cotton baseball cap with a curved brim and breathable eyelets.' },

  // Beauty
  { sku: 'BTY-001', name: 'Vitamin C Serum', category: 'Beauty', price: 189.0, description: 'A brightening vitamin C serum that evens skin tone and boosts radiance.' },
  { sku: 'BTY-002', name: 'Matte Lipstick', category: 'Beauty', price: 89.0, description: 'A long-wearing matte lipstick with rich, full-coverage colour.' },
  { sku: 'BTY-003', name: 'Facial Cleanser', category: 'Beauty', price: 129.0, description: 'A gentle gel facial cleanser that removes dirt and oil without stripping the skin.' },
  { sku: 'BTY-004', name: 'Hair Dryer', category: 'Beauty', price: 399.0, description: 'A fast-drying ionic hair dryer with multiple heat and speed settings.' },

  // Sports
  { sku: 'SPT-001', name: 'Yoga Mat', category: 'Sports', price: 169.0, description: 'A non-slip 6mm yoga mat with cushioning that protects the joints.' },
  { sku: 'SPT-002', name: 'Dumbbell Set', category: 'Sports', price: 599.0, description: 'An adjustable dumbbell set that replaces a full rack of free weights.' },
  { sku: 'SPT-003', name: 'Water Bottle', category: 'Sports', price: 109.0, description: 'A 750ml insulated stainless steel bottle that keeps drinks cold for 24 hours.' },
  { sku: 'SPT-004', name: 'Resistance Bands', category: 'Sports', price: 139.0, description: 'A set of five resistance bands for strength training and mobility work.' },

  // Books
  { sku: 'BOK-001', name: 'The Everyday Cookbook', category: 'Books', price: 149.0, description: 'A cookbook of 120 quick weeknight recipes with simple, affordable ingredients.' },
  { sku: 'BOK-002', name: 'Echoes of Tomorrow', category: 'Books', price: 119.0, description: 'A gripping science-fiction novel about a crew who wakes far from home.' },
  { sku: 'BOK-003', name: 'The Focus Method', category: 'Books', price: 129.0, description: 'A practical productivity guide for building deep-work habits that last.' },

  // Toys
  { sku: 'TOY-001', name: 'Building Blocks Set', category: 'Toys', price: 219.0, description: 'A 250-piece building blocks set that sparks creativity for ages 4 and up.' },
  { sku: 'TOY-002', name: 'Plush Teddy Bear', category: 'Toys', price: 129.0, description: 'A huggable 40cm plush teddy bear made from soft, hypoallergenic fabric.' },
  { sku: 'TOY-003', name: 'Remote Control Car', category: 'Toys', price: 349.0, description: 'A fast 2.4GHz remote control car with all-terrain grip and a rechargeable battery.' },

  // Grocery
  { sku: 'GRO-001', name: 'Organic Honey', category: 'Grocery', price: 99.0, description: 'A jar of raw organic honey, unfiltered and sourced from local apiaries.' },
  { sku: 'GRO-002', name: 'Green Tea', category: 'Grocery', price: 79.0, description: 'A box of 50 whole-leaf green tea bags with a smooth, fresh finish.' },
  { sku: 'GRO-003', name: 'Olive Oil', category: 'Grocery', price: 189.0, description: 'A 750ml bottle of cold-pressed extra-virgin olive oil with a fruity aroma.' },
  { sku: 'GRO-004', name: 'Dark Chocolate', category: 'Grocery', price: 69.0, description: 'A 70% cocoa dark chocolate bar, rich and not too sweet.' },
];

module.exports = { PRODUCTS, ACCENTS };
