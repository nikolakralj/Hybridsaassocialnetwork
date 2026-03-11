import { useState } from 'react';
import { useAuth, type UserProfile } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import {
  User, MapPin, Globe, Briefcase, Pencil, Check, X,
  Mail, Calendar, Loader2, Plus,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { formatDistanceToNow } from 'date-fns';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [newSkill, setNewSkill] = useState('');

  if (!user) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  const startEditing = () => {
    setForm({
      name: user.name,
      headline: user.headline || '',
      bio: user.bio || '',
      location: user.location || '',
      website: user.website || '',
      persona_type: user.persona_type,
      skills: [...(user.skills || [])],
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm({});
    setEditing(false);
    setNewSkill('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success('Profile updated');
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const skill = newSkill.trim();
    if (!skill) return;
    const current = form.skills || user.skills || [];
    if (current.includes(skill)) {
      toast.error('Skill already added');
      return;
    }
    setForm(f => ({ ...f, skills: [...current, skill] }));
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    const current = form.skills || user.skills || [];
    setForm(f => ({ ...f, skills: current.filter(s => s !== skill) }));
  };

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const displaySkills = editing ? (form.skills || []) : (user.skills || []);

  const personaLabels: Record<string, string> = {
    freelancer: 'Freelancer',
    company: 'Company',
    agency: 'Agency',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20 text-2xl">
              <AvatarFallback className="bg-foreground/10 text-foreground text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="profile-name" className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      id="profile-name"
                      value={form.name || ''}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profile-headline" className="text-xs text-muted-foreground">Headline</Label>
                    <Input
                      id="profile-headline"
                      placeholder="e.g. Senior Full-Stack Developer"
                      value={form.headline || ''}
                      onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-1">{user.name}</h2>
                  {user.headline && (
                    <p className="text-muted-foreground">{user.headline}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                    {user.persona_type && (
                      <Badge variant="secondary" className="text-xs">
                        {personaLabels[user.persona_type] || user.persona_type}
                      </Badge>
                    )}
                    {user.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {user.location}
                      </span>
                    )}
                    {user.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {user.email}
                      </span>
                    )}
                    {user.created_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About / Bio */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4" /> About
          </h3>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <Textarea
                placeholder="Tell people about yourself, your experience, and what you're looking for..."
                value={form.bio || ''}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={4}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="profile-location" className="text-xs text-muted-foreground">Location</Label>
                  <Input
                    id="profile-location"
                    placeholder="San Francisco, CA"
                    value={form.location || ''}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-website" className="text-xs text-muted-foreground">Website</Label>
                  <Input
                    id="profile-website"
                    placeholder="https://yoursite.com"
                    value={form.website || ''}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account Type</Label>
                <div className="flex gap-2 mt-1">
                  {(['freelancer', 'company', 'agency'] as const).map(type => (
                    <Button
                      key={type}
                      type="button"
                      variant={form.persona_type === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setForm(f => ({ ...f, persona_type: type }))}
                    >
                      {personaLabels[type]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {user.bio ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{user.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No bio yet. Click "Edit Profile" to add one.</p>
              )}
              {user.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <a href={user.website} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline">{user.website}</a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> Skills
          </h3>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {displaySkills.length > 0 ? (
              displaySkills.map(skill => (
                <Badge key={skill} variant="secondary" className="text-xs gap-1">
                  {skill}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-1 hover:text-destructive bg-transparent border-0 cursor-pointer p-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No skills added yet.{!editing && ' Click "Edit Profile" to add skills.'}
              </p>
            )}
          </div>
          {editing && (
            <div className="flex gap-2 mt-3">
              <Input
                placeholder="Add a skill..."
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addSkill}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4" /> Account
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{user.email}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-xs">{user.id.slice(0, 8)}...</span>
            </div>
            {user.created_at && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member since</span>
                  <span>{new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
