/**
 * PrintNode API integration.
 * PrintNode installs a lightweight client on Windows and receives jobs over the internet.
 * Docs: https://www.printnode.com/en/docs/api/curl
 */

const PRINTNODE_API_BASE = "https://api.printnode.com";

export interface PrintNodePrinter {
  id: number;
  name: string;
  description: string;
  state: string;
  computer: {
    id: number;
    name: string;
    state: string;
  };
}

export interface PrintNodeJob {
  id: number;
  printer: { id: number; name: string };
  title: string;
  state: string;
  createTimestamp: string;
}

async function printNodeRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown
): Promise<unknown> {
  const credentials = Buffer.from(`${apiKey}:`).toString("base64");
  const response = await fetch(`${PRINTNODE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PrintNode API error ${response.status}: ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function listPrinters(apiKey: string): Promise<PrintNodePrinter[]> {
  const result = await printNodeRequest("GET", "/printers", apiKey);
  return (result as PrintNodePrinter[]) ?? [];
}

export async function getPrinter(
  apiKey: string,
  printerId: number
): Promise<PrintNodePrinter | null> {
  try {
    const result = await printNodeRequest("GET", `/printers/${printerId}`, apiKey);
    const arr = result as PrintNodePrinter[];
    return arr.length > 0 ? arr[0] : null;
  } catch {
    return null;
  }
}

/**
 * Submit a print job to PrintNode.
 * @param apiKey - PrintNode API key
 * @param printerId - Target printer ID
 * @param title - Job title shown in the print queue
 * @param pdfBase64 - Base64-encoded PDF content
 * @param copies - Number of copies
 * @returns PrintNode job ID
 */
export async function submitPrintJob(
  apiKey: string,
  printerId: number,
  title: string,
  pdfBase64: string,
  copies: number = 1,
  colorMode: "bw" | "color" = "bw"
): Promise<number> {
  const payload = {
    printerId,
    title,
    contentType: "pdf_base64",
    content: pdfBase64,
    source: "PrintPortal",
    options: {
      copies,
      color: colorMode === "color",
    },
  };

  const result = await printNodeRequest("POST", "/printjobs", apiKey, payload);
  return result as number;
}

export async function getPrintJobStatus(
  apiKey: string,
  jobId: number
): Promise<PrintNodeJob | null> {
  try {
    const result = await printNodeRequest("GET", `/printjobs/${jobId}`, apiKey);
    const arr = result as PrintNodeJob[];
    return arr.length > 0 ? arr[0] : null;
  } catch {
    return null;
  }
}

/**
 * Test the PrintNode connection by fetching account info.
 */
export async function testPrintNodeConnection(apiKey: string): Promise<boolean> {
  try {
    await printNodeRequest("GET", "/whoami", apiKey);
    return true;
  } catch {
    return false;
  }
}
