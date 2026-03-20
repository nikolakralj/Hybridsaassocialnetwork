import { WidgetCard } from "../WidgetCard";
import { Button } from "../ui/button";
import { TrendingUp } from "lucide-react";
import { Badge } from "../ui/badge";
import { toast } from "sonner";

export function AIInsightsWidget() {
  const insights = [
    {
      what: "Move 'Deadlines' to top",
      why: "Improves on-time rate (last 4 weeks)",
      confidence: "High",
      action: "Apply",
    },
    {
      what: "Draft SOW from Job #142",
      why: "All required fields complete",
      confidence: "High",
      action: "Review",
    },
  ];

  const handleApply = (insight: typeof insights[0]) => {
    // Show undo toast
    toast.success(`Applied: ${insight.what}`, {
      action: {
        label: "Undo",
        onClick: () => toast.info("Action undone"),
      },
      duration: 5000,
    });
  };

  return (
    <WidgetCard
      title="AI Insights"
      tooltip="Smart suggestions and opportunities"
      size="S"
    >
      <div className="space-y-3">
        {insights.slice(0, 2).map((insight, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg border border-ai-accent/20 bg-ai-accent/5"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <p className="text-sm mb-1">{insight.what}?</p>
                <p className="text-xs text-muted-foreground">{insight.why}</p>
              </div>
              <Badge
                variant="outline"
                className="border-ai-accent/30 text-xs h-5 flex-shrink-0"
                style={{ color: "var(--ai-accent)" }}
              >
                {insight.confidence}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                style={{
                  backgroundColor: "var(--ai-accent)",
                  color: "var(--ai-accent-foreground)",
                }}
                onClick={() => handleApply(insight)}
              >
                {insight.action}
              </Button>
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 p-0"
              >
                Why this?
              </button>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
