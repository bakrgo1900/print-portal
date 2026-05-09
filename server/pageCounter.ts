/**
 * Page count detection for uploaded files.
 * - PDF: uses pdf-parse for accurate page counting
 * - DOCX: uses mammoth to extract text, estimates pages from word count (~300 words/page)
 * - Images (JPG, PNG, JPEG): always 1 page
 */
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type SupportedFileType = "pdf" | "docx" | "jpg" | "jpeg" | "png";

/**
 * Count pages in a PDF buffer using pdf-parse.
 */
async function countPdfPages(buffer: Buffer): Promise<number> {
  try {
    const data = await pdfParse(buffer);
    return data.numpages > 0 ? data.numpages : 1;
  } catch (err) {
    console.error("[PageCounter] pdf-parse error, falling back to raw scan:", err);
    // Fallback: raw byte scan
    try {
      const text = buffer.toString("latin1");
      const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
      if (pageMatches && pageMatches.length > 0) return pageMatches.length;
      const countMatch = text.match(/\/Count\s+(\d+)/);
      if (countMatch && countMatch[1]) {
        const count = parseInt(countMatch[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }
    } catch {}
    return 1;
  }
}

/**
 * Estimate pages in a DOCX buffer.
 * Uses mammoth to extract text, then estimates ~300 words per page.
 */
async function countDocxPages(buffer: Buffer): Promise<number> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value ?? "";
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(wordCount / 300));
  } catch (err) {
    console.error("[PageCounter] DOCX parse error:", err);
    return 1;
  }
}

/**
 * Detect page count from a file buffer based on its type.
 */
export async function detectPageCount(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<number> {
  switch (fileType) {
    case "pdf":
      return countPdfPages(buffer);
    case "docx":
      return countDocxPages(buffer);
    case "jpg":
    case "jpeg":
    case "png":
      return 1;
    default:
      return 1;
  }
}

/**
 * Normalize a file extension to a supported file type.
 */
export function normalizeFileType(extension: string): SupportedFileType | null {
  const ext = extension.toLowerCase().replace(".", "");
  const supported: SupportedFileType[] = ["pdf", "docx", "jpg", "jpeg", "png"];
  if (supported.includes(ext as SupportedFileType)) {
    return ext as SupportedFileType;
  }
  return null;
}
