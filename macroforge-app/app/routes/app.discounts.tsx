import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { Page, Card, Text, BlockStack, Button, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
      #graphql
      query GetShopifyData {
        shopifyFunctions(first: 10) {
          nodes {
            id
            title
          }
        }
        automaticDiscountNodes(first: 20) {
          nodes {
            id
            automaticDiscount {
              ... on DiscountAutomaticApp {
                title
                status
              }
            }
          }
        }
      }
    `);
    
    const responseJson = await response.json();
    const functions = responseJson.data?.shopifyFunctions?.nodes || [];
    const discountNodes = responseJson.data?.automaticDiscountNodes?.nodes || [];
    
    const targetFunction = functions.find((fn: any) => 
      fn.title?.toLowerCase().includes("forge") ||
      fn.title?.toLowerCase().includes("discount") ||
      functions.length === 1
    ) || functions[0];

    // Check if the discount is already active on the store
    const activeDiscount = discountNodes.find((node: any) => 
      node.automaticDiscount?.title === "Forge Stack Bundle Discount" &&
      node.automaticDiscount?.status === "ACTIVE"
    );

    return { 
      functionId: targetFunction?.id || null, 
      isDiscountActive: !!activeDiscount,
      error: null 
    };
  } catch (error: any) {
    console.error("Failed to load Shopify functions/discounts:", error);
    return { functionId: null, isDiscountActive: false, error: error.message || "Unknown error occurred in loader." };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin: shopifyAdmin } = await authenticate.admin(request);
    const formData = await request.formData();
    const functionId = formData.get("functionId") as string;

    if (!functionId) {
      return { success: false, error: "Function ID not found. Ensure your extension is deployed." };
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
          discountClasses: ["PRODUCT"],
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
      return { success: false, error: userErrors[0].message };
    }

    return { 
      success: true, 
      discount: responseJson.data?.discountAutomaticAppCreate?.automaticAppDiscount 
    };
  } catch (error: any) {
    console.error("Failed to create discount mutation:", error);
    return { success: false, error: error.message || "Server exception during mutation." };
  }
}

export default function DiscountManager() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const functionId = data?.functionId;
  const isDiscountActive = data?.isDiscountActive;
  const loaderError = data?.error;

  const isCreating = fetcher.state === "submitting";
  const actionData = fetcher.data as { success?: boolean; error?: string; discount?: any } | undefined;

  // Reflect active state immediately if the mutation succeeds during this session
  const discountActiveState = isDiscountActive || actionData?.success;

  return (
    <Page title="Forge Stack Bundle Management" subtitle="Automate your bundle pricing rules">
      <BlockStack gap="500">
        {loaderError && (
          <Banner tone="critical">
            Loader Error: {loaderError}
          </Banner>
        )}
        {discountActiveState && (
          <Banner tone="success">
            Automatic bundle discount is active and running on your store!
          </Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical">
            Mutation Error: {actionData.error}
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">Function Status</Text>
            <Text variant="bodyMd" as="p">
              {functionId 
                ? `Connected Function ID: ${functionId}` 
                : "Warning: Function was not found on this store. Ensure you have run a production deployment via the CLI."}
            </Text>

            <fetcher.Form method="post">
              <input type="hidden" name="functionId" value={functionId || ""} />
              <Button 
                submit 
                variant={discountActiveState ? "plain" : "primary"} 
                disabled={!functionId || isCreating || discountActiveState} 
                loading={isCreating}
              >
                {discountActiveState ? "Discount Already Active" : "Activate Automatic Bundle Discount"}
              </Button>
            </fetcher.Form>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs: any) => boundary.headers(headersArgs);