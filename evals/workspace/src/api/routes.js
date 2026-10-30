import { payableTotal, subtotal } from '../cart.js';

export function cartSummary(items, coupon) {
  return {
    subtotal: subtotal(items),
    payable: payableTotal(items, coupon),
    currency: 'CNY',
  };
}

export function handleCartSummary(request) {
  const { items = [], coupon = 0 } = request.body ?? {};
  return { status: 200, body: cartSummary(items, coupon) };
}
