import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { ProductCard } from '../../components/product-card/product-card';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most orders' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price-asc', label: 'Price (low → high)' },
  { value: 'price-desc', label: 'Price (high → low)' },
  { value: 'name', label: 'Name (A–Z)' },
];

@Component({
  selector: 'app-product-list',
  imports: [ProductCard],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductList implements OnInit {
  private readonly productService = inject(ProductService);

  readonly sortOptions = SORT_OPTIONS;

  readonly products = signal<Product[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly search = signal('');
  readonly sort = signal('popular');

  readonly totalOrders = computed(() => this.products().reduce((n, p) => n + p.orders, 0));

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.productService.list({ search: this.search(), sort: this.sort(), limit: 50 }).subscribe({
      next: (res) => {
        this.products.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load products. Make sure the API is running on port 3000.');
        this.loading.set(false);
      },
    });
  }

  onSortChange(value: string): void {
    this.sort.set(value);
    this.load();
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }
}
