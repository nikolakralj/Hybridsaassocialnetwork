import { useState } from "react";
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
import { IntroPage } from "./IntroPage";

interface LandingProps {
  onSignIn?: () => void;
  onSignUp?: (email: string, intent?: PersonaType) => void;
  showIntro?: boolean;
}

export function Landing({ onSignIn, onSignUp, showIntro = false }: LandingProps) {
  const [introComplete, setIntroComplete] = useState(!showIntro);

  const handleGetStarted = (emailOrIntent?: string | PersonaType, intent?: PersonaType) => {
    // If first param is email (from HeroWarp)
    if (typeof emailOrIntent === "string" && emailOrIntent.includes("@")) {
      onSignUp?.(emailOrIntent, intent);
    } else {
      // Generic get started without email (from other CTAs)
      // This shouldn't happen in new flow, but fallback to scroll to hero
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleIntroComplete = () => {
    // Mark intro as seen in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('workgraph_intro_seen', 'true');
    }
    setIntroComplete(true);
  };

  // Show intro page first
  if (!introComplete) {
    return <IntroPage onEnter={handleIntroComplete} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <TopBar onSignIn={onSignIn} onGetStarted={() => handleGetStarted()} />
      
      {/* 1. Hero - Single email + CTA, trust signal */}
      <HeroWarp onGetStarted={handleGetStarted} />
      
      {/* 2. Logo strip - Trust validation */}
      <LogoStrip />
      
      {/* 3. Quantified results - Show the numbers */}
      <ResultsStrip />
      
      {/* 4. Testimonials - Founder quotes carousel */}
      <TestimonialsCarousel />
      
      {/* 5. Benefits - Clear value sections */}
      <BenefitSections />
      
      {/* 6. Comparison - Old way vs WorkGraph */}
      <ComparisonDiagram />
      
      {/* 7. Pricing - Simple and clear */}
      <section id="pricing">
        <PricingSnapshot onGetStarted={handleGetStarted} />
      </section>
      
      {/* 8. FAQ - Address objections */}
      <div className="py-16 px-6">
        <PricingFAQ />
      </div>
      
      {/* 9. Final CTA - Strong closing banner */}
      <FinalCTABanner onGetStarted={() => handleGetStarted()} />
      
      <Footer />
    </div>
  );
}