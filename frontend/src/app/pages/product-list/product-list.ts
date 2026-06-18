import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ProductService } from '../../services/product.service';
import { CategoryCount, Product } from '../../models/product';
import { ProductCard } from '../../components/product-card/product-card';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'price-asc', label: 'Price (low → high)' },
  { value: 'price-desc', label: 'Price (high → low)' },
  { value: 'rating', label: 'Top rated' },
  { value: 'popular', label: 'Best selling' },
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
  readonly categories = signal<CategoryCount[]>([]);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly category = signal('all');
  readonly search = signal('');
  readonly sort = signal('name');
  readonly page = signal(1);

  readonly pageList = computed(() =>
    Array.from({ length: this.pages() }, (_, i) => i + 1)
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadCategories();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.productService
      .list({
        category: this.category(),
        search: this.search(),
        sort: this.sort(),
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.items);
          this.total.set(res.total);
          this.pages.set(res.pages);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load products. Make sure the API is running on port 3000.');
          this.loading.set(false);
        },
      });
  }

  private loadCategories(): void {
    this.productService.categories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  setCategory(category: string): void {
    this.category.set(category);
    this.page.set(1);
    this.load();
  }

  onSortChange(value: string): void {
    this.sort.set(value);
    this.page.set(1);
    this.load();
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages() || p === this.page()) return;
    this.page.set(p);
    this.load();
  }
}
