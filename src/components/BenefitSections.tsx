import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Users, Briefcase, Clock, Network, Shield, Eye } from "lucide-react";

export function BenefitSections() {
  const benefits = [
    {
      icon: Network,
      iconColor: "bg-blue-500/10 text-blue-600",
      title: "A graph that models real work relationships",
      description:
        "WorkGraph uses a 3-tier graph data model (Company → Agency → Client) to map how organizations actually collaborate. Not flat contact lists — real organizational relationships with scoped permissions.",
      features: [
        "Company, Agency, and Client node types",
        "Relationship-Based Access Control (ReBAC)",
        "Persona switching — see the platform from any perspective",
        "SVG auto-layout visualization engine",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1770159116807-9b2a7bb82294?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVlbGFuY2VyJTIwbGFwdG9wJTIwY29kaW5nJTIwZGFyayUyMG1pbmltYWx8ZW58MXx8fHwxNzczMjgxOTAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
      imageAlt: "Developer working on code",
    },
    {
      icon: Briefcase,
      iconColor: "bg-amber-500/10 text-amber-600",
      title: "Projects with built-in compliance",
      description:
        "Create projects with statements of work, approval chains, and region-aware settings. Every contractor interaction has a paper trail.",
      features: [
        "Project creation wizard with SOW builder",
        "Multi-currency and region support",
        "Work week configuration",
        "Member management with role-based access",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1695462131553-5f532df1768d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobmljYWwlMjB0ZWFtJTIwcmVtb3RlJTIwd29yayUyMHZpZGVvJTIwY2FsbHxlbnwxfHx8fDE3NzMyODE5MDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
      imageAlt: "Team collaboration",
    },
    {
      icon: Clock,
      iconColor: "bg-emerald-500/10 text-emerald-600",
      title: "Hours-first timesheets that flow through the graph",
      description:
        "Our timesheet system is designed around hours, not tasks. Log time, submit for approval, and watch it cascade through your multi-party approval chain automatically.",
      features: [
        "Weekly timesheet grid with task tagging",
        "Multi-party cascading approvals",
        "SLA tracking for approval deadlines",
        "Automatic invoice generation from approved hours",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1702479743967-3dcccd4a671d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBkYXNoYm9hcmQlMjBhbmFseXRpY3MlMjBzY3JlZW4lMjBkYXJrfGVufDF8fHx8MTc3MzIzMzkwMXww&ixlib=rb-4.1.0&q=80&w=1080",
      imageAlt: "Analytics dashboard",
    },
  ];

  return (
    <section id="product" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            Built different, on purpose
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Most freelancer tools are glorified spreadsheets. WorkGraph is a
            relationship-aware platform that understands organizational
            complexity.
          </p>
        </div>

        <div className="space-y-24">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className={`flex flex-col ${
                index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
              } gap-12 items-center`}
            >
              {/* Text side */}
              <div className="flex-1 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl ${benefit.iconColor} flex items-center justify-center mb-4`}
                >
                  <benefit.icon className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-semibold tracking-tight mb-3 text-foreground">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {benefit.description}
                </p>
                <ul className="space-y-2.5">
                  {benefit.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-brand mt-1.5 shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Image side */}
              <div className="flex-1 min-w-0 w-full">
                <div className="rounded-xl overflow-hidden border border-border/50 shadow-lg">
                  <ImageWithFallback
                    src={benefit.imageUrl}
                    alt={benefit.imageAlt}
                    className="w-full h-auto block aspect-[16/10] object-cover"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}