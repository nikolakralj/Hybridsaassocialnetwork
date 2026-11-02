/** Hours and status of a submitted or approved week are not editable. */

export function timesheetContentLocked(status: string | null | undefined): boolean {
  return status === 'approved' || status === 'submitted';
}

export function timesheetLockMessage(status: string | null | undefined): string {
  if (status === 'approved') return 'Approved timesheets are locked.';
  if (status === 'submitted') {
    return 'Submitted timesheets are locked while they are being approved. Recall the week to edit it.';
  }
  return 'This timesheet cannot be edited.';
}

export function isTimesheetLockError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42501') return true;
  const message = error.message || '';
  return message.includes('Approved timesheets are locked')
    || message.includes('Submitted timesheets are locked')
    || message.includes('cannot be deleted')
    || message.includes('approval workflow');
}
