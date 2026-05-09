import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Printing devices — each device has a unique QR token that links to its session portal.
 * The printNodePrinterId is the printer ID from the PrintNode account.
 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  printNodePrinterId: varchar("printNodePrinterId", { length: 64 }),
  pricePerPage: decimal("pricePerPage", { precision: 10, scale: 2 }).notNull().default("0.50"),
  pricePerPageBW: decimal("pricePerPageBW", { precision: 10, scale: 2 }).notNull().default("0.50"),
  pricePerPageColor: decimal("pricePerPageColor", { precision: 10, scale: 2 }).notNull().default("1.00"),
  qrToken: varchar("qrToken", { length: 128 }).notNull().unique(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

/**
 * Print jobs — one job per user session. Tracks payment and print status.
 */
export const printJobs = mysqlTable("printJobs", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  sessionToken: varchar("sessionToken", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "paid", "printing", "done", "failed"]).default("pending").notNull(),
  totalPages: int("totalPages").default(0).notNull(),
  totalCost: decimal("totalCost", { precision: 10, scale: 2 }).default("0.00").notNull(),
  paymentRef: varchar("paymentRef", { length: 255 }),
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  printNodeJobId: varchar("printNodeJobId", { length: 64 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerName: varchar("customerName", { length: 255 }),
  customerPhone: varchar("customerPhone", { length: 32 }),
  notes: text("notes"),
  paidAt: timestamp("paidAt"),
  printedAt: timestamp("printedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PrintJob = typeof printJobs.$inferSelect;
export type InsertPrintJob = typeof printJobs.$inferInsert;

/**
 * Files attached to a print job. Each file has its own page count and copy quantity.
 */
export const printJobFiles = mysqlTable("printJobFiles", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileType: mysqlEnum("fileType", ["pdf", "docx", "jpg", "png", "jpeg"]).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  pageCount: int("pageCount").default(1).notNull(),
  copies: int("copies").default(1).notNull(),
  colorMode: mysqlEnum("colorMode", ["bw", "color"]).default("bw").notNull(),
  fileSizeBytes: int("fileSizeBytes").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PrintJobFile = typeof printJobFiles.$inferSelect;
export type InsertPrintJobFile = typeof printJobFiles.$inferInsert;

/**
 * Global settings key-value store for app configuration.
 */
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key_name", { length: 128 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
