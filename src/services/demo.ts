import { getDb } from "@/mock/load";

/**
 * Demo-only controls (Settings → Demo, P28). Not part of the future API.
 * After `resetDemoData`, the caller clears the React Query cache.
 */
export async function resetDemoData() {
  const { reset } = await getDb();
  reset();
}

/**
 * Generate everything in the background (e.g. after login) so the first
 * visit to a heavy page doesn't wait for ride generation.
 */
export async function warmUpDemoData() {
  const { db } = await getDb();
  void db.ix.rides;
  void db.ix.support;
  void db.ix.documents;
  void db.ix.finance;
}
