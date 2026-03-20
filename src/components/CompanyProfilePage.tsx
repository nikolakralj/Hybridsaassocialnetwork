import React, { useState } from 'react';
import { CompanyPrivateWorkspace } from './CompanyPrivateWorkspace';
import { CompanyPublicProfile } from './CompanyPublicProfile';
import { Button } from './ui/button';
import { Eye, Lock } from 'lucide-react';
import { toast } from 'sonner';

export function CompanyProfilePage() {
  const [view, setView] = useState<"private" | "public">("private");

  const handleFollow = () => {
    toast.success("Following company!");
  };

  const handleMessage = () => {
    toast.info("Opening message composer...");
  };

  const handleApplyToRole = (roleId: string) => {
    toast.success("Application submitted!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end mb-6">
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={view === "private" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("private")}
            className="gap-2"
          >
            <Lock className="w-4 h-4" />
            Internal Workspace
          </Button>
          <Button
            variant={view === "public" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("public")}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            Public View
          </Button>
        </div>
      </div>

      <div className="pb-12">
        {view === "public" ? (
          <CompanyPublicProfile
            onFollow={handleFollow}
            onMessage={handleMessage}
            onApplyToRole={handleApplyToRole}
          />
        ) : (
          <CompanyPrivateWorkspace />
        )}
      </div>
    </div>
  );
}
