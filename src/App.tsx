import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { PersonaProvider } from './contexts/PersonaContext';
import { WorkGraphProvider } from './contexts/WorkGraphContext';
import { TimesheetStoreProvider } from './contexts/TimesheetDataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Force light mode globally
if (typeof document !== 'undefined') {
  document.documentElement.classList.remove('dark');
}

export default function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
