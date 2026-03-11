import React, { useState } from 'react';
import { Plus, FileText, Download, Filter } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { MyContractsPanel } from './MyContractsPanel';

export function ContractsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contracts & Agreements</h1>
          <p className="text-muted-foreground mt-1">
            Manage your vendors, customers, and active statements of work.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Contract
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <MyContractsPanel
          projectId="all-projects"
          viewerOrgId="my-org-id"
        />
      </Card>
    </div>
  );
}
