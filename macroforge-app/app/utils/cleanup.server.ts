import { db } from "../db.server";
import { activityLogs } from "../db/schema";
import { and, eq, lt } from "drizzle-orm";

// In-memory tracker to prevent running cleanup on every single request
const lastCleanupMap = new Map<string, number>();

export function runBackgroundLogCleanup(shopDomain: string) {
  const now = Date.now();
  const lastRun = lastCleanupMap.get(shopDomain) || 0;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Skip if cleanup already ran for this shop within the last 24 hours
  if (now - lastRun < TWENTY_FOUR_HOURS) {
    return;
  }

  // Update timestamp immediately to prevent duplicate concurrent triggers
  lastCleanupMap.set(shopDomain, now);

  // Run asynchronously in the background loop without blocking the main request
  setImmediate(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await db
        .delete(activityLogs)
        .where(
          and(
            eq(activityLogs.shopDomain, shopDomain),
            lt(activityLogs.createdAt, thirtyDaysAgo)
          )
      );

      console.log(`[Background Cleanup] Purged activity logs older than 30 days for ${shopDomain}`);
    } catch (error) {
      console.error(`[Background Cleanup] Failed to purge logs for ${shopDomain}:`, error);
      // Reset tracker on failure so it can retry later
      lastCleanupMap.delete(shopDomain);
    }
  });
}