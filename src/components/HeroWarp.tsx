import { useState } from "react";
import { ArrowRight, Building2, Users, Network, BarChart3, Clock, FileText, CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { PersonaType } from "./social/IntentChips";

interface HeroWarpProps {
  onGetStarted?: (email: string, intent?: PersonaType) => void;
}

export function HeroWarp({ onGetStarted }: HeroWarpProps) {
  const [selectedIntent, setSelectedIntent] = useState<PersonaType | null>(null);

  const intents = [
    { id: "freelancer" as PersonaType, label: "I'm freelancing", icon: Users },
    { id: "company" as PersonaType, label: "I hire contractors", icon: Building2 },
    { id: "agency" as PersonaType, label: "I place talent", icon: Network },
  ];

  return (
    <section className="relative px-6 pt-20 pb-8 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-brand/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-brand/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl w-full mx-auto text-center relative z-10">
        {/* Beta badge */}
        <Badge
          variant="secondary"
          className="mb-6 px-4 py-1.5 text-xs font-medium bg-accent-brand/10 text-accent-brand border-accent-brand/20"
        >
          Open Beta — Building in public
        </Badge>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 font-semibold tracking-tight leading-[1.08]">
          The work platform for
          <br className="hidden sm:block" />
          <span className="text-accent-brand"> technical freelancers</span>
        </h1>

        {/* Subtext — honest, not hype */}
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Find contracts, track time, get approvals, and invoice — all connected
          through a graph that maps how companies, agencies, and freelancers
          actually work together.
        </p>

        {/* Intent pills */}
        <div className="flex flex-wrap justify-center gap-2.5 mb-8">
          {intents.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedIntent(id === selectedIntent ? null : id)}
              className={`
                px-4 py-2.5 rounded-xl font-medium transition-all text-sm
                flex items-center gap-2 border cursor-pointer
                ${
                  selectedIntent === id
                    ? "bg-accent-brand text-white border-accent-brand shadow-md"
                    : "bg-card border-border hover:border-accent-brand/40 text-foreground shadow-sm hover:shadow-md"
                }
              `}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Button
            size="lg"
            className="h-12 px-8 text-base rounded-xl font-medium gap-2"
            onClick={() => onGetStarted?.("", selectedIntent || undefined)}
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            No credit card required · Free during beta
          </p>
        </div>

        {/* Product preview — rendered UI mockup */}
        <ProductPreview />
      </div>
    </section>
  );
}

/** A lightweight rendered UI mockup of the dashboard */
function ProductPreview() {
  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="rounded-xl overflow-hidden border border-border/60 shadow-2xl bg-card">
        {/* Fake browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
          </div>
          <div className="flex-1 mx-8">
            <div className="h-5 bg-background rounded-md border border-border/40 max-w-xs mx-auto flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground/60 font-mono">app.workgraph.io/dashboard</span>
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Welcome back, Sarah</div>
              <div className="text-[11px] text-muted-foreground">Here's your overview for this month.</div>
            </div>
            <div className="flex gap-2">
              <div className="h-7 px-3 rounded-md bg-muted text-[11px] flex items-center gap-1.5 text-muted-foreground">
                <BarChart3 className="w-3 h-3" /> Browse Jobs
              </div>
              <div className="h-7 px-3 rounded-md bg-foreground text-background text-[11px] flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Submit Timesheet
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Earnings", value: "$12,450", sub: "+15.3%", color: "bg-emerald-50 text-emerald-600" },
              { label: "Hours Logged", value: "92.5", sub: "87% billable", color: "bg-blue-50 text-blue-600" },
              { label: "Pending Approvals", value: "3", sub: "Worth $4,500", color: "bg-amber-50 text-amber-600" },
              { label: "Active Contracts", value: "5", sub: "2 expiring soon", color: "bg-violet-50 text-violet-600" },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-lg border border-border/40 bg-card text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-md ${stat.color} flex items-center justify-center`}>
                    <div className="w-3 h-3 rounded-sm bg-current opacity-30" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-lg font-semibold text-foreground leading-none">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Chart area + sidebar preview */}
          <div className="grid grid-cols-3 gap-3">
            {/* Chart */}
            <div className="col-span-2 p-3 rounded-lg border border-border/40 bg-card">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-medium text-foreground">Earnings Trend</div>
                <div className="text-[10px] text-muted-foreground">Last 30 days</div>
              </div>
              {/* Mini chart bars */}
              <div className="flex items-end gap-1 h-16">
                {[40, 55, 35, 65, 50, 72, 60, 80, 68, 85, 75, 90, 82, 95, 88].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-accent-brand/20 transition-all"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Sidebar preview */}
            <div className="p-3 rounded-lg border border-border/40 bg-card space-y-3">
              <div className="text-[11px] font-medium text-foreground">Quick Actions</div>
              {[
                { icon: FileText, label: "Log Hours" },
                { icon: CheckCircle, label: "Review Approvals" },
                { icon: Users, label: "My Network" },
              ].map((action) => (
                <div key={action.label} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/40">
                  <action.icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-foreground">{action.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Subtle glow behind */}
      <div className="absolute -inset-4 -z-10 bg-gradient-to-b from-accent-brand/5 via-accent-brand/3 to-transparent rounded-2xl blur-xl" />
    </div>
  );
}
