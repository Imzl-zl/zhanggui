import { round2, shippingFor, taxFor } from './pricing.js';

export function lineTotal(item) {
  return round2(item.price * item.quantity);
}

export function subtotal(items) {
  return round2(items.reduce((sum, item) => sum + lineTotal(item), 0));
}

export function discountAmount(items, couponPercent) {
  return round2(subtotal(items) * (couponPercent / 100));
}

export function discountedSubtotal(items, couponPercent) {
  return round2(subtotal(items) - discountAmount(items, couponPercent));
}

export function payableTotal(items, couponPercent = 0) {
  const gross = subtotal(items);
  const net = discountedSubtotal(items, couponPercent);
  return round2(net + taxFor(gross) + shippingFor(gross));
}
