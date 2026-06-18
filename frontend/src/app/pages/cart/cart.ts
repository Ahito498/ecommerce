import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartService } from '../../services/cart.service';
import { ProductImage } from '../../components/product-image/product-image';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, ProductImage, MoneyPipe],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  protected readonly cart = inject(CartService);

  changeQty(productId: string, quantity: number): void {
    this.cart.setQuantity(productId, quantity);
  }

  remove(productId: string): void {
    this.cart.remove(productId);
  }

  clear(): void {
    this.cart.clear();
  }
}
