import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * 🧪 TEST MODE ONLY - Phase 5 Validation
 * 
 * This is a TEMPORARY testing harness to validate the approval flow.
 * Will be REPLACED with real Supabase Auth in Phase 9.
 */

export type PersonaRole = 'contractor' | 'manager' | 'client';

export interface TestPersona {
  id: string;
  email: string;
  name: string;
  role: PersonaRole;
  companyId?: string;
  contractorId?: string;
}

// Test personas for validation
export const TEST_PERSONAS: TestPersona[] = [
  {
    id: 'alice-contractor',
    email: 'alice@contractor.com',
    name: 'Alice Chen',
    role: 'contractor',
    contractorId: 'contractor-001',
  },
  {
    id: 'bob-manager',
    email: 'bob@techcorp.com',
    name: 'Bob Martinez',
    role: 'manager',
    companyId: 'company-001',
  },
  {
    id: 'charlie-client',
    email: 'charlie@megacorp.com',
    name: 'Charlie Davis',
    role: 'client',
    companyId: 'company-002',
  },
];

interface PersonaContextType {
  currentPersona: TestPersona | null;
  setPersona: (persona: TestPersona) => void;
  isTestMode: boolean;
  hasPermission: (permission: string, resourceId?: string) => boolean;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [currentPersona, setCurrentPersona] = useState<TestPersona | null>(() => {
    // Load from localStorage
    const stored = localStorage.getItem('test-persona');
    if (stored) {
      try {
        const persona = JSON.parse(stored);
        return TEST_PERSONAS.find(p => p.id === persona.id) || TEST_PERSONAS[0];
      } catch {
        return TEST_PERSONAS[0];
      }
    }
    return TEST_PERSONAS[0]; // Default to Alice (contractor)
  });

  const setPersona = (persona: TestPersona) => {
    setCurrentPersona(persona);
    localStorage.setItem('test-persona', JSON.stringify(persona));
    console.log('🧪 [TEST MODE] Switched to persona:', persona.name, persona.role);
  };

  // Simple permission check based on role
  const hasPermission = (permission: string, resourceId?: string): boolean => {
    if (!currentPersona) return false;

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
  };

  return (
    <PersonaContext.Provider
      value={{
        currentPersona,
        setPersona,
        isTestMode: true,
        hasPermission,
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
}
