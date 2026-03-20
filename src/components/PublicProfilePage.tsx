import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth, type UserProfile } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  User,
  MapPin,
  Globe,
  Briefcase,
  Mail,
  Calendar,
  Loader2,
  UserPlus,
  MessageSquare,
  ExternalLink,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { projectId, publicAnonKey } from "../utils/supabase/info";

export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  // If viewing own profile, redirect to editable profile
  useEffect(() => {
    if (currentUser && userId === currentUser.id) {
      navigate("/app/profile", { replace: true });
    }
  }, [currentUser, userId, navigate]);

  useEffect(() => {
    if (!userId) return;
    loadProfile(userId);
  }, [userId]);

  const loadProfile = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/api/profile/${id}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );
      if (!res.ok) throw new Error("Profile not found");
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile:", err);
      // Fall back to a mock for demo purposes
      setProfile({
        id: id,
        email: "",
        name: "WorkGraph User",
        headline: "Technical Freelancer",
        bio: "This user hasn't completed their profile yet.",
        location: "",
        website: "",
        persona_type: "freelancer",
        skills: [],
        created_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = () => {
    setFollowing(!following);
    toast.success(following ? "Unfollowed" : "Following!");
  };

  const handleMessage = () => {
    toast.info("Direct messaging coming soon");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const personaLabels: Record<string, string> = {
    freelancer: "Freelancer",
    company: "Company",
    agency: "Agency",
  };

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer p-0"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar className="w-20 h-20 text-2xl shrink-0">
              <AvatarFallback className="bg-accent-brand/10 text-accent-brand text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">{profile.name}</h2>
                  {profile.headline && (
                    <p className="text-muted-foreground">{profile.headline}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                    {profile.persona_type && (
                      <Badge variant="secondary" className="text-xs">
                        {personaLabels[profile.persona_type] ||
                          profile.persona_type}
                      </Badge>
                    )}
                    {profile.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {profile.location}
                      </span>
                    )}
                    {profile.created_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Joined{" "}
                        {formatDistanceToNow(new Date(profile.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isOwnProfile && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant={following ? "secondary" : "default"}
                      size="sm"
                      onClick={handleFollow}
                      className="gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {following ? "Following" : "Follow"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMessage}
                      className="gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4" /> About
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {profile.bio ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No bio added yet.
              </p>
            )}
            {profile.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {profile.website}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      {profile.skills && profile.skills.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Skills
            </h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Activity Summary (placeholder) */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Eye className="w-4 h-4" /> Activity
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Public activity feed coming soon. Follow this user to stay updated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
