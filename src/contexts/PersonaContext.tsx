import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth, type UserProfile } from './AuthContext';

export type PersonaRole = 'contractor' | 'manager' | 'client' | 'admin';

export interface TestPersona {
  id: string;
  email: string;
  name: string;
  role: PersonaRole;
  companyId?: string;
  contractorId?: string;
  graphViewerType?: string;
  graphOrgId?: string;
}

export const TEST_PERSONAS: TestPersona[] = [
  {
    id: '__admin__',
    email: 'admin@workgraph.dev',
    name: 'Admin (Full View)',
    role: 'admin',
    graphViewerType: 'admin',
  },
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
  setPersonaByNodeId: (nodeId: string) => void;
  isTestMode: boolean;
  hasPermission: (permission: string, resourceId?: string) => boolean;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

function mapPersonaTypeToRole(personaType?: UserProfile['persona_type']): PersonaRole {
  switch (personaType) {
    case 'company':
    case 'agency':
      return 'manager';
    default:
      return 'contractor';
  }
}

function mapPersonaTypeToViewerType(personaType?: UserProfile['persona_type']) {
  switch (personaType) {
    case 'company':
      return 'company';
    case 'agency':
      return 'agency';
    default:
      return 'freelancer';
  }
}

function buildAuthPersona(user: UserProfile): TestPersona {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: mapPersonaTypeToRole(user.persona_type),
    graphViewerType: mapPersonaTypeToViewerType(user.persona_type),
  };
}

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      localStorage.removeItem('test-persona');
      return;
    }

    const stored = localStorage.getItem('test-persona');
    if (!stored) return;

    try {
      const persona = JSON.parse(stored);
      const match = TEST_PERSONAS.find((candidate) => candidate.id === persona.id);
      if (match) {
        setSelectedPersonaId(match.id);
      }
    } catch {
      localStorage.removeItem('test-persona');
    }
  }, [user]);

  const authPersona = useMemo(() => {
    if (!user) return null;
    return buildAuthPersona(user);
  }, [user]);

  const selectedPersona = useMemo(() => {
    if (!selectedPersonaId) return null;
    return TEST_PERSONAS.find((persona) => persona.id === selectedPersonaId) || null;
  }, [selectedPersonaId]);

  const currentPersona = selectedPersona || authPersona || TEST_PERSONAS[0];

  const setPersona = useCallback((persona: TestPersona) => {
    setSelectedPersonaId(persona.id);
    if (!user) {
      localStorage.setItem('test-persona', JSON.stringify(persona));
      return;
    }
  }, [user]);

  const setPersonaByNodeId = useCallback((nodeId: string) => {
    const match = TEST_PERSONAS.find((persona) => persona.id === nodeId);
    if (match) {
      setPersona(match);
    }
  }, [setPersona]);

  const hasPermission = useCallback((permission: string): boolean => {
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
    isTestMode: !user || !!selectedPersona,
    hasPermission,
  }), [currentPersona, setPersona, setPersonaByNodeId, selectedPersona, user, hasPermission]);

  return (
    <PersonaContext.Provider value={contextValue}>
      {children}
    </PersonaContext.Provider>
  );
}

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
    return FALLBACK_CONTEXT;
  }
  return context;
}
