# shop-app

Small storefront service: cart pricing, order placement, and an HTTP layer.

```
src/
  cart.js        line totals, discounts, and the payable amount
  pricing.js     tax and shipping rules
  api/routes.js  HTTP handlers
  web/views.js   server-rendered views
test/
  cart.test.js
  pricing.test.js
```

## Running

```bash
npm test
```

## Conventions

- Every behaviour change lands with a test that failed before the change.
- Decisions worth remembering go in `.agents/notes/` as one file per decision.
