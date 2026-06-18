import { Pipe, PipeTransform } from '@angular/core';

/** Store currency. Change this in one place to re-brand the catalog. */
export const STORE_CURRENCY = 'EGP';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: STORE_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  transform(value: number | null | undefined): string {
    return this.fmt.format(value ?? 0);
  }
}
