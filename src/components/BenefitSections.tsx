import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Users, Briefcase, Clock, Network, Shield, Eye } from "lucide-react";

export function BenefitSections() {
  const benefits = [
    {
      icon: Network,
      iconColor: "bg-blue-500/10 text-blue-600",
      title: "One chain of responsibility across every company",
      description:
        "Model the supplier, agency, client, workers, and approval path once. Each party sees the part of the chain it is permitted to act on.",
      features: [
        "Project-specific organization and worker identities",
        "Server-scoped graph projection",
        "Private commercial fields stay outside unauthorized browser payloads",
        "Visible approval and billing relationships",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1770159116807-9b2a7bb82294?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVlbGFuY2VyJTIwbGFwdG9wJTIwY29kaW5nJTIwZGFyayUyMG1pbmltYWx8ZW58MXx8fHwxNzczMjgxOTAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
      imageAlt: "Developer working on code",
    },
    {
      icon: Briefcase,
      iconColor: "bg-amber-500/10 text-amber-600",
      title: "Real people approve their own layer",
      description:
        "Invite a named counterparty approver to represent their organization. Approval requests route to that person's account instead of a shared admin workaround.",
      features: [
        "Party-tagged invitations",
        "Account-to-organization approver linking",
        "Database-enforced approval ownership",
        "Who-approved-what audit trail",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1695462131553-5f532df1768d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobmljYWwlMjB0ZWFtJTIwcmVtb3RlJTIwd29yayUyMHZpZGVvJTIwY2FsbHxlbnwxfHx8fDE3NzMyODE5MDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
      imageAlt: "Team collaboration",
    },
    {
      icon: Clock,
      iconColor: "bg-emerald-500/10 text-emerald-600",
      title: "Invoice only when the work is ready",
      description:
        "Approved weeks roll into a monthly seller invoice, while readiness checks stop missing private rates from becoming zero-value drafts.",
      features: [
        "Weekly timesheet grid with task tagging",
        "Multi-party cascading approvals",
        "One monthly invoice per seller organization",
        "Issued and paid invoice lifecycle locking",
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
            Built for the operational handoff that spreadsheets miss
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            WorkGraph connects the evidence of work, the people authorized to
            approve it, and the billing output that follows.
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
