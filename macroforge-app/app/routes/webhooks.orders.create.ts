import { type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { productMetaProfiles, productBatches, batchLosses, batchWaitlists, activityLogs } from "~/db/schema";
import { eq, and, gt, lt, gte, asc } from "drizzle-orm";

export async function action({ request }: ActionFunctionArgs) {
  // 1. Authenticate the incoming webhook from Shopify
  const { shop, topic, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize time for accurate date comparisons
  const todayStr = today.toISOString().split("T")[0];

  // 2. Automatic Expiry Sweep: Archive any expired batches with remaining stock into losses
  const expiredBatches = await db
    .select()
    .from(productBatches)
    .where(
      and(
        eq(productBatches.shopDomain, shop),
        lt(productBatches.expiryDate, today),
        gt(productBatches.remainingQuantity, 0)
      )
    );

  for (const batch of expiredBatches) {
    const profileMatch = await db
      .select()
      .from(productMetaProfiles)
      .where(
        and(
          eq(productMetaProfiles.shopDomain, shop),
          eq(productMetaProfiles.shopifyProductId, batch.productId)
        )
      )
      .limit(1);

    const productProfileId = profileMatch.length ? profileMatch[0].id : 0;

    if (productProfileId) {
      await db.insert(batchLosses).values({
        shopDomain: shop,
        productProfileId,
        batchNumber: batch.batchNumber,
        quantityLost: batch.remainingQuantity,
        preparedDate: batch.productionDate.toISOString().split("T")[0],
        expirationDate: batch.expiryDate ? batch.expiryDate.toISOString().split("T")[0] : todayStr,
        reason: "EXPIRED_SPOILAGE",
      });
    }

    await db.delete(productBatches).where(eq(productBatches.id, batch.id));
    console.log(`Archived expired batch ${batch.batchNumber} to losses. Quantity lost: ${batch.remainingQuantity}`);
  }

  const lineItems = payload.line_items || [];
  const customerEmail = payload.email || payload.contact_email;

  for (const item of lineItems) {
    const shopifyProductId = `gid://shopify/Product/${item.product_id}`;
    const orderedQuantity = item.quantity;

    // Find the master product profile id matching this Shopify product
    const profile = await db
      .select()
      .from(productMetaProfiles)
      .where(
        and(
          eq(productMetaProfiles.shopDomain, shop),
          eq(productMetaProfiles.shopifyProductId, shopifyProductId)
        )
      )
      .limit(1);

    if (!profile.length) continue;
    const productTitle = profile[0].title;

    // Fetch active batches sorted by FIFO, strictly requiring expiration date to be today or later
    const activeBatches = await db
      .select()
      .from(productBatches)
      .where(
        and(
          eq(productBatches.shopDomain, shop),
          eq(productBatches.productId, shopifyProductId),
          gt(productBatches.remainingQuantity, 0),
          gte(productBatches.expiryDate, today)
        )
      )
      .orderBy(asc(productBatches.expiryDate));

    // GRACEFUL FALLBACK & WAITLIST CAPTURE: Handle unbatched or stock-exhausted sales
    if (activeBatches.length === 0) {
      console.warn(`[FIFO Warning] Order received for "${productTitle}", but no active production batches found! Adding customer to waitlist.`);
      
      await db.insert(activityLogs).values({
        shopDomain: shop,
        actionType: "UNBATCHED_SALE",
        description: `Sold ${orderedQuantity} unit(s) of "${productTitle}" with zero active production batches in inventory. Customer added to waitlist.`,
      });

      if (customerEmail) {
        await db.insert(batchWaitlists).values({
          shopDomain: shop,
          productId: shopifyProductId,
          productTitle,
          customerEmail,
          quantity: orderedQuantity,
          status: "waiting",
        });
      }

      continue;
    }

    let remainingToAllocate = orderedQuantity;

    // Deduct inventory across batches using FIFO logic matching schema fields
    for (const batch of activeBatches) {
      if (remainingToAllocate <= 0) break;

      const deductAmount = Math.min(batch.remainingQuantity, remainingToAllocate);
      const newRemaining = batch.remainingQuantity - deductAmount;

      await db
        .update(productBatches)
        .set({ 
          remainingQuantity: newRemaining,
          isActive: newRemaining > 0 
        })
        .where(eq(productBatches.id, batch.id));

      remainingToAllocate -= deductAmount;
      console.log(`Allocated ${deductAmount} units from batch ${batch.batchNumber}. Remaining stock: ${newRemaining}`);
    }

    // If demand exceeded current available batch stock, capture the remaining unfulfilled portion into the waitlist
    if (remainingToAllocate > 0 && customerEmail) {
      await db.insert(batchWaitlists).values({
        shopDomain: shop,
        productId: shopifyProductId,
        productTitle,
        customerEmail,
        quantity: remainingToAllocate,
        status: "waiting",
      });

      console.log(`Demand exceeded active batches for "${productTitle}". Added remaining ${remainingToAllocate} units' demand to waitlist for ${customerEmail}.`);
    }
  }

  return new Response("Webhook processed successfully", { status: 200 });
}