import { useState, useEffect } from "react"; // ✅ FIXED: Add React hooks
import { Landing } from "./Landing";
import { PersonalProfileSetup } from "./onboarding/PersonalProfileSetup";
import { FreelancerOnboarding } from "./onboarding/FreelancerOnboarding";
import { CompanyOnboarding } from "./onboarding/CompanyOnboarding";
import { AgencyOnboardingNew } from "./onboarding/AgencyOnboardingNew";
import { FeedHome } from "./FeedHome";
import { CompanyProfileDemo } from "./CompanyProfileDemo";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { ProjectsListView } from "./projects/ProjectsListView";
import { ApprovalsWorkbench } from "./approvals/ApprovalsWorkbench";
import { DeepLinkHandler } from "./approvals/DeepLinkHandler"; // ✅ DAY 7: Deep-link approvals
import { DatabaseSetupPage } from "./DatabaseSetupPage"; // ✅ UNIFIED: One setup page to rule them all
import { ContractsDemoPage } from "./contracts/ContractsDemoPage"; // ✅ LOCAL SCOPE: Contracts demo
import { NotificationDropdown } from "./notifications/NotificationDropdown"; // ✅ PHASE 6: Notifications
import { ActivityFeedPage } from "./notifications/ActivityFeedPage"; // ✅ PHASE 6: Activity feed
import { DashboardPage } from "./dashboard/DashboardPage"; // ✅ PHASE 7: Hybrid Dashboard
import { PersonaType } from "./social/IntentChips";
import { Toaster } from "./ui/sonner";
import { WorkGraphProvider } from "../contexts/WorkGraphContext";
import { QueryProvider } from "./QueryProvider";
import { TestModeBanner } from "./TestModeBanner"; // ✅ TEST MODE: Banner
import { PersonaSwitcher } from "./PersonaSwitcher"; // ✅ TEST MODE: Persona switcher
import { Menu, X } from "lucide-react"; // ✅ Icons for nav

type AppRoute = 
  | "landing" 
  | "personal-profile-setup"
  | "freelancer-onboarding" 
  | "company-onboarding" 
  | "agency-onboarding" 
  | "feed"
  | "company-profile-demo"
  | "project-workspace"
  | "projects" // ✅ Projects management route
  | "approvals" // ✅ DAY 3: Global approvals workbench
  | "approve" // ✅ DAY 7: Deep-link approve
  | "reject" // ✅ DAY 7: Deep-link reject
  | "approval-view" // ✅ DAY 7: Deep-link view
  | "contracts" // ✅ LOCAL SCOPE: Contracts visibility demo
  | "notifications" // ✅ PHASE 6: Activity feed
  | "dashboard" // ✅ PHASE 7: Hybrid dashboard
  | "setup"; // ✅ NEW: Database setup

interface UserData {
  email: string;
  fullName: string;
  headline: string;
  bio?: string;
  workspaceName?: string;
}

function AppContent() {
  const getInitialRoute = (): AppRoute => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search; // ✅ FIX: Declare search variable
      
      // ✅ Priority 1: Check hash-based routing #/route?params (works everywhere)
      if (hash.startsWith('#/')) {
        const hashPath = hash.substring(2); // Remove '#/'
        const [hashRoute, hashSearch] = hashPath.split('?');
        console.log('[ROUTER] ✅ DETECTED HASH ROUTE:', hashRoute);
        if (hashRoute) return hashRoute as AppRoute;
      }
      
      // ✅ Priority 2: Check query parameter ?route=xxx (works in most environments)
      const routeParam = params.get('route');
      if (routeParam) {
        console.log('[ROUTER] ✅ DETECTED ROUTE FROM QUERY PARAM:', routeParam);
        return routeParam as AppRoute;
      }
      
      console.log('[ROUTER] Initial URL:', { path, search, hash, full: window.location.href });
      
      // ✅ Priority 3: Check pathname (fallback for environments that support it)
      // Deep-link detection
      if (path === '/approve' || path.includes('/approve') || search.includes('approve')) {
        console.log('[ROUTER] ✅ DETECTED APPROVE ROUTE');
        return 'approve';
      }
      if (path === '/reject' || path.includes('/reject') || search.includes('reject')) {
        console.log('[ROUTER] ✅ DETECTED REJECT ROUTE');
        return 'reject';
      }
      if (path === '/approval-view' || path === '/approval' || search.includes('approval')) {
        console.log('[ROUTER] ✅ DETECTED APPROVAL VIEW ROUTE');
        return 'approval-view';
      }
      if (path === '/setup' || path.includes('/setup')) {
        console.log('[ROUTER] ✅ DETECTED SETUP ROUTE');
        return 'setup';
      }
    }
    console.log('[ROUTER] ⚠️ No route detected, defaulting to projects');
    return "projects";
  };

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute());
  const [userData, setUserData] = useState<UserData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasSeenIntro, setHasSeenIntro] = useState(() => {
    // Check localStorage to see if user has seen intro before
    if (typeof window !== 'undefined') {
      return localStorage.getItem('workgraph_intro_seen') === 'true';
    }
    return false;
  });

  // Listen for navigation events from child components
  useEffect(() => {
    const handleNavigate = (event: CustomEvent<AppRoute>) => {
      const route = event.detail;
      setCurrentRoute(route);
      // ✅ Update URL so refresh works
      window.history.pushState({}, '', `#/${route}`);
    };
    
    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);
  
  // Listen for URL changes (for deep-links and browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/')) {
        const hashPath = hash.substring(2); // Remove '#/'
        const [hashRoute] = hashPath.split('?');
        console.log('[ROUTER] Hash changed to:', hashRoute);
        if (hashRoute) {
          setCurrentRoute(hashRoute as AppRoute);
        }
      }
    };

    const handlePopState = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      
      console.log('[ROUTER] URL changed:', { path, search, hash });
      
      // First check hash
      if (hash.startsWith('#/')) {
        handleHashChange();
        return;
      }
      
      // Then check pathname/search
      if (path === '/approve' || path.includes('/approve') || search.includes('approve')) {
        setCurrentRoute('approve');
      } else if (path === '/reject' || path.includes('/reject') || search.includes('reject')) {
        setCurrentRoute('reject');
      } else if (path === '/approval-view' || path === '/approval') {
        setCurrentRoute('approval-view');
      } else if (path === '/setup' || path.includes('/setup')) {
        setCurrentRoute('setup');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Handle signup from landing page
  const handleSignUp = (email: string, intent?: PersonaType) => {
    // Store the user's email and intent
    setUserData({ email, fullName: "", headline: "", bio: "" });
    
    // Always go to personal profile setup first (Phase 1)
    setCurrentRoute("personal-profile-setup");
  };

  // Handle personal profile completion
  const handlePersonalProfileComplete = (profileData: any) => {
    // Update user data with profile info
    setUserData(prev => ({ ...prev!, ...profileData }));
    
    // Route based on original intent (Phase 2)
    if (profileData.intent === "company") {
      setCurrentRoute("company-onboarding");
    } else if (profileData.intent === "agency") {
      setCurrentRoute("agency-onboarding");
    } else if (profileData.intent === "freelancer") {
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
      headline: userData!.intent === "company" ? "Company Admin" : "Agency Admin"
    };
    setUserData(minimalProfile);
    
    // Route to workspace setup
    if (userData!.intent === "company") {
      setCurrentRoute("company-onboarding");
    } else if (userData!.intent === "agency") {
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
            showIntro={!hasSeenIntro}
          />
        );

      case "personal-profile-setup":
        return (
          <PersonalProfileSetup
            userEmail={userData?.email || ""}
            onComplete={handlePersonalProfileComplete}
            onSkip={handleSkipPersonalProfile}
            mode={userData?.intent === "company" || userData?.intent === "agency" ? "optional" : "required"}
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
            persona={userData?.intent} 
          />
        );

      case "company-profile-demo":
        return <CompanyProfileDemo />;

      case "project-workspace":
        return <ProjectWorkspace />;

      case "projects": // ✅ NEW: Projects management
        return <ProjectsListView />;

      case "approvals": // ✅ DAY 3: Global approvals workbench
        return <ApprovalsWorkbench />;

      case "approve": // ✅ DAY 7: Deep-link approve
        return <DeepLinkHandler />;

      case "reject": // ✅ DAY 7: Deep-link reject
        return <DeepLinkHandler />;

      case "approval-view": // ✅ DAY 7: Deep-link view
        return <ApprovalsWorkbench />;

      case "contracts": // ✅ LOCAL SCOPE: Contracts visibility demo
        return <ContractsDemoPage />;

      case "notifications": // ✅ PHASE 6: Activity feed
        return (
          <ActivityFeedPage 
            userId="user-123" 
            onNavigate={(url) => {
              // Parse route from URL (e.g., "#/approvals")
              const route = url.replace('#/', '');
              setCurrentRoute(route as AppRoute);
            }}
          />
        );

      case "dashboard": // ✅ PHASE 7: Hybrid dashboard
        return (
          <DashboardPage 
            userId="user-123"
            onNavigate={(route) => {
              setCurrentRoute(route.replace('#/', '') as AppRoute);
              window.history.pushState({}, '', route);
            }}
          />
        );

      case "setup": // ✅ NEW: Database setup
        return <DatabaseSetupPage />;

      default:
        return <Landing onSignIn={handleSignIn} onSignUp={handleSignUp} />;
    }
  };

  const navigationRoutes: { route: AppRoute; label: string }[] = [
    { route: "landing", label: "🏠 Landing" },
    { route: "dashboard", label: "📊 Dashboard" }, // ✅ PHASE 7: Hybrid dashboard
    { route: "feed", label: "📰 Feed" },
    { route: "projects", label: "📋 Projects" },
    { route: "approvals", label: "✅ My Approvals" }, // ✅ DAY 3: Global approvals
    { route: "contracts", label: "🤝 Contracts Demo" }, // ✅ LOCAL SCOPE: Contracts visibility
    { route: "project-workspace", label: "📁 Project Workspace" },
    { route: "company-profile-demo", label: "🏢 Company Profile" },
    { route: "setup", label: "🔧 Database Setup" }, // ✅ NEW: Database setup
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ✅ TEST MODE BANNER */}
      <TestModeBanner />
      
      {/* Developer Navigation Bar - ENHANCED */}
      <div className="fixed top-12 left-0 right-0 z-[99999] bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-2xl border-b border-slate-700">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              WORKGRAPH DEV
            </span>
            <span className="text-xs opacity-40">|</span>
            <span className="text-sm font-medium text-blue-300">{currentRoute}</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* ✅ NOTIFICATION BELL */}
            <NotificationDropdown 
              userId="user-123"
              onNavigate={(url) => {
                const route = url.replace('#/', '');
                setCurrentRoute(route as AppRoute);
                window.history.pushState({}, '', url);
              }}
              onViewAll={() => {
                setCurrentRoute('notifications');
                window.history.pushState({}, '', '#/notifications');
              }}
            />
            
            {/* ✅ PERSONA SWITCHER */}
            <PersonaSwitcher />
            
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #475569',
                backgroundColor: sidebarOpen ? '#2563eb' : '#334155',
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
                e.currentTarget.style.backgroundColor = sidebarOpen ? '#1d4ed8' : '#475569';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = sidebarOpen ? '#2563eb' : '#334155';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              <span>{sidebarOpen ? 'Close' : 'Navigate'}</span>
            </button>
          </div>
        </div>
        
        {sidebarOpen && (
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
                    // ✅ Update URL so refresh works
                    window.history.pushState({}, '', `#/${route}`);
                    setSidebarOpen(false);
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
            
            {/* Dev utilities */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  localStorage.removeItem('workgraph_intro_seen');
                  setHasSeenIntro(false);
                  setCurrentRoute('landing');
                  window.history.pushState({}, '', '#/landing');
                  setSidebarOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #475569',
                  backgroundColor: '#334155',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#475569';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#334155';
                }}
              >
                ✨ Reset Intro (Test)
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Add top padding to account for fixed nav + banner */}
      <div className="pt-[120px]">
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