export function discountFor(total) {
  if (total >= 100) return Math.round(total * 0.1);
  return 0;
}
