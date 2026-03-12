import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { useScrollSpy } from "./hooks/useScrollSpy";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

interface TopBarProps {
  mode?: "guest" | "authenticated";
  onSignIn?: () => void;
  onGetStarted?: () => void;
}

const HEADER_HEIGHT = 72;
const STICKY_THRESHOLD = 80;

export function TopBar({ mode = "guest", onSignIn, onGetStarted }: TopBarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Scroll-spy to track active section
  const activeSection = useScrollSpy({ 
    sectionIds: ["product", "pricing"], 
    offset: HEADER_HEIGHT + 100 
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > STICKY_THRESHOLD);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const elementTop = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementTop - HEADER_HEIGHT;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: "product", label: "Product" },
    { id: "pricing", label: "Pricing" },
  ];

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled 
          ? "bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm" 
          : "bg-transparent"
      }`}
      style={{ height: `${HEADER_HEIGHT}px` }}
    >
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <a href="/" className="flex items-center group">
            <span className="text-xl font-semibold text-foreground hover:text-accent-brand transition-colors">
              WorkGraph
            </span>
          </a>
        </div>

        {/* Desktop Nav - Center/Left group */}
        {mode === "guest" && (
          <nav className="hidden md:flex items-center gap-8 ml-12">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className="relative text-sm font-medium transition-colors hover:text-foreground group"
                  style={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
                >
                  {item.label}
                  {/* Active indicator - subtle dot */}
                  {isActive && (
                    <span 
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-brand"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-4">
          {mode === "guest" && (
            <>
              <Button 
                variant="ghost" 
                onClick={onSignIn} 
                className="text-sm font-medium"
              >
                Sign in
              </Button>
              <Button 
                onClick={onGetStarted} 
                className="rounded-xl font-medium"
              >
                Get started free
              </Button>
            </>
          )}
        </div>

        {/* Mobile: Logo + Get Started + Hamburger */}
        <div className="md:hidden flex items-center gap-3">
          <Button 
            onClick={onGetStarted} 
            size="sm"
            className="rounded-xl font-medium"
          >
            Get started
          </Button>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              <nav className="flex flex-col pt-16">
                {/* Nav items */}
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="px-6 py-4 text-left text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
                
                {/* Divider */}
                <div className="h-px bg-border my-2" />
                
                {/* Sign in */}
                <button
                  onClick={() => {
                    onSignIn?.();
                    setMobileMenuOpen(false);
                  }}
                  className="px-6 py-4 text-left text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Sign in
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-accent-brand text-white py-1.5 px-4 relative">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-sm m-0 font-medium">
          We're in open beta — Join free →
        </p>
      </div>
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
        onClick={() => setIsVisible(false)}
        aria-label="Close announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}