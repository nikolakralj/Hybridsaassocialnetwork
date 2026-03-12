import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { AnnouncementBar, TopBar } from "./TopBar";
import { HeroWarp } from "./HeroWarp";
import { LogoStrip } from "./LogoStrip";
import { ResultsStrip } from "./social/ResultsStrip";
import { TestimonialsCarousel } from "./TestimonialsCarousel";
import { BenefitSections } from "./BenefitSections";
import { ComparisonDiagram } from "./ComparisonDiagram";
import { PricingSnapshot } from "./PricingSnapshot";
import { PricingFAQ } from "./PricingFAQ";
import { FinalCTABanner } from "./FinalCTABanner";
import { Footer } from "./Footer";
import { PersonaType } from "./social/IntentChips";
import { useAuth } from "../contexts/AuthContext";
import { AuthModal } from "./AuthModal";

export function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");

  // If already authenticated, redirect to app
  useEffect(() => {
    if (user) {
      navigate("/app");
    }
  }, [user, navigate]);

  const handleGetStarted = () => {
    setAuthMode("signup");
    setAuthOpen(true);
  };

  const handleSignIn = () => {
    setAuthMode("signin");
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <TopBar onSignIn={handleSignIn} onGetStarted={handleGetStarted} />

      {/* 1. Hero — value prop + product screenshot */}
      <HeroWarp onGetStarted={handleGetStarted} />

      {/* 2. Capabilities strip — what's built in */}
      <LogoStrip />

      {/* 3. Architecture stats — honest about what we've built */}
      <ResultsStrip />

      {/* 4. How it works — 4 steps */}
      <TestimonialsCarousel />

      {/* 5. Product features — real capabilities */}
      <BenefitSections />

      {/* 6. Comparison — old way vs WorkGraph */}
      <ComparisonDiagram />

      {/* 7. Pricing */}
      <section id="pricing">
        <PricingSnapshot onGetStarted={handleGetStarted} />
      </section>

      {/* 8. FAQ */}
      <div className="py-16 px-6">
        <PricingFAQ />
      </div>

      {/* 9. Final CTA */}
      <FinalCTABanner onGetStarted={handleGetStarted} />

      <Footer />

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
      />
    </div>
  );
}
