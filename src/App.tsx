import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { QueryProvider } from './components/QueryProvider';
import { PersonaProvider } from './contexts/PersonaContext';
import { WorkGraphProvider } from './contexts/WorkGraphContext';
import { TimesheetStoreProvider } from './contexts/TimesheetDataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';

// Force light mode globally — runs before any React renders
if (typeof document !== 'undefined') {
  document.documentElement.classList.remove('dark');
}

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <PersonaProvider>
          <WorkGraphProvider>
            <TimesheetStoreProvider>
              <NotificationProvider>
                <RouterProvider router={router} />
              </NotificationProvider>
            </TimesheetStoreProvider>
          </WorkGraphProvider>
        </PersonaProvider>
      </AuthProvider>
    </QueryProvider>
  );
}