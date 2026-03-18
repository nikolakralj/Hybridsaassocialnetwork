import { createBrowserRouter } from "react-router";
import { Landing } from "./components/Landing";
import { PersonalProfileSetup } from "./components/onboarding/PersonalProfileSetup";
import { FreelancerOnboarding } from "./components/onboarding/FreelancerOnboarding";
import { CompanyOnboarding } from "./components/onboarding/CompanyOnboarding";
import { AgencyOnboardingNew } from "./components/onboarding/AgencyOnboardingNew";
import { FeedHome } from "./components/FeedHome";
import { CompanyProfilePage } from "./components/CompanyProfilePage";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { ProjectsListView } from "./components/projects/ProjectsListView";
import { ApprovalsWorkbench } from "./components/approvals/ApprovalsWorkbench";
import { DeepLinkHandler } from "./components/approvals/DeepLinkHandler";
import { ContractsPage } from "./components/contracts/ContractsPage";
import { ActivityFeedPage } from "./components/notifications/ActivityFeedPage";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { ProfilePage } from "./components/ProfilePage";
import { SettingsPage } from "./components/SettingsPage";
import { PublicProfilePage } from "./components/PublicProfilePage";
import { AppLayout } from "./components/AppLayout";
import { OnboardingLayout } from "./components/onboarding/OnboardingLayout";

// WorkGraph Routes - Phase 1 with real data APIs
export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/onboarding",
    Component: OnboardingLayout,
    children: [
      { path: "personal", Component: PersonalProfileSetup },
      { path: "freelancer", Component: FreelancerOnboarding },
      { path: "company", Component: CompanyOnboarding },
      { path: "agency", Component: AgencyOnboardingNew },
    ],
  },
  {
    path: "/app",
    Component: AppLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "feed", Component: FeedHome },
      { path: "projects", Component: ProjectsListView },
      { path: "project-workspace", Component: ProjectWorkspace },
      { path: "approvals", Component: ApprovalsWorkbench },
      { path: "contracts", Component: ContractsPage },
      { path: "company-profile", Component: CompanyProfilePage },
      { path: "notifications", Component: ActivityFeedPage },
      { path: "profile", Component: ProfilePage },
      { path: "profile/:userId", Component: PublicProfilePage },
      { path: "settings", Component: SettingsPage },
      { path: "approve", Component: DeepLinkHandler },
      { path: "reject", Component: DeepLinkHandler },
      { path: "approval-view", Component: ApprovalsWorkbench },
    ],
  },
]);