/**
 * Tab navigation that can carry a person to focus on.
 *
 * Graph Quick Actions ("View Timesheets" on Rodman) switch the workspace tab
 * with a `changeTab` window event. The detail used to be only the tab name,
 * so the Timesheets/Approvals tab opened on the signed-in user. The detail may
 * now also name a person; a plain string is still accepted everywhere.
 *
 * The focus only narrows what a tab already shows. Tabs apply it after their
 * permission filtering, so it can never reveal anyone the viewer cannot see.
 */

export interface FocusPerson {
  /** Graph node id of the person (e.g. "person-851e…"). */
  id: string;
  /** Account id behind the node, when the graph links one. */
  userId?: string;
  name?: string;
}

export type TabNavigationDetail = string | { tab: string; focusPerson?: FocusPerson | null };

export function navigateToTab(tab: string, focusPerson?: FocusPerson | null): void {
  const detail: TabNavigationDetail = focusPerson?.id ? { tab, focusPerson } : tab;
  window.dispatchEvent(new CustomEvent('changeTab', { detail }));
}

export function parseTabNavigation(detail: unknown): { tab: string; focusPerson: FocusPerson | null } | null {
  if (typeof detail === 'string' && detail) return { tab: detail, focusPerson: null };
  if (detail && typeof detail === 'object' && typeof (detail as { tab?: unknown }).tab === 'string') {
    const raw = (detail as { focusPerson?: unknown }).focusPerson;
    const focusPerson = raw && typeof raw === 'object' && typeof (raw as FocusPerson).id === 'string' && (raw as FocusPerson).id
      ? {
          id: (raw as FocusPerson).id,
          ...(typeof (raw as FocusPerson).userId === 'string' && (raw as FocusPerson).userId ? { userId: (raw as FocusPerson).userId } : {}),
          ...(typeof (raw as FocusPerson).name === 'string' && (raw as FocusPerson).name ? { name: (raw as FocusPerson).name } : {}),
        }
      : null;
    return { tab: (detail as { tab: string }).tab, focusPerson };
  }
  return null;
}

/** Every id the focused person can appear under (graph node id and account id). */
export function focusIds(focusPerson: FocusPerson | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (focusPerson?.id) ids.add(focusPerson.id);
  if (focusPerson?.userId) ids.add(focusPerson.userId);
  return ids;
}

export function weekMatchesFocus(
  week: { personId: string; graphNodeId?: string },
  focusPerson: FocusPerson | null | undefined,
): boolean {
  const ids = focusIds(focusPerson);
  if (ids.size === 0) return true;
  return ids.has(week.personId) || (!!week.graphNodeId && ids.has(week.graphNodeId));
}

export function approvalMatchesFocus(
  item: {
    person?: { id?: string };
    submitterUserId?: string;
    subjectId?: string;
    subjectSnapshot?: { submitterId?: string; submitterNodeId?: string } | null;
  },
  focusPerson: FocusPerson | null | undefined,
): boolean {
  const ids = focusIds(focusPerson);
  if (ids.size === 0) return true;
  const subjectPerson = item.subjectId && item.subjectId.includes(':')
    ? item.subjectId.slice(0, item.subjectId.lastIndexOf(':'))
    : undefined;
  return [
    item.person?.id,
    item.submitterUserId,
    item.subjectSnapshot?.submitterId,
    item.subjectSnapshot?.submitterNodeId,
    subjectPerson,
  ].some((candidate) => !!candidate && ids.has(candidate));
}
