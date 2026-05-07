import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  devices,
  printJobs,
  printJobFiles,
  settings,
  InsertDevice,
  InsertPrintJob,
  InsertPrintJobFile,
  Device,
  PrintJob,
  PrintJobFile,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export async function createDevice(data: InsertDevice) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(devices).values(data);
  const result = await db.select().from(devices).where(eq(devices.qrToken, data.qrToken)).limit(1);
  return result[0];
}

export async function listDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devices).orderBy(desc(devices.createdAt));
}

export async function getDeviceByQrToken(qrToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(eq(devices.qrToken, qrToken)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDeviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateDevice(id: number, data: Partial<InsertDevice>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(devices).set(data).where(eq(devices.id, id));
  return getDeviceById(id);
}

export async function deleteDevice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(devices).set({ isActive: 0 }).where(eq(devices.id, id));
}

// ─── Print Jobs ───────────────────────────────────────────────────────────────

export async function createPrintJob(data: InsertPrintJob) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(printJobs).values(data);
  const result = await db
    .select()
    .from(printJobs)
    .where(eq(printJobs.sessionToken, data.sessionToken))
    .limit(1);
  return result[0];
}

export async function getPrintJobBySessionToken(sessionToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(printJobs)
    .where(eq(printJobs.sessionToken, sessionToken))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPrintJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(printJobs).where(eq(printJobs.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listPrintJobs(deviceId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (deviceId) {
    return db
      .select()
      .from(printJobs)
      .where(eq(printJobs.deviceId, deviceId))
      .orderBy(desc(printJobs.createdAt));
  }
  return db.select().from(printJobs).orderBy(desc(printJobs.createdAt));
}

export async function updatePrintJob(id: number, data: Partial<InsertPrintJob>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(printJobs).set(data).where(eq(printJobs.id, id));
  return getPrintJobById(id);
}

export async function updatePrintJobBySessionToken(
  sessionToken: string,
  data: Partial<InsertPrintJob>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(printJobs).set(data).where(eq(printJobs.sessionToken, sessionToken));
  return getPrintJobBySessionToken(sessionToken);
}

// ─── Print Job Files ──────────────────────────────────────────────────────────

export async function addPrintJobFile(data: InsertPrintJobFile) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(printJobFiles).values(data);
  const result = await db
    .select()
    .from(printJobFiles)
    .where(eq(printJobFiles.fileKey, data.fileKey))
    .limit(1);
  return result[0];
}

export async function getFilesByJobId(jobId: number): Promise<PrintJobFile[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(printJobFiles).where(eq(printJobFiles.jobId, jobId));
}

export async function updatePrintJobFile(id: number, data: Partial<InsertPrintJobFile>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(printJobFiles).set(data).where(eq(printJobFiles.id, id));
}

export async function deletePrintJobFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(printJobFiles).where(eq(printJobFiles.id, id));
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result.length > 0 ? (result[0].value ?? null) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(settings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalJobs: 0, pendingJobs: 0, paidJobs: 0, doneJobs: 0, totalRevenue: "0" };

  const allJobs = await db.select().from(printJobs);
  const totalJobs = allJobs.length;
  const pendingJobs = allJobs.filter((j) => j.status === "pending").length;
  const paidJobs = allJobs.filter((j) => j.status === "paid" || j.status === "printing").length;
  const doneJobs = allJobs.filter((j) => j.status === "done").length;
  const totalRevenue = allJobs
    .filter((j) => j.status !== "pending" && j.status !== "failed")
    .reduce((sum, j) => sum + parseFloat(j.totalCost?.toString() ?? "0"), 0)
    .toFixed(2);

  return { totalJobs, pendingJobs, paidJobs, doneJobs, totalRevenue };
}
