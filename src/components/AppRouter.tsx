import { useState, useEffect } from "react"; // ✅ FIXED: Add React hooks
import { Landing } from "./Landing";
import { PersonalProfileSetup } from "./onboarding/PersonalProfileSetup";
import { FreelancerOnboarding } from "./onboarding/FreelancerOnboarding";
import { CompanyOnboarding } from "./onboarding/CompanyOnboarding";
import { AgencyOnboardingNew } from "./onboarding/AgencyOnboardingNew";
import { FeedHome } from "./FeedHome";
import { CompanyProfileDemo } from "./CompanyProfileDemo";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { DatabaseSyncTest } from "./timesheets/DatabaseSyncTest"; // ✅ Database test (development only)
import { ProjectsListView } from "./projects/ProjectsListView";
import { WorkGraphBuilder } from "./workgraph/WorkGraphBuilder";
import { ApprovalsWorkbench } from "./approvals/ApprovalsWorkbench"; // ✅ DAY 3: Global approvals
import { TestDashboard } from "./TestDashboard"; // ✅ NEW: Comprehensive testing dashboard
import { CheckboxTest } from "./CheckboxTest";
import { DatabaseSetup } from "./DatabaseSetup"; // ✅ NEW: Database setup page
import { PersonaType } from "./social/IntentChips";
import { Toaster } from "./ui/sonner";
import { WorkGraphProvider } from "../contexts/WorkGraphContext";
import { QueryProvider } from "./QueryProvider";
import { Menu, X } from "lucide-react";

type AppRoute = 
  | "landing" 
  | "personal-profile-setup"
  | "freelancer-onboarding" 
  | "company-onboarding" 
  | "agency-onboarding" 
  | "feed"
  | "company-profile-demo"
  | "project-workspace"
  | "db-sync-test"
  | "projects" // ✅ Projects management route
  | "approvals" // ✅ DAY 3: Global approvals workbench
  | "test-dashboard" // ✅ NEW: Comprehensive testing dashboard
  | "checkbox-test" // ✅ Checkbox debugging
  | "setup"; // ✅ NEW: Database setup

interface UserData {
  email: string;
  fullName: string;
  headline: string;
  bio?: string;
  workspaceName?: string;
}

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>("projects");
  const [userIntent, setUserIntent] = useState<PersonaType | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showNav, setShowNav] = useState(false);

  // Listen for navigation events from child components
  useEffect(() => {
    const handleNavigate = (event: CustomEvent<AppRoute>) => {
      setCurrentRoute(event.detail);
    };
    
    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

  // Handle signup from landing page
  const handleSignUp = (email: string, intent?: PersonaType) => {
    // Store the user's email and intent
    setUserData({ email, fullName: "", headline: "", bio: "" });
    setUserIntent(intent || null);
    
    // Always go to personal profile setup first (Phase 1)
    setCurrentRoute("personal-profile-setup");
  };

  // Handle personal profile completion
  const handlePersonalProfileComplete = (profileData: any) => {
    // Update user data with profile info
    setUserData(prev => ({ ...prev!, ...profileData }));
    
    // Route based on original intent (Phase 2)
    if (userIntent === "company") {
      setCurrentRoute("company-onboarding");
    } else if (userIntent === "agency") {
      setCurrentRoute("agency-onboarding");
    } else if (userIntent === "freelancer") {
      // Freelancers go to extended freelancer onboarding
      setCurrentRoute("freelancer-onboarding");
    } else {
      // No intent selected - default to feed (minimal freelancer)
      setCurrentRoute("feed");
    }
  };

  // Handle skipping personal profile (company/agency admins might do this)
  const handleSkipPersonalProfile = () => {
    // Still create minimal user data
    const minimalProfile = {
      ...userData!,
      fullName: userData!.email.split("@")[0], // Extract from email
      headline: userIntent === "company" ? "Company Admin" : "Agency Admin"
    };
    setUserData(minimalProfile);
    
    // Route to workspace setup
    if (userIntent === "company") {
      setCurrentRoute("company-onboarding");
    } else if (userIntent === "agency") {
      setCurrentRoute("agency-onboarding");
    } else {
      setCurrentRoute("feed");
    }
  };

  // Handle workspace onboarding completion
  const handleWorkspaceComplete = (workspaceName?: string) => {
    console.log("✅ Workspace complete! Going to feed. Workspace:", workspaceName);
    // Store workspace name if provided
    if (workspaceName) {
      setUserData(prev => ({ ...prev!, workspaceName }));
    }
    // Go directly to feed
    setCurrentRoute("feed");
  };

  // Handle skipping workspace setup
  const handleSkipWorkspace = () => {
    setCurrentRoute("feed");
  };

  const handleSignIn = () => {
    // For demo, just go to feed
    setCurrentRoute("feed");
  };

  const renderRoute = () => {
    switch (currentRoute) {
      case "landing":
        return (
          <Landing 
            onSignIn={handleSignIn} 
            onSignUp={handleSignUp} 
          />
        );

      case "personal-profile-setup":
        return (
          <PersonalProfileSetup
            userEmail={userData?.email || ""}
            onComplete={handlePersonalProfileComplete}
            onSkip={handleSkipPersonalProfile}
            mode={userIntent === "company" || userIntent === "agency" ? "optional" : "required"}
          />
        );

      case "freelancer-onboarding":
        return (
          <FreelancerOnboarding
            onComplete={handleWorkspaceComplete}
          />
        );

      case "company-onboarding":
        return (
          <CompanyOnboarding
            userEmail={userData?.email || ""}
            userName={userData?.fullName || ""}
            onComplete={handleWorkspaceComplete}
            onSkip={handleSkipWorkspace}
          />
        );

      case "agency-onboarding":
        return (
          <AgencyOnboardingNew
            userEmail={userData?.email || ""}
            userName={userData?.fullName || ""}
            onComplete={handleWorkspaceComplete}
            onSkip={handleSkipWorkspace}
          />
        );

      case "feed":
        return (
          <FeedHome 
            isNewUser={true} 
            userName={userData?.fullName || "User"} 
            persona={userIntent} 
          />
        );

      case "company-profile-demo":
        return <CompanyProfileDemo />;

      case "project-workspace":
        return <ProjectWorkspace />;

      case "db-sync-test": // ✅ NEW: Database sync test route
        return <DatabaseSyncTest />;

      case "projects": // ✅ NEW: Projects management
        return <ProjectsListView />;

      case "approvals": // ✅ DAY 3: Global approvals workbench
        return <ApprovalsWorkbench />;

      case "test-dashboard": // ✅ Comprehensive testing dashboard
        return <TestDashboard />;

      case "checkbox-test": // ✅ Checkbox debugging
        return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
            <CheckboxTest />
          </div>
        );

      case "setup": // ✅ NEW: Database setup
        return <DatabaseSetup />;

      default:
        return <Landing onSignIn={handleSignIn} onSignUp={handleSignUp} />;
    }
  };

  const navigationRoutes: { route: AppRoute; label: string }[] = [
    { route: "test-dashboard", label: "🧪 TEST DASHBOARD" }, // ✅ NEW: Featured at top
    { route: "landing", label: "🏠 Landing" },
    { route: "feed", label: "📰 Feed" },
    { route: "projects", label: "📋 Projects" },
    { route: "approvals", label: "✅ My Approvals" }, // ✅ DAY 3: Global approvals
    { route: "project-workspace", label: "📁 Project Workspace" },
    { route: "company-profile-demo", label: "🏢 Company Profile" },
    { route: "db-sync-test", label: "🔄 Database Sync Test" },
    { route: "checkbox-test", label: "✅ Checkbox Test" },
    { route: "setup", label: "🔧 Database Setup" }, // ✅ NEW: Database setup
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Developer Navigation Bar - ENHANCED */}
      <div className="fixed top-0 left-0 right-0 z-[99999] bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-2xl border-b border-slate-700">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              WORKGRAPH DEV
            </span>
            <span className="text-xs opacity-40">|</span>
            <span className="text-sm font-medium text-blue-300">{currentRoute}</span>
          </div>
          
          <button
            onClick={() => setShowNav(!showNav)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #475569',
              backgroundColor: showNav ? '#2563eb' : '#334155',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = showNav ? '#1d4ed8' : '#475569';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = showNav ? '#2563eb' : '#334155';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {showNav ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>{showNav ? 'Close' : 'Navigate'}</span>
          </button>
        </div>
        
        {showNav && (
          <div className="border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm p-4">
            <div className="flex flex-wrap gap-3">
              {navigationRoutes.map(({ route, label }) => (
                <button
                  key={route}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Navigating to:', route);
                    setCurrentRoute(route);
                    setShowNav(false);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: currentRoute === route ? '2px solid #3b82f6' : '1px solid #475569',
                    backgroundColor: currentRoute === route ? '#2563eb' : '#334155',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: currentRoute === route ? '600' : '500',
                    transition: 'all 0.2s',
                    boxShadow: currentRoute === route ? '0 4px 12px rgba(37, 99, 235, 0.4)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = currentRoute === route ? '#1d4ed8' : '#475569';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = currentRoute === route ? '#2563eb' : '#334155';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = currentRoute === route ? '0 4px 12px rgba(37, 99, 235, 0.4)' : 'none';
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Add top padding to account for fixed nav */}
      <div className="pt-10">
        {renderRoute()}
      </div>
      <Toaster />
    </div>
  );
}

export function AppRouter() {
  return (
    <WorkGraphProvider>
      <QueryProvider>
        <AppContent />
      </QueryProvider>
    </WorkGraphProvider>
  );
}