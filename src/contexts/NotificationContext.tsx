/**
 * NotificationContext — Local notification store for Phase 5 Day 8
 *
 * Generates notifications from timesheet status changes.
 * Tracks multi-party approval chains with progressive status.
 * Manages user preferences (immediate vs quiet mode).
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { WeekStatus } from './TimesheetDataContext';
import { TEST_PERSONAS } from './PersonaContext';

// ============================================================================
// Types
// ============================================================================

export type ApprovalStepStatus = 'completed' | 'pending' | 'awaiting' | 'rejected';

export interface ApprovalStep {
  id: string;
  partyId: string;
  partyName: string;
  partyType: 'company' | 'agency' | 'client';
  status: ApprovalStepStatus;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  order: number;
}

export interface ApprovalChain {
  id: string;
  weekStart: string;
  weekLabel: string;
  personId: string;
  personName: string;
  steps: ApprovalStep[];
  overallStatus: 'draft' | 'in_progress' | 'fully_approved' | 'rejected';
  submittedAt?: string;
  totalHours: number;
}

export type NotifType =
  | 'first_approval'
  | 'middle_approval'
  | 'final_approval'
  | 'rejection'
  | 'submission'
  | 'recall';

export type NotifPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AppNotification {
  id: string;
  type: NotifType;
  priority: NotifPriority;
  title: string;
  message: string;
  actorId?: string;
  actorName?: string;
  recipientId: string;
  weekStart?: string;
  personId?: string;
  read: boolean;
  createdAt: string;
  chainId?: string;
}

export type EmailDigestMode = 'immediate' | 'daily' | 'weekly' | 'quiet';

export interface NotificationPrefs {
  emailDigest: EmailDigestMode;
  notifyEachStep: boolean;       // vs quiet mode (final only)
  notifyOnRejection: boolean;    // always true recommended
  notifyOnSubmission: boolean;   // for approvers
  quietHoursEnabled: boolean;
  quietHoursStart: string;       // "22:00"
  quietHoursEnd: string;         // "08:00"
}

export interface NotificationStoreAPI {
  // Notifications
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;

  // Approval chains
  chains: ApprovalChain[];
  getChainForWeek: (personId: string, weekStart: string) => ApprovalChain | undefined;

  // Preferences
  prefs: NotificationPrefs;
  updatePrefs: (partial: Partial<NotificationPrefs>) => void;

  // Actions — called by TimesheetStore when status changes
  onTimesheetStatusChange: (
    personId: string,
    weekStart: string,
    weekLabel: string,
    newStatus: WeekStatus,
    totalHours: number,
    meta?: { by?: string; note?: string }
  ) => void;

  version: number;
}

// ============================================================================
// Demo approval chains (multi-party)
// ============================================================================

const APPROVAL_CHAIN_TEMPLATES: Record<string, { partyId: string; partyName: string; partyType: 'company' | 'agency' | 'client' }[]> = {
  // Acme Dev Studio employees go through: Acme → Client
  'org-acme': [
    { partyId: 'org-acme', partyName: 'Acme Dev Studio', partyType: 'agency' },
    { partyId: 'client-techcorp', partyName: 'TechCorp (Client)', partyType: 'client' },
  ],
  // BrightWorks employees go through: BrightWorks → Client
  'org-brightworks': [
    { partyId: 'org-brightworks', partyName: 'BrightWorks Design', partyType: 'agency' },
    { partyId: 'client-techcorp', partyName: 'TechCorp (Client)', partyType: 'client' },
  ],
  // Freelancers go direct to client
  '__freelancers__': [
    { partyId: 'client-techcorp', partyName: 'TechCorp (Client)', partyType: 'client' },
  ],
};

function personName(id: string): string {
  return TEST_PERSONAS.find(t => t.id === id)?.name ?? id;
}

function personOrgId(id: string): string {
  const p = TEST_PERSONAS.find(t => t.id === id);
  if (p?.graphOrgId) return p.graphOrgId;
  if (p?.graphViewerType === 'freelancer') return '__freelancers__';
  return '__other__';
}

function getChainTemplate(personId: string) {
  const orgId = personOrgId(personId);
  return APPROVAL_CHAIN_TEMPLATES[orgId] || APPROVAL_CHAIN_TEMPLATES['__freelancers__'];
}

// ============================================================================
// Default preferences
// ============================================================================

const DEFAULT_PREFS: NotificationPrefs = {
  emailDigest: 'immediate',
  notifyEachStep: true,
  notifyOnRejection: true,
  notifyOnSubmission: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

// ============================================================================
// Context
// ============================================================================

const NotificationContext = createContext<NotificationStoreAPI | null>(null);

export function useNotificationStore(): NotificationStoreAPI {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationStore must be used within NotificationProvider');
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chains, setChains] = useState<ApprovalChain[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [version, setVersion] = useState(0);
  const idCounter = useRef(1);

  const bump = useCallback(() => setVersion(v => v + 1), []);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    const notif: AppNotification = {
      ...n,
      id: `notif-${idCounter.current++}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [notif, ...prev]);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    bump();
  }, [bump]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    bump();
  }, [bump]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    bump();
  }, [bump]);

  const updatePrefs = useCallback((partial: Partial<NotificationPrefs>) => {
    setPrefs(prev => ({ ...prev, ...partial }));
    bump();
  }, [bump]);

  const getChainForWeek = useCallback((personId: string, weekStart: string) => {
    return chains.find(c => c.personId === personId && c.weekStart === weekStart);
  }, [chains]);

  const onTimesheetStatusChange = useCallback((
    personId: string,
    weekStart: string,
    weekLabel: string,
    newStatus: WeekStatus,
    totalHours: number,
    meta?: { by?: string; note?: string }
  ) => {
    const name = personName(personId);
    const chainTemplate = getChainTemplate(personId);
    const chainId = `chain-${personId}-${weekStart}`;
    const now = new Date().toISOString();

    // Update or create the approval chain
    setChains(prev => {
      const existing = prev.find(c => c.id === chainId);

      if (newStatus === 'draft') {
        // Recalled — reset chain
        return prev.filter(c => c.id !== chainId);
      }

      if (newStatus === 'submitted') {
        // Create new chain with all steps awaiting
        const steps: ApprovalStep[] = chainTemplate.map((t, i) => ({
          id: `step-${chainId}-${i}`,
          partyId: t.partyId,
          partyName: t.partyName,
          partyType: t.partyType,
          status: i === 0 ? 'pending' : 'awaiting',
          order: i,
        }));
        const chain: ApprovalChain = {
          id: chainId,
          weekStart,
          weekLabel,
          personId,
          personName: name,
          steps,
          overallStatus: 'in_progress',
          submittedAt: now,
          totalHours,
        };
        return [...prev.filter(c => c.id !== chainId), chain];
      }

      if (newStatus === 'approved' && existing) {
        // Find first pending step and approve it
        const updatedSteps = [...existing.steps];
        const pendingIdx = updatedSteps.findIndex(s => s.status === 'pending');
        if (pendingIdx >= 0) {
          updatedSteps[pendingIdx] = {
            ...updatedSteps[pendingIdx],
            status: 'completed',
            decidedAt: now,
            decidedBy: meta?.by || 'Unknown',
          };
          // Next step becomes pending
          if (pendingIdx + 1 < updatedSteps.length) {
            updatedSteps[pendingIdx + 1] = {
              ...updatedSteps[pendingIdx + 1],
              status: 'pending',
            };
          }
        }
        const allDone = updatedSteps.every(s => s.status === 'completed');
        return prev.map(c => c.id === chainId ? {
          ...c,
          steps: updatedSteps,
          overallStatus: allDone ? 'fully_approved' : 'in_progress',
        } as ApprovalChain : c);
      }

      if (newStatus === 'rejected' && existing) {
        const updatedSteps = existing.steps.map(s =>
          s.status === 'pending' ? {
            ...s,
            status: 'rejected' as const,
            decidedAt: now,
            decidedBy: meta?.by || 'Unknown',
            note: meta?.note,
          } : s
        );
        return prev.map(c => c.id === chainId ? {
          ...c,
          steps: updatedSteps,
          overallStatus: 'rejected',
        } as ApprovalChain : c);
      }

      return prev;
    });

    // Generate notifications based on status change + preferences
    if (newStatus === 'submitted') {
      // Notify the first approver
      const firstApprover = chainTemplate[0];
      if (prefs.notifyOnSubmission) {
        addNotification({
          type: 'submission',
          priority: 'normal',
          title: `Timesheet submitted`,
          message: `${name} submitted ${weekLabel} (${totalHours}h) for your approval`,
          actorId: personId,
          actorName: name,
          recipientId: firstApprover.partyId,
          weekStart,
          personId,
          chainId,
        });
      }
    }

    if (newStatus === 'approved') {
      const chain = chains.find(c => c.id === chainId);
      const pendingCount = chain ? chain.steps.filter(s => s.status === 'pending' || s.status === 'awaiting').length : 0;
      const isFirst = chain ? chain.steps.filter(s => s.status === 'completed').length === 0 : true;
      const isFinal = pendingCount <= 1; // Last pending one is being approved now

      if (isFinal) {
        addNotification({
          type: 'final_approval',
          priority: 'high',
          title: `Fully approved — ready to invoice`,
          message: `${weekLabel} (${totalHours}h) has been approved by all parties`,
          actorName: meta?.by,
          recipientId: personId,
          weekStart,
          personId,
          chainId,
        });
      } else if (isFirst) {
        addNotification({
          type: 'first_approval',
          priority: 'normal',
          title: `Approved by ${meta?.by || 'approver'}`,
          message: `${weekLabel} (${totalHours}h) — progress is happening!`,
          actorName: meta?.by,
          recipientId: personId,
          weekStart,
          personId,
          chainId,
        });
      } else if (prefs.notifyEachStep) {
        addNotification({
          type: 'middle_approval',
          priority: 'low',
          title: `Approved by ${meta?.by || 'approver'}`,
          message: `${weekLabel} (${totalHours}h) — moving through the chain`,
          actorName: meta?.by,
          recipientId: personId,
          weekStart,
          personId,
          chainId,
        });
      }
    }

    if (newStatus === 'rejected') {
      addNotification({
        type: 'rejection',
        priority: 'urgent',
        title: `Action needed: Rejected by ${meta?.by || 'approver'}`,
        message: `${weekLabel} (${totalHours}h)${meta?.note ? ` — "${meta.note}"` : ''}`,
        actorName: meta?.by,
        recipientId: personId,
        weekStart,
        personId,
        chainId,
      });
    }

    if (newStatus === 'draft') {
      addNotification({
        type: 'recall',
        priority: 'low',
        title: `Timesheet recalled`,
        message: `${name} recalled ${weekLabel}`,
        actorId: personId,
        actorName: name,
        recipientId: personId,
        weekStart,
        personId,
        chainId,
      });
    }

    bump();
  }, [chains, prefs, addNotification, bump]);

  const unreadCount = useMemo(() =>
    notifications.filter(n => !n.read).length,
    [notifications]
  );

  const api: NotificationStoreAPI = useMemo(() => ({
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    chains,
    getChainForWeek,
    prefs,
    updatePrefs,
    onTimesheetStatusChange,
    version,
  }), [notifications, unreadCount, markRead, markAllRead, clearAll, chains, getChainForWeek, prefs, updatePrefs, onTimesheetStatusChange, version]);

  return (
    <NotificationContext.Provider value={api}>
      {children}
    </NotificationContext.Provider>
  );
}
