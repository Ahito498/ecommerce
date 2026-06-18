import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Product } from '../../models/product';
import { CartService } from '../../services/cart.service';
import { ProductImage } from '../product-image/product-image';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, ProductImage, MoneyPipe],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly added = signal(false);

  private readonly cart = inject(CartService);
  private timer?: ReturnType<typeof setTimeout>;

  addToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add(this.product());
    this.added.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.added.set(false), 1200);
  }
}
