# APP_DECISIONS

## 1. Store concept: MacroForge Fitness Store

MacroForge is a specialized e-commerce storefront designed to fuel peak physical performance by offering an integrated ecosystem of elite gym gear, precision meal prep products, and clean supplementation-featuring high-contrast, clean modern aesthetics, explicit nutritional breakdowns, and seamless dietary matching (such as Keto, Vegan, Carnivore, and Balanced/Omnivore options).

### Store Standout Feature: Forge Stack Bundle Builder
The signature feature of the storefront is the Forge Stack Builder, an interactive, real-time bundle-building tool. It empowers customers to curate custom stacks of meals, meal prep products, and supplements tailored to their precise nutritional goals.

**Interactive Bundle Building**: Users select and mix items dynamically on a unified interface, seeing their aggregated macros (protein, carbs, fats, and total calories) update instantly.

**Dynamic Discount Calculation**: To incentivize larger volume purchases and help customers build complete nutritional stacks, the system calculates a tiered dynamic discount based on the total bundle value. For instance, exceeding $150 on a single bundle will activate higher tier discounts of up to 20%, encouraging higher Average Order Value (AOV) while delivering perceived value to the buyer. The discount is powered by an app extension that intercepts bundle creations and dynamically applies discounts to the products included in said bundles.

## 2. App Idea & Core Systems

### A. Food Batch Management System
For food and supplement vendors, tracking production lifecycles and perishability is critical to safety, compliance, and waste reduction.

**Batch Tracking & Expiration Control**: Vendors can log specific cooking or manufacturing runs with unique batch codes, initial and remaining quantities, and strict production-to-expiration date parameters.

**Automated Loss Logging**: If a batch reaches expiration or is manually discarded, the system automatically archives the remaining stock into a dedicated loss ledger to maintain accurate operational accountability.

**Demand-Driven Production**: The system connects live customer waitlist demand directly to the kitchen, allowing staff to view unfulfilled product demand and instantly spin up new production batches to clear backlogs.

### B. Dietary Recommendation Engine
To personalize the shopping experience, MacroForge includes a flexible recommendation engine. This is a theme extension that integrates seamlessly into store interfaces.

**Dietary Scoring Algorithm**: The engine evaluates products against custom dietary rules and macro profiles (e.g., keto, high-protein, low-carb, vegan).

**Dynamic Storefront Integration**: It scores and ranks products in real-time, matching items to a user's selected diet type to serve contextual recommendations directly on the storefront.

## 3. Key architecture/schema decisions

The application utilizes Drizzle ORM coupled with a robust relational database structure. Each schema was intentionally designed to isolate concerns, ensure data integrity, and support scalable querying.

### productMetaProfiles

**Design**: Acts as a localized metadata layer linked to Shopify's product catalog (shopifyProductId).

**Why**: Decouples heavy custom properties (macros, dietary tags, internal categorizations) from Shopify's native API calls, ensuring lightning-fast lookup and filtering speeds for the recommendation engine and stack builder.

### productBatches

**Design**: Tracks individual production runs with initialQuantity, remainingQuantity, productionDate, and expiryDate.

**Why**: Essential for **FIFO (First-In, First-Out)** inventory control and tracking expiration lifecycles down to the specific batch number rather than just total stock counts.

### batchLosses

**Design**: An immutable archival table logging discarded or expired quantities, reasons (MANUAL_DISCARD, etc.), and dates.

**Why**: Keeps the active inventory tables clean while preserving historical audit trails for financial tracking and waste analysis.

### batchWaitlists

**Design**: Captures customer demand for out-of-stock or unbatched items, featuring a lifecycle status (waiting vs. notified) and a fulfillment timestamp (dateFulfilled tracked via a consistent timestamp).

**Why**: Translates lost sales opportunities into actionable kitchen prep lists, bridging storefront demand with back-of-house production planning.

### recommendationRules

**Design**: Stores weighted scoring parameters for various diet types.

**Why**: Allows store admins to tweak recommendation logic dynamically via the admin panel without requiring code deployments.

### activityLogs

**Design**: A centralized audit log recording administrative actions (actionType, description, createdAt).

**Why**: Provides store owners with full visibility into back-office modifications (batch creation, deletions, manual syncs) for operational transparency.

## 4. Tradeoffs

### Admin-Centric Waitlist & Notification Workflow:

Currently, the waitlist and batch fulfillment systems operate entirely on the admin and preparation side. When a customer registers interest in an unbatched item, it populates the admin waitlist; when a batch is created, it marks those requests as fulfilled. However, there is no automated customer-facing notification (such as automated emails or SMS alerts) triggered to notify the buyer that their item has been restocked or batched.

### Tabular Reporting vs. Graphical Charts:

All operational reports and summaries utilize formatted data tables rather than visual charts or graphs.


## 5. What I'd improve with more time

1. **Automated Customer Notifications**: Implement transactional email/SMS triggers via Shopify webhooks that automatically alert waitlisted customers the moment a matching batch is created or restocked.

2. **Advanced Analytics Dashboard**: Introduce visual trend analysis (using lightweight charting libraries) to track waste patterns, historical demand velocity, and seasonal macro preferences over time.

3. **Enhanced Stack Builder Customization**: Allow merchants to define custom macro threshold rules directly inside the Forge Stack Builder, giving customers real-time warnings if their custom bundle deviates too far from their target nutritional profile. In addition, extra information such as height, weight, age, and activity levels which are standard for caloric computations could be integrated with the user account interface for better recommendations and metrics.
