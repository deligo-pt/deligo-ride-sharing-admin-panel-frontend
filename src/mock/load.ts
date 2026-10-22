/**
 * Services get the database through this dynamic import so faker, the
 * generators and the data load as a separate chunk on the first request —
 * never in a page's first-load JS (§H budget: ≤ 220 kB gz per route).
 */
export async function getDb() {
  const mod = await import("./db");
  return mod;
}
