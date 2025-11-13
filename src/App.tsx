import React from 'react';
import { AppRouter } from './components/AppRouter';
import { QueryProvider } from './components/QueryProvider';
import { PersonaProvider } from './contexts/PersonaContext'; // ✅ TEST MODE: Persona switching
import { Toaster } from './components/ui/sonner';

// FORCE REBUILD: 2025-01-23-18:00:00 - Fixed import error ApprovalsWorkbench
export default function App() {
  // Debug: Log when App.tsx renders
  React.useEffect(() => {
    console.log('[APP.TSX] App mounted!', {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      href: window.location.href,
    });
  }, []);

  return (
    <QueryProvider>
      <PersonaProvider>
        <AppRouter />
        <Toaster />
      </PersonaProvider>
    </QueryProvider>
  );
}