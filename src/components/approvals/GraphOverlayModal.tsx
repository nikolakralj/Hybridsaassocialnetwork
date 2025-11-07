// Phase 5 Day 4: Graph Overlay Modal
// Opens WorkGraph Builder in approval overlay mode from the approval queue

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  CheckCircle,
  XCircle,
  X,
  Loader2,
  AlertTriangle,
  Eye,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
// import { WorkGraphBuilder } from '../workgraph/WorkGraphBuilder';
import type { ApprovalQueueItem } from '../../utils/api/approvals-queue';
import { approveItemMock, rejectItemMock } from '../../utils/api/approvals-queue';

interface GraphOverlayModalProps {
  open: boolean;
  onClose: () => void;
  item: ApprovalQueueItem | null;
  onApprovalComplete?: () => void;
}

export function GraphOverlayModal({
  open,
  onClose,
  item,
  onApprovalComplete,
}: GraphOverlayModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Keyboard shortcuts: Escape, A=approve, R=reject
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!open) return;
      
      // Escape to close
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      // Ignore if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      // A = Approve
      if (e.key.toLowerCase() === 'a' && !isApproving && !isRejecting) {
        e.preventDefault();
        handleApprove();
      }
      
      // R = Reject
      if (e.key.toLowerCase() === 'r' && !isApproving && !isRejecting) {
        e.preventDefault();
        handleReject();
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [open, onClose, isApproving, isRejecting]);

  if (!item) return null;

  // Handle approve from graph
  async function handleApprove() {
    if (!item) return;
    
    setIsApproving(true);
    try {
      await approveItemMock(item.id, {
        approvedBy: 'current-user',
        notes: 'Approved from graph overlay',
      });
      
      toast.success('Approved from graph!', {
        description: `Moving to step ${item.stepOrder + 1}`,
      });
      
      onClose();
      onApprovalComplete?.();
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setIsApproving(false);
    }
  }

  // Handle reject from graph
  async function handleReject() {
    if (!item) return;
    
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    
    setIsRejecting(true);
    try {
      await rejectItemMock(item.id, {
        rejectedBy: 'current-user',
        reason,
      });
      
      toast.success('Rejected', {
        description: 'Contractor will be notified',
      });
      
      onClose();
      onApprovalComplete?.();
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setIsRejecting(false);
    }
  }

  // Get next step info
  const isLastStep = item.stepOrder === item.totalSteps;
  const nextStepText = isLastStep 
    ? 'Final approval - will complete workflow' 
    : `Next: Step ${item.stepOrder + 1} of ${item.totalSteps}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 gap-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">
                Approval Path on Graph
              </DialogTitle>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{item.person.name}</span>
                  {item.person.role && (
                    <Badge variant="outline" className="text-xs">
                      {item.person.role}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {item.project.name} · Week of {new Date(item.period.start).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            {/* Current Step Badge */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  You are at Step {item.stepOrder} of {item.totalSteps}
                </div>
                <div className="text-xs text-gray-600">{item.partyName}</div>
              </div>
              <Badge 
                variant="default" 
                className="bg-blue-600 text-lg px-4 py-2"
              >
                Step {item.stepOrder}
              </Badge>
            </div>
          </div>
        </div>

        {/* Graph Placeholder - Will be replaced with WorkGraphBuilder once projects are set up */}
        <div className="flex-1 min-h-0 relative bg-gray-50" style={{ height: 'calc(95vh - 280px)' }}>
          {/* Temporary: Visual representation of approval flow */}
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-3xl w-full">
              {/* Approval Flow Diagram */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Approval Flow for {item.person.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {item.project.name} · {item.totalSteps}-step approval process
                  </p>
                </div>
                
                {/* Visual Flow */}
                <div className="flex items-center justify-center gap-4">
                  {/* Step 1 */}
                  <div className={`flex flex-col items-center ${item.stepOrder === 1 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        item.stepOrder === 1 ? 'bg-blue-600 ring-4 ring-blue-200' : 'bg-gray-300'
                      }`}>
                        <span className="text-white font-medium">1</span>
                      </div>
                      {/* YOU badge */}
                      {item.stepOrder === 1 && (
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5 shadow-lg">YOU</Badge>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-sm font-medium text-gray-900">Contractor</div>
                      <div className="text-xs text-gray-600">Submitted</div>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex-shrink-0 text-gray-400">→</div>
                  
                  {/* Step 2 */}
                  <div className={`flex flex-col items-center ${item.stepOrder === 2 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        item.stepOrder === 2 ? 'bg-blue-600 ring-4 ring-blue-200' : 'bg-gray-300'
                      }`}>
                        <span className="text-white font-medium">2</span>
                      </div>
                      {/* YOU badge */}
                      {item.stepOrder === 2 && (
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5 shadow-lg">YOU</Badge>
                        </div>
                      )}
                      {/* NEXT badge */}
                      {item.stepOrder === 1 && (
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5 shadow-lg">NEXT</Badge>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-sm font-medium text-gray-900">Manager</div>
                      <div className="text-xs text-gray-600">
                        {item.stepOrder === 2 ? '← YOU ARE HERE' : 'Pending'}
                      </div>
                    </div>
                  </div>
                  
                  {item.totalSteps > 2 && (
                    <>
                      {/* Arrow */}
                      <div className="flex-shrink-0 text-gray-400">→</div>
                      
                      {/* Step 3 */}
                      <div className={`flex flex-col items-center ${item.stepOrder === 3 ? 'opacity-100' : 'opacity-40'}`}>
                        <div className="relative">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                            item.stepOrder === 3 ? 'bg-blue-600 ring-4 ring-blue-200' : 'bg-gray-300'
                          }`}>
                            <span className="text-white font-medium">3</span>
                          </div>
                          {/* YOU badge */}
                          {item.stepOrder === 3 && (
                            <div className="absolute -top-2 -right-2">
                              <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5 shadow-lg">YOU</Badge>
                            </div>
                          )}
                          {/* NEXT badge */}
                          {item.stepOrder === 2 && (
                            <div className="absolute -top-2 -right-2">
                              <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5 shadow-lg">NEXT</Badge>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-center">
                          <div className="text-sm font-medium text-gray-900">Finance</div>
                          <div className="text-xs text-gray-600">
                            {item.stepOrder === 3 ? '← YOU ARE HERE' : 'Next'}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {item.totalSteps > 3 && (
                    <>
                      {/* Arrow */}
                      <div className="flex-shrink-0 text-gray-400">→</div>
                      
                      {/* Step 4 */}
                      <div className={`flex flex-col items-center ${item.stepOrder === 4 ? 'opacity-100' : 'opacity-40'}`}>
                        <div className="relative">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                            item.stepOrder === 4 ? 'bg-blue-600 ring-4 ring-blue-200' : 'bg-gray-300'
                          }`}>
                            <span className="text-white font-medium">4</span>
                          </div>
                          {/* YOU badge */}
                          {item.stepOrder === 4 && (
                            <div className="absolute -top-2 -right-2">
                              <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5 shadow-lg">YOU</Badge>
                            </div>
                          )}
                          {/* NEXT badge */}
                          {item.stepOrder === 3 && (
                            <div className="absolute -top-2 -right-2">
                              <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5 shadow-lg">NEXT</Badge>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-center">
                          <div className="text-sm font-medium text-gray-900">Client</div>
                          <div className="text-xs text-gray-600">Final</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Legend */}
                <div className="mt-8 pt-6 border-t">
                  <div className="flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-600 ring-2 ring-blue-200"></div>
                      <span className="text-gray-700">Current step</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                      <span className="text-gray-500">Completed/Pending</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Info Note */}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Eye className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Full Graph Overlay Coming Soon</p>
                    <p className="text-blue-800">
                      Once projects are configured, you'll see the complete WorkGraph Builder here with 
                      interactive nodes, zoom/pan capabilities, and live approval path highlighting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="border-t bg-gray-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Hours and Amount */}
              <div className="text-sm">
                <span className="text-gray-600">Hours: </span>
                <span className="font-medium">{item.hours.toFixed(1)}</span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="text-sm">
                <span className="text-gray-600">Amount: </span>
                <span className="font-medium">
                  {item.amount ? `$${item.amount.toLocaleString()}` : '•••'}
                </span>
                {!item.canViewRates && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Rate masked
                  </Badge>
                )}
              </div>
              
              {/* SLA Warning */}
              {item.sla.breached && (
                <>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">SLA Breached</span>
                  </div>
                </>
              )}
            </div>

            {/* Next Step Info */}
            <div className="text-sm text-gray-600">
              {nextStepText}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isApproving || isRejecting}
              >
                <X className="h-4 w-4 mr-2" />
                Close
                <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded">Esc</kbd>
              </Button>
              
              {/* Keyboard hints */}
              <div className="text-xs text-gray-500">
                Shortcuts: <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">A</kbd> approve · 
                <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">R</kbd> reject
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isApproving || isRejecting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                    <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded text-gray-600">R</kbd>
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Now from Graph
                    <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-green-700 border border-green-800 rounded text-white">A</kbd>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Gating Warnings */}
          {item.gating.blocked && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-900 mb-1">
                    Approval Gated
                  </h4>
                  <ul className="text-sm text-amber-800 space-y-1">
                    {item.gating.reasons.map((reason, idx) => (
                      <li key={idx}>• {reason}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-700 mt-2">
                    You can still approve, but policy conditions are not fully met.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}