export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// "Spend 100, save 20" applies to the whole cart.
export function total(items) {
  const sum = subtotal(items);
  return sum >= 100 ? sum - 20 : sum;
}
