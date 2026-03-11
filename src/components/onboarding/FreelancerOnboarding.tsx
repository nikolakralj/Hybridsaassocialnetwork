import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Check, Upload, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner@2.0.3";

interface FreelancerOnboardingProps {
  onComplete?: () => void;
}

type OnboardingStep = "welcome" | "profile" | "skills" | "preferences" | "complete";

export function FreelancerOnboarding({ onComplete }: FreelancerOnboardingProps) {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: user?.name || "",
    headline: user?.headline || "",
    bio: user?.bio || "",
    skills: user?.skills || ([] as string[]),
    hourlyRate: "",
    availability: "",
    isPublic: true,
  });

  const steps = ["welcome", "profile", "skills", "preferences", "complete"];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    const stepOrder: OnboardingStep[] = ["welcome", "profile", "skills", "preferences", "complete"];
    const nextIndex = stepOrder.indexOf(currentStep) + 1;
    if (nextIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextIndex]);
    }
  };

  const handleSkip = () => {
    onComplete?.();
    navigate('/app');
  };

  // Save profile data when moving from profile step
  const handleProfileNext = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: formData.displayName || user?.name,
        headline: formData.headline,
        bio: formData.bio,
        persona_type: 'freelancer',
      });
      handleNext();
    } catch (err: any) {
      console.error("Failed to save profile data:", err);
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Save skills when moving from skills step
  const handleSkillsNext = async () => {
    setSaving(true);
    try {
      await updateProfile({ skills: formData.skills });
      handleNext();
    } catch (err: any) {
      console.error("Failed to save skills:", err);
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Save preferences and complete
  const handlePreferencesComplete = async () => {
    setSaving(true);
    try {
      // Save any remaining profile data as metadata
      const meta: Record<string, any> = {};
      if (formData.hourlyRate) meta.hourly_rate = formData.hourlyRate;
      if (formData.availability) meta.availability = formData.availability;
      meta.is_public = formData.isPublic;
      await updateProfile(meta);
      handleNext(); // Go to complete step
    } catch (err: any) {
      console.error("Failed to save preferences:", err);
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = () => {
    onComplete?.();
    navigate('/app/feed');
  };

  const handleViewProfile = () => {
    onComplete?.();
    navigate('/app/profile');
  };

  if (currentStep === "welcome") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-accent-brand/10 flex items-center justify-center mx-auto mb-8">
            <Sparkles className="w-10 h-10 text-accent-brand" />
          </div>

          <h1 className="text-5xl md:text-6xl mb-6 font-semibold tracking-tight">
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
            Let's create your professional profile. This should take about 3 minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" onClick={handleNext} className="rounded-xl text-lg h-14 px-8">
              Get started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="ghost" onClick={handleSkip} className="text-lg h-14 px-8">
              I'll do this later
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <Card className="p-6">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Check className="w-5 h-5 text-success" />
              </div>
              <h3 className="mb-2">Your profile</h3>
              <p className="text-sm text-muted-foreground m-0">
                Showcase your skills and experience to potential clients
              </p>
            </Card>

            <Card className="p-6">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Check className="w-5 h-5 text-success" />
              </div>
              <h3 className="mb-2">Apply for jobs</h3>
              <p className="text-sm text-muted-foreground m-0">
                Browse and apply to contract opportunities instantly
              </p>
            </Card>

            <Card className="p-6">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Check className="w-5 h-5 text-success" />
              </div>
              <h3 className="mb-2">Get paid</h3>
              <p className="text-sm text-muted-foreground m-0">
                Auto-generate invoices from approved timesheets
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "profile") {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground m-0">Step 1 of 3</p>
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                Skip for now
              </button>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <h2 className="text-3xl md:text-4xl mb-4 font-semibold">Create your profile</h2>
          <p className="text-muted-foreground mb-8">
            This is how companies and agencies will find you.
          </p>

          <div className="space-y-6">
            <div>
              <Label htmlFor="photo">Profile photo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <Button variant="outline">Upload photo</Button>
              </div>
            </div>

            <div>
              <Label htmlFor="displayName">Full name *</Label>
              <Input
                id="displayName"
                placeholder="Jane Doe"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="headline">Professional headline *</Label>
              <Input
                id="headline"
                placeholder="Senior Full-Stack Developer"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This appears under your name everywhere on WorkGraph
              </p>
            </div>

            <div>
              <Label htmlFor="bio">About you</Label>
              <Textarea
                id="bio"
                placeholder="Tell companies what you're great at and what you're looking for..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="mt-2"
                rows={4}
              />
            </div>

            <Card className="p-4 bg-accent/50 border-accent">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h4 className="mb-1">Public profile by default</h4>
                  <p className="text-sm text-muted-foreground m-0">
                    Your profile will be visible to companies and agencies. You can change this anytime in settings.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleProfileNext} size="lg" className="flex-1 rounded-xl" disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "skills") {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground m-0">Step 2 of 3</p>
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                Skip for now
              </button>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <h2 className="text-3xl md:text-4xl mb-4 font-semibold">What are your skills?</h2>
          <p className="text-muted-foreground mb-8">
            Add skills to help companies find you for relevant opportunities.
          </p>

          <div className="space-y-6">
            <div>
              <Label>Suggested for you</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {["React", "TypeScript", "Node.js", "Python", "AWS", "Docker", "PostgreSQL", "GraphQL"].map((skill) => (
                  <button
                    key={skill}
                    onClick={() => {
                      if (!formData.skills.includes(skill)) {
                        setFormData({ ...formData, skills: [...formData.skills, skill] });
                      }
                    }}
                    className="px-4 py-2 rounded-full bg-accent hover:bg-accent-brand/10 hover:text-accent-brand transition-colors text-sm border-0 cursor-pointer"
                  >
                    + {skill}
                  </button>
                ))}
              </div>
            </div>

            {formData.skills.length > 0 && (
              <div>
                <Label>Your skills ({formData.skills.length})</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="px-3 py-1.5">
                      {skill}
                      <button
                        onClick={() => setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) })}
                        className="ml-2 hover:text-destructive bg-transparent border-0 cursor-pointer p-0"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="customSkill">Add a skill</Label>
              <Input
                id="customSkill"
                placeholder="Type and press Enter"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value) {
                    e.preventDefault();
                    const skill = e.currentTarget.value.trim();
                    if (skill && !formData.skills.includes(skill)) {
                      setFormData({ ...formData, skills: [...formData.skills, skill] });
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSkillsNext} size="lg" className="flex-1 rounded-xl" disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "preferences") {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground m-0">Step 3 of 3</p>
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                Skip for now
              </button>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <h2 className="text-3xl md:text-4xl mb-4 font-semibold">Work preferences</h2>
          <p className="text-muted-foreground mb-8">
            Help companies understand what you're looking for.
          </p>

          <div className="space-y-6">
            <div>
              <Label htmlFor="hourlyRate">Hourly rate (optional)</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="hourlyRate"
                  type="number"
                  placeholder="150"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You can hide this or change it anytime
              </p>
            </div>

            <div>
              <Label htmlFor="availability">Availability</Label>
              <select
                id="availability"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                className="mt-2 w-full h-10 px-3 rounded-lg border border-border bg-input-background text-foreground"
              >
                <option value="">Select availability</option>
                <option value="full-time">Available full-time (40h/week)</option>
                <option value="part-time">Available part-time (20h/week)</option>
                <option value="project">Open to project-based work</option>
                <option value="not-available">Not currently available</option>
              </select>
            </div>

            <div>
              <Label>I'm interested in</Label>
              <div className="space-y-2 mt-2">
                {["Remote work", "Hybrid roles", "On-site opportunities", "Short-term contracts (< 3 months)", "Long-term contracts (6+ months)"].map((pref) => (
                  <label key={pref} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded border-border" />
                    <span className="text-sm">{pref}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handlePreferencesComplete} size="lg" className="flex-1 rounded-xl" disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <>Complete profile <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Complete step
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full text-center">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-8">
          <Check className="w-10 h-10 text-success" />
        </div>

        <h1 className="text-5xl md:text-6xl mb-6 font-semibold tracking-tight">
          You're all set!
        </h1>

        <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
          Your profile is live. Start exploring opportunities or customize your profile further.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={handleComplete} className="rounded-xl text-lg h-14 px-8">
            Go to feed
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button size="lg" variant="outline" onClick={handleViewProfile} className="text-lg h-14 px-8">
            View my profile
          </Button>
        </div>
      </div>
    </div>
  );
}
