import { type LoaderFunctionArgs, type ActionFunctionArgs, href } from "react-router";
import { Link, useLoaderData, useSubmit, useSearchParams } from "react-router";
import {
  Page,
  Card,
  DataTable,
  Text,
  BlockStack,
  InlineGrid,
  Box,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "~/db.server";
import { activityLogs, productMetaProfiles, recommendationRules, productBatches, batchLosses, batchWaitlists } from "~/db/schema";
import { desc, count, eq, and } from "drizzle-orm"; // Added 'and' here
import { boundary } from "@shopify/shopify-app-react-router/server";
import { syncShopifyProductsToProfiles } from "../utils/sync-profiles.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Automated Sync: Keep product profiles automatically synchronized on page load
  try {
    await syncShopifyProductsToProfiles(admin, shopDomain);
  } catch (error) {
    console.error("Automated background product sync failed:", error);
  }

  const [productCountResult] = await db
    .select({ count: count() })
    .from(productMetaProfiles)
    .where(eq(productMetaProfiles.shopDomain, shopDomain));

  const [ruleCountResult] = await db
    .select({ count: count() })
    .from(recommendationRules)
    .where(eq(recommendationRules.shopDomain, shopDomain));

  const [batchCountResult] = await db
    .select({ count: count() })
    .from(productBatches)
    .where(eq(productBatches.shopDomain, shopDomain));

  const [lossCountResult] = await db
    .select({ count: count() })
    .from(batchLosses)
    .where(eq(batchLosses.shopDomain, shopDomain));

  // Updated query to only count 'waiting' status
  const [waitlistCountResult] = await db
    .select({ count: count() })
    .from(batchWaitlists)
    .where(
      and(
        eq(batchWaitlists.shopDomain, shopDomain),
        eq(batchWaitlists.status, "waiting")
      )
    );

  const recentLogs = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.shopDomain, shopDomain))
    .orderBy(desc(activityLogs.createdAt))
    .limit(5);

  return {
    stats: {
      products: productCountResult?.count || 0,
      rules: ruleCountResult?.count || 0,
      batches: batchCountResult?.count || 0,
      losses: lossCountResult?.count || 0,
      waitlists: waitlistCountResult?.count || 0,
    },
    logs: recentLogs,
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const count = await syncShopifyProductsToProfiles(admin, session.shop);
    return { success: true, count };
  } catch (error: any) {
    console.error("Sync failed:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function MacroForgeDashboard() {
  const { stats, logs } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleSync = () => {
    submit({}, { method: "POST" });
  };

  const navigateTo = (path: string) => {
    if (typeof window !== "undefined") {
      const search = window.location.search;
      window.location.href = search ? `${path}${search}` : path;
    }
  };

  const logRows = logs.map((log) => [
    log.actionType,
    log.description,
    new Date(log.createdAt).toLocaleString(),
  ]);

  return (
    <Page 
      title="MacroForge Dashboard" 
      subtitle="Smart Macro & Dietary Recommendation Engine"
    >
      <BlockStack gap="500">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 5 }} gap="400">

          <div onClick={() => navigateTo("/app/rules")} style={{cursor: "pointer"}}> 
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Active Rules</Text>
                <Text variant="heading2xl" as="p">{stats.rules}</Text>
                <Text variant="bodySm" as="span" tone="subdued">
                  Custom dietary scoring and weighting rules
                </Text>
              </BlockStack>
            </Card>
          </div>

          <div onClick={() => navigateTo("/app/batches")} style={{cursor: "pointer"}}> 
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Active Batches</Text>
                <Text variant="heading2xl" as="p">{stats.batches}</Text>
                <Text variant="bodySm" as="span" tone="subdued">
                  Current production batches in inventory
                </Text>
              </BlockStack>
            </Card>
          </div>

          <div onClick={() => navigateTo("/app/batch-losses")} style={{cursor: "pointer"}}> 
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Batch Losses</Text>
                <Text variant="heading2xl" as="p">{stats.losses}</Text>
                <Text variant="bodySm" as="span" tone="subdued">
                  Archived expired or spoiled batch records
                </Text>
              </BlockStack>
            </Card>
          </div>

          <div onClick={() => navigateTo("/app/waitlists")} style={{cursor: "pointer"}}> 
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Waitlisted Batches</Text>
                <Text variant="heading2xl" as="p">{stats.waitlists}</Text>
                <Text variant="bodySm" as="span" tone="subdued">
                  Customers waiting for unbatched or restocked items
                </Text>
              </BlockStack>
            </Card>
          </div>

        </InlineGrid>

        {/* Recent Activity Log Table with Secondary Manual Sync Action */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Box>
                <Text variant="headingMd" as="h3">Recent Activity & Audit Log</Text>
              </Box>
              <Button size="slim" onClick={handleSync}>
                Manual Sync Catalog
              </Button>
            </InlineStack>

            {logs.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text']}
                headings={['Action Type', 'Description', 'Timestamp']}
                rows={logRows}
              />
            ) : (
              <Box padding="400">
                <Text variant="bodyMd" as="p" tone="subdued">
                  No activity recorded yet. Catalog synchronization runs automatically when viewing food items.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs: any) => {
  return boundary.headers(headersArgs);
};