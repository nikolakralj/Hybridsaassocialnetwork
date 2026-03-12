import { X, Check, ArrowRight } from "lucide-react";

export function ComparisonDiagram() {
  const oldWay = [
    "LinkedIn for networking",
    "Upwork/Toptal for finding contracts",
    "Spreadsheets for time tracking",
    "QuickBooks for invoicing",
    "Email threads for approvals",
    "Separate logins for each client",
  ];

  const warpWay = [
    "Professional profile + social feed",
    "Job listings in your network",
    "Built-in weekly timesheets",
    "Auto-invoicing from approved hours",
    "Multi-party approval chains",
    "One workspace, all relationships",
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            Stop juggling tools
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Replace your entire freelance tech stack with one platform
          </p>
        </div>

        {/* Comparison grid */}
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-8 items-start">
          {/* Old way */}
          <div className="bg-destructive/5 border-2 border-destructive/20 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg m-0">The old way</h3>
            </div>
            <div className="space-y-3">
              {oldWay.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground m-0">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-destructive/20">
              <p className="text-sm font-medium text-destructive m-0">
                $200+/mo in subscriptions
              </p>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center pt-20">
            <ArrowRight className="w-8 h-8 text-accent-brand" />
          </div>

          {/* WorkGraph way */}
          <div className="bg-success/5 border-2 border-success/20 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <h3 className="font-semibold text-lg m-0">The WorkGraph way</h3>
            </div>
            <div className="space-y-3">
              {warpWay.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-sm m-0">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-success/20">
              <p className="text-sm font-medium text-success m-0">
                Free for individuals
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}