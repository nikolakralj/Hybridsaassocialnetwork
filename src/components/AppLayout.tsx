import { Navigate, Outlet, useLocation } from "react-router";
import { AppHeader } from "./AppHeader";
import { Toaster } from "./ui/sonner";
import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const params = new URLSearchParams({
      auth: "signin",
      next,
    });

    return <Navigate to={`/?${params.toString()}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
