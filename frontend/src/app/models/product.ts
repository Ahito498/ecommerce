export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  description: string;
  accentColor: string;
  rating: number;
  ratingCount: number;
  stock: number;
  unitsSold: number;
  returnRate: number;
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
