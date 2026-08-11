import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { shopifySessions } from "../db/schema"; // Ensure this points to your Drizzle session table schema
import { eq } from "drizzle-orm";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const current = payload.current as string[];
  
  if (session && session.id) {
    // Correct Drizzle ORM syntax update
    await db
      .update(shopifySessions)
      .set({ 
        scope: current.toString() 
      })
      .where(eq(shopifySessions.id, session.id));

      console.log(`Updated scopes for session ${session.id}`);
  }

  return new Response("Webhook processed", { status: 200 });
};