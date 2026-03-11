import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader";
import { Toaster } from "./ui/sonner";
import { useAuth } from "../contexts/AuthContext";
import { AuthModal } from "./AuthModal";
import { useState } from "react";
import { Button } from "./ui/button";
import { Loader2, LogIn } from "lucide-react";

export function AppLayout() {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not authenticated, show a gentle prompt (not a hard block, so users can still explore)
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center justify-between px-6 py-3">
            <a href="/" className="text-lg font-semibold tracking-tight text-foreground no-underline">
              WorkGraph
            </a>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}
              >
                Sign in
              </Button>
              <Button
                size="sm"
                onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}
              >
                Get started
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto mb-6">
              <LogIn className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sign in to continue</h2>
            <p className="text-muted-foreground mb-6">
              Create an account or sign in to access your dashboard, projects, and workspace.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}
              >
                Sign in
              </Button>
              <Button onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}>
                Create account
              </Button>
            </div>
          </div>
        </main>

        <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
