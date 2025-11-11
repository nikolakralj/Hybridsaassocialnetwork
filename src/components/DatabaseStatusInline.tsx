/**
 * Inline Database Status Checker
 * Shows quick database health check with table counts
 */

import { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { verifySupabaseSetup } from '../utils/api/supabase-setup-check';

export function DatabaseStatusInline() {
  const [status, setStatus] = useState<{
    connection: boolean;
    tables: Record<string, boolean>;
    counts: Record<string, number>;
    errors: string[];
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const result = await verifySupabaseSetup();
      setStatus(result);
    } catch (error) {
      console.error('Failed to check database status:', error);
      setStatus({
        connection: false,
        tables: {},
        counts: {},
        errors: ['Failed to connect to database'],
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (!status && !isChecking) {
    return null;
  }

  const hasData = status && Object.values(status.counts).some(count => count > 0);
  const allTablesExist = status && Object.values(status.tables).every(exists => exists);

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-600" />
          <h4 className="font-semibold text-gray-900">Database Status</h4>
        </div>
        <button
          onClick={checkStatus}
          disabled={isChecking}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 ${isChecking ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isChecking ? (
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Checking database...
        </div>
      ) : status ? (
        <div className="space-y-2">
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            {status.connection ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-700">Connected to Supabase</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-700">Connection failed</span>
              </>
            )}
          </div>

          {/* Tables Status */}
          {status.connection && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Tables ({Object.values(status.tables).filter(Boolean).length}/{Object.keys(status.tables).length})
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(status.tables).map(([table, exists]) => (
                  <div key={table} className="flex items-center gap-1.5">
                    {exists ? (
                      <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                    )}
                    <span className={exists ? 'text-gray-700' : 'text-red-700'}>
                      {table.replace('_', ' ')} {exists && status.counts[table] !== undefined && `(${status.counts[table]})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Summary */}
          {hasData && (
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs font-semibold text-green-700">
                ✅ Found {Object.values(status.counts).reduce((a, b) => a + b, 0)} total records
              </div>
            </div>
          )}

          {/* No Data Warning */}
          {allTablesExist && !hasData && (
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-start gap-2 text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Tables exist but contain no data. Click "Go to Setup Page" to seed demo data.</span>
              </div>
            </div>
          )}

          {/* Errors */}
          {status.errors.length > 0 && (
            <div className="pt-2 border-t border-gray-200 space-y-1">
              <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">Errors</div>
              {status.errors.slice(0, 3).map((error, i) => (
                <div key={i} className="text-xs text-red-600 flex items-start gap-1">
                  <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ))}
              {status.errors.length > 3 && (
                <div className="text-xs text-red-600">...and {status.errors.length - 3} more</div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
