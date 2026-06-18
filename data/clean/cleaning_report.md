# Data Cleaning Report

Generated from `data/raw/orders_raw.csv` by `data/clean.js`.

## Summary

| Metric | Value |
| --- | ---: |
| Raw rows read | 940 |
| Dropped — missing order id | 6 |
| Dropped — unresolvable product | 9 |
| Duplicate lines removed | 46 |
| **Clean transaction rows** | **879** |
| Products derived | 38 |
| Categories normalised to | 8 |

## Field-level fixes

| Fix | Count |
| --- | ---: |
| Product names normalised (case/spacing/punctuation) | 399 |
| Category labels normalised | 705 |
| Prices re-parsed from currency/comma formats | 328 |
| Prices imputed (missing/invalid → product median) | 83 |
| Prices rejected as invalid (≤0 or outlier) | 15 |
| Quantities imputed (missing → 1) | 55 |
| Quantities clamped (invalid → 1) | 30 |
| Dates left blank (unparseable) | 0 |
| Return reasons cleared (set on non-returns) | 31 |
| Return reasons filled ("Unspecified") | 18 |

## Canonical categories

- Beauty (4 products)
- Books (3 products)
- Electronics (8 products)
- Fashion (6 products)
- Grocery (4 products)
- Home & Kitchen (6 products)
- Sports (4 products)
- Toys (3 products)

## Outputs

- `clean/orders_clean.csv` — 879 analysis-ready rows
- `clean/products.json` — 38 products consumed by the API
