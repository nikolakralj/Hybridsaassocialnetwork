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

export function toMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthKeyFromDate(date: Date): string {
  const monthStart = toMonthStart(date);
  return `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyToDate(monthKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
  return new Date(year, monthIndex, 1);
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

export function MonthProvider({ children }: { children: ReactNode }) {
  // Default to the current month so the app opens on today's data, not legacy seed data
  const [selectedMonth, setSelectedMonthState] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const setSelectedMonth = (date: Date) => {
    setSelectedMonthState(toMonthStart(date));
  };

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
