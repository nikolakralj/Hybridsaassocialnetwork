import { Search, Plus, Bell, Clock, FileText, Briefcase, Users, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner@2.0.3";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useState } from "react";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const navItems = [
    { label: "Dashboard", path: "/app" },
    { label: "Projects", path: "/app/projects" },
    { label: "Approvals", path: "/app/approvals" },
    { label: "Contracts", path: "/app/contracts" },
    { label: "Feed", path: "/app/feed" },
  ];

  return (
    <header className="border-b border-border/60 bg-card sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          <Link to="/app" className="text-base font-semibold tracking-tight text-foreground no-underline flex-shrink-0">
            WorkGraph
          </Link>

          {/* Desktop nav - inline with logo */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors no-underline ${
                    isActive
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Center: Search */}
        <div className="hidden lg:block flex-1 max-w-md mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search projects, people, contracts..."
              className="pl-9 bg-background border-border/60 rounded-lg h-8 text-sm"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Mobile nav trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg md:hidden">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="pt-14 px-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">Navigation</p>
                <nav className="space-y-0.5">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.label}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-3 py-2 rounded-md text-sm transition-colors no-underline ${
                          isActive
                            ? "bg-accent text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/app/notifications">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
              <Bell className="w-4 h-4" />
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 rounded-lg h-8 px-3 text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/app/projects')} className="cursor-pointer">
                <Briefcase className="w-4 h-4 mr-2" />
                New Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/approvals')} className="cursor-pointer">
                <Clock className="w-4 h-4 mr-2" />
                Submit Timesheet
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/contracts')} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2" />
                New Contract
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/feed')} className="cursor-pointer">
                <Users className="w-4 h-4 mr-2" />
                Write a Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full ml-1 p-0">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-[11px] font-medium bg-accent-brand/10 text-accent-brand">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium text-sm">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/profile" className="cursor-pointer no-underline">My Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/settings" className="cursor-pointer no-underline">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/company-profile" className="cursor-pointer no-underline">Company Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}