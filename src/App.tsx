import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { WorkGraphProvider } from './contexts/WorkGraphContext';
import { TimesheetStoreProvider } from './contexts/TimesheetDataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Force light mode globally
if (typeof document !== 'undefined') {
  document.documentElement.classList.remove('dark');
}

// Phase 1: Real data APIs wired up for Projects, Contracts, Timesheets
// Fix: Removed duplicate barrel exports from types/index.ts to resolve module compilation
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WorkGraphProvider>
          <TimesheetStoreProvider>
            <NotificationProvider>
              <RouterProvider router={router} />
            </NotificationProvider>
          </TimesheetStoreProvider>
        </WorkGraphProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
