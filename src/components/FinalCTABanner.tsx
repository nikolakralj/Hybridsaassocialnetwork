import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

interface FinalCTABannerProps {
  onGetStarted?: () => void;
}

export function FinalCTABanner({ onGetStarted }: FinalCTABannerProps) {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-gradient-to-br from-foreground via-foreground to-foreground/95 text-background overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-background/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-background/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6 leading-tight">
          Run your freelance career at WorkGraph speed
        </h2>
        <p className="text-xl mb-12 opacity-85 max-w-2xl mx-auto leading-relaxed">
          We're building in public and shipping fast. Join the open beta and help shape the future of freelance work infrastructure.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            onClick={onGetStarted}
            className="h-14 px-10 text-base bg-background text-foreground hover:bg-background/95 rounded-xl font-medium apple-shadow-lg hover:apple-shadow-xl apple-transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Start for free
            <ArrowRight className="w-5 h-5 ml-2" strokeWidth={2.5} />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onGetStarted}
            className="h-14 px-10 text-base border-background/30 text-background hover:bg-background/10 hover:border-background/50 rounded-xl font-medium apple-transition backdrop-blur-sm"
          >
            Sign in
          </Button>
        </div>
        <p className="text-sm mt-8 opacity-60">
          Free forever for individuals · No credit card required
        </p>
      </div>
    </section>
  );
}