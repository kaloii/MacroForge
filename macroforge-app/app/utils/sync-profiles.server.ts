import { db } from "../db.server"; 
import { productMetaProfiles, activityLogs } from "~/db/schema"; 
import { eq, and } from "drizzle-orm";

interface MetafieldNode {
  namespace: string;
  key: string;
  value: string | null;
}

interface ImageNode {
  url: string;
}

interface ProductNode {
  id: string;
  title: string;
  handle: string;
  featuredImage?: ImageNode | null;
  metafields: {
    nodes: MetafieldNode[];
  };
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface ProductsQueryResponse {
  data?: {
    products?: {
      nodes: ProductNode[];
      pageInfo: PageInfo;
    };
  };
}

export async function syncShopifyProductsToProfiles(admin: any, shopDomain: string): Promise<number> {
  let hasNextPage: boolean = true;
  let cursor: string | null = null;
  let syncedCount: number = 0;

  while (hasNextPage) {
    const response: Response = await admin.graphql(
      `#graphql
      query GetStoreProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          nodes {
            id
            title
            handle
            featuredImage {
              url
            }
            metafields(first: 20) {
              nodes {
                namespace
                key
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      {
        variables: { cursor },
      }
    );

    const json: ProductsQueryResponse = await response.json();
    const productData = json.data?.products;
    const products: ProductNode[] = productData?.nodes || [];

    for (const product of products) {
      const { id, title, handle, featuredImage, metafields: mfConnection } = product;
      const metafields: MetafieldNode[] = mfConnection?.nodes || [];
      const imageUrl = featuredImage?.url || null;

      const caloriesMf = metafields.find((m) => m.key === "calories");
      const proteinMf = metafields.find((m) => m.key === "protein");

      if (!caloriesMf || !proteinMf || !caloriesMf.value || !proteinMf.value) {
        continue; 
      }

      const getMacro = (key: string): number => {
        const mf = metafields.find((m) => m.key === key);
        return mf && mf.value !== null && mf.value !== "" ? parseInt(mf.value, 10) || 0 : 0;
      };

      const getDiet = (key: string): string => {
        const mf = metafields.find((m) => m.key === key);
        return mf && mf.value ? mf.value : "omnivore";
      };

      const proteinGrams = getMacro("protein");
      const carbGrams = getMacro("carbs");
      const fatGrams = getMacro("fats");
      const calories = getMacro("calories");
      const dietType = getDiet("diet_type");

      const existing = await db
        .select()
        .from(productMetaProfiles)
        .where(
          and(
            eq(productMetaProfiles.shopDomain, shopDomain),
            eq(productMetaProfiles.shopifyProductId, id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(productMetaProfiles)
          .set({
            title,
            handle,
            imageUrl,
            dietType,
            proteinGrams,
            carbGrams,
            fatGrams,
            calories,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productMetaProfiles.shopDomain, shopDomain),
              eq(productMetaProfiles.shopifyProductId, id)
            )
          );
      } else {
        await db.insert(productMetaProfiles).values({
          shopDomain,
          shopifyProductId: id,
          title,
          handle,
          imageUrl,
          dietType,
          proteinGrams,
          carbGrams,
          fatGrams,
          calories,
        });
      }
      syncedCount++;
    }

    hasNextPage = productData?.pageInfo?.hasNextPage || false;
    cursor = productData?.pageInfo?.endCursor || null;
  }

  await db.insert(activityLogs).values({
    shopDomain,
    actionType: "SYNC_PRODUCTS",
    description: `Successfully synced ${syncedCount} profiled products.`,
  });

  return syncedCount;
}