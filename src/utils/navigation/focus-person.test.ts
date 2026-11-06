import { describe, expect, it } from 'vitest';
import { approvalMatchesFocus, parseTabNavigation, weekMatchesFocus } from './focus-person';

const rodman = { id: 'person-851e', userId: '8dc4d627-4ef0-4815-90c6-f56b50592abc', name: 'Rodman' };

describe('parseTabNavigation', () => {
  it('still accepts the old plain tab name', () => {
    expect(parseTabNavigation('timesheets')).toEqual({ tab: 'timesheets', focusPerson: null });
  });

  it('reads a focused person', () => {
    expect(parseTabNavigation({ tab: 'timesheets', focusPerson: rodman })).toEqual({ tab: 'timesheets', focusPerson: rodman });
  });

  it('drops a malformed focus instead of focusing on nobody', () => {
    expect(parseTabNavigation({ tab: 'approvals', focusPerson: { id: '' } })).toEqual({ tab: 'approvals', focusPerson: null });
    expect(parseTabNavigation({ nope: true })).toBeNull();
    expect(parseTabNavigation(null)).toBeNull();
  });
});

describe('weekMatchesFocus', () => {
  it('matches by account id or by graph node id', () => {
    expect(weekMatchesFocus({ personId: rodman.userId }, rodman)).toBe(true);
    expect(weekMatchesFocus({ personId: 'someone-else', graphNodeId: 'person-851e' }, rodman)).toBe(true);
  });

  it("does not match the signed-in owner's own week", () => {
    expect(weekMatchesFocus({ personId: '9f782a3c-17eb-42f8-b341-c0635312db23' }, rodman)).toBe(false);
  });

  it('keeps every week when nobody is focused', () => {
    expect(weekMatchesFocus({ personId: 'anyone' }, null)).toBe(true);
  });
});

describe('approvalMatchesFocus', () => {
  it('matches the submitter from the subject id, snapshot or account', () => {
    expect(approvalMatchesFocus({ subjectId: 'person-851e:2026-09-07' }, rodman)).toBe(true);
    expect(approvalMatchesFocus({ subjectSnapshot: { submitterId: 'person-851e' } }, rodman)).toBe(true);
    expect(approvalMatchesFocus({ submitterUserId: rodman.userId }, rodman)).toBe(true);
    expect(approvalMatchesFocus({ person: { id: 'person-851e' } }, rodman)).toBe(true);
  });

  it("does not match someone else's approval", () => {
    expect(approvalMatchesFocus({ subjectId: '9f782a3c-17eb-42f8-b341-c0635312db23:2026-08-03' }, rodman)).toBe(false);
  });
});
