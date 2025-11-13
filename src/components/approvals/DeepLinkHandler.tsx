// Phase 5 Day 7: Deep-Link Approval Handler
// Handles one-click approvals from email links

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info'; // ✅ Add Supabase info

type ApprovalStatus = 'validating' | 'success' | 'error' | 'expired' | 'already-processed';

interface ApprovalResult {
  success: boolean;
  message: string;
  itemDetails?: {
    submitterName: string;
    projectName: string;
    periodLabel: string;
    hours: number;
  };
  error?: string;
}

/**
 * Get URL search params in a browser-compatible way
 */
function getSearchParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function DeepLinkApprovalHandler() {
  const searchParams = getSearchParams();
  const token = searchParams.get('token');
  const action = searchParams.get('action') || 'approve'; // Default to approve
  
  const [status, setStatus] = useState<ApprovalStatus>('validating');
  const [result, setResult] = useState<ApprovalResult | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Debug: Log component mount
  useEffect(() => {
    console.log('[DEEP LINK HANDLER] Component mounted!', {
      token,
      action,
      pathname: window.location.pathname,
      search: window.location.search,
    });
  }, []);

  useEffect(() => {
    if (token) {
      handleApprovalAction();
    } else {
      setStatus('error');
      setResult({
        success: false,
        message: 'Invalid approval link',
        error: 'NO_TOKEN',
      });
    }
  }, [token, action]);

  // Auto-redirect countdown for success
  useEffect(() => {
    if (status === 'success' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (status === 'success' && countdown === 0) {
      // Auto-close window or redirect
      if (window.opener) {
        window.close();
      }
    }
  }, [status, countdown]);

  const handleApprovalAction = async () => {
    setStatus('validating');
    
    try {
      // Call real backend approval execution
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/approvals/execute`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, action }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setStatus('success');
        setResult(data);
      } else if (data.error === 'TOKEN_EXPIRED') {
        setStatus('expired');
        setResult(data);
      } else if (data.error === 'ALREADY_PROCESSED' || data.error === 'ALREADY_USED') {
        setStatus('already-processed');
        setResult(data);
      } else {
        setStatus('error');
        setResult(data);
      }
    } catch (error) {
      console.error('Approval execution error:', error);
      setStatus('error');
      setResult({
        success: false,
        message: 'Network error. Please try again.',
        error: 'NETWORK_ERROR',
      });
    }
  };

  const handleGoToApprovals = () => {
    window.location.href = '/my-approvals';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <Card className="max-w-lg w-full p-8">
        {/* Validating State */}
        {status === 'validating' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
            <div>
              <h2 className="text-2xl m-0">Processing {action}...</h2>
              <p className="text-muted-foreground mt-2 m-0">
                Please wait while we verify your request
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span>Validating token</span>
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && result && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            
            <div>
              <h2 className="text-2xl m-0 mb-2">
                {action === 'approve' ? '✅ Approved!' : '❌ Rejected'}
              </h2>
              <p className="text-muted-foreground m-0">
                {result.message}
              </p>
            </div>

            {result.itemDetails && (
              <Card className="p-4 bg-muted text-left">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Submitter:</span>
                    <span className="font-medium">{result.itemDetails.submitterName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Project:</span>
                    <span className="font-medium">{result.itemDetails.projectName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Period:</span>
                    <span className="font-medium">{result.itemDetails.periodLabel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Hours:</span>
                    <span className="font-medium">{result.itemDetails.hours}h</span>
                  </div>
                </div>
              </Card>
            )}

            <div className="pt-4 space-y-3">
              <p className="text-sm text-muted-foreground m-0">
                {window.opener 
                  ? `Window will close in ${countdown} seconds...`
                  : 'You can safely close this window.'
                }
              </p>
              
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={handleGoToApprovals}
                  className="gap-2"
                >
                  View All Approvals
                </Button>
                {window.opener && (
                  <Button 
                    variant="secondary" 
                    onClick={() => window.close()}
                  >
                    Close Window
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expired Token State */}
        {status === 'expired' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            
            <div>
              <h2 className="text-2xl m-0 mb-2">Link Expired</h2>
              <p className="text-muted-foreground m-0">
                This approval link has expired for security reasons.
              </p>
            </div>

            <Card className="p-4 bg-muted">
              <p className="text-sm m-0">
                <strong>Approval links expire after 72 hours.</strong><br />
                Please use the WorkGraph app to complete this approval.
              </p>
            </Card>

            <Button 
              onClick={handleGoToApprovals}
              className="w-full gap-2"
            >
              Go to Approvals Page
            </Button>
          </div>
        )}

        {/* Already Processed State */}
        {status === 'already-processed' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-blue-600" />
            </div>
            
            <div>
              <h2 className="text-2xl m-0 mb-2">Already Processed</h2>
              <p className="text-muted-foreground m-0">
                {result?.message || 'This timesheet has already been approved or rejected.'}
              </p>
            </div>

            <Card className="p-4 bg-muted">
              <p className="text-sm m-0">
                Someone else may have already processed this approval,
                or you may have clicked this link twice.
              </p>
            </Card>

            <Button 
              onClick={handleGoToApprovals}
              className="w-full gap-2"
            >
              View Approval Status
            </Button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            
            <div>
              <h2 className="text-2xl m-0 mb-2">Error</h2>
              <p className="text-muted-foreground m-0">
                {result?.message || 'Unable to process approval'}
              </p>
            </div>

            {result?.error && (
              <Card className="p-4 bg-muted">
                <div className="space-y-1 text-left">
                  <p className="text-sm font-medium m-0">Error Details:</p>
                  <p className="text-xs text-muted-foreground m-0 font-mono">
                    {result.error}
                  </p>
                </div>
              </Card>
            )}

            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Try Again
              </Button>
              <Button 
                onClick={handleGoToApprovals}
                className="flex-1"
              >
                Go to Approvals
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground m-0">
            Powered by <strong>WorkGraph</strong> · Secure Approval System
          </p>
          {token && (
            <p className="text-xs text-muted-foreground mt-1 m-0 font-mono opacity-50">
              Token: {token.substring(0, 16)}...
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

// Rejection-specific handler with reason
export function DeepLinkRejectionHandler() {
  const searchParams = getSearchParams();
  const [reason, setReason] = useState(searchParams.get('reason') || '');
  const [showReasonInput, setShowReasonInput] = useState(!searchParams.get('reason'));

  if (showReasonInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-6">
        <Card className="max-w-lg w-full p-8">
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl m-0 mb-2">Reject Timesheet</h2>
              <p className="text-muted-foreground m-0">
                Please provide a reason for rejection (optional)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Rejection</label>
              <textarea
                className="w-full min-h-[100px] p-3 border border-border rounded-lg resize-none"
                placeholder="e.g., Missing task descriptions, hours don't match expected..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground m-0">
                This will be sent to the submitter
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowReasonInput(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  // Add reason to URL and proceed
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('reason', reason);
                  newParams.set('action', 'reject');
                  window.location.search = newParams.toString();
                }}
                className="flex-1"
              >
                Reject Timesheet
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // If reason provided, proceed with rejection
  return <DeepLinkApprovalHandler />;
}

// Default export for easy routing
export function DeepLinkHandler() {
  const searchParams = getSearchParams();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  
  // Determine which handler to use based on path
  if (path === '/reject' || searchParams.get('action') === 'reject') {
    return <DeepLinkRejectionHandler />;
  }
  
  return <DeepLinkApprovalHandler />;
}