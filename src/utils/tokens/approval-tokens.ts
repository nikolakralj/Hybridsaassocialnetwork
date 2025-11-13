// Phase 5 Day 7: Secure Approval Token System
// Generates signed tokens for one-click email approvals

export interface ApprovalTokenPayload {
  id: string;
  approvalItemId: string;
  approverId: string;
  action: 'approve' | 'reject' | 'view';
  expiresAt: string; // ISO timestamp
  issuedAt: string;  // ISO timestamp
}

export interface ApprovalToken extends ApprovalTokenPayload {
  signature: string;
}

// Secret key for signing (in production, use env variable)
// In browser environment, this would be replaced with a key from your backend
const SECRET_KEY = 'workgraph-approval-secret-key-change-in-production';

/**
 * Generate random UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Convert string to Uint8Array
 */
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate HMAC signature for token payload using Web Crypto API
 */
async function signPayload(payload: ApprovalTokenPayload): Promise<string> {
  const data = JSON.stringify({
    id: payload.id,
    approvalItemId: payload.approvalItemId,
    approverId: payload.approverId,
    action: payload.action,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
  });
  
  // Import the secret key
  const key = await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Sign the data
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToUint8Array(data)
  );
  
  return arrayBufferToHex(signature);
}

/**
 * Verify token signature using Web Crypto API
 */
async function verifySignature(token: ApprovalToken): Promise<boolean> {
  const expectedSignature = await signPayload(token);
  
  // Timing-safe comparison
  if (expectedSignature.length !== token.signature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ token.signature.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate a secure approval token
 * 
 * @param approvalItemId - ID of the approval item
 * @param approverId - ID of the person who can approve
 * @param action - What action this token allows
 * @param expiresInHours - Token validity period (default: 72 hours)
 * @returns Base64-encoded signed token
 */
export async function generateApprovalToken(
  approvalItemId: string,
  approverId: string,
  action: 'approve' | 'reject' | 'view',
  expiresInHours: number = 72
): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
  
  const payload: ApprovalTokenPayload = {
    id: generateUUID(),
    approvalItemId,
    approverId,
    action,
    expiresAt: expiresAt.toISOString(),
    issuedAt: now.toISOString(),
  };
  
  const signature = await signPayload(payload);
  
  const token: ApprovalToken = {
    ...payload,
    signature,
  };
  
  // Encode as Base64 URL-safe
  return btoa(JSON.stringify(token))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Validate and decode an approval token
 * 
 * @param tokenString - Base64-encoded token
 * @returns Decoded token or null if invalid/expired
 */
export async function validateApprovalToken(tokenString: string): Promise<ApprovalToken | null> {
  try {
    // Decode from Base64 (restore padding)
    const padding = '='.repeat((4 - (tokenString.length % 4)) % 4);
    const base64 = tokenString
      .replace(/-/g, '+')
      .replace(/_/g, '/') + padding;
    
    const decoded = atob(base64);
    const token: ApprovalToken = JSON.parse(decoded);
    
    // Verify signature
    const isValid = await verifySignature(token);
    if (!isValid) {
      console.error('Token signature verification failed');
      return null;
    }
    
    // Check expiration
    const now = new Date();
    const expiresAt = new Date(token.expiresAt);
    
    if (now > expiresAt) {
      console.log('Token expired:', { expiresAt, now });
      return null;
    }
    
    return token;
    
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

/**
 * Hash token for database storage (one-way hash)
 * Used to check if token has been used without storing the actual token
 */
export async function hashToken(tokenString: string): Promise<string> {
  const data = stringToUint8Array(tokenString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hashBuffer);
}