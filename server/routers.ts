import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  createDevice,
  listDevices,
  getDeviceByQrToken,
  getDeviceById,
  updateDevice,
  deleteDevice,
  createPrintJob,
  getPrintJobBySessionToken,
  getPrintJobById,
  listPrintJobs,
  updatePrintJob,
  updatePrintJobBySessionToken,
  addPrintJobFile,
  getFilesByJobId,
  updatePrintJobFile,
  deletePrintJobFile,
  getSetting,
  setSetting,
  getAdminStats,
  getPendingJobByDeviceId,
} from "./db";
import { listPrinters, testPrintNodeConnection, submitPrintJob } from "./printnode";

// ─── Admin-only middleware ────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Devices ───────────────────────────────────────────────────────────────

  devices: router({
    list: adminProcedure.query(async () => {
      return listDevices();
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          location: z.string().optional(),
          printNodePrinterId: z.string().optional(),
          pricePerPage: z.string().default("0.50"),
        })
      )
      .mutation(async ({ input }) => {
        const qrToken = nanoid(32);
        return createDevice({
          name: input.name,
          location: input.location ?? null,
          printNodePrinterId: input.printNodePrinterId ?? null,
          pricePerPage: input.pricePerPage,
          qrToken,
          isActive: 1,
        });
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          location: z.string().optional(),
          printNodePrinterId: z.string().optional(),
          pricePerPage: z.string().optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateDevice(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDevice(input.id);
        return { success: true };
      }),

    generateQrCode: adminProcedure
      .input(z.object({ deviceId: z.number(), baseUrl: z.string() }))
      .mutation(async ({ input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device) throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
        const url = `${input.baseUrl}/print/${device.qrToken}`;
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: "#1a1a2e", light: "#ffffff" },
        });
        return { qrDataUrl, url, device };
      }),
  }),

  // ─── Print Sessions (public — accessed via QR code) ────────────────────────

  session: router({
    getDeviceByToken: publicProcedure
      .input(z.object({ qrToken: z.string() }))
      .query(async ({ input }) => {
        const device = await getDeviceByQrToken(input.qrToken);
        if (!device || !device.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found or inactive" });
        }
        return {
          id: device.id,
          name: device.name,
          location: device.location,
          pricePerPage: device.pricePerPage,
        };
      }),

    createSession: publicProcedure
      .input(z.object({ qrToken: z.string() }))
      .mutation(async ({ input }) => {
        const device = await getDeviceByQrToken(input.qrToken);
        if (!device || !device.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Device not found or inactive" });
        }
        // Reuse existing pending session if one exists for this device
        const existingJob = await getPendingJobByDeviceId(device.id);
        if (existingJob) {
          return { sessionToken: existingJob.sessionToken, jobId: existingJob.id, device };
        }
        const sessionToken = nanoid(48);
        const job = await createPrintJob({
          deviceId: device.id,
          sessionToken,
          status: "pending",
          totalPages: 0,
          totalCost: "0.00",
        });
        return { sessionToken, jobId: job?.id, device };
      }),

    getJob: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const job = await getPrintJobBySessionToken(input.sessionToken);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
        const files = await getFilesByJobId(job.id);
        const device = await getDeviceById(job.deviceId);
        return { job, files, device };
      }),

    updateJobTotals: publicProcedure
      .input(
        z.object({
          sessionToken: z.string(),
          totalPages: z.number(),
          totalCost: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return updatePrintJobBySessionToken(input.sessionToken, {
          totalPages: input.totalPages,
          totalCost: input.totalCost,
        });
      }),

    updateFileCopies: publicProcedure
      .input(z.object({ fileId: z.number(), copies: z.number().min(1).max(100) }))
      .mutation(async ({ input }) => {
        await updatePrintJobFile(input.fileId, { copies: input.copies });
        return { success: true };
      }),

    deleteFile: publicProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ input }) => {
        await deletePrintJobFile(input.fileId);
        return { success: true };
      }),

    submitForPayment: publicProcedure
      .input(
        z.object({
          sessionToken: z.string(),
          customerName: z.string().optional(),
          customerEmail: z.string().email().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const job = await getPrintJobBySessionToken(input.sessionToken);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
        if (job.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Job already submitted" });
        }
        const files = await getFilesByJobId(job.id);
        if (files.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No files uploaded" });
        }

        // Recalculate totals
        const device = await getDeviceById(job.deviceId);
        const pricePerPage = parseFloat(device?.pricePerPage?.toString() ?? "0.50");
        let totalPages = 0;
        for (const file of files) {
          totalPages += (file.pageCount ?? 1) * (file.copies ?? 1);
        }
        const totalCost = (totalPages * pricePerPage).toFixed(2);

        await updatePrintJobBySessionToken(input.sessionToken, {
          totalPages,
          totalCost,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail ?? null,
        });

        return { success: true, totalPages, totalCost, jobId: job.id };
      }),

    // Simulate payment confirmation (MVP: manual trigger)
    confirmPayment: publicProcedure
      .input(
        z.object({
          sessionToken: z.string(),
          paymentRef: z.string().optional(),
          paymentMethod: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const job = await getPrintJobBySessionToken(input.sessionToken);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });

        await updatePrintJobBySessionToken(input.sessionToken, {
          status: "paid",
          paymentRef: input.paymentRef ?? `PAY-${nanoid(12)}`,
          paymentMethod: input.paymentMethod ?? "manual",
          paidAt: new Date(),
        });

        // Trigger print dispatch
        await dispatchPrintJob(job.id);

        return { success: true };
      }),
  }),

  // ─── Admin Panel ───────────────────────────────────────────────────────────

  admin: router({
    stats: adminProcedure.query(async () => {
      return getAdminStats();
    }),

    listJobs: adminProcedure
      .input(z.object({ deviceId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const jobs = await listPrintJobs(input?.deviceId);
        const jobsWithFiles = await Promise.all(
          jobs.map(async (job) => {
            const files = await getFilesByJobId(job.id);
            const device = await getDeviceById(job.deviceId);
            return { ...job, files, device };
          })
        );
        return jobsWithFiles;
      }),

    getJob: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const job = await getPrintJobById(input.id);
        if (!job) throw new TRPCError({ code: "NOT_FOUND" });
        const files = await getFilesByJobId(job.id);
        const device = await getDeviceById(job.deviceId);
        return { job, files, device };
      }),

    updateJobStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "paid", "printing", "done", "failed"]),
        })
      )
      .mutation(async ({ input }) => {
        const updates: Record<string, unknown> = { status: input.status };
        if (input.status === "paid") updates.paidAt = new Date();
        if (input.status === "done") updates.printedAt = new Date();
        await updatePrintJob(input.id, updates);
        return { success: true };
      }),

    dispatchJob: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await dispatchPrintJob(input.id);
        return { success: true };
      }),

    // Settings
    getSettings: adminProcedure.query(async () => {
      const printNodeApiKey = await getSetting("printNodeApiKey");
      return { printNodeApiKey: printNodeApiKey ? "***configured***" : null };
    }),

    updateSettings: adminProcedure
      .input(
        z.object({
          printNodeApiKey: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (input.printNodeApiKey !== undefined) {
          await setSetting("printNodeApiKey", input.printNodeApiKey);
        }
        return { success: true };
      }),

    testPrintNode: adminProcedure.mutation(async () => {
      const apiKey = await getSetting("printNodeApiKey");
      if (!apiKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "PrintNode API key not configured" });
      }
      const ok = await testPrintNodeConnection(apiKey);
      if (!ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PrintNode connection failed" });
      }
      return { success: true };
    }),

    listPrinters: adminProcedure.query(async () => {
      const apiKey = await getSetting("printNodeApiKey");
      if (!apiKey) return [];
      try {
        return await listPrinters(apiKey);
      } catch {
        return [];
      }
    }),
  }),
});

// ─── Print Dispatch Helper ────────────────────────────────────────────────────

async function dispatchPrintJob(jobId: number): Promise<void> {
  try {
    const job = await getPrintJobById(jobId);
    if (!job) return;

    const device = await getDeviceById(job.deviceId);
    if (!device?.printNodePrinterId) {
      console.warn(`[PrintDispatch] Device ${job.deviceId} has no PrintNode printer configured`);
      return;
    }

    const apiKey = await getSetting("printNodeApiKey");
    if (!apiKey) {
      console.warn("[PrintDispatch] PrintNode API key not configured");
      return;
    }

    const files = await getFilesByJobId(jobId);
    if (files.length === 0) return;

    await updatePrintJob(jobId, { status: "printing" });

    const printerId = parseInt(device.printNodePrinterId);

    // For MVP: dispatch each file as a separate print job
    for (const file of files) {
      try {
        // Fetch the file from storage
        const fileResponse = await fetch(
          `${process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "")}/v1/storage/presign/get?path=${encodeURIComponent(file.fileKey)}`,
          {
            headers: { Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
          }
        );

        if (!fileResponse.ok) {
          console.error(`[PrintDispatch] Failed to get presigned URL for file ${file.id}`);
          continue;
        }

        const { url: presignedUrl } = (await fileResponse.json()) as { url: string };
        const fileDataResponse = await fetch(presignedUrl);
        if (!fileDataResponse.ok) continue;

        const fileBuffer = Buffer.from(await fileDataResponse.arrayBuffer());
        const pdfBase64 = fileBuffer.toString("base64");

        const printNodeJobId = await submitPrintJob(
          apiKey,
          printerId,
          `${file.fileName} (Job #${jobId})`,
          pdfBase64,
          file.copies ?? 1
        );

        await updatePrintJob(jobId, { printNodeJobId: String(printNodeJobId) });
        console.log(`[PrintDispatch] Submitted job ${jobId}, PrintNode job ID: ${printNodeJobId}`);
      } catch (fileErr) {
        console.error(`[PrintDispatch] Failed to dispatch file ${file.id}:`, fileErr);
      }
    }

    await updatePrintJob(jobId, { status: "done", printedAt: new Date() });
  } catch (err) {
    console.error(`[PrintDispatch] Error dispatching job ${jobId}:`, err);
    await updatePrintJob(jobId, { status: "failed" }).catch(() => {});
  }
}

export type AppRouter = typeof appRouter;
