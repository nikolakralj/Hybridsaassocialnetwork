import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

/**
 * 🧪 TEST MODE ONLY - Phase 5 Validation
 * 
 * This is a TEMPORARY testing harness to validate the approval flow.
 * Will be REPLACED with real Supabase Auth in Phase 9.
 * 
 * Now wired to the WorkGraph viewer selector for unified perspective switching.
 */

export type PersonaRole = 'contractor' | 'manager' | 'client' | 'admin';

export interface TestPersona {
  id: string;
  email: string;
  name: string;
  role: PersonaRole;
  companyId?: string;
  contractorId?: string;
  /** Graph viewer type (maps to ViewerIdentity.type) */
  graphViewerType?: string;
  /** Org node ID in the graph (for employees) */
  graphOrgId?: string;
}

// Test personas for validation — now includes all graph nodes
export const TEST_PERSONAS: TestPersona[] = [
  // Admin (god mode)
  {
    id: '__admin__',
    email: 'admin@workgraph.dev',
    name: 'Admin (Full View)',
    role: 'admin',
    graphViewerType: 'admin',
  },
  // Acme Dev Studio employees
  {
    id: 'user-sarah',
    email: 'sarah@acmedev.com',
    name: 'Sarah Johnson',
    role: 'contractor',
    companyId: 'org-acme',
    graphViewerType: 'company',
    graphOrgId: 'org-acme',
  },
  {
    id: 'user-mike',
    email: 'mike@acmedev.com',
    name: 'Mike Chen',
    role: 'contractor',
    companyId: 'org-acme',
    graphViewerType: 'company',
    graphOrgId: 'org-acme',
  },
  {
    id: 'user-emily',
    email: 'emily@acmedev.com',
    name: 'Emily Davis',
    role: 'contractor',
    companyId: 'org-acme',
    graphViewerType: 'company',
    graphOrgId: 'org-acme',
  },
  {
    id: 'user-robert',
    email: 'robert@acmedev.com',
    name: 'Robert Garcia',
    role: 'contractor',
    companyId: 'org-acme',
    graphViewerType: 'company',
    graphOrgId: 'org-acme',
  },
  {
    id: 'user-lisa',
    email: 'lisa@acmedev.com',
    name: 'Lisa Anderson',
    role: 'contractor',
    companyId: 'org-acme',
    graphViewerType: 'company',
    graphOrgId: 'org-acme',
  },
  // BrightWorks Design employees
  {
    id: 'user-sophia',
    email: 'sophia@brightworks.com',
    name: 'Sophia Martinez',
    role: 'contractor',
    companyId: 'org-brightworks',
    graphViewerType: 'agency',
    graphOrgId: 'org-brightworks',
  },
  {
    id: 'user-oliver',
    email: 'oliver@brightworks.com',
    name: 'Oliver Anderson',
    role: 'contractor',
    companyId: 'org-brightworks',
    graphViewerType: 'agency',
    graphOrgId: 'org-brightworks',
  },
  {
    id: 'user-emma',
    email: 'emma@brightworks.com',
    name: 'Emma Thomas',
    role: 'contractor',
    companyId: 'org-brightworks',
    graphViewerType: 'agency',
    graphOrgId: 'org-brightworks',
  },
  // Freelancers
  {
    id: 'user-alex',
    email: 'alex@contractor.com',
    name: 'Alex Chen',
    role: 'contractor',
    contractorId: 'contractor-001',
    graphViewerType: 'freelancer',
  },
  {
    id: 'user-jordan',
    email: 'jordan@contractor.com',
    name: 'Jordan Rivera',
    role: 'contractor',
    contractorId: 'contractor-002',
    graphViewerType: 'freelancer',
  },
  // Organizations (as viewers)
  {
    id: 'org-acme',
    email: 'admin@acmedev.com',
    name: 'Acme Dev Studio',
    role: 'manager',
    companyId: 'org-acme',
    graphViewerType: 'company',
  },
  {
    id: 'org-brightworks',
    email: 'admin@brightworks.com',
    name: 'BrightWorks Design',
    role: 'manager',
    companyId: 'org-brightworks',
    graphViewerType: 'agency',
  },
  {
    id: 'client-company',
    email: 'admin@clientcorp.com',
    name: 'Enterprise ClientCorp',
    role: 'client',
    companyId: 'client-company',
    graphViewerType: 'client',
  },
];

interface PersonaContextType {
  currentPersona: TestPersona | null;
  setPersona: (persona: TestPersona) => void;
  /** Switch persona by graph node ID (called from WorkGraph viewer selector) */
  setPersonaByNodeId: (nodeId: string) => void;
  isTestMode: boolean;
  hasPermission: (permission: string, resourceId?: string) => boolean;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [currentPersona, setCurrentPersona] = useState<TestPersona | null>(() => {
    const stored = localStorage.getItem('test-persona');
    if (stored) {
      try {
        const persona = JSON.parse(stored);
        return TEST_PERSONAS.find(p => p.id === persona.id) || TEST_PERSONAS[0];
      } catch {
        return TEST_PERSONAS[0];
      }
    }
    return TEST_PERSONAS[0]; // Default to Admin
  });

  const setPersona = useCallback((persona: TestPersona) => {
    setCurrentPersona(persona);
    localStorage.setItem('test-persona', JSON.stringify(persona));
    console.log('🧪 [TEST MODE] Switched to persona:', persona.name, persona.role);
  }, []);

  const setPersonaByNodeId = useCallback((nodeId: string) => {
    const match = TEST_PERSONAS.find(p => p.id === nodeId);
    if (match) {
      setPersona(match);
    } else {
      console.warn('🧪 [TEST MODE] No persona found for nodeId:', nodeId);
    }
  }, [setPersona]);

  // Simple permission check based on role
  const hasPermission = useCallback((permission: string, resourceId?: string): boolean => {
    if (!currentPersona) return false;
    if (currentPersona.role === 'admin') return true;

    switch (permission) {
      case 'create-timesheet':
        return currentPersona.role === 'contractor';
      
      case 'approve-timesheet':
        return currentPersona.role === 'manager' || currentPersona.role === 'client';
      
      case 'view-all-projects':
        return currentPersona.role === 'manager' || currentPersona.role === 'client';
      
      case 'create-project':
        return currentPersona.role === 'manager';
      
      default:
        return false;
    }
  }, [currentPersona]);

  const contextValue = useMemo(() => ({
    currentPersona,
    setPersona,
    setPersonaByNodeId,
    isTestMode: true as const,
    hasPermission,
  }), [currentPersona, setPersona, setPersonaByNodeId, hasPermission]);

  return (
    <PersonaContext.Provider value={contextValue}>
      {children}
    </PersonaContext.Provider>
  );
}

// Safe fallback for when usePersona is called outside PersonaProvider
// (e.g., Figma component preview renders components in isolation)
const FALLBACK_CONTEXT: PersonaContextType = {
  currentPersona: TEST_PERSONAS[0],
  setPersona: () => {},
  setPersonaByNodeId: () => {},
  isTestMode: true,
  hasPermission: () => false,
};

export function usePersona() {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    console.warn('usePersona called outside PersonaProvider — using fallback');
    return FALLBACK_CONTEXT;
  }
  return context;
}