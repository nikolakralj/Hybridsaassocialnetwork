import { describe, expect, it } from 'vitest';
import { userDisplayName } from './display-name';

describe('userDisplayName', () => {
  it('uses the full name from the profile', () => {
    expect(userDisplayName({ name: 'QA Tester', email: 'qa@example.com' })).toBe('QA Tester');
  });
  it('falls back to the email when the name is blank', () => {
    expect(userDisplayName({ name: '   ', email: 'qa@example.com' })).toBe('qa@example.com');
  });
  it('falls back to the given default without a user', () => {
    expect(userDisplayName(null, 'Owner')).toBe('Owner');
  });
});
