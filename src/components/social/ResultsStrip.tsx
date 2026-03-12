import { Code, GitBranch, Layers, Rocket } from "lucide-react";

export function ResultsStrip() {
  const stats = [
    {
      icon: Layers,
      number: "3-tier",
      label: "Graph data model",
      sublabel: "Company → Agency → Client",
    },
    {
      icon: Code,
      number: "ReBAC",
      label: "Access control",
      sublabel: "Relationship-based permissions",
    },
    {
      icon: GitBranch,
      number: "Multi-party",
      label: "Approval chains",
      sublabel: "Cascading sign-off workflows",
    },
    {
      icon: Rocket,
      number: "Open",
      label: "Beta",
      sublabel: "Free while we build in public",
    },
  ];

  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-sm text-muted-foreground mb-10">
          Not another generic freelancer tool — WorkGraph models how work{" "}
          <span className="text-foreground font-medium">actually flows</span>{" "}
          between organizations
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-5 rounded-xl border border-border/50 bg-card/50"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-brand/10 flex items-center justify-center mx-auto mb-3">
                <stat.icon className="w-5 h-5 text-accent-brand" />
              </div>
              <div className="text-xl font-semibold text-foreground mb-0.5">
                {stat.number}
              </div>
              <div className="text-sm font-medium text-foreground mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-muted-foreground">{stat.sublabel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
