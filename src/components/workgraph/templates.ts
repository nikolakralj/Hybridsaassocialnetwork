import type { BaseNode, BaseEdge } from '../../types/workgraph';

export interface WorkGraphTemplate {
  id: string;
  name: string;
  description: string;
  nodes: BaseNode[];
  edges: BaseEdge[];
}

export const TEMPLATES: WorkGraphTemplate[] = [
  {
    id: 'workgraph-project-real',
    name: '🎯 WorkGraph Project (Real Data)',
    description: 'Real people and companies from timesheets database with approval chains',
    nodes: [
      // ============================================================================
      // ✅ REAL PEOPLE FROM DATABASE - Acme Dev Studio
      // ============================================================================
      {
        id: 'user-sarah',
        type: 'person',
        position: { x: 100, y: 100 },
        data: {
          name: 'Sarah Johnson',
          userId: 'user-sarah',
          role: 'company_employee',
          company: 'Acme Dev Studio',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'user-mike',
        type: 'person',
        position: { x: 100, y: 200 },
        data: {
          name: 'Mike Chen',
          userId: 'user-mike',
          role: 'company_employee',
          company: 'Acme Dev Studio',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'user-emily',
        type: 'person',
        position: { x: 100, y: 300 },
        data: {
          name: 'Emily Davis',
          userId: 'user-emily',
          role: 'company_employee',
          company: 'Acme Dev Studio',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'user-robert',
        type: 'person',
        position: { x: 100, y: 400 },
        data: {
          name: 'Robert Garcia',
          userId: 'user-robert',
          role: 'company_employee',
          company: 'Acme Dev Studio',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'user-lisa',
        type: 'person',
        position: { x: 100, y: 500 },
        data: {
          name: 'Lisa Anderson',
          userId: 'user-lisa',
          role: 'company_employee',
          company: 'Acme Dev Studio',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      
      // ============================================================================
      // ✅ REAL PEOPLE FROM DATABASE - BrightWorks Design
      // ============================================================================
      {
        id: 'user-sophia',
        type: 'person',
        position: { x: 100, y: 650 },
        data: {
          name: 'Sophia Martinez',
          userId: 'user-sophia',
          role: 'agency_contractor',
          company: 'BrightWorks Design',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'user-oliver',
        type: 'person',
        position: { x: 100, y: 750 },
        data: {
          name: 'Oliver Anderson',
          userId: 'user-oliver',
          role: 'agency_contractor',
          company: 'BrightWorks Design',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'user-emma',
        type: 'person',
        position: { x: 100, y: 850 },
        data: {
          name: 'Emma Thomas',
          userId: 'user-emma',
          role: 'agency_contractor',
          company: 'BrightWorks Design',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      
      // ============================================================================
      // ✅ REAL FREELANCERS FROM DATABASE
      // ============================================================================
      {
        id: 'user-alex',
        type: 'person',
        position: { x: 100, y: 1000 },
        data: {
          name: 'Alex Chen',
          userId: 'user-alex',
          role: 'individual_contributor',
          company: 'Freelancer',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'user-jordan',
        type: 'person',
        position: { x: 100, y: 1100 },
        data: {
          name: 'Jordan Rivera',
          userId: 'user-jordan',
          role: 'individual_contributor',
          company: 'Freelancer',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      
      // ============================================================================
      // ✅ REAL COMPANIES FROM DATABASE
      // ============================================================================
      {
        id: 'org-acme',
        type: 'party',
        position: { x: 450, y: 300 },
        data: {
          name: 'Acme Dev Studio',
          organizationId: 'org-acme',
          partyType: 'company',
          role: 'Vendor Company',
          canApprove: true,
          canViewRates: true,
          canEditTimesheets: false,
        },
      },
      {
        id: 'org-brightworks',
        type: 'party',
        position: { x: 450, y: 750 },
        data: {
          name: 'BrightWorks Design',
          organizationId: 'org-brightworks',
          partyType: 'agency',
          role: 'Design Agency',
          canApprove: true,
          canViewRates: true,
          canEditTimesheets: false,
        },
      },
      
      // ============================================================================
      // CLIENT (End Client for approval chain)
      // ============================================================================
      {
        id: 'client-company',
        type: 'party',
        position: { x: 800, y: 500 },
        data: {
          name: 'Enterprise ClientCorp',
          partyType: 'client',
          role: 'End Client',
          canApprove: true,
          canViewRates: false,
          canEditTimesheets: false,
        },
      },
      
      // ============================================================================
      // CONTRACTS
      // ============================================================================
      {
        id: 'contract-acme-client',
        type: 'contract',
        position: { x: 625, y: 300 },
        data: {
          name: 'MSA: Acme ↔ Client',
          contractType: 'hourly',
          hourlyRate: 150.00,
          parties: {
            partyA: 'org-acme',
            partyB: 'client-company',
          },
          weeklyHourLimit: 200, // 5 people × 40 hrs
          monthlyHourLimit: 800,
        },
      },
      {
        id: 'contract-brightworks-client',
        type: 'contract',
        position: { x: 625, y: 750 },
        data: {
          name: 'MSA: BrightWorks ↔ Client',
          contractType: 'daily',
          dailyRate: 800.00,
          parties: {
            partyA: 'org-brightworks',
            partyB: 'client-company',
          },
          weeklyHourLimit: 15, // 3 people × 5 days
          monthlyHourLimit: 60,
        },
      },
    ],
    edges: [
      // ============================================================================
      // ACME DEV STUDIO - EMPLOYMENT EDGES
      // ============================================================================
      {
        id: 'employs-sarah',
        type: 'employs',
        source: 'org-acme',
        target: 'user-sarah',
        data: { edgeType: 'employs' },
      },
      {
        id: 'employs-mike',
        type: 'employs',
        source: 'org-acme',
        target: 'user-mike',
        data: { edgeType: 'employs' },
      },
      {
        id: 'employs-emily',
        type: 'employs',
        source: 'org-acme',
        target: 'user-emily',
        data: { edgeType: 'employs' },
      },
      {
        id: 'employs-robert',
        type: 'employs',
        source: 'org-acme',
        target: 'user-robert',
        data: { edgeType: 'employs' },
      },
      {
        id: 'employs-lisa',
        type: 'employs',
        source: 'org-acme',
        target: 'user-lisa',
        data: { edgeType: 'employs' },
      },
      
      // ============================================================================
      // BRIGHTWORKS DESIGN - EMPLOYMENT EDGES
      // ============================================================================
      {
        id: 'employs-sophia',
        type: 'employs',
        source: 'org-brightworks',
        target: 'user-sophia',
        data: { edgeType: 'employs' },
      },
      {
        id: 'employs-oliver',
        type: 'employs',
        source: 'org-brightworks',
        target: 'user-oliver',
        data: { edgeType: 'employs' },
      },
      {
        id: 'employs-emma',
        type: 'employs',
        source: 'org-brightworks',
        target: 'user-emma',
        data: { edgeType: 'employs' },
      },
      
      // ============================================================================
      // APPROVAL FLOWS (2-step: Worker → Company → Client)
      // ============================================================================
      
      // Acme employees submit → Acme approves (step 1)
      {
        id: 'approval-sarah',
        type: 'approves',
        source: 'user-sarah',
        target: 'org-acme',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-mike',
        type: 'approves',
        source: 'user-mike',
        target: 'org-acme',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-emily',
        type: 'approves',
        source: 'user-emily',
        target: 'org-acme',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-robert',
        type: 'approves',
        source: 'user-robert',
        target: 'org-acme',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-lisa',
        type: 'approves',
        source: 'user-lisa',
        target: 'org-acme',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      
      // BrightWorks employees submit → BrightWorks approves (step 1)
      {
        id: 'approval-sophia',
        type: 'approves',
        source: 'user-sophia',
        target: 'org-brightworks',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-oliver',
        type: 'approves',
        source: 'user-oliver',
        target: 'org-brightworks',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-emma',
        type: 'approves',
        source: 'user-emma',
        target: 'org-brightworks',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      
      // Freelancers submit → Client approves (direct, step 1)
      {
        id: 'approval-alex',
        type: 'approves',
        source: 'user-alex',
        target: 'client-company',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-jordan',
        type: 'approves',
        source: 'user-jordan',
        target: 'client-company',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      
      // Companies → Client (step 2)
      {
        id: 'approval-acme-client',
        type: 'approves',
        source: 'org-acme',
        target: 'client-company',
        data: {
          edgeType: 'approves',
          order: 2,
          required: true,
        },
      },
      {
        id: 'approval-brightworks-client',
        type: 'approves',
        source: 'org-brightworks',
        target: 'client-company',
        data: {
          edgeType: 'approves',
          order: 2,
          required: true,
        },
      },
    ],
  },
  
  // ============================================================================
  // SIMPLE TEMPLATE (for users who want to start from scratch)
  // ============================================================================
  {
    id: 'simple-approval-chain',
    name: '📝 Simple Approval Chain',
    description: 'Basic 2-step approval: Worker → Manager → Client',
    nodes: [
      {
        id: 'worker-1',
        type: 'person',
        position: { x: 100, y: 200 },
        data: {
          name: 'New Worker',
          role: 'Contractor',
          canApprove: false,
          canViewRates: true,
          canEditTimesheets: true,
        },
      },
      {
        id: 'manager-1',
        type: 'party',
        position: { x: 400, y: 200 },
        data: {
          name: 'Manager Company',
          partyType: 'company',
          role: 'Vendor',
          canApprove: true,
          canViewRates: true,
          canEditTimesheets: false,
        },
      },
      {
        id: 'client-1',
        type: 'party',
        position: { x: 700, y: 200 },
        data: {
          name: 'Client Company',
          partyType: 'client',
          role: 'End Client',
          canApprove: true,
          canViewRates: false,
          canEditTimesheets: false,
        },
      },
    ],
    edges: [
      {
        id: 'employs-1',
        type: 'employs',
        source: 'manager-1',
        target: 'worker-1',
        data: { edgeType: 'employs' },
      },
      {
        id: 'approval-1',
        type: 'approves',
        source: 'worker-1',
        target: 'manager-1',
        data: {
          edgeType: 'approves',
          order: 1,
          required: true,
        },
      },
      {
        id: 'approval-2',
        type: 'approves',
        source: 'manager-1',
        target: 'client-1',
        data: {
          edgeType: 'approves',
          order: 2,
          required: true,
        },
      },
    ],
  },
  
  // ============================================================================
  // BLANK TEMPLATE
  // ============================================================================
  {
    id: 'blank',
    name: '⚪ Blank Canvas',
    description: 'Start from scratch - no nodes or edges',
    nodes: [],
    edges: [],
  },
];