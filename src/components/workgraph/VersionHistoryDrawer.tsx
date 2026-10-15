// Phase 5 Day 1-2: Version History Drawer
// Shows all policy versions with comparison and rollback options

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  History,
  CheckCircle,
  RotateCcw,
  GitCompare,
  Clock,
  User,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { PolicyVersionSummary, PolicyVersionStats } from '../../types/policy-versions';
import { dev as policyApi } from '../../utils/api/policy-versions';
import { PolicyVersionStatus } from './PolicyVersionBadge';

export interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentVersionId: string;
  onVersionSelect?: (versionId: string) => void;
  onCompare?: (versionA: string, versionB: string) => void;
  onRollback?: (versionId: string) => Promise<void>;
}

export function VersionHistoryDrawer({
  open,
  onClose,
  projectId,
  currentVersionId,
  onVersionSelect,
  onCompare,
  onRollback,
}: VersionHistoryDrawerProps) {
  const [versions, setVersions] = useState<PolicyVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [rollbackTarget, setRollbackTarget] = useState<PolicyVersionSummary | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, projectId]);

  async function loadVersions() {
    setLoading(true);
    try {
      const data = await policyApi.getPolicyVersions(projectId);
      setVersions(data);
    } catch (error) {
      console.error('Failed to load version history:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCompareToggle(versionId: string) {
    setSelectedForCompare(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      } else if (prev.length < 2) {
        return [...prev, versionId];
      } else {
        // Replace oldest selection
        return [prev[1], versionId];
      }
    });
  }

  function handleCompare() {
    if (selectedForCompare.length === 2 && onCompare) {
      onCompare(selectedForCompare[0], selectedForCompare[1]);
      setSelectedForCompare([]);
    }
  }

  async function handleRollback() {
    if (!rollbackTarget || !onRollback) return;

    setRollbackLoading(true);
    try {
      await onRollback(rollbackTarget.id);
      setRollbackTarget(null);
      await loadVersions(); // Refresh list
    } catch (error) {
      console.error('Rollback failed:', error);
    } finally {
      setRollbackLoading(false);
    }
  }

  const activeVersion = versions.find(v => v.isActive);

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Policy Version History
            </SheetTitle>
            <SheetDescription>
              View and manage approval policy versions for this project
            </SheetDescription>
          </SheetHeader>

          {/* Compare button */}
          {selectedForCompare.length === 2 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <GitCompare className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-900">
                    2 versions selected for comparison
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedForCompare([])}
                  >
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleCompare}>
                    Compare
                  </Button>
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full mx-auto mb-4" />
                  <p className="text-sm text-gray-500">Loading versions...</p>
                </div>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">No versions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((version, index) => (
                  <div key={version.id}>
                    <VersionCard
                      version={version}
                      isActive={version.isActive}
                      isCurrent={version.id === currentVersionId}
                      isSelectedForCompare={selectedForCompare.includes(version.id)}
                      onSelect={onVersionSelect ? () => onVersionSelect(version.id) : undefined}
                      onCompareToggle={() => handleCompareToggle(version.id)}
                      onRollback={
                        onRollback && !version.isActive
                          ? () => setRollbackTarget(version)
                          : undefined
                      }
                    />
                    {index < versions.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Rollback confirmation dialog */}
      <AlertDialog open={!!rollbackTarget} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback to v{rollbackTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will make v{rollbackTarget?.version} the active policy version.
              </p>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-medium mb-1">In-flight items will stay pinned</p>
                    <p>
                      Timesheets currently using other versions will remain unchanged.
                      Only new timesheets will use v{rollbackTarget?.version}.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Target: Rollback should complete in {"<"}1s
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollbackLoading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {rollbackLoading ? 'Rolling back...' : 'Rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface VersionCardProps {
  version: PolicyVersionSummary;
  isActive: boolean;
  isCurrent: boolean;
  isSelectedForCompare: boolean;
  onSelect?: () => void;
  onCompareToggle: () => void;
  onRollback?: () => void;
}

function VersionCard({
  version,
  isActive,
  isCurrent,
  isSelectedForCompare,
  onSelect,
  onCompareToggle,
  onRollback,
}: VersionCardProps) {
  const formattedDate = new Date(version.createdAt).toLocaleString();

  return (
    <div
      className={`
        p-4 rounded-lg border transition-all
        ${isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
        ${isSelectedForCompare ? 'ring-2 ring-blue-400' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">
              Version {version.version}
            </h3>
            <PolicyVersionStatus
              isActive={version.isActive}
              isPublished={version.isPublished}
            />
            {isCurrent && (
              <Badge variant="outline" className="text-xs">
                Current View
              </Badge>
            )}
          </div>
          {version.versionName && (
            <p className="text-sm text-gray-600">{version.versionName}</p>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span>Created by {version.createdBy}</span>
        </div>
      </div>

      {/* Stats */}
      {(version.totalTimesheets !== undefined || version.pendingApprovals !== undefined) && (
        <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded">
          <div className="text-center">
            <div className="text-lg font-semibold">{version.totalTimesheets || 0}</div>
            <div className="text-xs text-gray-500">Timesheets</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{version.pendingApprovals || 0}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{version.approvedTimesheets || 0}</div>
            <div className="text-xs text-gray-500">Approved</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onSelect && (
          <Button size="sm" variant="outline" onClick={onSelect}>
            <FileText className="w-4 h-4 mr-1" />
            View
          </Button>
        )}
        <Button
          size="sm"
          variant={isSelectedForCompare ? 'default' : 'outline'}
          onClick={onCompareToggle}
        >
          <GitCompare className="w-4 h-4 mr-1" />
          {isSelectedForCompare ? 'Selected' : 'Compare'}
        </Button>
        {onRollback && !isActive && (
          <Button size="sm" variant="outline" onClick={onRollback}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Rollback
          </Button>
        )}
      </div>
    </div>
  );
}
