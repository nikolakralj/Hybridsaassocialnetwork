// ============================================================================
// MigrationRunner - Optional database setup info
// ============================================================================

import React from 'react';
import { Database, Terminal, Info } from 'lucide-react';

export function MigrationRunner() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <Database className="size-6 text-blue-600 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-blue-900 mb-2">Database Setup (Optional)</h3>
          <p className="text-blue-800 mb-4">
            <strong>✅ The demo is currently running with mock data - no database setup required!</strong>
          </p>
          <p className="text-blue-700 mb-4">
            All 5 components are fully functional with in-memory data. You can interact with the contract
            network, invitations, and disclosure requests without any database configuration.
          </p>
          
          <div className="mt-4 p-4 bg-white rounded border border-blue-200">
            <div className="flex items-start gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900">
                <strong>Want to persist to Supabase?</strong>
              </p>
            </div>
            <p className="text-sm text-blue-700 ml-6">
              Migration SQL files are available in <code className="bg-gray-100 px-1 rounded text-xs">/docs/database/</code> but
              your existing schema may have constraints we can't see (like required user_id columns). 
              For prototyping, the mock data approach works perfectly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
