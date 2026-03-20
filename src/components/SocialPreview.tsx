import { Heart, MessageCircle, Repeat2, Bookmark, UserPlus } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { toast } from "sonner";

interface SocialPreviewProps {
  onSignUpPrompt?: () => void;
}

export function SocialPreview({ onSignUpPrompt }: SocialPreviewProps) {
  const trendingPosts = [
    {
      id: 1,
      author: "Sarah Chen",
      role: "Senior Full-Stack Developer",
      avatar: "SC",
      content: "Just wrapped up a major refactor that cut our load time by 60%. Sometimes the best feature is the one users don't see. 🚀",
      likes: 127,
      comments: 23,
      tags: ["#performance", "#webdev"]
    },
    {
      id: 2,
      author: "James Wilson",
      role: "Tech Recruiter",
      avatar: "JW",
      content: "Placed 3 amazing engineers this week! The market is hot for developers with strong TypeScript + React skills.",
      likes: 84,
      comments: 15,
      tags: ["#hiring", "#techrecruiting"]
    },
    {
      id: 3,
      author: "Alex Martinez",
      role: "Engineering Manager",
      avatar: "AM",
      content: "Our team just shipped v2.0! Huge shoutout to everyone who contributed. This was a true team effort. 🎉",
      likes: 203,
      comments: 41,
      tags: ["#teamwork", "#launch"]
    },
    {
      id: 4,
      author: "Lisa Park",
      role: "Product Designer",
      avatar: "LP",
      content: "New case study: How we redesigned our onboarding flow and increased activation by 45%. Link in comments! ✨",
      likes: 156,
      comments: 32,
      tags: ["#uxdesign", "#casestudy"]
    },
    {
      id: 5,
      author: "David Kim",
      role: "Freelance Developer",
      avatar: "DK",
      content: "Three months into freelancing and I've never been happier. Here's what I learned about finding good clients...",
      likes: 91,
      comments: 28,
      tags: ["#freelance", "#career"]
    }
  ];

  const featuredProfiles = [
    {
      name: "Emma Rodriguez",
      role: "DevOps Engineer",
      avatar: "ER",
      skills: ["AWS", "Kubernetes", "Terraform"],
      followers: "1.2k"
    },
    {
      name: "Michael Chen",
      role: "Tech Lead",
      avatar: "MC",
      skills: ["React", "Node.js", "Architecture"],
      followers: "2.8k"
    },
    {
      name: "Sophie Anderson",
      role: "UX Researcher",
      avatar: "SA",
      skills: ["User Research", "Design Systems"],
      followers: "890"
    }
  ];

  const handleInteraction = () => {
    if (onSignUpPrompt) {
      onSignUpPrompt();
    } else {
      toast.info("Sign up to interact with posts", {
        description: "Join the network to like, comment, and connect"
      });
    }
  };

  return (
    <section className="py-20 md:py-24 bg-accent/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <h2 className="m-0 mb-4">See what's happening</h2>
          <p className="text-lg text-muted-foreground m-0 mb-6">
            Connect with professionals, discover opportunities, and stay updated
          </p>
          
          {/* Tag rail for discovery */}
          <div className="flex flex-wrap justify-center gap-2">
            {["#hiring", "#launch", "#freelance", "#design", "#engineering", "#remote"].map((tag) => (
              <button
                key={tag}
                onClick={handleInteraction}
                className="px-3 py-1 rounded-full bg-accent hover:bg-accent-brand/10 text-sm text-muted-foreground hover:text-accent-brand transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Trending Posts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="m-0">Trending today</h3>
              <Button variant="ghost" size="sm" onClick={handleInteraction}>
                See all
              </Button>
            </div>

            {trendingPosts.map((post) => (
              <Card key={post.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarFallback className="bg-accent-brand/10 text-accent-brand">
                      {post.avatar}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <p className="font-medium m-0">{post.author}</p>
                      <p className="text-sm text-muted-foreground m-0">{post.role}</p>
                    </div>

                    <p className="m-0 mb-3">{post.content}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-6">
                      <button
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-brand transition-colors group"
                        onClick={handleInteraction}
                      >
                        <Heart className="w-4 h-4 group-hover:fill-accent-brand" />
                        <span>{post.likes}</span>
                      </button>
                      <button
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-brand transition-colors"
                        onClick={handleInteraction}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{post.comments}</span>
                      </button>
                      <button
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-brand transition-colors"
                        onClick={handleInteraction}
                      >
                        <Repeat2 className="w-4 h-4" />
                      </button>
                      <button
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-brand transition-colors ml-auto"
                        onClick={handleInteraction}
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Featured Profiles */}
          <div className="space-y-4">
            <h3 className="m-0 mb-4">Featured profiles</h3>

            {featuredProfiles.map((profile) => (
              <Card key={profile.name} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarFallback className="bg-emerald-500/10 text-emerald-500">
                      {profile.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium m-0 truncate">{profile.name}</p>
                    <p className="text-sm text-muted-foreground m-0 truncate">{profile.role}</p>
                    <p className="text-xs text-muted-foreground m-0 mt-1">
                      {profile.followers} followers
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {profile.skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleInteraction}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Follow
                </Button>
              </Card>
            ))}

            {/* CTA Card */}
            <Card className="p-6 bg-accent-brand/5 border-accent-brand/20">
              <h4 className="m-0 mb-2">Join the community</h4>
              <p className="text-sm text-muted-foreground m-0 mb-4">
                Connect with 28k+ professionals building the future of work
              </p>
              <Button className="w-full" onClick={onSignUpPrompt}>
                Get started free
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
