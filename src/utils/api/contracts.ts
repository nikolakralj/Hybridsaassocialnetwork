// Contract API - legacy client-side fallback store.
// This module is kept for compatibility and intentionally avoids importing server code.

import type { Contract } from '../../types/contracts';

const contractStore = new Map<string, Contract>();

function generateContractId(): string {
  return `contract_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function createContract(
  contract: Omit<Contract, 'id' | 'createdAt'>
): Promise<string> {
  const id = generateContractId();
  const newContract: Contract = {
    ...contract,
    id,
    createdAt: new Date(),
  };

  contractStore.set(id, newContract);
  return id;
}

export async function getContract(id: string): Promise<Contract | null> {
  return contractStore.get(id) || null;
}

export async function getProjectContracts(projectId: string): Promise<Contract[]> {
  const allContracts = Array.from(contractStore.values());
  return allContracts.filter((contract) => contract.projectId === projectId && contract.status !== 'terminated');
}

export async function getContractChain(
  userId: string,
  projectId: string
): Promise<Contract[]> {
  const allContracts = await getProjectContracts(projectId);
  const chain: Contract[] = [];
  let currentProviderId = userId;

  while (true) {
    const nextContract = allContracts.find((contract) => contract.providerId === currentProviderId);
    if (!nextContract) break;
    chain.push(nextContract);
    currentProviderId = nextContract.recipientId;
  }

  return chain;
}

export async function getContractsForApprover(
  userId: string,
  projectId: string
): Promise<Contract[]> {
  const allContracts = await getProjectContracts(projectId);
  return allContracts.filter((contract) => contract.recipientId === userId);
}

export async function updateContract(
  id: string,
  updates: Partial<Contract>
): Promise<void> {
  const existing = await getContract(id);
  if (!existing) {
    throw new Error(`Contract ${id} not found`);
  }

  const updated: Contract = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
  };

  contractStore.set(id, updated);
}

export async function deleteContract(id: string): Promise<void> {
  await updateContract(id, { status: 'terminated' });
}

export async function getContractsGroupedByType(
  recipientId: string,
  projectId: string
): Promise<{
  individual: Contract[];
  company: Contract[];
  agency: Contract[];
}> {
  const contracts = await getContractsForApprover(recipientId, projectId);

  return {
    individual: contracts.filter((contract) => contract.providerType === 'individual'),
    company: contracts.filter((contract) => contract.providerType === 'company'),
    agency: contracts.filter((contract) => contract.providerType === 'agency'),
  };
}
