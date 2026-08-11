import { type LoaderFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { recommendationRules, productMetaProfiles } from "~/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const targetDiet = url.searchParams.get("diet") || "keto";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Validate that the shop parameter is provided
  if (!shop) {
    return Response.json({ error: "Missing shop parameter" }, { status: 400, headers: corsHeaders });
  }

  try {
    // 1. Check if there is an active recommendation rule for this diet/shop
    const [rule] = await db
      .select()
      .from(recommendationRules)
      .where(
        and(
          eq(recommendationRules.shopDomain, shop),
          eq(recommendationRules.targetDiet, targetDiet),
          eq(recommendationRules.isPriorityActive, true)
        )
      )
      .limit(1);

    // Fallback weight if no custom rule is active
    const proteinWeight = rule ? rule.proteinWeight : 50;

    // 2. Query product profiles and calculate dynamic score based on protein weight
    const scoreExpression = sql<number>`${productMetaProfiles.proteinGrams} * ${proteinWeight}`;

    const rankedProducts = await db
      .select({
        title: productMetaProfiles.title,
        handle: productMetaProfiles.handle,
        proteinGrams: productMetaProfiles.proteinGrams,
        carbGrams: productMetaProfiles.carbGrams,
        fatGrams: productMetaProfiles.fatGrams,
        calories: productMetaProfiles.calories,
        score: scoreExpression,
      })
      .from(productMetaProfiles)
      .where(
        and(
          eq(productMetaProfiles.shopDomain, shop),
          eq(productMetaProfiles.dietType, targetDiet)
        )
      )
      .orderBy(desc(scoreExpression))
      .limit(5);

    // 3. Return a clean JSON response
    return Response.json({
      success: true,
      activeRule: rule ? rule.ruleName : "Default Scoring",
      proteinWeight,
      products: rankedProducts,
    }, { headers: corsHeaders });
    
  } catch (error: any) {
    console.error("API Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}