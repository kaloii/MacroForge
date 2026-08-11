import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Page, Layout, Card, DataTable, Text, Select, TextField, BlockStack, Banner } from "@shopify/polaris";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query GetRankingsData {
      orders(first: 50, sortKey: CREATED_AT, reverse: true) {
        nodes {
          createdAt
          lineItems(first: 50) {
            nodes {
              quantity
              originalTotalSet {
                presentmentMoney {
                  amount
                  currencyCode
                }
              }
              product {
                id
                title
                collections(first: 5) {
                  nodes { id title }
                }
                metafields(first: 10) {
                  nodes {
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
      metafieldDefinitions(ownerType: PRODUCT, first: 20) {
        nodes {
          name
          namespace
          key
        }
      }
    }`
  );

  const json = await response.json();
  const orders = json.data?.orders?.nodes || [];
  const metafieldDefs = json.data?.metafieldDefinitions?.nodes || [];

  const productMap: Record<string, any> = {};
  let currencyCode = "PHP";

  for (const order of orders) {
    const orderCreatedAt = order.createdAt;
    for (const item of order.lineItems.nodes) {
      const product = item.product;
      if (!product) continue;

      const productId = product.id;
      const quantity = item.quantity;
      const amount = parseFloat(item.originalTotalSet?.presentmentMoney?.amount || "0");
      currencyCode = item.originalTotalSet?.presentmentMoney?.currencyCode || "PHP";

      if (!productMap[productId]) {
        const mfMap: Record<string, string> = {};
        product.metafields?.nodes?.forEach((mf: any) => {
          if (mf?.namespace && mf?.key) {
            mfMap[`${mf.namespace}.${mf.key}`] = mf.value;
          }
        });

        productMap[productId] = {
          productId,
          title: product.title,
          currencyCode,
          collections: product.collections?.nodes || [],
          metafields: mfMap,
          salesEntries: [],
        };
      }

      productMap[productId].salesEntries.push({
        quantity,
        amount,
        createdAt: orderCreatedAt,
      });
    }
  }

  return {
    rankings: Object.values(productMap),
    metafieldDefs,
  };
};

export default function ProductRankingsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const rankings = loaderData?.rankings || [];
  const metafieldDefs = loaderData?.metafieldDefs || [];

  const [selectedSort, setSelectedSort] = useState(() => "totalQuantity");
  const [selectedMetafieldFilter, setSelectedMetafieldFilter] = useState(() => "");
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState(() => "");
  const [startDate, setStartDate] = useState(() => "");
  const [endDate, setEndDate] = useState(() => "");

  const pieChartLabel = selectedSort === "totalRevenue" 
    ? "Revenue Share Breakdown" 
    : "Units Sold Breakdown";

  const uniqueCollectionsMap = new Map();
  rankings.forEach((item: any) => {
    item.collections?.forEach((col: any) => {
      if (col?.id && col?.title) {
        uniqueCollectionsMap.set(col.id, col.title);
      }
    });
  });

  const sortOptions = [
    { label: "Units Sold (Default)", value: "totalQuantity" },
    { label: "Total Revenue", value: "totalRevenue" },
  ];

  const metafieldFilterOptions = [
    { label: "All Products (No Filter)", value: "" },
    ...metafieldDefs.map((def: any) => ({
      label: def.name,
      value: `${def.namespace}.${def.key}`,
    })),
  ];

  const collectionFilterOptions = [
    { label: "All Collections (No Filter)", value: "" },
    ...Array.from(uniqueCollectionsMap.entries()).map(([id, title]) => ({
      label: title,
      value: id,
    })),
  ];

  // Validation: End range cannot be earlier than start range
  const isDateRangeInvalid = startDate && endDate && endDate < startDate;

  // Process sales entries based on date range
  const processedRankings = rankings.map((item: any) => {
    const validEntries = item.salesEntries.filter((entry: any) => {
      const entryDateOnly = entry.createdAt ? entry.createdAt.split("T")[0] : "";
      if (startDate && entryDateOnly < startDate) return false;
      if (endDate && entryDateOnly > endDate) return false;
      return true;
    });

    const totalQuantity = validEntries.reduce((sum: number, e: any) => sum + e.quantity, 0);
    const totalRevenue = validEntries.reduce((sum: number, e: any) => sum + e.amount, 0);

    return {
      ...item,
      totalQuantity,
      totalRevenue,
    };
  });

  // Filter products based on active collection, metafield, and sales presence within range
  const filteredRankings = processedRankings.filter((item: any) => {
    if (isDateRangeInvalid) return false;

    let matchesMetafield = true;
    if (selectedMetafieldFilter) {
      const mfVal = item.metafields?.[selectedMetafieldFilter];
      matchesMetafield = mfVal !== undefined && mfVal !== null && mfVal !== "" && mfVal !== "null";
    }

    let matchesCollection = true;
    if (selectedCollectionFilter) {
      matchesCollection = item.collections?.some(
        (col: any) => col.id === selectedCollectionFilter
      );
    }

    const matchesSales = item.totalQuantity > 0;

    return matchesMetafield && matchesCollection && matchesSales;
  });

  // Sort filtered dataset
  const sortedRankings = [...filteredRankings].sort((a, b) => {
    if (selectedSort === "totalRevenue") {
      return (b.totalRevenue || 0) - (a.totalRevenue || 0);
    }
    return (b.totalQuantity || 0) - (a.totalQuantity || 0);
  });

  const chartData = sortedRankings.slice(0, 6).map((item) => ({
    name: item.title || "Untitled",
    value: item.totalRevenue || 0,
  }));

  const COLORS = ["#008060", "#5c6ac4", "#de3618", "#ffc453", "#47c1bf", "#637381"];

  const rows = sortedRankings.map((item, index) => [
    <Text key={`${item.productId}-rank`} variant="bodyMd" fontWeight="bold" as="span">
      #{index + 1}
    </Text>,
    item.title || "Untitled Product",
    item.totalQuantity || 0,
    `${item.currencyCode || "PHP"} ${(item.totalRevenue || 0).toFixed(2)}`,
  ]);

  return (
    <Page title="Product Sales Rankings & Intelligence">
      <BlockStack gap="500">
        <Layout>
          {/* Controls Section: Filters & Date Ranges */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <Select
                      label="Sort Rankings By"
                      options={sortOptions}
                      value={selectedSort}
                      onChange={(value) => setSelectedSort(value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <Select
                      label="Filter by Collection"
                      options={collectionFilterOptions}
                      value={selectedCollectionFilter}
                      onChange={(value) => setSelectedCollectionFilter(value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <Select
                      label="Filter by Metafield"
                      options={metafieldFilterOptions}
                      value={selectedMetafieldFilter}
                      onChange={(value) => setSelectedMetafieldFilter(value)}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <TextField
                      label="Start Date"
                      type="date"
                      value={startDate}
                      onChange={setStartDate}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <TextField
                      label="End Date"
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
                <p>The end date cannot be earlier than the start date. Please update your date filter selections.</p>
              </Banner>
            </Layout.Section>
          )}

          {/* Recharts Pie Chart Section */}
          <Layout.Section>
            <Card>
              <div style={{ padding: "1rem 0 0 1rem" }}>
                <Text variant="headingMd" as="h2">{pieChartLabel}</Text>
              </div>
              <div style={{ width: "100%", height: 320, padding: "1rem" }}>
                {!isDateRangeInvalid && chartData.length > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={60}
                        paddingAngle={4}
                        label
                      >
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                    <Text variant="bodyMd" as="p">
                      {isDateRangeInvalid ? "Please resolve the date range validation error." : "No sold products found matching the selected filters and date range."}
                    </Text>
                  </div>
                )}
              </div>
            </Card>
          </Layout.Section>

          {/* DataTable Section */}
          <Layout.Section>
            <Card>
              <DataTable
                columnContentTypes={["text", "text", "numeric", "numeric"]}
                headings={["Rank", "Product Title", "Units Sold", "Total Revenue"]}
                rows={rows}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}