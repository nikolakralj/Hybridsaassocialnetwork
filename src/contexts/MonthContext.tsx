/**
 * MonthContext
 * 
 * Shared context for the currently selected viewing month across all tabs
 * This ensures Project Graph, Timesheets, and other views stay synchronized
 * when users navigate between different months.
 * 
 * Usage:
 * - Timesheets tab updates this when user clicks Previous/Next month
 * - Project Graph reads this to show stats for the selected month
 * - Other components can subscribe to see which month is being viewed
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MonthContextType {
  selectedMonth: Date;
  setSelectedMonth: (date: Date) => void;
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

export function MonthProvider({ children }: { children: ReactNode }) {
  // Default to November 2025 (matches seed data: Nov 4-10)
  const [selectedMonth, setSelectedMonth] = useState(new Date('2025-11-01'));

  return (
    <MonthContext.Provider value={{ selectedMonth, setSelectedMonth }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonthContext() {
  const context = useContext(MonthContext);
  if (!context) {
    throw new Error('useMonthContext must be used within a MonthProvider');
  }
  return context;
}

// Hook to safely use month context (returns current date if not in a provider)
export function useMonthContextSafe() {
  const context = useContext(MonthContext);
  if (!context) {
    // Return current date if not in provider (for components outside ProjectWorkspace)
    return {
      selectedMonth: new Date(),
      setSelectedMonth: () => {},
    };
  }
  return context;
}