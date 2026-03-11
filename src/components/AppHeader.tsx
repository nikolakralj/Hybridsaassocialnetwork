import { Search, Plus, Moon, Sun, Bell } from "lucide-react";
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
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

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
    <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link to="/app" className="m-0 text-lg font-semibold tracking-tight text-foreground no-underline">
            WorkGraph
          </Link>

          <div className="relative w-80 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects, people, contracts..."
              className="pl-10 bg-background/60 border-border/60 rounded-lg h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <Link to="/app/notifications">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Bell className="w-4 h-4" />
            </Button>
          </Link>

          <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2 rounded-full h-9 px-4 text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-0 bg-transparent border-0 cursor-pointer">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user?.name || "User"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email || ""}</p>
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

      <nav className="flex items-center gap-1 px-6 pb-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors border-0 no-underline ${
                isActive
                  ? "bg-foreground/8 text-foreground font-medium"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
