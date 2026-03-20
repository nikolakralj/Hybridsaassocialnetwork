import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Upload, Check, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Progress } from "../ui/progress";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

export function PersonalProfileSetup() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    headline: user?.headline || "",
    bio: user?.bio || "",
  });

  const canProceed = formData.fullName && formData.headline;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) return;

    setSaving(true);
    try {
      await updateProfile({
        name: formData.fullName,
        headline: formData.headline,
        bio: formData.bio,
      });
      toast.success("Profile saved!");
      navigate("/onboarding/freelancer");
    } catch (err: any) {
      console.error("Failed to save personal profile:", err);
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground m-0">Step 1 of 2</p>
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
            >
              I'll do this later
            </button>
          </div>
          <Progress value={50} className="h-1.5" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-accent-brand/10 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-accent-brand" />
            </div>
            <h2 className="mb-2">Create your personal profile</h2>
            <p className="text-muted-foreground m-0">
              This is your unique identity on WorkGraph. You can use it across all workspaces.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="mt-2 bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="fullName">Full name *</Label>
              <Input
                id="fullName"
                placeholder="Sarah Chen"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="headline">Professional headline *</Label>
              <Input
                id="headline"
                placeholder="Senior React Developer"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                className="mt-2"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                This appears under your name everywhere on WorkGraph
              </p>
            </div>

            <div>
              <Label htmlFor="bio">About you (optional)</Label>
              <Textarea
                id="bio"
                placeholder="Tell people what you do..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="bg-accent/30 border border-border rounded-xl p-4">
              <p className="text-sm m-0">
                Your personal profile is separate from any workspaces you create or join. 
                You'll always have this profile, even if you switch companies or agencies.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                className="flex-1"
                disabled={saving}
              >
                I'll do this later
              </Button>
              <Button
                type="submit"
                disabled={!canProceed || saving}
                className="flex-1 rounded-xl"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Next: Set up your workspace
        </p>
      </div>
    </div>
  );
}
