import { useState } from "react";
import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Text,
  BlockStack,
  TextField,
  Select,
  Button,
  Box,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "~/db.server";
import { recommendationRules, activityLogs } from "~/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { boundary } from "@shopify/shopify-app-react-router/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const rules = await db
    .select()
    .from(recommendationRules)
    .where(eq(recommendationRules.shopDomain, shopDomain))
    .orderBy(desc(recommendationRules.id));

  return { rules };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // 1. Handle toggling rule active status
  if (intent === "toggle") {
    const ruleId = parseInt(formData.get("ruleId") as string, 10);
    const currentStatus = formData.get("currentStatus") === "true";
    const ruleName = formData.get("ruleName") as string;

    if (isNaN(ruleId)) {
      return Response.json({ success: false, error: "Invalid rule ID." }, { status: 400 });
    }

    try {
      const willBeActive = !currentStatus;

      // If we are activating this rule, pause any other active rule for the same target diet first
      if (willBeActive) {
        const [ruleRecord] = await db
          .select()
          .from(recommendationRules)
          .where(eq(recommendationRules.id, ruleId));

        if (ruleRecord) {
          await db
            .update(recommendationRules)
            .set({ isPriorityActive: false })
            .where(
              and(
                eq(recommendationRules.shopDomain, session.shop),
                eq(recommendationRules.targetDiet, ruleRecord.targetDiet),
                eq(recommendationRules.isPriorityActive, true)
              )
            );
        }
      }

      // Update the target rule's status
      await db
        .update(recommendationRules)
        .set({ isPriorityActive: willBeActive })
        .where(eq(recommendationRules.id, ruleId));

      await db.insert(activityLogs).values({
        shopDomain: session.shop,
        actionType: "UPDATE_RULE_STATUS",
        description: `${willBeActive ? "Activated" : "Paused"} recommendation rule: "${ruleName}".`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Failed to toggle rule status:", error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // 2. Handle deleting a rule
  if (intent === "delete") {
    const ruleId = parseInt(formData.get("ruleId") as string, 10);
    const ruleName = formData.get("ruleName") as string;

    if (isNaN(ruleId)) {
      return Response.json({ success: false, error: "Invalid rule ID." }, { status: 400 });
    }

    try {
      await db
        .delete(recommendationRules)
        .where(
          and(
            eq(recommendationRules.id, ruleId),
            eq(recommendationRules.shopDomain, session.shop)
          )
        );

      await db.insert(activityLogs).values({
        shopDomain: session.shop,
        actionType: "DELETE_RULE",
        description: `Deleted recommendation rule: "${ruleName}".`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Failed to delete rule:", error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // 3. Handle creating a new rule
  const ruleName = formData.get("ruleName") as string;
  const targetDiet = formData.get("targetDiet") as string;
  const proteinWeight = parseInt(formData.get("proteinWeight") as string, 10) || 50;

  if (!ruleName || !targetDiet) {
    return Response.json({ success: false, error: "Rule name and target diet are required." }, { status: 400 });
  }

  try {
    // Pause any existing active rules for this target diet first
    await db
      .update(recommendationRules)
      .set({ isPriorityActive: false })
      .where(
        and(
          eq(recommendationRules.shopDomain, session.shop),
          eq(recommendationRules.targetDiet, targetDiet),
          eq(recommendationRules.isPriorityActive, true)
        )
      );

    // Insert the new active rule
    await db.insert(recommendationRules).values({
      shopDomain: session.shop,
      ruleName,
      targetDiet,
      proteinWeight,
      isPriorityActive: true,
    });

    await db.insert(activityLogs).values({
      shopDomain: session.shop,
      actionType: "CREATE_RULE",
      description: `Created custom recommendation rule: "${ruleName}" for diet type "${targetDiet}".`,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to create rule:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function MacroForgeRulesPage() {
  const { rules } = useLoaderData<typeof loader>();
  
  const [ruleName, setRuleName] = useState("");
  const [targetDiet, setTargetDiet] = useState("keto");
  const [proteinWeight, setProteinWeight] = useState("50");
  const submit = useSubmit();

  const dietOptions = [
    { label: "Keto", value: "keto" },
    { label: "Vegan", value: "vegan" },
    { label: "Carnivore", value: "carnivore" },
    { label: "Omnivore / Balanced", value: "omnivore" },
  ];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ruleName.trim()) return;
    submit({ ruleName, targetDiet, proteinWeight }, { method: "POST" });
    setRuleName("");
    setProteinWeight("50");
  };

  const handleToggle = (ruleId: number, currentStatus: boolean, ruleName: string) => {
    submit(
      { intent: "toggle", ruleId: ruleId.toString(), currentStatus: currentStatus.toString(), ruleName },
      { method: "POST" }
    );
  };

  const handleDelete = (ruleId: number, ruleName: string) => {
    if (confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
      submit(
        { intent: "delete", ruleId: ruleId.toString(), ruleName },
        { method: "POST" }
      );
    }
  };

  const ruleRows = rules.map((rule) => [
    rule.ruleName,
    <Badge key={`${rule.id}-diet`} tone="info">{rule.targetDiet.toUpperCase()}</Badge>,
    rule.proteinWeight,
    <div key={`${rule.id}-status-container`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Badge key={`${rule.id}-status`} tone={rule.isPriorityActive ? "success" : "attention"}>
          {rule.isPriorityActive ? "Active" : "Paused"}
        </Badge>
        <Button
          size="slim"
          onClick={() => handleToggle(rule.id, rule.isPriorityActive, rule.ruleName)}
        >
          {rule.isPriorityActive ? "Pause" : "Activate"}
        </Button>
      </div>
      <Button
        size="slim"
        tone="critical"
        onClick={() => handleDelete(rule.id, rule.ruleName)}
      >
        Delete
      </Button>
    </div>,
  ]);

  return (
    <Page 
      title="Recommendation Rules" 
      subtitle="Configure custom dietary scoring and product matching weights"
    >
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">Create New Rule</Text>
              <form onSubmit={handleSubmit}>
                <BlockStack gap="300">
                  <TextField
                    label="Rule Name"
                    value={ruleName}
                    onChange={(val) => setRuleName(val)}
                    placeholder="e.g. Extreme Keto Boost"
                    autoComplete="off"
                  />
                  <Select
                    label="Target Diet Category"
                    options={dietOptions}
                    value={targetDiet}
                    onChange={(val) => setTargetDiet(val)}
                  />
                  <TextField
                    label="Protein Weight Multiplier (1 - 100)"
                    type="number"
                    value={proteinWeight}
                    onChange={(val) => setProteinWeight(val)}
                    autoComplete="off"
                    helpText="Higher weight gives priority to high-protein items in this category."
                  />
                  <Box paddingBlockStart="200">
                    <Button submit variant="primary" fullWidth>
                      Save Rule
                    </Button>
                  </Box>
                </BlockStack>
              </form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box paddingBlockEnd="200">
                <Text variant="headingMd" as="h3">Active Scoring Rules</Text>
              </Box>
              {rules.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'numeric', 'text']}
                  headings={['Rule Name', 'Target Diet', 'Protein Weight', 'Status / Action']}
                  rows={ruleRows}
                />
              ) : (
                <Box padding="400">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    No recommendation rules configured yet. Use the form on the left to create your first rule.
                  </Text>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs: any) => {
  return boundary.headers(headersArgs);
};