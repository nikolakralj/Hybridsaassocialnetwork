import type { Hono } from "npm:hono";

interface ApprovalTokenPayload {
  id: string;
  approvalItemId: string;
  approverId: string;
  action: "approve" | "reject" | "view";
  expiresAt: string;
  issuedAt: string;
}

interface ApprovalToken extends ApprovalTokenPayload {
  signature: string;
}

const VALID_ACTIONS = ["approve", "reject", "view"];

function getSigningSecret(): string {
  const secret = Deno.env.get("APPROVAL_TOKEN_SECRET");
  if (!secret) {
    throw new Error("APPROVAL_TOKEN_SECRET environment variable is not set");
  }
  return secret;
}

function stringToUint8Array(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(value: string): string {
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlDecode(value: string): string {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  return atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
}

function signingData(payload: ApprovalTokenPayload): string {
  return JSON.stringify({
    id: payload.id,
    approvalItemId: payload.approvalItemId,
    approverId: payload.approverId,
    action: payload.action,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
  });
}

async function createSignature(payload: ApprovalTokenPayload): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    stringToUint8Array(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    stringToUint8Array(signingData(payload)),
  );

  return arrayBufferToHex(signature);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let i = 0; i < left.length; i++) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return result === 0;
}

function isValidPayload(payload: unknown): payload is ApprovalTokenPayload {
  if (!payload || typeof payload !== "object") return false;

  const value = payload as Record<string, unknown>;
  return (
    typeof value.id === "string" &&
    typeof value.approvalItemId === "string" &&
    typeof value.approverId === "string" &&
    typeof value.action === "string" &&
    VALID_ACTIONS.includes(value.action) &&
    typeof value.expiresAt === "string" &&
    typeof value.issuedAt === "string" &&
    !Number.isNaN(Date.parse(value.expiresAt)) &&
    !Number.isNaN(Date.parse(value.issuedAt))
  );
}

function decodeApprovalToken(tokenString: string): ApprovalToken {
  return JSON.parse(base64UrlDecode(tokenString)) as ApprovalToken;
}

async function verifySignedToken(tokenString: string): Promise<{
  valid: boolean;
  error?: string;
  token?: ApprovalToken;
}> {
  let token: ApprovalToken;

  try {
    token = decodeApprovalToken(tokenString);
  } catch {
    return { valid: false, error: "INVALID_TOKEN" };
  }

  if (!isValidPayload(token) || typeof token.signature !== "string") {
    return { valid: false, error: "INVALID_TOKEN" };
  }

  const expectedSignature = await createSignature(token);
  if (!timingSafeEqual(expectedSignature, token.signature)) {
    return { valid: false, error: "INVALID_SIGNATURE" };
  }

  if (new Date(token.expiresAt) < new Date()) {
    return { valid: false, error: "TOKEN_EXPIRED", token };
  }

  return { valid: true, token };
}

export function registerApprovalTokenRoutes(app: Hono) {
  app.post("/make-server-f8b491be/approval-tokens/sign", async (c) => {
    try {
      const body = await c.req.json();
      const payload = body?.payload;

      if (!isValidPayload(payload)) {
        return c.json({ error: "Invalid approval token payload" }, 400);
      }

      const signature = await createSignature(payload);
      const token: ApprovalToken = { ...payload, signature };

      return c.json({ token: base64UrlEncode(JSON.stringify(token)) });
    } catch (err: any) {
      console.error("[APPROVAL TOKENS] Sign error:", err);
      return c.json({ error: err.message || "Failed to sign approval token" }, 500);
    }
  });

  app.get("/make-server-f8b491be/approval-tokens/verify/:token", async (c) => {
    try {
      const result = await verifySignedToken(c.req.param("token"));

      if (!result.valid) {
        return c.json(result, 400);
      }

      return c.json(result);
    } catch (err: any) {
      console.error("[APPROVAL TOKENS] Verify error:", err);
      return c.json({ valid: false, error: err.message || "Failed to verify approval token" }, 500);
    }
  });
}
