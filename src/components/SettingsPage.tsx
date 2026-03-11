import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { NotificationPreferencesPanel } from './notifications/NotificationPreferencesPanel';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import {
  Bell, User, Shield, Palette, LogOut,
  Loader2, Check, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

type SettingsTab = 'account' | 'notifications' | 'privacy' | 'appearance';

export function SettingsPage() {
  const { user, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left border-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-foreground/8 text-foreground font-medium'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          <Separator className="my-3" />

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors text-left bg-transparent border-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'privacy' && <PrivacySettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
        </div>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { user, updateProfile } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Account Information</h3>
          <p className="text-xs text-muted-foreground">Manage your account details</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm">{user.email}</p>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <p className="text-sm">{user.name}</p>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Account Type</Label>
            <Badge variant="secondary" className="text-xs capitalize">
              {user.persona_type || 'freelancer'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Password</h3>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => setChangingPassword(!changingPassword)}>
            Change password
          </Button>
          {changingPassword && (
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="new-password" className="text-xs">New password</Label>
                <Input id="new-password" type="password" placeholder="Min 6 characters" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-xs">Confirm password</Label>
                <Input id="confirm-password" type="password" className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { toast.info('Password change coming soon'); setChangingPassword(false); }}>
                  Update password
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setChangingPassword(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Once you delete your account, there is no going back.
          </p>
          <Button variant="destructive" size="sm" onClick={() => toast.error('Account deletion is not yet available')}>
            Delete account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Notification Preferences</h3>
          <p className="text-xs text-muted-foreground">
            Control how and when you receive notifications
          </p>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesPanel />
        </CardContent>
      </Card>
    </div>
  );
}

function PrivacySettings() {
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'connections' | 'private'>('public');
  const [showEmail, setShowEmail] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Profile Visibility</h3>
          <p className="text-xs text-muted-foreground">
            Control who can see your profile information
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['public', 'connections', 'private'] as const).map(opt => (
            <label key={opt} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={profileVisibility === opt}
                onChange={() => setProfileVisibility(opt)}
                className="mt-1 accent-foreground"
              />
              <div>
                <p className="text-sm font-medium capitalize m-0">{opt}</p>
                <p className="text-xs text-muted-foreground m-0">
                  {opt === 'public' && 'Anyone can find and view your profile'}
                  {opt === 'connections' && 'Only people you work with can see your profile'}
                  {opt === 'private' && 'Your profile is hidden from search and discovery'}
                </p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Information Sharing</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">Show email on profile</span>
            <input
              type="checkbox"
              checked={showEmail}
              onChange={e => setShowEmail(e.target.checked)}
              className="accent-foreground w-4 h-4"
            />
          </label>
          <Separator />
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">Show activity status</span>
            <input
              type="checkbox"
              checked={showActivity}
              onChange={e => setShowActivity(e.target.checked)}
              className="accent-foreground w-4 h-4"
            />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast.success(`Theme set to ${t}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold">Theme</h3>
          <p className="text-xs text-muted-foreground">Choose your preferred appearance</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => applyTheme(t)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all cursor-pointer bg-transparent ${
                  theme === t
                    ? 'border-foreground ring-1 ring-foreground'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${
                  t === 'light' ? 'bg-white border border-gray-200' :
                  t === 'dark' ? 'bg-gray-900 border border-gray-700' :
                  'bg-gradient-to-br from-white to-gray-900 border border-gray-300'
                }`} />
                <span className="text-xs font-medium capitalize">{t}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
