import { cartSummary } from '../api/routes.js';

export function renderCart(items, coupon) {
  const summary = cartSummary(items, coupon);
  const lines = items.map(item => `  <li>${item.sku} x${item.quantity}</li>`).join('\n');
  return [
    '<section class="cart">',
    '  <ul>',
    lines,
    '  </ul>',
    `  <p class="payable">${summary.payable.toFixed(2)} ${summary.currency}</p>`,
    '</section>',
  ].join('\n');
}
