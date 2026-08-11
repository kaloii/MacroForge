import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { Page, Card, Text, BlockStack, Button, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    #graphql
    query GetShopifyFunction {
      shopifyFunctions(first: 10) {
        nodes {
          id
          app {
            title
          }
          apiClient {
            title
          }
        }
      }
    }
  `);
  
  const responseJson = await response.json();
  const functions = responseJson.data?.shopifyFunctions?.nodes || [];
  
  const targetFunction = functions.find((fn: any) => 
    fn.apiClient?.title?.toLowerCase().includes("forge-stack-discount") ||
    fn.id
  );

  return Response.json({ functionId: targetFunction?.id || null });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin: shopifyAdmin } = await authenticate.admin(request);
  const formData = await request.formData();
  const functionId = formData.get("functionId") as string;

  if (!functionId) {
    return Response.json({ success: false, error: "Function ID not found." });
  }

  const response = await shopifyAdmin.graphql(`
    #graphql
    mutation CreateAutomaticDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount {
          discountId
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      automaticAppDiscount: {
        title: "Forge Stack Bundle Discount",
        startsAt: new Date().toISOString(),
        functionId: functionId,
        combinesWith: {
          orderDiscounts: true,
          productDiscounts: true,
          shippingDiscounts: true
        }
      }
    }
  });

  const responseJson = await response.json();
  const userErrors = responseJson.data?.discountAutomaticAppCreate?.userErrors;

  if (userErrors && userErrors.length > 0) {
    return Response.json({ success: false, error: userErrors[0].message });
  }

  return Response.json({ 
    success: true, 
    discount: responseJson.data?.discountAutomaticAppCreate?.automaticAppDiscount 
  });
}

export default function DiscountManager() {
  const { functionId } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const isCreating = fetcher.state === "submitting";
  const actionData = fetcher.data as { success?: boolean; error?: string; discount?: any } | undefined;

  return (
    <Page title="Forge Stack Bundle Management" subtitle="Automate your bundle pricing rules">
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner tone="success">
            Automatic bundle discount successfully created and activated!
          </Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical">
            Error: {actionData.error}
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">Function Status</Text>
            <Text variant="bodyMd" as="p">
              {functionId 
                ? `Connected Function ID: ${functionId}` 
                : "Warning: Function 'forge-stack-discount' not detected. Make sure you deployed with 'shopify app deploy'."}
            </Text>

            <fetcher.Form method="post">
              <input type="hidden" name="functionId" value={functionId || ""} />
              <Button submit variant="primary" disabled={!functionId || isCreating} loading={isCreating}>
                Activate Automatic Bundle Discount
              </Button>
            </fetcher.Form>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs: any) => boundary.headers(headersArgs);