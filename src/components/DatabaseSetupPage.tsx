/**
 * Database Setup Page
 * 
 * Dedicated page for setting up the WorkGraph database.
 * Shows instructions and SQL scripts.
 */

import { DatabaseHealthCheck } from './DatabaseHealthCheck';

export default function DatabaseSetupPage() {
  return <DatabaseHealthCheck />;
}
