// Phase 1: Contracts Frontend API Client

import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/api`;

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

export async function listContracts(accessToken?: string | null) {
  const res = await fetch(`${BASE}/contracts`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list contracts');
  return data.contracts || [];
}

export async function listProjectContracts(projectId: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/projects/${projectId}/contracts`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list project contracts');
  return data.contracts || [];
}

export async function getContract(contractId: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/contracts/${contractId}`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get contract');
  return data.contract;
}

export async function createContract(
  contract: {
    projectId?: string;
    providerName?: string;
    providerType?: string;
    recipientName?: string;
    recipientType?: string;
    baseHourlyRate?: number;
    workTypeRates?: Record<string, number>;
    currency?: string;
    billingCycle?: string;
    status?: string;
    effectiveDate?: string;
    expirationDate?: string;
    hideRateFromProvider?: boolean;
    hideRateFromRecipient?: boolean;
  },
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/contracts`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify(contract),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create contract');
  return data.contract;
}

export async function updateContract(
  contractId: string,
  updates: Record<string, any>,
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/contracts/${contractId}`, {
    method: 'PUT',
    headers: getHeaders(accessToken),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update contract');
  return data.contract;
}

export async function deleteContract(contractId: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/contracts/${contractId}`, {
    method: 'DELETE',
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete contract');
  return true;
}