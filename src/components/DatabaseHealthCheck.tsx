/**
 * Database Health Check
 * 
 * Checks if required database tables exist and shows setup guide if not.
 */

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export function DatabaseHealthCheck({ children }: { children?: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'needs_setup'>('checking');
  const [missingTables, setMissingTables] = useState<string[]>([]);

  const checkDatabase = async () => {
    setStatus('checking');
    const supabase = createClient();

    const requiredTables = [
      'organizations',
      'project_contracts',
      'timesheet_periods',
      'timesheet_entries',
    ];

    const missing: string[] = [];

    for (const table of requiredTables) {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);
        
        if (error) {
          console.error(`Table ${table} check failed:`, error);
          if (error.code === 'PGRST205' || error.message.includes('not find')) {
            missing.push(table);
          }
        }
      } catch (err) {
        console.error(`Error checking table ${table}:`, err);
        missing.push(table);
      }
    }

    if (missing.length > 0) {
      setMissingTables(missing);
      setStatus('needs_setup');
    } else {
      setStatus('ready');
    }
  };

  useEffect(() => {
    checkDatabase();
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500" />
          <p className="text-muted-foreground">Checking database connection...</p>
        </div>
      </div>
    );
  }

  if (status === 'needs_setup') {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <Card className="p-4 mb-6 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="m-0 mb-1"><strong>Database tables not found</strong></p>
                <p className="text-sm text-muted-foreground m-0 mb-3">
                  Missing tables: {missingTables.join(', ')}
                </p>
                <Button
                  size="sm"
                  onClick={() => window.location.href = '/setup'}
                  className="mr-2"
                >
                  Go to Database Setup
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkDatabase}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recheck
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Database is ready - show children or success message
  return (
    <>
      {children ? (
        children
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <h2 className="m-0">Database Ready!</h2>
            <p className="text-muted-foreground">All required tables exist.</p>
            <Button onClick={() => window.location.href = '/demo/workgraph'}>
              Go to Project Graph
            </Button>
          </div>
        </div>
      )}
    </>
  );
}