import { Calendar, Clock, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";

export type TimesheetStatus = "draft" | "submitted" | "approved" | "manager_approved" | "rejected" | "amended" | "partial";

interface PersonPeriodCardProps {
  personId: string;
  personName: string;
  personInitials: string;
  role: string;
  company?: string;
  periodStart: Date;
  periodEnd: Date;
  totalHours: number;
  overtimeHours?: number;
  estimatedCost?: number;
  status: TimesheetStatus;
  submittedAt?: Date;
  dueAt: Date;
  flags?: {
    hasWeekend?: boolean;
    hasHoliday?: boolean;
    overDailyLimit?: boolean;
    missingTasks?: boolean;
    outsideContract?: boolean;
  };
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSendBack: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  showCost?: boolean;
}

export function PersonPeriodCard({
  personName,
  personInitials,
  role,
  company,
  periodStart,
  periodEnd,
  totalHours,
  overtimeHours = 0,
  estimatedCost,
  status,
  submittedAt,
  dueAt,
  flags = {},
  onReview,
  onApprove,
  onReject,
  onSendBack,
  isSelected = false,
  onSelect,
  showCost = true,
}: PersonPeriodCardProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatPeriod = () => {
    return `${formatDate(periodStart)} – ${formatDate(periodEnd)}`;
  };

  // Calculate SLA status
  const now = new Date();
  const timeUntilDue = dueAt.getTime() - now.getTime();
  const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);
  const daysUntilDue = Math.ceil(hoursUntilDue / 24);
  
  const slaStatus = hoursUntilDue < 0 ? "overdue" : hoursUntilDue < 24 ? "due-soon" : "on-time";

  const getStatusBadge = () => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Draft</Badge>;
      case "submitted":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Submitted</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Approved</Badge>;
      case "manager_approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Manager Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "amended":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Amended</Badge>;
      case "partial":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Partial</Badge>;
    }
  };

  const getSLABadge = () => {
    if (status === "approved" || status === "manager_approved" || status === "rejected") return null;
    
    switch (slaStatus) {
      case "overdue":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Overdue</Badge>;
      case "due-soon":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 gap-1"><Clock className="w-3 h-3" />Due {hoursUntilDue < 1 ? "now" : `in ${Math.round(hoursUntilDue)}h`}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{daysUntilDue}d remaining</Badge>;
    }
  };

  const flagCount = Object.values(flags).filter(Boolean).length;

  return (
    <Card className={`p-4 transition-all ${isSelected ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/50" : "hover:border-accent-brand"}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="mt-1 w-4 h-4 rounded border-gray-300"
          />
        )}
        
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {personInitials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold truncate">{personName}</h4>
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{role}</span>
            {company && (
              <>
                <span>•</span>
                <span className="truncate">{company}</span>
              </>
            )}
          </div>
        </div>

        {getSLABadge()}
      </div>

      {/* Period & Submission Info */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{formatPeriod()}</span>
        </div>
        {submittedAt && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <CheckCircle2 className="w-3 h-3" />
            <span>Submitted {formatDate(submittedAt)}</span>
          </div>
        )}
      </div>

      {/* Hours & Cost */}
      <div className="grid grid-cols-2 gap-4 mb-3 p-3 bg-muted/50 rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
          <p className="text-lg font-semibold">{totalHours.toFixed(1)}h</p>
          {overtimeHours > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">+{overtimeHours.toFixed(1)}h OT</p>
          )}
        </div>
        {showCost && estimatedCost !== undefined && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Est. Cost</p>
            <p className="text-lg font-semibold">${estimatedCost.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Flags */}
      {flagCount > 0 && (
        <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              {flagCount} issue{flagCount > 1 ? 's' : ''} to review
            </p>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {flags.hasWeekend && (
              <Badge variant="outline" className="text-xs">Weekend work</Badge>
            )}
            {flags.hasHoliday && (
              <Badge variant="outline" className="text-xs">Holiday work</Badge>
            )}
            {flags.overDailyLimit && (
              <Badge variant="outline" className="text-xs">Over daily limit</Badge>
            )}
            {flags.missingTasks && (
              <Badge variant="outline" className="text-xs">Missing tasks</Badge>
            )}
            {flags.outsideContract && (
              <Badge variant="outline" className="text-xs text-red-600">Outside contract dates</Badge>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onReview}
          className="flex-1"
        >
          Review
        </Button>

        {status === "submitted" || status === "amended" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onApprove}
              className="flex-1 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              className="border-red-600 text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Reject
            </Button>
          </>
        ) : status === "partial" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onApprove}
            className="flex-1 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
          >
            Approve All
          </Button>
        ) : null}
      </div>

      {/* Partial approval progress */}
      {status === "partial" && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Approval Progress</span>
            <span>3 of 5 days approved</span>
          </div>
          <Progress value={60} className="h-1.5" />
        </div>
      )}
    </Card>
  );
}