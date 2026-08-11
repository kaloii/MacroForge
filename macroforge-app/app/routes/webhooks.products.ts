import { type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "~/db.server";
import { productMetaProfiles } from "~/db/schema";
import { eq, and } from "drizzle-orm";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    return new Response();
  }

  // Handle product creation or updates
  if (topic === "products/create" || topic === "products/update") {
    const product = payload;
    
    const shopDomain = shop;
    const productId = product.id.toString();
    const title = product.title;
    const handle = product.handle;

    // Optional: Extract macro metafields if they are attached to the product, 
    // or set smart defaults so the product immediately appears in recommendations.
    // Assuming custom metafields exist, otherwise fallback to 0:
    const proteinGrams = product.metafields?.find((m: any) => m.key === 'protein')?.value || 0;
    const carbGrams = product.metafields?.find((m: any) => m.key === 'carbs')?.value || 0;
    const fatGrams = product.metafields?.find((m: any) => m.key === 'fat')?.value || 0;
    const calories = product.metafields?.find((m: any) => m.key === 'calories')?.value || 0;
    
    // Default fallback diet type if not specified
    const dietType = product.metafields?.find((m: any) => m.key === 'diet_type')?.value || 'keto';

    try {
      // Check if this product already exists in your MySQL database
      const existingProduct = await db
        .select()
        .from(productMetaProfiles)
        .where(
          and(
            eq(productMetaProfiles.shopDomain, shopDomain),
            eq(productMetaProfiles.handle, handle)
          )
        )
        .limit(1);

      if (existingProduct.length > 0) {
        // Update existing record
        await db
          .update(productMetaProfiles)
          .set({
            title,
            proteinGrams: Number(proteinGrams),
            carbGrams: Number(carbGrams),
            fatGrams: Number(fatGrams),
            calories: Number(calories),
            dietType,
          })
          .where(
            and(
              eq(productMetaProfiles.shopDomain, shopDomain),
              eq(productMetaProfiles.handle, handle)
            )
          );
      } else {
        // Insert new record so it immediately appears in recommendations
        await db.insert(productMetaProfiles).values({
          shopDomain,
          title,
          handle,
          proteinGrams: Number(proteinGrams),
          carbGrams: Number(carbGrams),
          fatGrams: Number(fatGrams),
          calories: Number(calories),
          dietType,
        });
      }

      console.log(`Successfully synced product: ${title} for ${shopDomain}`);
    } catch (error) {
      console.error(`Failed to sync webhook product ${title}:`, error);
    }
  }

  return new Response("Webhook processed", { status: 200 });
};