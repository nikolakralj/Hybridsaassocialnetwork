// ============================================================================
// WorkGraph Document Exchange — TypeScript Types
// ============================================================================
// Every document that flows between parties on a project is modelled here.
// from_party / to_party are graph node IDs (e.g. "org-tia", "org-nas") so
// the document model stays graph-aware without requiring UUID resolution.
// ============================================================================

export type DocumentType =
  | 'nda'
  | 'contract'
  | 'sow'
  | 'invoice'
  | 'purchase_order'
  | 'expense_report'
  | 'deliverable_signoff'
  | 'change_order'
  | 'compliance'
  | 'rate_card'
  | 'other';

export type DocumentStatus =
  | 'draft'
  | 'pending_signature'
  | 'countersigning'
  | 'signed'
  | 'rejected'
  | 'expired'
  | 'superseded';

export type DocumentEventType =
  | 'created'
  | 'sent'
  | 'signed'
  | 'countersigned'
  | 'rejected'
  | 'expired'
  | 'superseded'
  | 'uploaded';

// ---------------------------------------------------------------------------
// Core document shape (matches wg_documents DB row)
// ---------------------------------------------------------------------------

export interface WorkDocument {
  id: string;                   // doc_xxx
  projectId: string;
  type: DocumentType;
  title: string;
  description?: string;

  // Parties — graph node IDs
  fromParty: string;            // issuer (e.g. "org-tia")
  toParty: string;              // recipient (e.g. "org-nas")

  // Lifecycle
  status: DocumentStatus;
  signedBy: string[];           // Supabase user UUIDs
  rejectedBy?: string;
  rejectionNote?: string;

  // Dates
  signedAt?: string;
  rejectedAt?: string;
  expiresAt?: string;

  // File
  fileUrl?: string;
  fileName?: string;
  fileSizeKb?: number;

  // Type-specific metadata
  data: DocumentData;

  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Type-specific data shapes (stored in the JSONB `data` column)
// ---------------------------------------------------------------------------

export interface NdaData {
  mutual: boolean;             // true = both parties bound; false = one-way
  governingLaw?: string;       // e.g. "German law"
  confidentialityPeriodYears?: number;
}

export interface ContractData {
  contractNumber?: string;
  startDate: string;
  endDate?: string;
  totalValue?: number;
  currency?: string;
  paymentTermsDays?: number;   // e.g. 30
  scopeSummary?: string;
}

export interface SowData {
  milestones?: { title: string; dueDate: string; value?: number }[];
  deliverables?: string[];
  acceptanceCriteria?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  issuedDate: string;
  dueDate: string;
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  currency: string;
  poReference?: string;        // purchase order number from client
  timesheetIds?: string[];     // linked approved weeks
}

export interface PurchaseOrderData {
  poNumber: string;
  issuedDate: string;
  expiryDate?: string;
  maxValue: number;
  currency: string;
  costCenter?: string;
  approvedBy?: string;
}

export interface ExpenseReportData {
  period: { start: string; end: string };
  items: {
    date: string;
    category: 'travel' | 'accommodation' | 'meals' | 'equipment' | 'software' | 'other';
    description: string;
    amount: number;
    currency: string;
    receiptUrl?: string;
  }[];
  totalAmount: number;
  currency: string;
}

export interface DeliverableSignoffData {
  milestoneName: string;
  deliverables: string[];
  acceptedAt?: string;
  clientNotes?: string;
}

export interface ChangeOrderData {
  changeNumber: string;
  reason: string;
  scopeChanges: string;
  rateImpact?: number;          // delta in EUR/USD
  durationImpactDays?: number;
  previousContractRef?: string;
}

export interface ComplianceData {
  documentKind: 'right_to_work' | 'background_check' | 'certification' | 'insurance' | 'tax_registration' | 'other';
  issuedBy?: string;
  issuedDate?: string;
  certificationBody?: string;
  registrationNumber?: string;
}

export interface RateCardData {
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  roles: { role: string; ratePerHour: number; maxHoursPerWeek?: number }[];
}

// Union type for all data shapes
export type DocumentData =
  | NdaData
  | ContractData
  | SowData
  | InvoiceData
  | PurchaseOrderData
  | ExpenseReportData
  | DeliverableSignoffData
  | ChangeOrderData
  | ComplianceData
  | RateCardData
  | Record<string, unknown>;

// ---------------------------------------------------------------------------
// Audit event
// ---------------------------------------------------------------------------

export interface DocumentEvent {
  id: number;
  documentId: string;
  eventType: DocumentEventType;
  actorId?: string;
  actorNode?: string;           // graph node ID
  note?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  nda:                 'NDA',
  contract:            'Contract',
  sow:                 'Statement of Work',
  invoice:             'Invoice',
  purchase_order:      'Purchase Order',
  expense_report:      'Expense Report',
  deliverable_signoff: 'Deliverable Sign-off',
  change_order:        'Change Order',
  compliance:          'Compliance Document',
  rate_card:           'Rate Card',
  other:               'Document',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft:               'Draft',
  pending_signature:   'Pending Signature',
  countersigning:      'Awaiting Counter-signature',
  signed:              'Signed',
  rejected:            'Rejected',
  expired:             'Expired',
  superseded:          'Superseded',
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  draft:               'bg-slate-100 text-slate-600 border-slate-200',
  pending_signature:   'bg-amber-50 text-amber-700 border-amber-200',
  countersigning:      'bg-blue-50 text-blue-700 border-blue-200',
  signed:              'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:            'bg-red-50 text-red-700 border-red-200',
  expired:             'bg-orange-50 text-orange-700 border-orange-200',
  superseded:          'bg-slate-50 text-slate-400 border-slate-200',
};

// Which document types require counter-signature from the other party
export const REQUIRES_COUNTERSIGN: DocumentType[] = [
  'nda', 'contract', 'sow', 'change_order', 'rate_card',
];

// Which document types are submitted by one party and approved (not signed) by the other
export const REQUIRES_APPROVAL: DocumentType[] = [
  'invoice', 'expense_report', 'deliverable_signoff', 'purchase_order',
];

// Generate a document ID
export function generateDocumentId(): string {
  return `doc_${Math.random().toString(36).slice(2, 10)}`;
}
