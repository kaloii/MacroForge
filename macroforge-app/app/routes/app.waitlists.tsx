import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { batchWaitlists } from "~/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { 
  Page, 
  Layout, 
  Card, 
  DataTable, 
  Button, 
  Badge,
  Text,
  BlockStack,
  Pagination
} from "@shopify/polaris";
import { useState } from "react";

// Helper to format dates consistently
const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "N/A" : d.toISOString().split("T")[0];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const demandSummary = await db
    .select({
      productId: batchWaitlists.productId,
      productTitle: batchWaitlists.productTitle,
      totalWaitingQuantity: sql<number>`sum(${batchWaitlists.quantity})`.as("total_waiting_quantity"),
      waitingCount: sql<number>`count(*)`.as("waiting_count"),
    })
    .from(batchWaitlists)
    .where(
      and(
        eq(batchWaitlists.shopDomain, shopDomain),
        eq(batchWaitlists.status, "waiting")
      )
    )
    .groupBy(batchWaitlists.productId, batchWaitlists.productTitle);

  const fulfilledSummary = await db
    .select({
      productId: batchWaitlists.productId,
      productTitle: batchWaitlists.productTitle,
      totalFulfilledQuantity: sql<number>`sum(${batchWaitlists.quantity})`.as("total_fulfilled_quantity"),
      fulfilledCount: sql<number>`count(*)`.as("fulfilled_count"),
      dateFulfilled: sql<string>`MAX(${batchWaitlists.dateFulfilled})`.as("date_fulfilled"),
    })
    .from(batchWaitlists)
    .where(
      and(
        eq(batchWaitlists.shopDomain, shopDomain),
        eq(batchWaitlists.status, "notified")
      )
    )
    .groupBy(batchWaitlists.productId, batchWaitlists.productTitle);

  return { demandSummary, fulfilledSummary };
}

export default function WaitlistsPage() {
  const { demandSummary, fulfilledSummary } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [demandPage, setDemandPage] = useState(1);
  const [fulfilledPage, setFulfilledPage] = useState(1);
  const rowsPerPage = 10;

  const handleCreateBatch = (productId: string, quantity: number) => {
    navigate(`/app/batches?profileId=${productId}&quantity=${quantity}&autoOpen=true`);
  };

  const exportDemandCSV = () => {
    const headers = ["Product Title", "Total Waiting Quantity", "Orders Count"];
    const csvRows = demandSummary.map(d => [
      `"${d.productTitle.replace(/"/g, '""')}"`,
      d.totalWaitingQuantity || d.waitingCount,
      d.waitingCount
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `unfulfilled_waitlist_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFulfilledCSV = () => {
    const headers = ["Product Title", "Total Fulfilled Quantity", "Orders Count", "Date Fulfilled"];
    const csvRows = fulfilledSummary.map(f => [
      `"${f.productTitle.replace(/"/g, '""')}"`,
      f.totalFulfilledQuantity || f.fulfilledCount,
      f.fulfilledCount,
      formatDate(f.dateFulfilled)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fulfilled_waitlists_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalDemandPages = Math.ceil(demandSummary.length / rowsPerPage) || 1;
  const paginatedDemand = demandSummary.slice((demandPage - 1) * rowsPerPage, demandPage * rowsPerPage);

  const totalFulfilledPages = Math.ceil(fulfilledSummary.length / rowsPerPage) || 1;
  const paginatedFulfilled = fulfilledSummary.slice((fulfilledPage - 1) * rowsPerPage, fulfilledPage * rowsPerPage);

  const demandRows = paginatedDemand.map((item) => [
    item.productTitle,
    <Badge key={item.productId} tone="attention">
      {`${item.totalWaitingQuantity || item.waitingCount} Units requested (${item.waitingCount} orders)`}
    </Badge>,
    <Button
      key={`btn-${item.productId}`}
      size="slim"
      variant="primary"
      onClick={() => handleCreateBatch(item.productId, Number(item.totalWaitingQuantity || item.waitingCount))}
    >
      Create Batch
    </Button>,
  ]);

  const fulfilledRows = paginatedFulfilled.map((item) => [
    item.productTitle,
    <Badge key={`fulfilled-${item.productId}`} tone="success">
      {`${item.totalFulfilledQuantity || item.fulfilledCount} Units fulfilled (${item.fulfilledCount} orders)`}
    </Badge>,
    formatDate(item.dateFulfilled)
  ]);

  return (
    <Page title="Customer Waitlists">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="400">
              <div style={{ padding: "16px 16px 0 16px", display: "flex", justifyContent: "space-between" }}>
                <Text variant="headingMd" as="h3">Unfulfilled Demand</Text>
                {demandSummary.length > 0 && <Button onClick={exportDemandCSV}>Export CSV</Button>}
              </div>
              {demandSummary.length > 0 ? (
                <>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text']}
                    headings={['Product Name', 'Unfulfilled Demand', 'Action']}
                    rows={demandRows}
                  />
                  {totalDemandPages > 1 && (
                    <div style={{ padding: "16px", display: "flex", justifyContent: "center" }}>
                      <Pagination hasPrevious={demandPage > 1} onPrevious={() => setDemandPage(p => p - 1)} hasNext={demandPage < totalDemandPages} onNext={() => setDemandPage(p => p + 1)} />
                    </div>
                  )}
                </>
              ) : <div style={{ padding: "16px" }}><Text variant="bodyMd" as="p" tone="subdued">No pending waitlist items.</Text></div>}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="400">
              <div style={{ padding: "16px 16px 0 16px", display: "flex", justifyContent: "space-between" }}>
                <Text variant="headingMd" as="h3">Fulfilled Requests</Text>
                {fulfilledSummary.length > 0 && <Button onClick={exportFulfilledCSV}>Export CSV</Button>}
              </div>
              {fulfilledSummary.length > 0 ? (
                <>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text']}
                    headings={['Product Name', 'Fulfilled Demand', 'Date Fulfilled']}
                    rows={fulfilledRows}
                  />
                  {totalFulfilledPages > 1 && (
                    <div style={{ padding: "16px", display: "flex", justifyContent: "center" }}>
                      <Pagination hasPrevious={fulfilledPage > 1} onPrevious={() => setFulfilledPage(p => p - 1)} hasNext={fulfilledPage < totalFulfilledPages} onNext={() => setFulfilledPage(p => p + 1)} />
                    </div>
                  )}
                </>
              ) : <div style={{ padding: "16px" }}><Text variant="bodyMd" as="p" tone="subdued">No fulfilled waitlist items.</Text></div>}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}