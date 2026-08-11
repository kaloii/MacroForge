# MacroForge
Smart Macro & Dietary Recommendation Engine + Custom Shopify Theme

MacroForge is an all-in-one e-commerce and back-of-house operations solution tailored specifically for health food, meal prep, and supplement vendors. It bridges the gap between customer-facing dietary personalization and rigorous kitchen inventory management.

---
## 🚀 Key Features
### 1. The Forge Stack Builder (Storefront Feature)
**Interactive Bundle Building**: Empowers customers to curate custom stacks of meals or supplements on a unified interface.

**Real-Time Macro Aggregation**: Automatically calculates and displays total protein, carbs, fats, and calories as items are added or swapped.

**Dynamic Discount Calculation**: Features tier-based discount incentives that automatically scale up as customers add more items to their bundle, boosting Average Order Value (AOV).

### 2. Food Batch Management System (Admin Feature)
**Batch Tracking & Expiration Control**: Log specific cooking or manufacturing runs with unique batch codes, initial/remaining quantities, and strict production-to-expiration date parameters.

**Automated Loss Archiving**: Automatically logs expired or manually discarded stock into a dedicated loss ledger for financial tracking and waste audit compliance.

**Demand-Driven Production**: Connects unfulfilled customer waitlist demand directly to back-of-house kitchen planning so staff can instantly spin up new production batches.

### 3. Smart Dietary Recommendation Engine
**Scoring Algorithm**: Evaluates products against custom weighted dietary rules and macro profiles (keto, high-protein, low-carb, vegan).

**Storefront Personalization**: Serves contextual, real-time product recommendations matching the buyer's selected diet type.
---
## 🛠️ Tech Stack
**Framework**: React-Router (Shopify App Template)

**UI Library**: Shopify Polaris

**Database & ORM**: Drizzle ORM (with SQLite/PostgreSQL support)

**Platform**: Shopify CLI & Admin API

## 📂 Project Structure
```
macroforge/
├── macroforge-app/        # Shopify Remix App (Backend, Admin UI, Drizzle Schema)
│   ├── app/               # Routes, components, server utilities
│   ├── db/                # Drizzle ORM schema definitions and database connection
│   └── drizzle/           # Migration history
└── macroforge-theme/      # Custom Shopify Storefront Theme & Forge Stack Builder
```

## ⚙️ Getting Started & Local Development
Prerequisites
Node.js (v18+)
Shopify CLI installed globally

### 1. Clone & Setup the App
Navigate to the app directory and install dependencies:

```bash
cd macroforge-app
npm install
```

### 2. Configure Environment Variables
Create a .env file in macroforge-app/ based on your configuration requirements (including your Shopify API keys and database URL).

### 3. Run Database Migrations (Drizzle)
Generate and apply your Drizzle ORM schema migrations:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 4. Run the Development Server
Start the Shopify app tunnel and local server:

```bash
npm run dev
```