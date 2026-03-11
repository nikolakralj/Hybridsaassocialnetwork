// Demo Data for Approval System
// Shows 3 freelancers + 2 companies scenario with contract-based grouping

import type { Contract } from '../../types/contracts';
import type { Person } from '../../types/people';
import type { TimesheetEntry } from '../../utils/api/timesheets';

// ============================================================================
// PEOPLE (3 Individual Freelancers + 5 Company Contractors)
// ============================================================================

export const demoPeople: Person[] = [
  // Individual Freelancers
  {
    id: 'sarah-chen-id',
    name: 'Sarah Chen',
    initials: 'SC',
    email: 'sarah.chen@freelance.com',
  },
  {
    id: 'mike-johnson-id',
    name: 'Mike Johnson',
    initials: 'MJ',
    email: 'mike.johnson@freelance.com',
  },
  {
    id: 'emma-davis-id',
    name: 'Emma Davis',
    initials: 'ED',
    email: 'emma.davis@freelance.com',
  },
  
  // Acme Corp Contractors
  {
    id: 'tom-martinez-id',
    name: 'Tom Martinez',
    initials: 'TM',
    email: 'tom@acmecorp.com',
    organizationId: 'acme-corp-id',
  },
  {
    id: 'lisa-park-id',
    name: 'Lisa Park',
    initials: 'LP',
    email: 'lisa@acmecorp.com',
    organizationId: 'acme-corp-id',
  },
  {
    id: 'james-wilson-id',
    name: 'James Wilson',
    initials: 'JW',
    email: 'james@acmecorp.com',
    organizationId: 'acme-corp-id',
  },
  
  // TechStaff Inc Contractors
  {
    id: 'alex-kim-id',
    name: 'Alex Kim',
    initials: 'AK',
    email: 'alex@techstaff.com',
    organizationId: 'techstaff-id',
  },
  {
    id: 'jordan-lee-id',
    name: 'Jordan Lee',
    initials: 'JL',
    email: 'jordan@techstaff.com',
    organizationId: 'techstaff-id',
  },
];

// ============================================================================
// CONTRACTS (3 Individual + 2 Company)
// ============================================================================

export const demoContracts: Contract[] = [
  // Individual Freelancer Contracts
  {
    id: 'contract-sarah-001',
    projectId: 'mobile-app-redesign',
    
    providerId: 'sarah-chen-id',
    providerType: 'individual',
    providerName: 'Sarah Chen',
    
    recipientId: 'agency-owner-id',
    recipientType: 'agency',
    recipientName: 'TechFlow Agency',
    
    baseHourlyRate: 60,
    workTypeRates: {
      regular: 60,
      travel: 30,
      overtime: 90,
      oncall: 45,
    },
    
    contractNumber: 'IND-2025-001',
    currency: 'USD',
    billingCycle: 'monthly',
    status: 'active',
    effectiveDate: new Date('2025-01-01'),
    
    hideRateFromProvider: true,
    hideRateFromRecipient: false,
    
    createdBy: 'agency-owner-id',
    createdAt: new Date('2024-12-15'),
  },
  
  {
    id: 'contract-mike-002',
    projectId: 'mobile-app-redesign',
    
    providerId: 'mike-johnson-id',
    providerType: 'individual',
    providerName: 'Mike Johnson',
    
    recipientId: 'agency-owner-id',
    recipientType: 'agency',
    recipientName: 'TechFlow Agency',
    
    baseHourlyRate: 75,
    workTypeRates: {
      regular: 75,
      travel: 37.5,
      overtime: 112.5,
      oncall: 56.25,
    },
    
    contractNumber: 'IND-2025-002',
    currency: 'USD',
    billingCycle: 'monthly',
    status: 'active',
    effectiveDate: new Date('2025-02-01'),
    
    hideRateFromProvider: true,
    hideRateFromRecipient: false,
    
    createdBy: 'agency-owner-id',
    createdAt: new Date('2025-01-20'),
  },
  
  {
    id: 'contract-emma-003',
    projectId: 'mobile-app-redesign',
    
    providerId: 'emma-davis-id',
    providerType: 'individual',
    providerName: 'Emma Davis',
    
    recipientId: 'agency-owner-id',
    recipientType: 'agency',
    recipientName: 'TechFlow Agency',
    
    baseHourlyRate: 55,
    workTypeRates: {
      regular: 55,
      travel: 27.5,
      overtime: 82.5,
      oncall: 41.25,
    },
    
    contractNumber: 'IND-2025-003',
    currency: 'USD',
    billingCycle: 'monthly',
    status: 'active',
    effectiveDate: new Date('2025-03-01'),
    
    hideRateFromProvider: true,
    hideRateFromRecipient: false,
    
    createdBy: 'agency-owner-id',
    createdAt: new Date('2025-02-25'),
  },
  
  // Company Contracts
  {
    id: 'contract-acme-004',
    projectId: 'mobile-app-redesign',
    
    providerId: 'acme-corp-id',
    providerType: 'company',
    providerName: 'Acme Corp',
    
    recipientId: 'agency-owner-id',
    recipientType: 'agency',
    recipientName: 'TechFlow Agency',
    
    baseHourlyRate: 65,
    workTypeRates: {
      regular: 65,
      travel: 32.5,
      overtime: 97.5,
      oncall: 48.75,
    },
    
    contractNumber: 'CORP-2025-001',
    currency: 'USD',
    billingCycle: 'monthly',
    status: 'active',
    effectiveDate: new Date('2025-01-01'),
    
    hideRateFromProvider: true,
    hideRateFromRecipient: true,
    
    createdBy: 'agency-owner-id',
    createdAt: new Date('2024-12-01'),
  },
  
  {
    id: 'contract-techstaff-005',
    projectId: 'mobile-app-redesign',
    
    providerId: 'techstaff-id',
    providerType: 'company',
    providerName: 'TechStaff Inc',
    
    recipientId: 'agency-owner-id',
    recipientType: 'agency',
    recipientName: 'TechFlow Agency',
    
    baseHourlyRate: 70,
    workTypeRates: {
      regular: 70,
      travel: 35,
      overtime: 105,
      oncall: 52.5,
    },
    
    contractNumber: 'CORP-2025-002',
    currency: 'USD',
    billingCycle: 'monthly',
    status: 'active',
    effectiveDate: new Date('2025-01-15'),
    
    hideRateFromProvider: true,
    hideRateFromRecipient: true,
    
    createdBy: 'agency-owner-id',
    createdAt: new Date('2024-12-20'),
  },
];

// ============================================================================
// TIMESHEET ENTRIES (Mock pending entries for approval queue)
// ============================================================================

const thisMonday = new Date('2025-10-20'); // Current week Monday
const thisTuesday = new Date('2025-10-21');
const thisWednesday = new Date('2025-10-22');

export const demoTimesheetEntries: TimesheetEntry[] = [
  // Sarah Chen - Individual (22h this week)
  {
    id: 'entry-sarah-1',
    userId: 'sarah-chen-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'API Integration - User Authentication',
    notes: 'Implemented OAuth flow',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-sarah-2',
    userId: 'sarah-chen-id',
    projectId: 'mobile-app-redesign',
    date: thisTuesday,
    hours: 8,
    task: 'API Testing & Debugging',
    notes: 'Fixed authentication edge cases',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisTuesday,
    updatedAt: thisTuesday,
  },
  {
    id: 'entry-sarah-3',
    userId: 'sarah-chen-id',
    projectId: 'mobile-app-redesign',
    date: thisWednesday,
    hours: 6,
    task: 'Documentation',
    notes: 'Wrote API documentation',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisWednesday,
    updatedAt: thisWednesday,
  },
  
  // Mike Johnson - Individual (16h this week)
  {
    id: 'entry-mike-1',
    userId: 'mike-johnson-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'UI Design - Dashboard',
    notes: 'Finalized dashboard mockups',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-mike-2',
    userId: 'mike-johnson-id',
    projectId: 'mobile-app-redesign',
    date: thisTuesday,
    hours: 8,
    task: 'Prototyping',
    notes: 'Built interactive prototype',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisTuesday,
    updatedAt: thisTuesday,
  },
  
  // Emma Davis - Individual (16h this week)
  {
    id: 'entry-emma-1',
    userId: 'emma-davis-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'QA Testing',
    notes: 'Smoke testing on staging',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-emma-2',
    userId: 'emma-davis-id',
    projectId: 'mobile-app-redesign',
    date: thisWednesday,
    hours: 8,
    task: 'Bug Fixes',
    notes: 'Fixed 12 critical bugs',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisWednesday,
    updatedAt: thisWednesday,
  },
  
  // Acme Corp Contractors (120h total)
  // Tom Martinez
  {
    id: 'entry-tom-1',
    userId: 'tom-martinez-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'Backend Development',
    notes: 'Database schema updates',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-tom-2',
    userId: 'tom-martinez-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisTuesday,
    hours: 8,
    task: 'API Development',
    notes: 'Built REST endpoints',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisTuesday,
    updatedAt: thisTuesday,
  },
  {
    id: 'entry-tom-3',
    userId: 'tom-martinez-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisWednesday,
    hours: 8,
    task: 'Performance Optimization',
    notes: 'Query optimization',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisWednesday,
    updatedAt: thisWednesday,
  },
  
  // Lisa Park
  {
    id: 'entry-lisa-1',
    userId: 'lisa-park-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'Frontend Development',
    notes: 'Implemented dashboard UI',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-lisa-2',
    userId: 'lisa-park-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisTuesday,
    hours: 8,
    task: 'State Management',
    notes: 'Redux setup',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisTuesday,
    updatedAt: thisTuesday,
  },
  {
    id: 'entry-lisa-3',
    userId: 'lisa-park-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisWednesday,
    hours: 8,
    task: 'Component Library',
    notes: 'Built reusable components',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisWednesday,
    updatedAt: thisWednesday,
  },
  
  // James Wilson
  {
    id: 'entry-james-1',
    userId: 'james-wilson-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'DevOps',
    notes: 'CI/CD pipeline setup',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-james-2',
    userId: 'james-wilson-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisTuesday,
    hours: 8,
    task: 'Cloud Infrastructure',
    notes: 'AWS configuration',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisTuesday,
    updatedAt: thisTuesday,
  },
  {
    id: 'entry-james-3',
    userId: 'james-wilson-id',
    organizationId: 'acme-corp-id',
    projectId: 'mobile-app-redesign',
    date: thisWednesday,
    hours: 8,
    task: 'Monitoring Setup',
    notes: 'CloudWatch alerts',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisWednesday,
    updatedAt: thisWednesday,
  },
  
  // TechStaff Inc Contractors (80h total)
  // Alex Kim
  {
    id: 'entry-alex-1',
    userId: 'alex-kim-id',
    organizationId: 'techstaff-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'Mobile Development - iOS',
    notes: 'SwiftUI implementation',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-alex-2',
    userId: 'alex-kim-id',
    organizationId: 'techstaff-id',
    projectId: 'mobile-app-redesign',
    date: thisTuesday,
    hours: 8,
    task: 'Push Notifications',
    notes: 'APNs integration',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisTuesday,
    updatedAt: thisTuesday,
  },
  {
    id: 'entry-alex-3',
    userId: 'alex-kim-id',
    organizationId: 'techstaff-id',
    projectId: 'mobile-app-redesign',
    date: thisWednesday,
    hours: 8,
    task: 'App Store Submission',
    notes: 'Prepared build for review',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisWednesday,
    updatedAt: thisWednesday,
  },
  
  // Jordan Lee
  {
    id: 'entry-jordan-1',
    userId: 'jordan-lee-id',
    organizationId: 'techstaff-id',
    projectId: 'mobile-app-redesign',
    date: thisMonday,
    hours: 8,
    task: 'Mobile Development - Android',
    notes: 'Jetpack Compose UI',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisMonday,
    updatedAt: thisMonday,
  },
  {
    id: 'entry-jordan-2',
    userId: 'jordan-lee-id',
    organizationId: 'techstaff-id',
    projectId: 'mobile-app-redesign',
    date: thisTuesday,
    hours: 8,
    task: 'Firebase Integration',
    notes: 'FCM setup',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisTuesday,
    updatedAt: thisTuesday,
  },
  {
    id: 'entry-jordan-3',
    userId: 'jordan-lee-id',
    organizationId: 'techstaff-id',
    projectId: 'mobile-app-redesign',
    date: thisWednesday,
    hours: 8,
    task: 'Play Store Submission',
    notes: 'Beta release',
    workType: 'regular',
    status: 'submitted',
    createdAt: thisWednesday,
    updatedAt: thisWednesday,
  },
];

// ============================================================================
// SUMMARY STATS
// ============================================================================

export const demoApprovalSummary = {
  totalContracts: 5,
  individualContracts: 3,
  companyContracts: 2,
  
  totalHours: 254,
  totalAmount: 17820,
  
  individualContractors: {
    count: 3,
    hours: 54,
    amount: 4020,
  },
  
  companyContractors: {
    count: 2,
    hours: 200,
    amount: 13800,
  },
};