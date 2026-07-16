import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Loader2, ShieldCheck } from 'lucide-react';
import type { ProjectMember } from '../../types/collaboration';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface WorkerSetupValues {
  organizationName: string;
  displayName: string;
  placementTitle: string;
}

interface ProjectWorkerSetupDialogProps {
  open: boolean;
  member: ProjectMember | null;
  suggestedOrganizationName?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WorkerSetupValues) => Promise<void>;
}

function usableOrganizationName(value?: string): string {
  const name = value?.trim() || '';
  return name === 'Your Organization' ? '' : name;
}

export function ProjectWorkerSetupDialog({
  open,
  member,
  suggestedOrganizationName,
  onOpenChange,
  onSubmit,
}: ProjectWorkerSetupDialogProps) {
  const [organizationName, setOrganizationName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [placementTitle, setPlacementTitle] = useState('Employee');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !member) return;
    setOrganizationName(usableOrganizationName(suggestedOrganizationName));
    setDisplayName(member.userName || member.userEmail?.split('@')[0] || '');
    setPlacementTitle('Employee');
    setError('');
  }, [member, open, suggestedOrganizationName]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const company = organizationName.trim();
    const name = displayName.trim();
    if (!company || !name) {
      setError('Company name and employee name are required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onSubmit({
        organizationName: company,
        displayName: name,
        placementTitle: placementTitle.trim() || 'Employee',
      });
      onOpenChange(false);
    } catch (submissionError: any) {
      setError(submissionError?.message || 'Could not set up this employee.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5" />
            Set up employee
          </DialogTitle>
          <DialogDescription>
            Connect {member?.userName || member?.userEmail || 'this member'} to your company and this project.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="m-0">
                This grants access to submit their own timesheets. It does not grant rate, contract,
                approval, graph-editing, or invoice permissions.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-company-name">Your company name</Label>
            <Input
              id="worker-company-name"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Nikola Company"
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              This replaces the placeholder company name on the project graph.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-display-name">Employee name</Label>
            <Input
              id="worker-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-placement-title">Project role or title</Label>
            <Input
              id="worker-placement-title"
              value={placementTitle}
              onChange={(event) => setPlacementTitle(event.target.value)}
              placeholder="Consultant"
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Activate employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
