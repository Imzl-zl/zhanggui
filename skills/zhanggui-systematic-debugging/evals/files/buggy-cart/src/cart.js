export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// The "spend 100, save 20" rule is meant to look at the whole cart, but this
// reads the first line item instead.
export function total(items) {
  const [first] = items;
  const discount = first && first.price * first.qty >= 100 ? 20 : 0;
  return subtotal(items) - discount;
}
