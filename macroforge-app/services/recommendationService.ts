// services/recommendationService.ts
import { db } from '~/db.server';
import { productMetaProfiles, recommendationRules } from '~/db/schema';
import { eq, and } from 'drizzle-orm';

interface UserContext {
  shopDomain: string;
  dietPreference: 'vegan' | 'carnivore' | 'omnivore' | 'keto';
  targetProtein: number;
  targetCalories: number;
}

export async function scoreAndRankProducts(context: UserContext) {
  // Fetch products associated with this shop
  const products = await db.select().from(productMetaProfiles)
    .where(eq(productMetaProfiles.shopDomain, context.shopDomain));

  // Fetch scoring rules set by the merchant
  const rules = await db.select().from(recommendationRules)
    .where(and(
      eq(recommendationRules.shopDomain, context.shopDomain),
      eq(recommendationRules.targetDiet, context.dietPreference)
    ));

  const weight = rules[0]?.proteinWeight || 50;

  // Scoring and Ranking Algorithm
  const scoredProducts = products.map(product => {
    let score = 0;

    // 1. Hard dietary filter check
    if (context.dietPreference === 'vegan' && product.dietType !== 'vegan') return null;
    if (context.dietPreference === 'carnivore' && product.dietType !== 'carnivore') return null;

    // 2. Macro Proximity Scoring Formula
    const proteinDiff = Math.abs(product.proteinGrams - context.targetProtein);
    const proteinScore = Math.max(0, 100 - (proteinDiff * 2)) * (weight / 50);
    
    score += proteinScore;

    return {
      shopifyProductId: product.shopifyProductId,
      matchScore: Math.round(score),
      dietType: product.dietType,
      protein: product.proteinGrams
    };
  }).filter(Boolean);

  // Sort descending by match score (Highest ranking first)
  return scoredProducts.sort((a, b) => (b?.matchScore || 0) - (a?.matchScore || 0));
}