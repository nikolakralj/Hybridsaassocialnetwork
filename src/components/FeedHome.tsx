import { useState } from "react";
import { 
  PlusCircle, 
  Briefcase, 
  Users, 
  FileText,
  Image,
  Link2,
  BarChart3,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  TrendingUp,
  Clock,
  CheckCircle
} from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";
import { toast } from "sonner@2.0.3";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router";

interface FeedHomeProps {
  isNewUser?: boolean;
  userName?: string;
  persona?: "freelancer" | "company" | "agency" | null;
}

export function FeedHome({ isNewUser = false, userName, persona = null }: FeedHomeProps) {
  const [postContent, setPostContent] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = userName || user?.name || "You";

  const handlePost = () => {
    if (!postContent.trim()) {
      toast.error("Please write something first");
      return;
    }
    toast.success("Post published!");
    setPostContent("");
  };

  // REMOVED: No more EmptyState/WelcomeChecklist - go straight to feed
  // if (isNewUser) {
  //   return <EmptyState persona={persona} />;
  // }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-6 px-6 py-6">
          {/* Left Rail */}
          <aside className="lg:col-span-3 space-y-6">
            <QuickActions />
            <WorkspacesSwitcher />
          </aside>

          {/* Main Feed */}
          <main className="lg:col-span-6 space-y-6">
            {/* Composer */}
            <Card className="p-6">
              <div className="flex gap-4">
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarFallback className="bg-accent-brand/10 text-accent-brand">
                    {displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-4">
                  <Textarea
                    placeholder="Share update / Ask / Show progress"
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => toast.info('Image upload coming soon')}>
                        <Image className="w-4 h-4 mr-2" />
                        Image
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.info('Job posting coming in Phase 6')}>
                        <Briefcase className="w-4 h-4 mr-2" />
                        Job
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.info('Link attachment coming soon')}>
                        <Link2 className="w-4 h-4 mr-2" />
                        Link
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.info('Polls coming soon')}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Poll
                      </Button>
                    </div>
                    <Button onClick={handlePost} disabled={!postContent.trim()}>
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Feed Items */}
            <FeedList />
          </main>

          {/* Right Rail */}
          <aside className="lg:col-span-3 space-y-6">
            <MyWeekWidget />
            <SuggestedConnections />
            <JobsForYou />
          </aside>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <Card className="p-4">
      <h4 className="m-0 mb-4">Quick Actions</h4>
      <div className="space-y-2">
        <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Opening new job form")}>
          <Briefcase className="w-4 h-4 mr-2" />
          New Job
        </Button>
        <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Opening post composer")}>
          <FileText className="w-4 h-4 mr-2" />
          New Post
        </Button>
        <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Opening invite dialog")}>
          <Users className="w-4 h-4 mr-2" />
          Invite
        </Button>
      </div>
    </Card>
  );
}

function WorkspacesSwitcher() {
  const workspaces = [
    { name: "Personal", type: "personal", avatar: "YO" },
    { name: "TechCorp", type: "company", avatar: "TC" },
    { name: "Elite Recruiters", type: "agency", avatar: "ER" }
  ];

  return (
    <Card className="p-4">
      <h4 className="m-0 mb-4">Workspaces</h4>
      <div className="space-y-2">
        {workspaces.map((ws) => (
          <button
            key={ws.name}
            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition-colors text-left"
            onClick={() => toast.info(`Switching to ${ws.name}`)}
          >
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-xs">
                {ws.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium m-0 truncate">{ws.name}</p>
              <p className="text-xs text-muted-foreground m-0 capitalize">{ws.type}</p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function MyWeekWidget() {
  return (
    <Card className="p-4">
      <h4 className="m-0 mb-4">My Week</h4>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Hours logged</span>
            <span className="font-semibold">32 / 40h</span>
          </div>
          <Progress value={80} />
        </div>
        
        <Separator />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-sm">Tasks due</span>
            </div>
            <Badge className="bg-warning">3</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm">Completed</span>
            </div>
            <span className="text-sm font-medium">12</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-brand" />
              <span className="text-sm">Meetings</span>
            </div>
            <span className="text-sm font-medium">5</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SuggestedConnections() {
  const suggestions = [
    { name: "Alex Martinez", role: "Engineering Manager", avatar: "AM" },
    { name: "Emma Liu", role: "Product Designer", avatar: "EL" },
    { name: "TechVentures Inc", role: "Company • 250 employees", avatar: "TV" }
  ];

  return (
    <Card className="p-4">
      <h4 className="m-0 mb-4">Suggested Connections</h4>
      <div className="space-y-3">
        {suggestions.map((person) => (
          <div key={person.name} className="flex items-center gap-3">
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarFallback className="text-xs bg-accent">
                {person.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium m-0 truncate">{person.name}</p>
              <p className="text-xs text-muted-foreground m-0 truncate">{person.role}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.success(`Following ${person.name}`)}>
              Follow
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function JobsForYou() {
  const jobs = [
    { title: "Senior React Developer", company: "TechCorp", location: "Remote" },
    { title: "Full-Stack Engineer", company: "StartupX", location: "San Francisco" },
    { title: "Frontend Lead", company: "AgencyY", location: "New York" }
  ];

  return (
    <Card className="p-4">
      <h4 className="m-0 mb-4">Jobs for you</h4>
      <div className="space-y-3">
        {jobs.map((job) => (
          <button
            key={job.title}
            className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
            onClick={() => toast.info(`Viewing ${job.title}`)}
          >
            <p className="font-medium m-0 mb-1">{job.title}</p>
            <p className="text-sm text-muted-foreground m-0">{job.company}</p>
            <p className="text-xs text-muted-foreground m-0 mt-1">{job.location}</p>
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full mt-4" size="sm" onClick={() => toast.info('Full job board coming soon')}>
        See all jobs
      </Button>
    </Card>
  );
}

function FeedList() {
  const feedItems = [
    {
      id: 1,
      type: "post" as const,
      author: "Sarah Chen",
      role: "Senior Developer",
      avatar: "SC",
      time: "2h ago",
      content: "Just shipped a major performance update! Load times down by 60%. Sometimes the best features are invisible to users. 🚀",
      likes: 127,
      comments: 23,
      shares: 5
    },
    {
      id: 2,
      type: "job_change" as const,
      author: "Alex Martinez",
      role: "Engineering Manager",
      avatar: "AM",
      time: "5h ago",
      content: "Excited to announce I'm joining TechVentures as Engineering Manager! Looking forward to building amazing products with an incredible team.",
      likes: 203,
      comments: 41,
      shares: 12
    },
    {
      id: 3,
      type: "milestone" as const,
      author: "Emma Liu",
      role: "Product Designer",
      avatar: "EL",
      time: "1d ago",
      content: "Our design system v2.0 just hit production! 50+ new components, better accessibility, and dark mode throughout. Big thanks to the entire team! ✨",
      likes: 156,
      comments: 28,
      shares: 8
    }
  ];

  return (
    <div className="space-y-6">
      {feedItems.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function FeedItem({ item }: { item: any }) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes);

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <Avatar className="w-12 h-12 flex-shrink-0">
          <AvatarFallback className="bg-accent-brand/10 text-accent-brand">
            {item.avatar}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium m-0">{item.author}</p>
              <p className="text-sm text-muted-foreground m-0">{item.role}</p>
            </div>
            <span className="text-sm text-muted-foreground">{item.time}</span>
          </div>

          {item.type === "job_change" && (
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm text-success font-medium">Job Update</span>
            </div>
          )}

          {item.type === "milestone" && (
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-accent-brand" />
              <span className="text-sm text-accent-brand font-medium">Milestone</span>
            </div>
          )}

          <p className="m-0 mb-4">{item.content}</p>

          <div className="flex items-center gap-6">
            <button
              className={`flex items-center gap-2 text-sm transition-colors group ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
              onClick={() => { setLiked(!liked); setLikeCount(liked ? likeCount - 1 : likeCount + 1); }}
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-red-500' : 'group-hover:fill-red-500/20'}`} />
              <span>{likeCount}</span>
            </button>
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-brand transition-colors"
              onClick={() => toast.info('Comments coming soon')}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{item.comments}</span>
            </button>
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-brand transition-colors"
              onClick={() => toast.success('Post shared!')}
            >
              <Repeat2 className="w-4 h-4" />
              <span>{item.shares}</span>
            </button>
            <button
              className={`flex items-center gap-2 text-sm transition-colors ml-auto ${bookmarked ? 'text-accent-brand' : 'text-muted-foreground hover:text-accent-brand'}`}
              onClick={() => { setBookmarked(!bookmarked); toast.success(bookmarked ? 'Removed from saved' : 'Saved!'); }}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-accent-brand' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ persona }: { persona?: "freelancer" | "company" | "agency" | null }) {
  const getChecklistByPersona = () => {
    if (persona === "freelancer") {
      return [
        { id: 1, label: "Complete your profile", done: false },
        { id: 2, label: "Follow 5 people or companies", done: false },
        { id: 3, label: "Create your first post", done: false },
        { id: 4, label: "Turn on public profile", done: false }
      ];
    } else if (persona === "company") {
      return [
        { id: 1, label: "Post your first role", done: false },
        { id: 2, label: "Set timesheet approvals", done: false },
        { id: 3, label: "Invite a manager or finance teammate", done: false }
      ];
    } else if (persona === "agency") {
      return [
        { id: 1, label: "Add your first client", done: false },
        { id: 2, label: "Create your first deal room", done: false },
        { id: 3, label: "Configure roles (Recruiter, Account, Finance)", done: false }
      ];
    }
    // Default checklist
    return [
      { id: 1, label: "Complete your profile", done: false },
      { id: 2, label: "Follow 5 people or companies", done: false },
      { id: 3, label: "Create your first post or job", done: false }
    ];
  };

  const checklist = getChecklistByPersona();
  const [items, setItems] = useState(checklist);

  const progress = (items.filter(i => i.done).length / items.length) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-accent-brand/10 flex items-center justify-center mx-auto mb-4">
            <PlusCircle className="w-8 h-8 text-accent-brand" />
          </div>
          <h2 className="m-0 mb-2">Welcome to WorkGraph!</h2>
          <p className="text-muted-foreground m-0">
            Let's get you started. Complete these steps to make the most of your experience.
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Getting started</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left"
              onClick={() => {
                const newItems = [...items];
                newItems[idx].done = !newItems[idx].done;
                setItems(newItems);
                toast.success(item.done ? "Step unchecked" : "Step completed! 🎉");
              }}
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                item.done 
                  ? "bg-success border-success" 
                  : "border-border"
              }`}>
                {item.done && <CheckCircle className="w-4 h-4 text-white" />}
              </div>
              <span className={item.done ? "line-through text-muted-foreground" : ""}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {progress === 100 && (
          <div className="mt-6 p-4 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-sm text-center m-0">
              🎉 Great job! You're all set. Your feed will appear here as you connect with others.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}