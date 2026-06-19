import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product';
import { ProductImage } from '../../components/product-image/product-image';
import { ProductCard } from '../../components/product-card/product-card';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, ProductImage, ProductCard, MoneyPipe],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly cart = inject(CartService);

  readonly product = signal<Product | null>(null);
  readonly related = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly quantity = signal(1);
  readonly added = signal(false);

  private addedTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.fetch(id);
    });
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.product.set(null);
    this.quantity.set(1);
    this.added.set(false);

    this.productService.get(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.loading.set(false);
        this.loadRelated(product);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadRelated(product: Product): void {
    this.productService.list({ limit: 50 }).subscribe({
      next: (res) => this.related.set(res.items.filter((p) => p.id !== product.id).slice(0, 4)),
      error: () => this.related.set([]),
    });
  }

  changeQuantity(delta: number): void {
    this.quantity.update((q) => Math.max(1, Math.min(q + delta, 99)));
  }

  addToCart(): void {
    const product = this.product();
    if (!product) return;
    this.cart.add(product, this.quantity());
    this.added.set(true);
    clearTimeout(this.addedTimer);
    this.addedTimer = setTimeout(() => this.added.set(false), 1600);
  }
}
