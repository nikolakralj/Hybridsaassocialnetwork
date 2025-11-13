import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * 🧪 TEST MODE BANNER
 * 
 * Clearly indicates that this is a test environment with no real authentication.
 * Will be REMOVED in Phase 9 when real Supabase Auth is implemented.
 */

export function TestModeBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-900">
              <strong>⚠️ TEST MODE ONLY:</strong> No authentication enabled. Switch personas
              above to test approval flows.
            </span>
            <span className="text-amber-600">
              (Will be replaced with real auth in Phase 9)
            </span>
          </div>
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
      </div>
    </div>
  );
}
