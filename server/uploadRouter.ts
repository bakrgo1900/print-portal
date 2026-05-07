/**
 * File upload endpoint using multer.
 * POST /api/upload/:sessionToken
 * Accepts PDF, DOCX, JPG, PNG files.
 * Detects page count, stores in S3, saves to DB.
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import { getPrintJobBySessionToken, addPrintJobFile } from "./db";
import { detectPageCount, normalizeFileType } from "./pageCounter";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Allowed: PDF, DOCX, JPG, PNG`));
    }
  },
});

export function createUploadRouter(): Router {
  const router = Router();

  router.post(
    "/upload/:sessionToken",
    upload.array("files", 10),
    async (req, res) => {
      try {
        const { sessionToken } = req.params as { sessionToken: string };
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          res.status(400).json({ error: "No files uploaded" });
          return;
        }

        const job = await getPrintJobBySessionToken(sessionToken);
        if (!job) {
          res.status(404).json({ error: "Session not found" });
          return;
        }

        if (job.status !== "pending") {
          res.status(400).json({ error: "Session is no longer accepting files" });
          return;
        }

        const uploadedFiles = [];

        for (const file of files) {
          const ext = path.extname(file.originalname).toLowerCase();
          const fileType = normalizeFileType(ext);

          if (!fileType) {
            continue;
          }

          // Detect page count
          const pageCount = await detectPageCount(file.buffer, fileType);

          // Upload to S3
          const fileKey = `print-jobs/${job.id}/${nanoid(16)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { key, url } = await storagePut(fileKey, file.buffer, file.mimetype);

          // Save to DB
          const savedFile = await addPrintJobFile({
            jobId: job.id,
            fileName: file.originalname,
            fileType,
            fileKey: key,
            fileUrl: url,
            pageCount,
            copies: 1,
            fileSizeBytes: file.size,
          });

          uploadedFiles.push({
            id: savedFile?.id,
            fileName: file.originalname,
            fileType,
            pageCount,
            copies: 1,
            fileSizeBytes: file.size,
          });
        }

        res.json({ success: true, files: uploadedFiles });
      } catch (err) {
        console.error("[Upload] Error:", err);
        res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  return router;
}
