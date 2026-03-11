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
import { IntroPage } from "./IntroPage";
import { useAuth } from "../contexts/AuthContext";
import { AuthModal } from "./AuthModal";

export function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [introComplete, setIntroComplete] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  // If already authenticated, redirect to app
  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenIntro = localStorage.getItem('workgraph_intro_seen') === 'true';
      setIntroComplete(hasSeenIntro);
    }
  }, []);

  const handleGetStarted = (emailOrIntent?: string | PersonaType, intent?: PersonaType) => {
    setAuthMode('signup');
    setAuthOpen(true);
  };

  const handleSignIn = () => {
    setAuthMode('signin');
    setAuthOpen(true);
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
      <TopBar onSignIn={handleSignIn} onGetStarted={() => handleGetStarted()} />
      
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

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </div>
  );
}