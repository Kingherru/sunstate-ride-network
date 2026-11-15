export type CartCourse = { id: string; slug: string; title: string; price_cents: number; price_id: string | null; product_kind?: string };
export function eligibleCartItems(items: CartCourse[], ownedIds: readonly string[]) {
  const owned = new Set(ownedIds);
  return items.filter((item, index) => Number.isInteger(item.price_cents) && item.price_cents >= 0 && !owned.has(item.id) && items.findIndex(c => c.id === item.id) === index);
}
export function ownsEnrollment(enrollment: { user_id: string } | null, userId: string) {
  return !!enrollment && enrollment.user_id === userId;
}