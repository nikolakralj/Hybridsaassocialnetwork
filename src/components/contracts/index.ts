// ============================================================================
// Contracts Components - Local Scope Visibility
// ============================================================================

export { ContractCard, ContractSummary } from './ContractCard';
export { MyContractsPanel } from './MyContractsPanel';
export { InvitationInbox, InvitationEmptyState } from './InvitationInbox';
export {
  DisclosureRequestDialog,
  DisclosureStatusBadge,
} from './DisclosureRequestDialog';
// ContractsDemoPage removed - not yet implemented

// Re-export types for convenience
export type {
  ViewerContract,
  ContractInvitation,
  DisclosureRequest,
  ProjectGraph,
} from '../../types/project-contracts';