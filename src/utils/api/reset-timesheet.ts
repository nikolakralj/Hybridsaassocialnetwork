/**
 * Quick utility to reset timesheet to draft for testing
 */

import { projectId, publicAnonKey } from '../supabase/info';

export async function resetTimesheetToDraft(periodId: string) {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/timesheet-approvals/reset-to-draft`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ periodId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reset timesheet');
  }

  return await response.json();
}
