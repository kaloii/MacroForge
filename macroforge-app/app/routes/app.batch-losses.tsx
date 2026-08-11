import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Page, Layout, Card, DataTable, Text, Select, TextField, BlockStack, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { db } from "~/db.server";
import { batchLosses, productMetaProfiles } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // 1. Fetch batch losses from local database joined with product meta profiles
  const losses = await db
    .select({
      id: batchLosses.id,
      batchNumber: batchLosses.batchNumber,
      productProfileId: batchLosses.productProfileId,
      quantityLost: batchLosses.quantityLost,
      preparedDate: batchLosses.preparedDate,
      expirationDate: batchLosses.expirationDate,
      reason: batchLosses.reason,
      archivedAt: batchLosses.archivedAt,
      shopifyProductId: productMetaProfiles.shopifyProductId,
    })
    .from(batchLosses)
    .leftJoin(productMetaProfiles, eq(batchLosses.productProfileId, productMetaProfiles.id))
    .where(eq(batchLosses.shopDomain, shopDomain))
    .orderBy(desc(batchLosses.archivedAt));

  // 2. Fetch product collections from Shopify Admin GraphQL to enable collection filtering
  const response = await admin.graphql(
    `#graphql
    query GetProductsAndCollections {
      products(first: 100) {
        nodes {
          id
          title
          collections(first: 10) {
            nodes {
              id
              title
            }
          }
        }
      }
    }`
  );

  const json = await response.json();
  const shopifyProducts = json.data?.products?.nodes || [];

  const productInfoMap = new Map();
  const uniqueCollectionsMap = new Map();

  shopifyProducts.forEach((prod: any) => {
    const collections = prod.collections?.nodes || [];
    collections.forEach((col: any) => {
      if (col?.id && col?.title) {
        uniqueCollectionsMap.set(col.id, col.title);
      }
    });
    productInfoMap.set(prod.id, {
      title: prod.title,
      collections,
    });
  });

  const enrichedLosses = losses.map((loss) => {
    const prodInfo = loss.shopifyProductId ? productInfoMap.get(loss.shopifyProductId) : null;
    return {
      ...loss,
      productTitle: prodInfo?.title || "Unknown Product",
      collections: prodInfo?.collections || [],
    };
  });

  return {
    losses: enrichedLosses,
    collections: Array.from(uniqueCollectionsMap.entries()).map(([id, title]) => ({ id, title })),
  };
};

export default function BatchLossesPage() {
  const loaderData = useLoaderData<typeof loader>();
  const losses = loaderData?.losses || [];
  const collections = loaderData?.collections || [];

  const [selectedCollection, setSelectedCollection] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Validation: Start date cannot be later than end date
  const isDateRangeInvalid = startDate && endDate && startDate > endDate;

  const collectionOptions = [
    { label: "All Collections (No Filter)", value: "" },
    ...collections.map((col: any) => ({
      label: col.title,
      value: col.id,
    })),
  ];

  const filteredLosses = losses.filter((loss: any) => {
    if (isDateRangeInvalid) return false;

    // Collection filter check
    let matchesCollection = true;
    if (selectedCollection) {
      matchesCollection = loss.collections?.some((col: any) => col.id === selectedCollection);
    }

    // Date range check on archivedAt
    let matchesDate = true;
    if (loss.archivedAt) {
      const archivedDateOnly = new Date(loss.archivedAt).toISOString().split("T")[0];
      if (startDate && archivedDateOnly < startDate) matchesDate = false;
      if (endDate && archivedDateOnly > endDate) matchesDate = false;
    } else if (startDate || endDate) {
      matchesDate = false;
    }

    return matchesCollection && matchesDate;
  });

  const rows = filteredLosses.map((loss: any) => [
    <Text key={`${loss.id}-batch`} variant="bodyMd" fontWeight="bold" as="span">
      {loss.batchNumber}
    </Text>,
    loss.productTitle,
    loss.quantityLost,
    loss.reason,
    loss.preparedDate,
    loss.expirationDate,
    loss.archivedAt ? new Date(loss.archivedAt).toLocaleString() : "N/A",
  ]);

  return (
    <Page title="Batch Losses & Spoilage Archive" subtitle="Review expired and spoiled production batches">
      <BlockStack gap="500">
        <Layout>
          {/* Filters Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "250px" }}>
                    <Select
                      label="Filter by Collection"
                      options={collectionOptions}
                      value={selectedCollection}
                      onChange={setSelectedCollection}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <TextField
                      label="Start Date (Archived)"
                      type="date"
                      value={startDate}
                      onChange={setStartDate}
                      error={isDateRangeInvalid ? "Start date cannot be later than end date." : undefined}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <TextField
                      label="End Date (Archived)"
                      type="date"
                      value={endDate}
                      onChange={setEndDate}
                      error={isDateRangeInvalid ? "End date cannot be earlier than start date." : undefined}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          {isDateRangeInvalid && (
            <Layout.Section>
              <Banner tone="critical" title="Invalid Date Range">
                <p>The start date cannot be later than the end date. Please correct your date filter inputs.</p>
              </Banner>
            </Layout.Section>
          )}

          {/* DataTable Section */}
          <Layout.Section>
            <Card>
              <DataTable
                columnContentTypes={["text", "text", "numeric", "text", "text", "text", "text"]}
                headings={[
                  "Batch Number",
                  "Product Title",
                  "Quantity Lost",
                  "Reason",
                  "Prepared Date",
                  "Expiration Date",
                  "Archived At",
                ]}
                rows={rows}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}