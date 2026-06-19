export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string;
  price: number;
  priceMin: number;
  priceMax: number;
  description: string;
  accentColor: string;
  rating: number;
  ratingCount: number;
  orders: number;
  unitsSold: number;
  returnRate: number;
  avgDeliveryDays: number;
  topIssue: string;
  topCity: string;
  topChannel: string;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface ProductQuery {
  category?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
