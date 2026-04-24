export interface ApprovalTokenPayload {
  id: string;
  approvalItemId: string;
  approverId: string;
  action: 'approve' | 'reject' | 'view';
  expiresAt: string;
  issuedAt: string;
}

export interface ApprovalToken extends ApprovalTokenPayload {
  signature: string;
}
