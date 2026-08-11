import { mysqlTable, serial, varchar, text, int, bigint, timestamp, mysqlEnum, boolean } from 'drizzle-orm/mysql-core';

export const shopifySessions = mysqlTable('shopify_sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  shop: varchar('shop', { length: 255 }).notNull(),
  state: varchar('state', { length: 255 }).notNull(),
  isOnline: boolean('isOnline').notNull().default(false),
  scope: text('scope'),
  expires: bigint('expires', { mode: 'number' }),
  accessToken: text('accessToken'),
  userId: bigint('userId', { mode: 'number' }),
  firstName: varchar('firstName', { length: 255 }),
  lastName: varchar('lastName', { length: 255 }),
  email: varchar('email', { length: 255 }),
  accountOwner: boolean('accountOwner').default(false),
  locale: varchar('locale', { length: 255 }),
  collaborator: boolean('collaborator').default(false),
  emailVerified: boolean('emailVerified').default(false),
  refreshToken: text('refreshToken'),
  refreshTokenExpires: bigint('refreshTokenExpires', { mode: 'number' }),
});

// Master Catalog (Defines what the item is and its macros)
export const productMetaProfiles = mysqlTable('product_meta_profiles', {
  id: serial('id').primaryKey(),
  shopDomain: varchar('shop_domain', { length: 255 }).notNull(),
  shopifyProductId: varchar('shopify_product_id', { length: 100 }),
  title: varchar('title', { length: 100 }).notNull(),
  handle: varchar('handle', { length: 150 }),
  imageUrl: varchar("image_url", { length: 500 }),
  dietType: varchar('diet_type', { length: 50 }).notNull(),
  proteinGrams: int('protein_grams').notNull(),
  carbGrams: int('carb_grams').notNull(),
  fatGrams: int('fat_grams').notNull(),
  calories: int('calories').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

// Production Batches for Food / Supplements
export const productBatches = mysqlTable("product_batches", {
  id: serial("id").primaryKey(),
  shopDomain: varchar("shop_domain", { length: 255 }).notNull(),
  productId: varchar("product_id", { length: 255 }).notNull(), // Shopify Product ID
  batchNumber: varchar("batch_number", { length: 100 }).notNull(), // e.g. "BATCH-KETO-0812"
  initialQuantity: int("initial_quantity").notNull(),
  remainingQuantity: int("remaining_quantity").notNull(),
  productionDate: timestamp("production_date").defaultNow().notNull(),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Waitlist for Sold-Out Batches / Products
export const batchWaitlists = mysqlTable("batch_waitlists", {
  id: serial("id").primaryKey(),
  shopDomain: varchar("shop_domain", { length: 255 }).notNull(),
  productId: varchar("product_id", { length: 255 }).notNull(),
  productTitle: varchar("product_title", { length: 255 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  quantity: int("quantity").notNull().default(1), // Quantity tracking added,
  dateFulfilled: timestamp("date_fulfilled"),
  status: mysqlEnum("status", ["waiting", "notified", "fulfilled"]).default("waiting").notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recommendationRules = mysqlTable('recommendation_rules', {
  id: serial('id').primaryKey(),
  shopDomain: varchar('shop_domain', { length: 255 }).notNull(),
  ruleName: varchar('rule_name', { length: 100 }).notNull(),
  targetDiet: varchar('target_diet', { length: 50 }).notNull(),
  proteinWeight: int('protein_weight').default(50).notNull(),
  isPriorityActive: boolean('is_priority_active').default(true).notNull(),
});

export const activityLogs = mysqlTable('activity_logs', {
  id: serial('id').primaryKey(),
  shopDomain: varchar('shop_domain', { length: 255 }).notNull(),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const batchLosses = mysqlTable("batch_losses", {
  id: int("id").autoincrement().primaryKey(),
  shopDomain: varchar("shop_domain", { length: 255 }).notNull(),
  productProfileId: bigint('product_profile_id', { unsigned: true, mode: 'number' })
    .notNull()
    .references(() => productMetaProfiles.id, { onDelete: 'cascade' }),
  batchNumber: varchar("batch_number", { length: 100 }).notNull(),
  quantityLost: int("quantity_lost").notNull(),
  preparedDate: varchar("prepared_date", { length: 50 }).notNull(),
  expirationDate: varchar("expiration_date", { length: 50 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  archivedAt: timestamp("archived_at").defaultNow(),
});