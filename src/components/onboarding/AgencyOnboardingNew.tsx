import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ArrowLeft, Users, UserCheck, Briefcase, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner@2.0.3";
import { useAuth } from "../../contexts/AuthContext";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

interface AgencyOnboardingNewProps {
  userEmail: string;
  userName: string;
  onComplete: (agencyName?: string) => void;
  onSkip?: () => void;
}

type Step = 1 | 2;

export function AgencyOnboardingNew({ 
  userEmail = "demo@example.com", 
  userName = "Demo User", 
  onComplete, 
  onSkip 
}: Partial<AgencyOnboardingNewProps> = {}) {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    agencyName: "",
    website: "",
    regions: "",
    workMode: null as "recruiting" | "staffing" | "both" | null,
  });

  const displayName = user?.name || userName;

  const handleCreateAgency = async () => {
    if (!formData.agencyName) return;
    setSaving(true);
    try {
      await updateProfile({ persona_type: 'agency' });

      const agencyId = `agency-${user?.id || 'anon'}-${Date.now()}`;
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/kv`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          key: `agency:${agencyId}`,
          value: JSON.stringify({
            id: agencyId,
            owner_id: user?.id,
            name: formData.agencyName,
            website: formData.website,
            regions: formData.regions,
            created_at: new Date().toISOString(),
          }),
        }),
      });

      toast.success(`${formData.agencyName} created!`);
      setCurrentStep(2);
    } catch (err: any) {
      console.error("Failed to create agency:", err);
      toast.error(err.message || "Failed to create agency");
    } finally {
      setSaving(false);
    }
  };

  const handleWorkModeSelect = async (mode: "recruiting" | "staffing" | "both") => {
    setFormData({ ...formData, workMode: mode });
    toast.success(`Work mode set to ${mode === "recruiting" ? "Recruiting" : mode === "staffing" ? "Staff Augmentation" : "Both"}`);
    
    setTimeout(() => {
      onComplete?.(formData.agencyName);
      navigate('/app');
    }, 500);
  };

  const workModes = [
    {
      id: "recruiting" as const,
      icon: UserCheck,
      title: "Recruiting",
      description: "Permanent placements with finder's fees",
      gradient: "from-blue-500/10 to-blue-600/10",
      hoverGradient: "hover:from-blue-500/20 hover:to-blue-600/20",
      border: "border-blue-500/20",
      iconColor: "text-blue-500",
    },
    {
      id: "staffing" as const,
      icon: Users,
      title: "Staff Augmentation",
      description: "Contract placements (T&M, Outstaff)",
      gradient: "from-purple-500/10 to-purple-600/10",
      hoverGradient: "hover:from-purple-500/20 hover:to-purple-600/20",
      border: "border-purple-500/20",
      iconColor: "text-purple-500",
    },
    {
      id: "both" as const,
      icon: Briefcase,
      title: "Both",
      description: "Full-service agency doing both models",
      gradient: "from-green-500/10 to-green-600/10",
      hoverGradient: "hover:from-green-500/20 hover:to-green-600/20",
      border: "border-green-500/20",
      iconColor: "text-green-500",
    },
  ];

  const regionSuggestions = [
    "United States",
    "United Kingdom",
    "Europe",
    "Asia Pacific",
    "North America",
    "Global",
  ];

  const canCreateAgency = formData.agencyName;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Step Content */}
        <div className="bg-card rounded-xl border border-border p-8">
          {/* Step 1: Agency Basics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-accent-brand/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-accent-brand" />
                </div>
                <h2 className="mb-2">Create your agency workspace</h2>
                <p className="text-muted-foreground">
                  Set up a workspace for placements and deal rooms
                </p>
                <div className="mt-4 bg-accent/30 border border-border rounded-xl p-3">
                  <p className="text-sm m-0">
                    ✓ Personal profile created for {displayName}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="agencyName">Agency name *</Label>
                  <Input
                    id="agencyName"
                    placeholder="Elite Recruiters"
                    value={formData.agencyName}
                    onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website (optional)</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://eliterecruiters.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="regions">Regions served</Label>
                  <Input
                    id="regions"
                    placeholder="United States, Europe"
                    value={formData.regions}
                    onChange={(e) => setFormData({ ...formData, regions: e.target.value })}
                    className="mt-1.5"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {regionSuggestions.slice(0, 4).map((region) => (
                      <button
                        key={region}
                        onClick={() => {
                          const current = formData.regions;
                          const newRegions = current
                            ? current.includes(region)
                              ? current
                              : `${current}, ${region}`
                            : region;
                          setFormData({ ...formData, regions: newRegions });
                        }}
                        className="text-sm px-3 py-1 rounded-full border border-border bg-background hover:bg-accent transition-colors"
                      >
                        {region}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Privacy by default:</strong> All agency
                    data (candidates, clients, deals) is private to your team only.
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3 pt-6 border-t border-border">
                {onSkip && (
                  <Button
                    variant="ghost"
                    onClick={onSkip}
                    className="flex-1"
                    disabled={saving}
                  >
                    I'll do this later
                  </Button>
                )}
                <Button
                  onClick={handleCreateAgency}
                  disabled={!canCreateAgency || saving}
                  className="flex-1"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                  ) : (
                    <>Create agency <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: How You Work */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2">How you work</h2>
                <p className="text-muted-foreground">
                  This helps us configure the right workflows
                </p>
              </div>

              {/* Work Mode Cards - 3 equal cards */}
              <div className="space-y-3">
                {workModes.map((mode) => {
                  const Icon = mode.icon;

                  return (
                    <button
                      key={mode.id}
                      onClick={() => handleWorkModeSelect(mode.id)}
                      className={`
                        w-full group p-5 rounded-xl border-2 text-left
                        transition-all duration-200
                        bg-gradient-to-br ${mode.gradient}
                        ${mode.border} ${mode.hoverGradient}
                        hover:shadow-md hover:scale-[1.01]
                      `}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-lg bg-white/80 flex items-center justify-center flex-shrink-0">
                          <Icon className={`w-6 h-6 ${mode.iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="mb-1">{mode.title}</h3>
                          <p className="text-muted-foreground">
                            {mode.description}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              <div className="p-4 rounded-lg border border-border bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Don't worry:</strong> You can always change
                  this later or handle both types of deals.
                </p>
              </div>

              {/* Back button only */}
              <div className="flex items-center justify-between pt-6 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}