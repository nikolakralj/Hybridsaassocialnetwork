import { describe, expect, it } from 'vitest';
import { isTimesheetLockError, timesheetContentLocked, timesheetLockMessage } from './timesheet-lock';

describe('timesheet lock', () => {
  it('locks approved and submitted weeks and leaves draft and rejected editable', () => {
    expect(timesheetContentLocked('approved')).toBe(true);
    expect(timesheetContentLocked('submitted')).toBe(true);
    expect(timesheetContentLocked('draft')).toBe(false);
    expect(timesheetContentLocked('rejected')).toBe(false);
    expect(timesheetContentLocked(null)).toBe(false);
  });

  it('names the approved lock without offering a status change', () => {
    expect(timesheetLockMessage('approved')).toBe('Approved timesheets are locked.');
    expect(timesheetLockMessage('submitted')).toContain('Recall the week');
  });

  it('recognises the database refusal', () => {
    expect(isTimesheetLockError({ code: '42501', message: 'Approved timesheets are locked.' })).toBe(true);
    expect(isTimesheetLockError({ message: 'network down' })).toBe(false);
  });
});
