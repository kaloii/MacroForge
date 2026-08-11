import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { shopifySessions } from "../db/schema"; 
import { eq } from "drizzle-orm";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Clean up the session using Drizzle ORM syntax
  if (shop) {
    await db.delete(shopifySessions).where(eq(shopifySessions.shop, shop));
    console.log(`Deleted session data for uninstalled shop: ${shop}`);
  }

  return new Response();
};
