import { Check } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { PersonaType } from "./social/IntentChips";

interface PricingSnapshotProps {
  onGetStarted?: (persona?: PersonaType) => void;
}

interface Plan {
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
  persona?: PersonaType;
}

const plans: Plan[] = [
  {
    name: "Counterparty",
    price: "€0",
    cadence: "/month",
    description: "For invited clients, suppliers, and approvers",
    features: [
      "See approval requests assigned to you",
      "Approve or reject your organization's layer",
      "Scoped project and audit visibility",
      "No billing or workspace administration",
    ],
    cta: "Join as counterparty",
    badge: "Always free",
    persona: "company",
  },
  {
    name: "Founding pilot",
    price: "€199",
    cadence: "/month",
    description: "For a staffing or consulting operator proving one real close",
    features: [
      "Up to 3 active client projects",
      "Unlimited workers and counterparty approvers",
      "Timesheets, approval chains, and invoice drafts",
      "Hands-on workflow configuration and weekly review",
      "€750 one-time assisted onboarding",
    ],
    cta: "Start a paid pilot",
    highlighted: true,
    badge: "Best validation path",
    persona: "agency",
  },
  {
    name: "Scale",
    price: "Custom",
    description: "For larger project volumes after a successful pilot",
    features: [
      "Expanded active-project capacity",
      "Close-readiness reporting",
      "Import and integration planning",
      "Priority operating support",
    ],
    cta: "Discuss scale",
    persona: "agency",
  },
];

export function PricingSnapshot({ onGetStarted }: PricingSnapshotProps) {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="m-0 mb-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Price the close, not every invited seat
          </h2>
          <p className="text-muted-foreground m-0">
            The operating company pays. Workers, suppliers, and client approvers can participate without creating a seat-tax objection.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-10 relative rounded-3xl transition-all duration-200 ${
                plan.highlighted
                  ? "border-2 border-accent-brand shadow-2xl scale-[1.03]"
                  : "border-border/50 hover:border-border"
              }`}
            >
              {plan.badge && (
                <Badge className={`absolute -top-3 left-1/2 -translate-x-1/2 ${plan.highlighted ? "bg-accent-brand" : "bg-success"}`}>
                  {plan.badge}
                </Badge>
              )}

              <div className="mb-6">
                <h3 className="m-0 mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground m-0 mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold">{plan.price}</span>
                  {plan.cadence && <span className="text-sm text-muted-foreground">{plan.cadence}</span>}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ minHeight: "44px" }}
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() => onGetStarted?.(plan.persona)}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground m-0">
          Founding-pilot pricing is validated manually. We confirm scope and readiness before onboarding.
        </p>
      </div>
    </section>
  );
}
