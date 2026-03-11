import { Outlet, useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { AuthModal } from "../AuthModal";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Toaster } from "../ui/sonner";

/**
 * OnboardingLayout - Wraps onboarding pages with auth check.
 * If the user is not signed in, shows a prompt to sign up first.
 */
export function OnboardingLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold mb-3">Create an account first</h2>
          <p className="text-muted-foreground mb-6">
            Sign up to start your onboarding journey.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to home
            </Button>
            <Button onClick={() => setAuthOpen(true)}>
              Sign up
            </Button>
          </div>
        </div>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultMode="signup" />
        <Toaster />
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
