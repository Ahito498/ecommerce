import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { CategoryCount, Product, ProductPage, ProductQuery } from '../models/product';

/**
 * Talks to the products API. Requests use the relative "/api" path, which the
 * Angular dev server proxies to the backend (see proxy.conf.json).
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/products';

  list(query: ProductQuery = {}): Observable<ProductPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<ProductPage>(this.base, { params });
  }

  get(idOrSlug: string): Observable<Product> {
    return this.http.get<Product>(`${this.base}/${idOrSlug}`);
  }

  categories(): Observable<CategoryCount[]> {
    return this.http.get<CategoryCount[]>(`${this.base}/categories`);
  }
}
