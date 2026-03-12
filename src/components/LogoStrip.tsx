import { Clock, FileText, Network, Shield, Users, Zap } from "lucide-react";

export function LogoStrip() {
  const capabilities = [
    { icon: Network, label: "Work Graph" },
    { icon: Clock, label: "Time Tracking" },
    { icon: FileText, label: "Contracts & SOWs" },
    { icon: Shield, label: "Multi-Party Approvals" },
    { icon: Users, label: "Social Feed" },
    { icon: Zap, label: "Auto Invoicing" },
  ];

  return (
    <section className="py-8 px-6 border-b border-border/30">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs text-muted-foreground mb-5 uppercase tracking-wider font-medium">
          Built-in tools — no integrations needed
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {capabilities.map((cap) => (
            <div
              key={cap.label}
              className="flex items-center gap-2 text-sm text-muted-foreground/70"
            >
              <cap.icon className="w-3.5 h-3.5" />
              <span className="font-medium">{cap.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
