import { Injectable, computed, effect, signal } from '@angular/core';
import { Product } from '../models/product';

export interface CartLine {
  product: Product;
  quantity: number;
}

const STORAGE_KEY = 'ecommerce.cart';

/**
 * Client-side shopping cart. State lives in a signal and is mirrored to
 * localStorage so it survives a page refresh. There is no backend order
 * system — the cart is purely a frontend concern, as scoped.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _lines = signal<CartLine[]>(this.restore());

  /** Read-only view of the cart lines. */
  readonly lines = this._lines.asReadonly();

  /** Total number of items (sum of quantities). */
  readonly count = computed(() => this._lines().reduce((n, l) => n + l.quantity, 0));

  /** Cart subtotal in the store currency. */
  readonly subtotal = computed(() =>
    this._lines().reduce((sum, l) => sum + l.product.price * l.quantity, 0)
  );

  constructor() {
    // Persist on every change.
    effect(() => this.persist(this._lines()));
  }

  add(product: Product, quantity = 1): void {
    this._lines.update((lines) => {
      const existing = lines.find((l) => l.product.id === product.id);
      if (existing) {
        return lines.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: clampStock(l.quantity + quantity, product) }
            : l
        );
      }
      return [...lines, { product, quantity: clampStock(quantity, product) }];
    });
  }

  setQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    this._lines.update((lines) =>
      lines.map((l) =>
        l.product.id === productId
          ? { ...l, quantity: clampStock(quantity, l.product) }
          : l
      )
    );
  }

  remove(productId: string): void {
    this._lines.update((lines) => lines.filter((l) => l.product.id !== productId));
  }

  clear(): void {
    this._lines.set([]);
  }

  private restore(): CartLine[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(lines: CartLine[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore storage failures (e.g. private mode) */
    }
  }
}

function clampStock(quantity: number, product: Product): number {
  const max = product.stock > 0 ? product.stock : quantity;
  return Math.max(1, Math.min(quantity, max));
}
