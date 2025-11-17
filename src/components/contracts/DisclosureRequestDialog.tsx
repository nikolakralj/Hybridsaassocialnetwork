// ============================================================================
// DisclosureRequestDialog - Request visibility to vendor's subcontractors
// ============================================================================

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Eye, 
  AlertCircle, 
  Lock, 
  CheckCircle,
  Building2,
} from 'lucide-react';
import type { ViewerContract } from '../../types/project-contracts';

interface DisclosureRequestDialogProps {
  contract: ViewerContract;
  onRequest: (contractId: string, notes?: string) => Promise<void>;
  trigger?: React.ReactNode;
}

export function DisclosureRequestDialog({
  contract,
  onRequest,
  trigger,
}: DisclosureRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onRequest(contract.id, notes);
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setNotes('');
      }, 2000);
    } catch (err) {
      console.error('Failed to request disclosure:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const vendorName = contract.counterparty_org.name;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Request Vendor Details
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        {submitted ? (
          <SubmittedState vendorName={vendorName} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Request Vendor Disclosure
              </DialogTitle>
              <DialogDescription>
                Request visibility to {vendorName}'s subcontractors and sub-vendors.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Explanation */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-1">
                      What is disclosure?
                    </p>
                    <p className="text-sm text-blue-800">
                      Currently, you can see {vendorName} but not their subcontractors.
                      This request asks them to reveal their vendor relationships for
                      compliance, security clearance, or audit purposes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Current State */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Current Visibility</Label>
                <div className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-gray-600" />
                    <span className="font-medium">{vendorName}</span>
                    <Badge variant="outline" className="text-xs">
                      Visible
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 ml-6">
                    <Lock className="w-3 h-3" />
                    <span>Their subcontractors (hidden)</span>
                  </div>
                </div>
              </div>

              {/* After Disclosure */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">After Disclosure</Label>
                <div className="p-3 border border-green-200 rounded-lg bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-green-700" />
                    <span className="font-medium text-green-900">{vendorName}</span>
                    <Badge className="text-xs bg-green-600 text-white">
                      Visible
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700 ml-6">
                    <Eye className="w-3 h-3" />
                    <span>Their subcontractors (visible)</span>
                  </div>
                  <p className="text-xs text-green-600 ml-6 mt-1">
                    Subject to vendor and subcontractor approval
                  </p>
                </div>
              </div>

              {/* Request Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Reason for Request <span className="text-gray-400">(optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="e.g., Required for security clearance review, audit compliance, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  This will be shared with {vendorName} and their subcontractors.
                </p>
              </div>

              {/* Two-Sided Approval Notice */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    <strong>Two-sided approval required:</strong> Both {vendorName} and
                    their subcontractors must approve this request before disclosure is granted.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>Sending Request...</>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Submitted Success State
// ============================================================================

function SubmittedState({ vendorName }: { vendorName: string }) {
  return (
    <div className="py-8">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Request Sent!</h3>
        <p className="text-sm text-gray-600 max-w-sm">
          Your disclosure request has been sent to {vendorName}. 
          You'll be notified when they respond.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Disclosure Status Badge (for contract cards)
// ============================================================================

interface DisclosureStatusBadgeProps {
  hasDisclosure: boolean;
  isPending?: boolean;
}

export function DisclosureStatusBadge({
  hasDisclosure,
  isPending = false,
}: DisclosureStatusBadgeProps) {
  if (hasDisclosure) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200">
        <Eye className="w-3 h-3 mr-1" />
        Disclosed
      </Badge>
    );
  }

  if (isPending) {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-700">
        <AlertCircle className="w-3 h-3 mr-1" />
        Disclosure Requested
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-gray-300 text-gray-600">
      <Lock className="w-3 h-3 mr-1" />
      Private
    </Badge>
  );
}
