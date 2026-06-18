import { Component, computed, input } from '@angular/core';

/**
 * Lightweight placeholder image rendered as inline SVG. The generated catalog
 * has no real photos, so each product gets a clean accent-coloured tile with
 * its initials — no external assets or network requests.
 */
@Component({
  selector: 'app-product-image',
  template: `
    <svg
      class="ph"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      [attr.aria-label]="name()"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="400" height="300" [attr.fill]="accent()" />
      <circle cx="330" cy="58" r="130" fill="#ffffff" opacity="0.12" />
      <circle cx="60" cy="260" r="90" fill="#000000" opacity="0.08" />
      <text
        x="200"
        y="158"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="104"
        font-weight="700"
        fill="#ffffff"
        opacity="0.95"
        font-family="Inter, system-ui, sans-serif"
      >
        {{ initials() }}
      </text>
    </svg>
  `,
  styles: `
    :host { display: block; line-height: 0; }
    .ph { width: 100%; height: 100%; display: block; }
  `,
})
export class ProductImage {
  readonly name = input.required<string>();
  readonly accent = input<string>('#475569');

  readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  );
}
