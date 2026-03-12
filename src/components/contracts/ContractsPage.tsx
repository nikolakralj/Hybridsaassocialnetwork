import React, { useState } from 'react';
import { Plus, FileText, Download, Filter } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { MyContractsPanel } from './MyContractsPanel';
import { toast } from 'sonner@2.0.3';

export function ContractsPage() {
  const [filterActive, setFilterActive] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground m-0">Contracts & Agreements</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your vendors, customers, and active statements of work.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterActive ? "default" : "outline"}
            size="sm"
            className="gap-2 h-9"
            onClick={() => {
              setFilterActive(!filterActive);
              toast.info(filterActive ? 'Filters cleared' : 'Filters panel coming soon');
            }}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9"
            onClick={() => toast.info('Export will generate a CSV of your contracts')}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          <Button
            size="sm"
            className="gap-2 h-9"
            onClick={() => toast.info('Contract creation wizard coming in Phase 6')}
          >
            <Plus className="w-3.5 h-3.5" />
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
