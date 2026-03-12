import { ArrowRight, FileText, Clock, CheckCircle, DollarSign } from "lucide-react";

export function TestimonialsCarousel() {
  const steps = [
    {
      step: 1,
      icon: FileText,
      title: "Set up a project & SOW",
      description:
        "Create a project, define the statement of work, and invite your team. Companies, agencies, and freelancers each see what's relevant to them.",
      color: "bg-blue-500/10 text-blue-600",
    },
    {
      step: 2,
      icon: Clock,
      title: "Track hours against tasks",
      description:
        "Freelancers log time with our built-in timesheet. Hours are automatically organized by week and project for clean audit trails.",
      color: "bg-amber-500/10 text-amber-600",
    },
    {
      step: 3,
      icon: CheckCircle,
      title: "Multi-party approval chain",
      description:
        "Timesheets flow through the graph — agency approves first, then client. Everyone sees only what they should. No more email ping-pong.",
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      step: 4,
      icon: DollarSign,
      title: "Invoice and get paid",
      description:
        "Approved hours automatically generate invoices. Clean paper trail from logged hour to payment. No spreadsheet needed.",
      color: "bg-violet-500/10 text-violet-600",
    },
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            How WorkGraph works
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From contract to payment in four steps. No context switching.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.step} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(50%+24px)] right-[-calc(50%-24px)] w-[calc(100%-16px)]">
                  <ArrowRight className="w-4 h-4 text-border absolute -right-2 top-1/2 -translate-y-1/2" />
                  <div className="h-px bg-border w-full" />
                </div>
              )}

              <div className="flex flex-col items-center text-center">
                {/* Step icon */}
                <div
                  className={`w-14 h-14 rounded-2xl ${s.color} flex items-center justify-center mb-4`}
                >
                  <s.icon className="w-6 h-6" />
                </div>

                {/* Step number */}
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Step {s.step}
                </span>

                <h3 className="text-sm font-semibold mb-2 text-foreground">
                  {s.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
