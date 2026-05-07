import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock database helpers ────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createDevice: vi.fn(),
  listDevices: vi.fn().mockResolvedValue([]),
  getDeviceByQrToken: vi.fn(),
  getDeviceById: vi.fn(),
  updateDevice: vi.fn(),
  deleteDevice: vi.fn(),
  createPrintJob: vi.fn(),
  getPendingJobByDeviceId: vi.fn().mockResolvedValue(undefined),
  getPrintJobBySessionToken: vi.fn(),
  getPrintJobById: vi.fn(),
  listPrintJobs: vi.fn().mockResolvedValue([]),
  updatePrintJob: vi.fn(),
  updatePrintJobBySessionToken: vi.fn(),
  addPrintJobFile: vi.fn(),
  getFilesByJobId: vi.fn().mockResolvedValue([]),
  updatePrintJobFile: vi.fn(),
  deletePrintJobFile: vi.fn(),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn(),
  getAdminStats: vi.fn().mockResolvedValue({
    totalJobs: 0,
    pendingJobs: 0,
    paidJobs: 0,
    doneJobs: 0,
    totalRevenue: "0",
  }),
}));

vi.mock("./printnode", () => ({
  listPrinters: vi.fn().mockResolvedValue([]),
  testPrintNodeConnection: vi.fn().mockResolvedValue(true),
  submitPrintJob: vi.fn().mockResolvedValue(12345),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,abc123"),
  },
}));

// ─── Context factories ────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeAdminCtx(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-open-id",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeUserCtx(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "user-open-id",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Auth tests ───────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("admin");
  });
});

// ─── Admin stats tests ────────────────────────────────────────────────────────
describe("admin.stats", () => {
  it("returns stats for admin users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.stats();
    expect(result).toMatchObject({
      totalJobs: 0,
      pendingJobs: 0,
      doneJobs: 0,
    });
  });

  it("throws FORBIDDEN for regular users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.admin.stats()).rejects.toThrow("Admin access required");
  });

  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.admin.stats()).rejects.toThrow();
  });
});

// ─── Devices tests ────────────────────────────────────────────────────────────
describe("devices.list", () => {
  it("returns empty array when no devices exist", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.devices.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.devices.list()).rejects.toThrow("Admin access required");
  });
});

describe("devices.create", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(
      caller.devices.create({ name: "Test Device", pricePerPage: "0.50" })
    ).rejects.toThrow("Admin access required");
  });

  it("validates required name field", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await expect(
      caller.devices.create({ name: "", pricePerPage: "0.50" })
    ).rejects.toThrow();
  });
});

describe("devices.generateQrCode", () => {
  it("throws NOT_FOUND for non-existent device", async () => {
    const { getDeviceById } = await import("./db");
    vi.mocked(getDeviceById).mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(makeAdminCtx());
    await expect(
      caller.devices.generateQrCode({ deviceId: 999, baseUrl: "https://example.com" })
    ).rejects.toThrow("Device not found");
  });

  it("generates QR code for valid device", async () => {
    const { getDeviceById } = await import("./db");
    vi.mocked(getDeviceById).mockResolvedValueOnce({
      id: 1,
      name: "Test Device",
      location: null,
      printNodePrinterId: null,
      pricePerPage: "0.50",
      qrToken: "test-qr-token-123",
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.devices.generateQrCode({
      deviceId: 1,
      baseUrl: "https://example.com",
    });

    expect(result.qrDataUrl).toContain("data:image/png;base64");
    expect(result.url).toContain("/print/test-qr-token-123");
  });
});

// ─── Session tests ────────────────────────────────────────────────────────────
describe("session.getDeviceByToken", () => {
  it("throws NOT_FOUND for invalid QR token", async () => {
    const { getDeviceByQrToken } = await import("./db");
    vi.mocked(getDeviceByQrToken).mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.session.getDeviceByToken({ qrToken: "invalid-token" })
    ).rejects.toThrow("Device not found or inactive");
  });

  it("throws NOT_FOUND for inactive device", async () => {
    const { getDeviceByQrToken } = await import("./db");
    vi.mocked(getDeviceByQrToken).mockResolvedValueOnce({
      id: 1,
      name: "Inactive Device",
      location: null,
      printNodePrinterId: null,
      pricePerPage: "0.50",
      qrToken: "test-token",
      isActive: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.session.getDeviceByToken({ qrToken: "test-token" })
    ).rejects.toThrow("Device not found or inactive");
  });

  it("returns device info for valid active token", async () => {
    const { getDeviceByQrToken } = await import("./db");
    vi.mocked(getDeviceByQrToken).mockResolvedValueOnce({
      id: 1,
      name: "Library Station A",
      location: "Ground Floor",
      printNodePrinterId: "123",
      pricePerPage: "0.75",
      qrToken: "valid-token",
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.session.getDeviceByToken({ qrToken: "valid-token" });
    expect(result.name).toBe("Library Station A");
    expect(result.pricePerPage).toBe("0.75");
  });
});

describe("session.createSession", () => {
  it("creates a new session for a valid device", async () => {
    const { getDeviceByQrToken, createPrintJob, getPendingJobByDeviceId } = await import("./db");
    vi.mocked(getPendingJobByDeviceId).mockResolvedValueOnce(undefined);
    vi.mocked(getDeviceByQrToken).mockResolvedValueOnce({
      id: 1,
      name: "Test Device",
      location: null,
      printNodePrinterId: null,
      pricePerPage: "0.50",
      qrToken: "valid-qr",
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(createPrintJob).mockResolvedValueOnce({
      id: 42,
      deviceId: 1,
      sessionToken: "session-abc-123",
      status: "pending",
      totalPages: 0,
      totalCost: "0.00",
      paymentRef: null,
      paymentMethod: null,
      printNodeJobId: null,
      customerEmail: null,
      customerName: null,
      notes: null,
      paidAt: null,
      printedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.session.createSession({ qrToken: "valid-qr" });
    expect(result.sessionToken).toBeDefined();
    expect(result.jobId).toBeDefined();
  });
});

// ─── Admin settings tests ─────────────────────────────────────────────────────
describe("admin.getSettings", () => {
  it("returns null when no API key is configured", async () => {
    const { getSetting } = await import("./db");
    vi.mocked(getSetting).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getSettings();
    expect(result.printNodeApiKey).toBeNull();
  });

  it("returns masked value when API key is configured", async () => {
    const { getSetting } = await import("./db");
    vi.mocked(getSetting).mockResolvedValueOnce("actual-api-key-here");

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getSettings();
    expect(result.printNodeApiKey).toBe("***configured***");
  });
});

describe("admin.updateSettings", () => {
  it("saves the PrintNode API key", async () => {
    const { setSetting } = await import("./db");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.updateSettings({ printNodeApiKey: "new-api-key" });
    expect(result.success).toBe(true);
    expect(setSetting).toHaveBeenCalledWith("printNodeApiKey", "new-api-key");
  });
});

// ─── Admin jobs tests ─────────────────────────────────────────────────────────
describe("admin.listJobs", () => {
  it("returns empty array when no jobs exist", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.listJobs({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.updateJobStatus", () => {
  it("updates job status to done", async () => {
    const { updatePrintJob } = await import("./db");
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.updateJobStatus({ id: 1, status: "done" });
    expect(result.success).toBe(true);
    expect(updatePrintJob).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "done", printedAt: expect.any(Date) })
    );
  });

  it("sets paidAt when status is paid", async () => {
    const { updatePrintJob } = await import("./db");
    const caller = appRouter.createCaller(makeAdminCtx());
    await caller.admin.updateJobStatus({ id: 1, status: "paid" });
    expect(updatePrintJob).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "paid", paidAt: expect.any(Date) })
    );
  });
});
