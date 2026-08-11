import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useSearchParams, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { productMetaProfiles, productBatches, batchLosses, batchWaitlists, activityLogs } from "~/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { 
  Page, 
  Layout, 
  Card, 
  DataTable, 
  Select, 
  TextField, 
  Button, 
  Thumbnail,
  FormLayout,
  Badge,
  Text,
  Banner,
  BlockStack,
  Pagination
} from "@shopify/polaris";
import { useState, useEffect } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const products = await db
    .select()
    .from(productMetaProfiles)
    .where(eq(productMetaProfiles.shopDomain, shopDomain));

  const batches = await db
    .select({
      id: productBatches.id,
      batchNumber: productBatches.batchNumber,
      initialQuantity: productBatches.initialQuantity,
      remainingQuantity: productBatches.remainingQuantity,
      productionDate: productBatches.productionDate,
      expiryDate: productBatches.expiryDate,
      isActive: productBatches.isActive,
      productTitle: productMetaProfiles.title,
      imageUrl: productMetaProfiles.imageUrl,
      shopifyProductId: productMetaProfiles.shopifyProductId,
    })
    .from(productBatches)
    .innerJoin(productMetaProfiles, and(
      eq(productBatches.productId, productMetaProfiles.shopifyProductId),
      eq(productBatches.shopDomain, shopDomain)
    ))
    .where(eq(productBatches.shopDomain, shopDomain))
    .orderBy(desc(productBatches.createdAt));

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

  return { products, batches, demandSummary };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const productProfileId = parseInt(formData.get("productProfileId") as string, 10);
    const quantity = parseInt(formData.get("quantity") as string, 10) || 50;
    const productionDateStr = formData.get("productionDate") as string;
    const expiryDateStr = formData.get("expiryDate") as string;

    if (!productProfileId) return Response.json({ success: false, error: "Product selection is required." }, { status: 400 });
    if (!productionDateStr || !expiryDateStr) return Response.json({ success: false, error: "Both production date and expiration date are required." }, { status: 400 });
    if (expiryDateStr < productionDateStr) return Response.json({ success: false, error: "Expiration date cannot be earlier than the production date." }, { status: 400 });

    const [profile] = await db
      .select()
      .from(productMetaProfiles)
      .where(and(eq(productMetaProfiles.id, productProfileId), eq(productMetaProfiles.shopDomain, shopDomain)))
      .limit(1);

    if (!profile || !profile.shopifyProductId) {
      return Response.json({ success: false, error: "Associated Shopify Product ID not found for this profile." }, { status: 400 });
    }

    const dateSlug = productionDateStr.replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const batchNumber = `BATCH-${dateSlug}-${randomSuffix}`;

    const productionDate = new Date(productionDateStr);
    const expiryDate = new Date(expiryDateStr);

    await db.insert(productBatches).values({
      shopDomain,
      productId: profile.shopifyProductId,
      batchNumber,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      productionDate,
      expiryDate,
      isActive: true,
    });

    await db
      .update(batchWaitlists)
      .set({ status: "notified", dateFulfilled: new Date() })
      .where(
        and(
          eq(batchWaitlists.shopDomain, shopDomain),
          eq(batchWaitlists.productId, profile.shopifyProductId),
          eq(batchWaitlists.status, "waiting")
        )
      );

    await db.insert(activityLogs).values({
      shopDomain,
      actionType: "BATCH_CREATED",
      description: `Created batch ${batchNumber} for "${profile.title}" with ${quantity} units.`,
    });

    return Response.json({ success: true });
  }

  if (intent === "delete") {
    const id = parseInt(formData.get("id") as string, 10);
    if (!id) return Response.json({ success: false, error: "Missing batch ID" }, { status: 400 });

    const [batchToDelete] = await db
      .select()
      .from(productBatches)
      .where(
        and(
          eq(productBatches.id, id),
          eq(productBatches.shopDomain, shopDomain)
        )
      )
      .limit(1);

    if (batchToDelete && batchToDelete.remainingQuantity > 0) {
      const [profileMatch] = await db
        .select()
        .from(productMetaProfiles)
        .where(
          and(
            eq(productMetaProfiles.shopDomain, shopDomain),
            eq(productMetaProfiles.shopifyProductId, batchToDelete.productId)
          )
        )
        .limit(1);

      if (profileMatch) {
        await db.insert(batchLosses).values({
          shopDomain: shopDomain,
          productProfileId: profileMatch.id,
          batchNumber: batchToDelete.batchNumber,
          quantityLost: batchToDelete.remainingQuantity,
          preparedDate: batchToDelete.productionDate.toISOString().split("T")[0],
          expirationDate: batchToDelete.expiryDate ? batchToDelete.expiryDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          reason: "MANUAL_DISCARD",
        });
      }
    }

    await db
      .delete(productBatches)
      .where(
        and(
          eq(productBatches.id, id),
          eq(productBatches.shopDomain, shopDomain)
        )
      );

    await db.insert(activityLogs).values({
      shopDomain,
      actionType: "BATCH_DELETED",
      description: `Deleted batch ${batchToDelete?.batchNumber || id}. Remaining quantity: ${batchToDelete?.remainingQuantity ?? 0} units.`,
    });

    return Response.json({ success: true });
  }

  return Response.json({ success: false, error: "Invalid action intent" }, { status: 400 });
}

export default function BatchManagement() {
  const { products, batches, demandSummary } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ success?: boolean; error?: string }>();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [showForm, setShowForm] = useState(false);
  const [productProfileId, setProductProfileId] = useState("");
  const [quantity, setQuantity] = useState("50");
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split("T")[0]);
  const [expirationDate, setExpirationDate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [productionStart, setProductionStart] = useState("");
  const [productionEnd, setProductionEnd] = useState("");
  const [expiryStart, setExpiryStart] = useState("");
  const [expiryEnd, setExpiryEnd] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const isProductionRangeInvalid = productionStart && productionEnd && productionStart > productionEnd;
  const isExpiryRangeInvalid = expiryStart && expiryEnd && expiryStart > expiryEnd;

  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setShowForm(false);
        setQuantity("50");
        setExpirationDate("");
        setErrorMessage("");
      } else if (actionData.error) {
        setErrorMessage(actionData.error);
      }
    }
  }, [actionData]);

  useEffect(() => {
    const profileIdParam = searchParams.get("profileId");
    const quantityParam = searchParams.get("quantity");
    const autoOpenParam = searchParams.get("autoOpen");

    if (profileIdParam) {
      setProductProfileId(profileIdParam);
    } else if (products.length > 0 && !productProfileId) {
      setProductProfileId(String(products[0].id));
    }

    if (quantityParam) {
      setQuantity(quantityParam);
    }

    if (autoOpenParam === "true") {
      setShowForm(true);
    }
  }, [searchParams, products]);

  const productOptions = products.map((p) => ({
    label: p.title,
    value: String(p.id),
  }));

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!productProfileId) {
      setErrorMessage("Please select a valid menu item.");
      return;
    }

    if (!productionDate || !expirationDate) {
      setErrorMessage("Both Production Date and Expiration Date are required.");
      return;
    }

    if (expirationDate < productionDate) {
      setErrorMessage("Expiration date cannot be earlier than the production date.");
      return;
    }

    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("productProfileId", productProfileId);
    formData.append("quantity", quantity);
    formData.append("productionDate", productionDate);
    formData.append("expiryDate", expirationDate);

    submit(formData, { method: "POST" });
  };

  const handleCookFromWaitlist = (productId: string, totalQuantity: number) => {
    const matchingProduct = products.find((p) => p.shopifyProductId === productId);
    if (matchingProduct) {
      setProductProfileId(String(matchingProduct.id));
      setQuantity(String(totalQuantity));
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteClick = (id: number) => {
    if (confirm("Are you sure you want to delete this batch tracking record? Remaining stock will be logged as a manual discard loss.")) {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("id", String(id));
      submit(formData, { method: "POST" });
    }
  };

  const exportBatchesCSV = () => {
    const headers = ["Product Title", "Batch Number", "Initial Quantity", "Remaining Quantity", "Production Date", "Expiry Date"];
    const csvRows = filteredBatches.map(b => [
      `"${b.productTitle.replace(/"/g, '""')}"`,
      `"${b.batchNumber}"`,
      b.initialQuantity,
      b.remainingQuantity,
      new Date(b.productionDate).toISOString().split("T")[0],
      b.expiryDate ? new Date(b.expiryDate).toISOString().split("T")[0] : "N/A"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `production_batches_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredBatches = batches.filter((batch) => {
    if (isProductionRangeInvalid || isExpiryRangeInvalid) return false;

    const prodDateStr = new Date(batch.productionDate).toISOString().split("T")[0];
    const expDateStr = batch.expiryDate ? new Date(batch.expiryDate).toISOString().split("T")[0] : "";

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = batch.productTitle?.toLowerCase().includes(query);
      const matchesBatchNum = batch.batchNumber?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesBatchNum) return false;
    }

    if (productionStart && prodDateStr < productionStart) return false;
    if (productionEnd && prodDateStr > productionEnd) return false;

    if (expiryStart && expDateStr < expiryStart) return false;
    if (expiryEnd && expDateStr > expiryEnd) return false;

    return true;
  });

  const totalPages = Math.ceil(filteredBatches.length / rowsPerPage) || 1;
  const paginatedBatches = filteredBatches.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const demandRows = demandSummary.map((item) => [
    item.productTitle,
    <Badge key={item.productId} tone="attention">{`${item.totalWaitingQuantity || item.waitingCount} Units requested (${item.waitingCount} orders)`}</Badge>,
    <Button
      key={`btn-${item.productId}`}
      size="slim"
      variant="primary"
      onClick={() => handleCookFromWaitlist(item.productId, Number(item.totalWaitingQuantity || item.waitingCount))}
    >
      Cook/Prepare New Batch
    </Button>,
  ]);

  const rows = paginatedBatches.map((batch) => {
    const expDate = batch.expiryDate ? new Date(batch.expiryDate) : null;
    if (expDate) expDate.setHours(0, 0, 0, 0);

    let diffDays = 999;
    if (expDate) {
      diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    const isExpired = diffDays < 0;
    const isNearingExpiry = diffDays >= 0 && diffDays <= 2; 
    const isLowStock = batch.remainingQuantity <= 5 && batch.remainingQuantity > 0;
    const isOutOfStock = batch.remainingQuantity === 0;

    const prodDateFormatted = new Date(batch.productionDate).toISOString().split("T")[0];
    const expDateFormatted = batch.expiryDate ? new Date(batch.expiryDate).toISOString().split("T")[0] : "N/A";

    return [
      <Thumbnail
        source={batch.imageUrl || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"}
        alt={batch.productTitle}
        size="small"
      />,
      <div>
        <Text variant="bodyMd" fontWeight="bold" as="span">{batch.productTitle}</Text>
        <div style={{ fontSize: "12px", color: "#6d7175" }}>{batch.batchNumber}</div>
      </div>,
      <div>
        {batch.remainingQuantity} / {batch.initialQuantity} units
        {isOutOfStock && <div style={{ marginTop: "2px" }}><Badge tone="critical">Sold Out</Badge></div>}
        {isLowStock && <div style={{ marginTop: "2px" }}><Badge tone="warning">Low Stock</Badge></div>}
      </div>,
      prodDateFormatted,
      <div>
        {expDateFormatted}
        {isExpired && <div style={{ marginTop: "2px" }}><Badge tone="critical">Expired</Badge></div>}
        {isNearingExpiry && !isExpired && <div style={{ marginTop: "2px" }}><Badge tone="warning">Expiring Soon</Badge></div>}
      </div>,
      <Button size="micro" tone="critical" onClick={() => handleDeleteClick(batch.id)}>Delete</Button>
    ];
  });

  return (
    <Page
      title="Kitchen & Production Batches"
      subtitle="Log specific cooking runs, monitor unit quantities, and manage kitchen prep via customer waitlists."
      primaryAction={{
        content: showForm ? "Cancel" : "New Production Batch",
        onAction: () => {
          if (!products.length) {
            alert("Please create at least one master food item in your menu catalog first!");
            return;
          }
          setShowForm(!showForm);
        },
      }}
    >
      <Layout>
        {demandSummary.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">Kitchen Production Planning (Waitlist Demand)</Text>
                <DataTable
                  columnContentTypes={['text', 'text', 'text']}
                  headings={['Product Name', 'Unfulfilled Demand', 'Action']}
                  rows={demandRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {showForm && (
          <Layout.Section>
            <Card>
              <form onSubmit={handleCreateSubmit}>
                <FormLayout>
                  <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Log New Production Batch</h3>
                  {errorMessage && <Banner tone="critical"><p>{errorMessage}</p></Banner>}
                  <Select label="Select Menu Item" options={productOptions} value={productProfileId} onChange={setProductProfileId} />
                  <TextField label="Initial Batch Quantity (Units)" type="number" value={quantity} onChange={setQuantity} autoComplete="off" />
                  <FormLayout.Group>
                    <TextField label="Production Date" type="date" value={productionDate} onChange={setProductionDate} autoComplete="off" />
                    <TextField label="Expiration Date" type="date" value={expirationDate} onChange={setExpirationDate} autoComplete="off" />
                  </FormLayout.Group>
                  <Button variant="primary" loading={isSubmitting} submit>Save Batch Entry</Button>
                </FormLayout>
              </form>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingSm" as="h3">Filter Batches</Text>
              <TextField label="Search by Product Title or Batch Code" value={searchQuery} onChange={setSearchQuery} autoComplete="off" clearButton onClearButtonClick={() => setSearchQuery("")} />
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <TextField label="Production Start Date" type="date" value={productionStart} onChange={setProductionStart} autoComplete="off" />
                <TextField label="Production End Date" type="date" value={productionEnd} onChange={setProductionEnd} autoComplete="off" />
              </div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <TextField label="Expiry Start Date" type="date" value={expiryStart} onChange={setExpiryStart} autoComplete="off" />
                <TextField label="Expiry End Date" type="date" value={expiryEnd} onChange={setExpiryEnd} autoComplete="off" />
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="400">
              <div style={{ padding: "16px 16px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="headingSm" as="h3">Batch Records ({filteredBatches.length})</Text>
                <Button onClick={exportBatchesCSV}>Export Batches CSV</Button>
              </div>
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Image", "Product & Batch Code", "Remaining / Initial Quantity", "Production Date", "Expiration Date", "Actions"]}
                rows={rows}
              />
              {totalPages > 1 && (
                <div style={{ padding: "16px", display: "flex", justifyContent: "center" }}>
                  <Pagination
                    hasPrevious={currentPage > 1}
                    onPrevious={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                    hasNext={currentPage < totalPages}
                    onNext={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  />
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}