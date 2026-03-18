// Core identity and context types for WorkGraph

// NOTE: Specialized types should be imported directly from their files:
//   import type { ... } from './types/timesheets'
//   import type { ... } from './types/contracts'
//   import type { ... } from './types/approvals'
//   import type { ... } from './types/people'
//   import type { ... } from './types/permissions'
// Barrel re-exports were removed to fix duplicate export conflicts
// (e.g., Contract, Organization, TimesheetEntry, ContractType)

export type ContextType = "personal" | "company" | "agency";

export interface Context {
  id: string;
  type: ContextType;
  name: string;
  role?: "owner" | "admin" | "manager" | "member" | "contractor" | "recruiter";
}

export interface PersonalProfile {
  id: string;
  userId: string;
  // Identity (owned by person)
  name: string;
  photo?: string;
  email: string;
  phone?: string;
  location?: string;
  timezone?: string;
  
  // Portfolio & public info
  title?: string;
  bio?: string;
  skills: string[];
  languages: string[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  portfolio: PortfolioItem[];
  
  // Availability & rates
  availability: "available" | "limited" | "unavailable";
  hourlyRate?: number;
  dailyRate?: number;
  currency: string;
  
  // Privacy controls
  isPublic: boolean;
  showCurrentEmployer: boolean;
  searchable: boolean;
  
  // Links
  linkedInUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerRecord {
  id: string;
  organizationId: string;
  
  // Link to Personal Profile (optional until claimed)
  personalProfileId?: string;
  
  // Basic identity (org-owned)
  name: string;
  workEmail: string;
  workPhone?: string;
  
  // Employment data (org-owned)
  internalTitle: string;
  department?: string;
  startDate: Date;
  endDate?: Date;
  employmentType: "full-time" | "part-time" | "contractor" | "intern";
  
  // Contract & billing
  billableRate?: number;
  internalCost?: number;
  currency: string;
  
  // Status
  status: "unclaimed" | "claimed" | "active" | "inactive";
  inviteSentAt?: Date;
  claimedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  type: "company" | "agency" | "freelancer-company";
  
  // Identity
  name: string;
  legalName?: string;
  logo?: string;
  website?: string;
  
  // Contact
  email: string;
  phone?: string;
  address?: Address;
  
  // Business info
  industries: string[];
  size?: string;
  founded?: string;
  description?: string;
  
  // Settings
  settings: {
    allowPublicDirectory: boolean;
    requireNDABeforeSharing: boolean;
    defaultCurrency: string;
    defaultTimezone: string;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  projectUrl?: string;
  tags: string[];
  date?: string;
}

export interface Address {
  street?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

// Representation for agencies
export interface Representation {
  id: string;
  agencyId: string;
  candidateId: string; // WorkerRecord ID or PersonalProfile ID
  type: "exclusive" | "non-exclusive";
  startDate: Date;
  endDate?: Date;
  consentGrantedAt: Date;
  status: "active" | "expired" | "revoked";
}

// Contract models
export type ContractType = "placement" | "outstaff" | "project";
export type ContractStatus = "draft" | "sent" | "signed" | "active" | "completed" | "terminated";

export interface Contract {
  id: string;
  type: ContractType;
  status: ContractStatus;
  
  // Parties
  clientOrgId: string;
  supplierOrgId: string;
  agencyOrgId?: string; // For placement/representation
  
  // Assigned workers
  workerRecords: string[]; // WorkerRecord IDs
  
  // Financial
  currency: string;
  
  // Placement specific
  placementFee?: number;
  placementFeeType?: "fixed" | "percentage";
  guaranteePeriod?: number; // days
  
  // T&M specific
  hourlyRate?: number;
  dailyRate?: number;
  
  // Project specific
  totalValue?: number;
  milestones?: Milestone[];
  
  // Documents
  ndaId?: string;
  msaId?: string;
  sowId?: string;
  
  // Dates
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  dueDate: Date;
  value: number;
  status: "pending" | "in-progress" | "completed" | "approved" | "paid";
}

// Timesheet types
export type EntryStatus = "draft" | "submitted" | "pending" | "approved" | "rejected";

export interface EntryDetail {
  id: string;
  // ✅ FIX: Use correct field names matching API schema
  taskCategory?: string; // e.g., "Development", "Design", "Meeting"
  taskDescription?: string; // Specific task description
  workType?: 'regular' | 'overtime' | 'travel' | 'oncall';
  hours: number;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  status: EntryStatus;
  notes?: string;
  billable?: boolean;
  personId?: string; // Added for multi-person support
  date?: string; // Added for multi-person support
}

export interface TimesheetEntry {
  date: string; // YYYY-MM-DD
  entries: EntryDetail[];
}

// Job/Need
export interface Job {
  id: string;
  organizationId: string;
  
  // Details
  title: string;
  description: string;
  skills: string[];
  location?: string;
  remote: boolean;
  
  // Contract model
  contractType: ContractType;
  
  // Budget
  budgetMin?: number;
  budgetMax?: number;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  currency: string;
  
  // Timeline
  startDate?: Date;
  duration?: string;
  
  // Visibility
  visibility: "private" | "shared" | "public";
  sharedWith: string[]; // Organization IDs
  
  // Status
  status: "draft" | "open" | "in-progress" | "filled" | "closed";
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}