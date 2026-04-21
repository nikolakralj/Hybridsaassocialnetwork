// Phase 4: Invoice template extraction API
import { Hono } from "npm:hono";
import Anthropic from "npm:@anthropic-ai/sdk";

const invoiceExtractRouter = new Hono();

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an invoice template extractor.
Analyze the provided invoice and return a JSON object with this exact structure:
{
  "locale": "hr-HR",
  "layout": {
    "header": { "invoiceNumberLabel": "Ra\u010Dun:", "position": "top-left" },
    "parties": { "sellerLabel": "PRODAVATELJ:", "buyerLabel": "KUPAC:", "layout": "two-column-right" },
    "lineItems": { "columns": ["#", "Naziv", "JM", "Koli\u010Dina", "Cijena", "Iznos"], "hasStandardIdentifier": true },
    "totals": { "position": "bottom-right", "showSubtotal": true, "showTaxBreakdown": true }
  },
  "compliance": { "standard": "urn:cen.eu:en16931:2017", "taxScheme": "VAT", "idScheme": "9934", "paymentRefFormat": "HR99", "taxRate": 25 },
  "fieldMap": { "invoiceNumber": "Ra\u010Dun", "issueDate": "Datum izdavanja", "dueDate": "Datum dospije\u0107a", "currency": "\u0160ifra valute" }
}
Return only the JSON object, no explanation.`;

const CROATIAN_ERACUN_STUB = {
  locale: "hr-HR",
  layout: {
    header: { invoiceNumberLabel: "Ra\u010Dun:", position: "top-left" },
    parties: { sellerLabel: "PRODAVATELJ:", buyerLabel: "KUPAC:", layout: "two-column-right" },
    lineItems: {
      columns: ["#", "Naziv", "JM", "Koli\u010Dina", "Cijena", "Iznos"],
      hasStandardIdentifier: true,
    },
    totals: { position: "bottom-right", showSubtotal: true, showTaxBreakdown: true },
  },
  compliance: {
    standard: "urn:cen.eu:en16931:2017",
    taxScheme: "VAT",
    idScheme: "9934",
    paymentRefFormat: "HR99",
    taxRate: 25,
  },
  fieldMap: {
    invoiceNumber: "Ra\u010Dun",
    issueDate: "Datum izdavanja",
    dueDate: "Datum dospije\u0107a",
    currency: "\u0160ifra valute",
  },
};

function stripDataUrlPrefix(fileBase64: string): string {
  const trimmed = fileBase64.trim();
  if (!trimmed.startsWith("data:")) return trimmed;
  const commaIndex = trimmed.indexOf(",");
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1).trim() : trimmed;
}

async function readPayload(c: any): Promise<{ fileBase64: string; mimeType: string } | null> {
  const contentType = (c.req.header("content-type") || "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const fileValue = form.get("file");
    if (fileValue instanceof File) {
      const bytes = new Uint8Array(await fileValue.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      return {
        fileBase64: btoa(binary),
        mimeType: fileValue.type || "application/pdf",
      };
    }

    const fileBase64 = form.get("fileBase64");
    const mimeType = form.get("mimeType");
    if (typeof fileBase64 === "string" && typeof mimeType === "string") {
      return {
        fileBase64: stripDataUrlPrefix(fileBase64),
        mimeType,
      };
    }

    return null;
  }

  const body = await c.req.json().catch(() => ({}));
  if (typeof body.fileBase64 === "string" && typeof body.mimeType === "string") {
    return {
      fileBase64: stripDataUrlPrefix(body.fileBase64),
      mimeType: body.mimeType,
    };
  }

  return null;
}

function buildContentBlock(fileBase64: string, mimeType: string): any | null {
  const normalizedMimeType = mimeType.toLowerCase();
  if (normalizedMimeType.includes("pdf")) {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: fileBase64,
      },
    };
  }

  if (normalizedMimeType.startsWith("image/")) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: fileBase64,
      },
    };
  }

  return null;
}

function extractText(message: any): string {
  return (message?.content || [])
    .filter((block: any) => block?.type === "text" && typeof block.text === "string")
    .map((block: any) => block.text)
    .join("\n")
    .trim();
}

function parseJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  const jsonText = start >= 0 && end >= start
    ? withoutFence.slice(start, end + 1)
    : withoutFence;

  return JSON.parse(jsonText);
}

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/invoice-extract
// ---------------------------------------------------------------------------
invoiceExtractRouter.post("/", async (c) => {
  try {
    const payload = await readPayload(c);
    if (!payload) {
      return c.json({ error: "fileBase64 and mimeType are required" }, 400);
    }

    const contentBlock = buildContentBlock(payload.fileBase64, payload.mimeType);
    if (!contentBlock) {
      return c.json({ error: "Unsupported mimeType" }, 400);
    }

    if (!ANTHROPIC_API_KEY) {
      return c.json(CROATIAN_ERACUN_STUB);
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: "Extract the invoice template from this file and return only the JSON object.",
            },
          ],
        },
      ],
    });

    const text = extractText(message);
    if (!text) {
      throw new Error("Anthropic returned an empty response");
    }

    const parsed = parseJson(text);
    return c.json(parsed);
  } catch (err: any) {
    console.error("[invoice-extract] Error:", err);
    return c.json({ error: `Failed to extract invoice template: ${err.message}` }, 500);
  }
});

export { invoiceExtractRouter };
