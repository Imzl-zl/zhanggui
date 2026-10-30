export const TAX_RATE = 0.1;
export const FREE_SHIPPING_THRESHOLD = 50;
export const STANDARD_SHIPPING = 4.99;

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function taxFor(amount) {
  return round2(amount * TAX_RATE);
}

export function shippingFor(amount) {
  return amount >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
}
