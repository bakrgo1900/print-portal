/**
 * Payment webhook endpoint.
 * POST /api/payment/webhook
 * 
 * For MVP, this endpoint acts as both a webhook receiver and a manual payment confirmation.
 * In production, this would be called by a payment gateway (Stripe, PayPal, etc.)
 * after successful payment.
 */

import { Router } from "express";
import { getPrintJobBySessionToken, updatePrintJobBySessionToken, getPrintJobById, updatePrintJob, getDeviceById, getFilesByJobId } from "./db";
import { getSetting } from "./db";
import { submitPrintJob } from "./printnode";
import { storageReadBuffer } from "./storage";
import { nanoid } from "nanoid";

export function createPaymentWebhookRouter(): Router {
  const router = Router();

  /**
   * Webhook endpoint called by payment gateway after successful payment.
   * Body: { sessionToken, paymentRef, paymentMethod, amount }
   */
  router.post("/payment/webhook", async (req, res) => {
    try {
      const { sessionToken, paymentRef, paymentMethod, amount } = req.body as {
        sessionToken: string;
        paymentRef?: string;
        paymentMethod?: string;
        amount?: number;
      };

      if (!sessionToken) {
        res.status(400).json({ error: "sessionToken required" });
        return;
      }

      const job = await getPrintJobBySessionToken(sessionToken);
      if (!job) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (job.status !== "pending") {
        res.status(200).json({ message: "Already processed" });
        return;
      }

      // Mark as paid
      await updatePrintJobBySessionToken(sessionToken, {
        status: "paid",
        paymentRef: paymentRef ?? `WEBHOOK-${nanoid(12)}`,
        paymentMethod: paymentMethod ?? "webhook",
        paidAt: new Date(),
      });

      // Trigger print dispatch asynchronously
      dispatchPrintJobAsync(job.id).catch(console.error);

      res.json({ success: true, message: "Payment confirmed, print job dispatched" });
    } catch (err) {
      console.error("[PaymentWebhook] Error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  return router;
}

/**
 * Dispatch a print job to PrintNode asynchronously.
 */
async function dispatchPrintJobAsync(jobId: number): Promise<void> {
  try {
    const job = await getPrintJobById(jobId);
    if (!job) return;

    const device = await getDeviceById(job.deviceId);
    if (!device?.printNodePrinterId) {
      console.warn(`[PrintDispatch] Device ${job.deviceId} has no PrintNode printer configured`);
      // Still mark as done for MVP without printer
      await updatePrintJob(jobId, { status: "done", printedAt: new Date() });
      return;
    }

    const apiKey = await getSetting("printNodeApiKey");
    if (!apiKey) {
      console.warn("[PrintDispatch] PrintNode API key not configured");
      await updatePrintJob(jobId, { status: "done", printedAt: new Date() });
      return;
    }

    const files = await getFilesByJobId(jobId);
    if (files.length === 0) return;

    await updatePrintJob(jobId, { status: "printing" });

    const printerId = parseInt(device.printNodePrinterId);
    for (const file of files) {
      try {
        if (!file.fileKey) continue;
        const fileBuffer = await storageReadBuffer(file.fileKey);
        const pdfBase64 = fileBuffer.toString("base64");

        const printNodeJobId = await submitPrintJob(
          apiKey,
          printerId,
          `${file.fileName} (Job #${jobId})`,
          pdfBase64,
          file.copies ?? 1
        );

        await updatePrintJob(jobId, { printNodeJobId: String(printNodeJobId) });
        console.log(`[PrintDispatch] Job ${jobId} dispatched, PrintNode ID: ${printNodeJobId}`);
      } catch (fileErr) {
        console.error(`[PrintDispatch] Failed to dispatch file ${file.id}:`, fileErr);
      }
    }

    await updatePrintJob(jobId, { status: "done", printedAt: new Date() });
  } catch (err) {
    console.error(`[PrintDispatch] Error for job ${jobId}:`, err);
    await updatePrintJob(jobId, { status: "failed" }).catch(() => {});
  }
}
