/**
 * Shared type definitions for people/contractors across the application
 */

export interface Person {
  id: string;
  name: string;
  initials?: string;
  avatar?: string;
  role?: string;
  email?: string;
  organizationId?: string;
}