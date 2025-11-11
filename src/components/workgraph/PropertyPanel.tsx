import React, { useState } from 'react';
import { X, Trash2, Building2, ChevronDown, ChevronRight, Activity, Users, DollarSign, Clock, AlertCircle, Copy, CheckCircle2, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { CompanySearchDialog } from './CompanySearchDialog';
import { useNodeStats, useEdgeStats, formatTimeAgo, formatHoursProgress } from '../../hooks/useNodeStats';
import { useMonthContextSafe } from '../../contexts/MonthContext';
import type { BaseNode, BaseEdge } from '../../types/workgraph';

interface PropertyPanelProps {
  node: BaseNode | null;
  edge: BaseEdge | null;
  onUpdateNode: (nodeId: string, updates: any) => void;
  onUpdateEdge: (edgeId: string, updates: any) => void;
  onDelete: () => void;
  allParties: BaseNode[];
  allNodes?: BaseNode[];
  allEdges?: any[];
}

export function PropertyPanel({
  node,
  edge,
  onUpdateNode,
  onUpdateEdge,
  onDelete,
  allParties,
  allNodes = [],
  allEdges = [],
}: PropertyPanelProps) {
  if (!node && !edge) return null;

  // Check if this is a newly created node (has default "New {type}" name)
  const isNewNode = node && node.data?.name?.startsWith('New ');

  return (
    <div className="absolute right-4 top-4 bottom-4 w-80 bg-white rounded-lg shadow-xl overflow-hidden flex flex-col z-10">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
        <h3 className="font-semibold text-gray-900">
          {node ? 'Node Properties' : 'Edge Properties'}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* New Node Tip */}
      {isNewNode && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 text-lg">💡</span>
            <div className="text-xs text-blue-900">
              <strong>New node created!</strong> Click the <strong>Clear</strong> button or <strong>X</strong> icon to erase default text, then type your own. Changes save automatically.
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {node && <NodeProperties node={node} onUpdate={onUpdateNode} allParties={allParties} allNodes={allNodes} allEdges={allEdges} />}
        {edge && <EdgeProperties edge={edge} onUpdate={onUpdateEdge} allParties={allParties} allEdges={allEdges} />}
      </div>
    </div>
  );
}

function NodeProperties({ 
  node, 
  onUpdate, 
  allParties,
  allNodes,
  allEdges,
}: { 
  node: BaseNode; 
  onUpdate: (id: string, updates: any) => void;
  allParties: BaseNode[];
  allNodes: BaseNode[];
  allEdges: any[];
}) {
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [showStats, setShowStats] = useState(true); // Stats section open by default
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const partyRoleInputRef = React.useRef<HTMLInputElement>(null);
  const personRoleInputRef = React.useRef<HTMLInputElement>(null);
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  // Phase 5: Fetch node stats from database
  const { stats, loading: statsLoading, error: statsError } = useNodeStats(node, allNodes, allEdges);
  
  // Detect if database is not set up
  const isDatabaseError = statsError?.message?.includes('PGRST205') || 
                         statsError?.message?.includes('not find') ||
                         statsError?.message?.includes('schema cache');
  
  const [copiedSetupSQL, setCopiedSetupSQL] = useState(false);
  
  const setupSQL = `-- Run this in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('company', 'agency', 'freelancer')),
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  project_id UUID NOT NULL,
  contract_type TEXT NOT NULL,
  hourly_rate DECIMAL(10,2),
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timesheet_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES project_contracts(id),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_user ON project_contracts(user_id);
CREATE INDEX idx_periods_contract ON timesheet_periods(contract_id);`;

  const copySetupSQL = () => {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(setupSQL)
        .then(() => {
          setCopiedSetupSQL(true);
          setTimeout(() => setCopiedSetupSQL(false), 2000);
        })
        .catch((err) => {
          console.warn('Clipboard API failed, using fallback:', err);
          fallbackCopyTextToClipboard(setupSQL);
        });
    } else {
      // Fallback for older browsers or non-secure contexts
      fallbackCopyTextToClipboard(setupSQL);
    }
  };

  // Fallback copy method for browsers that don't support clipboard API
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopiedSetupSQL(true);
        setTimeout(() => setCopiedSetupSQL(false), 2000);
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
    }
    
    document.body.removeChild(textArea);
  };

  const handleChange = (field: string, value: any) => {
    onUpdate(node.id, { [field]: value });
  };

  // Clear button handlers
  const clearName = () => {
    handleChange('name', '');
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const clearPartyRole = () => {
    handleChange('role', '');
    setTimeout(() => partyRoleInputRef.current?.focus(), 0);
  };

  const clearPersonRole = () => {
    handleChange('role', '');
    setTimeout(() => personRoleInputRef.current?.focus(), 0);
  };

  const clearEmail = () => {
    handleChange('email', '');
    setTimeout(() => emailInputRef.current?.focus(), 0);
  };

  // Auto-select text when input is clicked/focused for easier editing
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.select();
    }, 0);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    setTimeout(() => {
      target.select();
    }, 0);
  };

  // Stop keyboard events from bubbling to window handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  const handleAttachCompany = (company: { id: string; name: string; type: string; logo: string }) => {
    handleChange('name', company.name);
    handleChange('partyType', company.type);
    handleChange('logo', company.logo);
    handleChange('organizationId', company.id);
  };

  return (
    <>
      {/* Common Fields */}
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="name">Name</Label>
          {node.data?.name && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearName}
              className="h-6 px-2 text-xs text-gray-500 hover:text-red-600"
            >
              Clear
            </Button>
          )}
        </div>
        <div className="relative mt-1">
          <Input
            ref={nameInputRef}
            id="name"
            value={node.data?.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter party name"
            className="font-medium pr-8"
            autoComplete="off"
          />
          {node.data?.name && (
            <button
              onClick={clearName}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">Node Type</Label>
        <Badge variant="outline" className="mt-1">{node.type}</Badge>
      </div>

      <Separator />

      {/* Party-specific fields */}
      {node.type === 'party' && (
        <>
          {/* Attach existing company button */}
          {!node.data?.organizationId && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompanySearch(true)}
                className="w-full gap-2"
              >
                <Building2 className="h-4 w-4" />
                Attach Existing Company
              </Button>
            </div>
          )}

          {node.data?.organizationId && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-xl">{node.data?.logo}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-yellow-900">
                    Linked to Organization
                  </div>
                  <div className="text-xs text-yellow-700">
                    Party Type is locked
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="partyType">Party Type</Label>
            <Select
              value={node.data?.partyType || 'company'}
              onValueChange={(value) => handleChange('partyType', value)}
              disabled={!!node.data?.organizationId}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="freelancer">Freelancer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="partyRole">Role/Title</Label>
              {node.data?.role && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearPartyRole}
                  className="h-6 px-2 text-xs text-gray-500 hover:text-red-600"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="relative mt-1">
              <Input
                ref={partyRoleInputRef}
                id="partyRole"
                value={node.data?.role || ''}
                onChange={(e) => handleChange('role', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Project Manager"
                className="font-medium pr-8"
                autoComplete="off"
              />
              {node.data?.role && (
                <button
                  onClick={clearPartyRole}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-medium">Permissions</Label>
            
            <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer">
              <Checkbox
                id="canApprove"
                checked={node.data?.canApprove || false}
                onCheckedChange={(checked) => handleChange('canApprove', checked)}
              />
              <Label htmlFor="canApprove" className="text-sm cursor-pointer flex-1">Can Approve</Label>
              {node.data?.canApprove && (
                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                  Active
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer">
              <Checkbox
                id="canViewRates"
                checked={node.data?.canViewRates || false}
                onCheckedChange={(checked) => handleChange('canViewRates', checked)}
              />
              <Label htmlFor="canViewRates" className="text-sm cursor-pointer flex-1">Can View Rates</Label>
              {node.data?.canViewRates && (
                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                  Active
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer">
              <Checkbox
                id="canEditTimesheets"
                checked={node.data?.canEditTimesheets || false}
                onCheckedChange={(checked) => handleChange('canEditTimesheets', checked)}
              />
              <Label htmlFor="canEditTimesheets" className="text-sm cursor-pointer flex-1">Can Edit Timesheets</Label>
              {node.data?.canEditTimesheets && (
                <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                  Active
                </Badge>
              )}
            </div>
          </div>
        </>
      )}

      {/* Contract-specific fields */}
      {node.type === 'contract' && (
        <>
          <div>
            <Label htmlFor="contractType">Contract Type</Label>
            <Select
              value={node.data?.contractType || 'hourly'}
              onValueChange={(value) => handleChange('contractType', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="fixed">Fixed Price</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {node.data?.contractType === 'hourly' && (
            <div>
              <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
              <Input
                id="hourlyRate"
                type="number"
                value={node.data?.hourlyRate || ''}
                onChange={(e) => handleChange('hourlyRate', parseFloat(e.target.value))}
                onFocus={handleInputFocus}
                onClick={handleInputClick}
                onKeyDown={handleKeyDown}
                className="mt-1"
              />
            </div>
          )}

          {node.data?.contractType === 'daily' && (
            <div>
              <Label htmlFor="dailyRate">Daily Rate ($)</Label>
              <Input
                id="dailyRate"
                type="number"
                value={node.data?.dailyRate || ''}
                onChange={(e) => handleChange('dailyRate', parseFloat(e.target.value))}
                onFocus={handleInputFocus}
                onClick={handleInputClick}
                onKeyDown={handleKeyDown}
                className="mt-1"
              />
            </div>
          )}

          {node.data?.contractType === 'fixed' && (
            <div>
              <Label htmlFor="fixedAmount">Fixed Amount ($)</Label>
              <Input
                id="fixedAmount"
                type="number"
                value={node.data?.fixedAmount || ''}
                onChange={(e) => handleChange('fixedAmount', parseFloat(e.target.value))}
                onFocus={handleInputFocus}
                onClick={handleInputClick}
                onKeyDown={handleKeyDown}
                className="mt-1"
              />
            </div>
          )}

          <Separator />
          
          {/* Contract Parties */}
          <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🤝</span>
              <Label className="text-sm font-medium text-blue-900">Contract Parties</Label>
            </div>
            <p className="text-xs text-blue-700">
              This contract is between these two parties:
            </p>
            
            <div>
              <Label htmlFor="partyA" className="text-xs text-blue-700">Party A (Vendor/Worker)</Label>
              <Select
                value={node.data?.parties?.partyA || 'none'}
                onValueChange={(value) => handleChange('parties', {
                  ...node.data?.parties,
                  partyA: value === 'none' ? undefined : value,
                })}
              >
                <SelectTrigger className="mt-1 bg-white">
                  <SelectValue placeholder="Select party A" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {allParties.map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.data?.name || 'Unnamed Party'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="partyB" className="text-xs text-blue-700">Party B (Client/Agency)</Label>
              <Select
                value={node.data?.parties?.partyB || 'none'}
                onValueChange={(value) => handleChange('parties', {
                  ...node.data?.parties,
                  partyB: value === 'none' ? undefined : value,
                })}
              >
                <SelectTrigger className="mt-1 bg-white">
                  <SelectValue placeholder="Select party B" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {allParties.map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.data?.name || 'Unnamed Party'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {node.data?.parties?.partyA && node.data?.parties?.partyB && (
              <div className="text-xs text-blue-700 bg-white p-2 rounded border border-blue-200">
                ✓ Only <strong>{allParties.find(p => p.id === node.data?.parties?.partyA)?.data?.name}</strong> and <strong>{allParties.find(p => p.id === node.data?.parties?.partyB)?.data?.name}</strong> can see this rate by default.
              </div>
            )}
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span>🔐</span>
              <Label className="text-sm font-medium">Rate Visibility</Label>
            </div>
            <p className="text-xs text-gray-500">
              Additional parties to hide this contract's rate from:
            </p>
            
            {allParties.filter(p => 
              p.id !== node.data?.parties?.partyA && 
              p.id !== node.data?.parties?.partyB
            ).length === 0 ? (
              <p className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded">
                No other parties to hide from. Rate is automatically hidden from non-contract parties.
              </p>
            ) : (
              <>
                {allParties.filter(p => 
                  p.id !== node.data?.parties?.partyA && 
                  p.id !== node.data?.parties?.partyB
                ).map((party) => (
                  <div key={party.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`hide-${party.id}`}
                      checked={
                        node.data?.visibility?.hideRateFrom?.includes(party.id) || false
                      }
                      onCheckedChange={(checked) => {
                        const hideRateFrom = node.data?.visibility?.hideRateFrom || [];
                        const newHideRateFrom = checked
                          ? [...hideRateFrom, party.id]
                          : hideRateFrom.filter((id: string) => id !== party.id);
                        handleChange('visibility', {
                          ...node.data?.visibility,
                          hideRateFrom: newHideRateFrom,
                        });
                      }}
                    />
                    <Label htmlFor={`hide-${party.id}`} className="text-sm">
                      {party.data?.name || 'Unnamed Party'}
                    </Label>
                  </div>
                ))}
              </>
            )}
          </div>
          
          <Separator />
          
          {/* Optional: Hour Limits */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">📊 Hour Limits (Optional)</Label>
            
            <div>
              <Label htmlFor="weeklyLimit" className="text-xs text-gray-600">Weekly Hour Limit</Label>
              <Input
                id="weeklyLimit"
                type="number"
                min="0"
                step="1"
                value={node.data?.weeklyHourLimit || ''}
                onChange={(e) => handleChange('weeklyHourLimit', e.target.value ? parseFloat(e.target.value) : undefined)}
                onFocus={handleInputFocus}
                onClick={handleInputClick}
                onKeyDown={handleKeyDown}
                placeholder="e.g., 40"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for no limit</p>
            </div>
            
            <div>
              <Label htmlFor="monthlyLimit" className="text-xs text-gray-600">Monthly Hour Limit</Label>
              <Input
                id="monthlyLimit"
                type="number"
                min="0"
                step="1"
                value={node.data?.monthlyHourLimit || ''}
                onChange={(e) => handleChange('monthlyHourLimit', e.target.value ? parseFloat(e.target.value) : undefined)}
                onFocus={handleInputFocus}
                onClick={handleInputClick}
                onKeyDown={handleKeyDown}
                placeholder="e.g., 160"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for no limit</p>
            </div>
          </div>
        </>
      )}

      {/* Person-specific fields */}
      {node.type === 'person' && (
        <>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="email">Email</Label>
              {node.data?.email && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearEmail}
                  className="h-6 px-2 text-xs text-gray-500 hover:text-red-600"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="relative mt-1">
              <Input
                ref={emailInputRef}
                id="email"
                type="email"
                value={node.data?.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="person@example.com"
                className="font-medium pr-8"
                autoComplete="off"
              />
              {node.data?.email && (
                <button
                  onClick={clearEmail}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="personRole">Role</Label>
              {node.data?.role && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearPersonRole}
                  className="h-6 px-2 text-xs text-gray-500 hover:text-red-600"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="relative mt-1">
              <Input
                ref={personRoleInputRef}
                id="personRole"
                value={node.data?.role || ''}
                onChange={(e) => handleChange('role', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Senior Developer"
                className="font-medium pr-8"
                autoComplete="off"
              />
              {node.data?.role && (
                <button
                  onClick={clearPersonRole}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Phase 5: Stats & Activity Section */}
      {stats && (
        <>
          <Separator />
          <Collapsible open={showStats} onOpenChange={setShowStats}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-medium cursor-pointer">Stats & Activity</Label>
                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                  Phase 5 🔄
                </Badge>
              </div>
              {showStats ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2 space-y-2">
              {statsLoading ? (
                <div className="text-xs text-gray-500 italic p-2">Loading stats...</div>
              ) : (
                <>
                  {/* Person Stats */}
                  {node.type === 'person' && 'totalHoursWorked' in stats && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600 flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Total Hours Worked
                        </span>
                        <span className="font-medium">{stats.totalHoursWorked.toLocaleString()} hrs</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">This Month</span>
                        <span className="font-medium">{stats.totalHoursThisMonth} hrs</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Current Week</span>
                        <span className="font-medium">
                          {stats.currentWeekHours} / {stats.weeklyLimit} hrs
                          <span className="text-xs text-gray-500 ml-1">
                            ({Math.round((stats.currentWeekHours / stats.weeklyLimit) * 100)}%)
                          </span>
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Current Month</span>
                        <span className="font-medium">
                          {stats.currentMonthHours} / {stats.monthlyLimit} hrs
                          <span className="text-xs text-gray-500 ml-1">
                            ({Math.round((stats.currentMonthHours / stats.monthlyLimit) * 100)}%)
                          </span>
                        </span>
                      </div>
                      
                      {stats.lastTimesheetSubmitted && (
                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <span className="text-blue-700">Last Timesheet</span>
                          <span className="font-medium text-blue-900">{formatTimeAgo(stats.lastTimesheetSubmitted)}</span>
                        </div>
                      )}
                      
                      {stats.pendingTimesheets > 0 && (
                        <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                          <span className="text-yellow-700">Pending Timesheets</span>
                          <Badge variant="outline" className="bg-yellow-100 border-yellow-300 text-yellow-900">
                            {stats.pendingTimesheets}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Party Stats */}
                  {node.type === 'party' && 'totalEmployees' in stats && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600 flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          Total Employees
                        </span>
                        <span className="font-medium">{stats.totalEmployees}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Active Contracts</span>
                        <span className="font-medium">{stats.totalContracts}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Total Hours (Month)</span>
                        <span className="font-medium">{stats.totalHoursThisMonth.toLocaleString()} hrs</span>
                      </div>
                      
                      {stats.lastActivity && (
                        <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <span className="text-green-700">Last Activity</span>
                          <span className="font-medium text-green-900">{formatTimeAgo(stats.lastActivity)}</span>
                        </div>
                      )}
                      
                      {stats.employeeNames.length > 0 && (
                        <div className="p-2 bg-blue-50 rounded">
                          <div className="text-xs text-blue-700 font-medium mb-1">Employees:</div>
                          <div className="text-xs text-blue-900">
                            {stats.employeeNames.slice(0, 3).join(', ')}
                            {stats.employeeNames.length > 3 && ` +${stats.employeeNames.length - 3} more`}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contract Stats */}
                  {node.type === 'contract' && 'totalHoursWorked' in stats && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600 flex items-center gap-2">
                          <DollarSign className="h-3 w-3" />
                          Total Billed
                        </span>
                        <span className="font-medium">${stats.totalAmountBilled.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Total Hours Worked</span>
                        <span className="font-medium">{stats.totalHoursWorked.toLocaleString()} hrs</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Budget Utilization</span>
                        <span className="font-medium">
                          {stats.budgetUtilization.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Current Week</span>
                        <span className="font-medium">{stats.currentWeekHours} hrs</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">Current Month</span>
                        <span className="font-medium">{stats.currentMonthHours} hrs</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                        <span className="text-purple-700">Workers on Contract</span>
                        <span className="font-medium text-purple-900">{stats.workersCount}</span>
                      </div>
                      
                      {stats.workerNames.length > 0 && (
                        <div className="p-2 bg-blue-50 rounded">
                          <div className="text-xs text-blue-700 font-medium mb-1">Workers:</div>
                          <div className="text-xs text-blue-900">
                            {stats.workerNames.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {/* Database Error Handling */}
      {isDatabaseError && (
        <>
          <Separator />
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-red-900">
                  Database Error
                </div>
                <div className="text-xs text-red-700">
                  {statsError?.message || 'An error occurred while fetching stats.'}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-gray-500" />
                <Label className="text-sm font-medium">Setup SQL</Label>
              </div>
              <p className="text-xs text-gray-500">
                Run the following SQL in your Supabase SQL Editor to set up the necessary tables:
              </p>
              
              <div className="p-2 bg-gray-50 rounded">
                <pre className="text-xs text-gray-700">
                  {setupSQL}
                </pre>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copySetupSQL}
                  className="text-sm"
                >
                  {copiedSetupSQL ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-gray-500 mr-2" />
                      Copy SQL
                    </>
                  )}
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // Navigate to setup page
                    window.dispatchEvent(new CustomEvent('navigate', { detail: 'setup' }));
                  }}
                  className="text-sm bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Setup Page
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                Or open the{' '}
                <a
                  href="https://supabase.com/dashboard/project/_/sql/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Supabase SQL Editor
                </a>
                {' '}directly
              </p>
            </div>
          </div>
        </>
      )}

      {/* Company Search Dialog */}
      {node.type === 'party' && (
        <CompanySearchDialog
          open={showCompanySearch}
          onSelect={handleAttachCompany}
          onClose={() => setShowCompanySearch(false)}
        />
      )}
    </>
  );
}

function EdgeProperties({
  edge,
  onUpdate,
  allParties,
  allEdges,
}: {
  edge: BaseEdge;
  onUpdate: (id: string, updates: any) => void;
  allParties: BaseNode[];
  allEdges: any[];
}) {
  const handleChange = (field: string, value: any) => {
    onUpdate(edge.id, { [field]: value });
  };

  // Auto-select text when input is clicked/focused for easier editing
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.select();
    }, 0);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    setTimeout(() => {
      target.select();
    }, 0);
  };

  // Stop keyboard events from bubbling to window handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  return (
    <>
      <div>
        <Label htmlFor="edgeType">Edge Type</Label>
        <Select
          value={edge.data?.edgeType || 'approves'}
          onValueChange={(value) => handleChange('edgeType', value)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="approves">Approves</SelectItem>
            <SelectItem value="funds">Funds</SelectItem>
            <SelectItem value="subcontracts">Subcontracts</SelectItem>
            <SelectItem value="billsTo">Bills To</SelectItem>
            <SelectItem value="assigns">Assigns</SelectItem>
            <SelectItem value="worksOn">Works On</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {edge.data?.edgeType === 'approves' && (
        <>
          <div>
            <Label htmlFor="order">Approval Order</Label>
            <Input
              id="order"
              type="number"
              min="1"
              value={edge.data?.order || 1}
              onChange={(e) => handleChange('order', parseInt(e.target.value))}
              onFocus={handleInputFocus}
              onClick={handleInputClick}
              onKeyDown={handleKeyDown}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="required"
              checked={edge.data?.required !== false}
              onCheckedChange={(checked) => handleChange('required', checked)}
            />
            <Label htmlFor="required" className="text-sm">Required Approval</Label>
          </div>
        </>
      )}

      {edge.data?.edgeType === 'funds' && (
        <>
          <div>
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              value={edge.data?.amount || ''}
              onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
              onFocus={handleInputFocus}
              onClick={handleInputClick}
              onKeyDown={handleKeyDown}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="fundingType">Funding Type</Label>
            <Select
              value={edge.data?.fundingType || 'direct'}
              onValueChange={(value) => handleChange('fundingType', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="through_po">Through PO</SelectItem>
                <SelectItem value="through_budget">Through Budget</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {edge.data?.edgeType === 'subcontracts' && (
        <>
          <div>
            <Label htmlFor="role">Contractor Role</Label>
            <Select
              value={edge.data?.role || 'sub'}
              onValueChange={(value) => handleChange('role', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prime">Prime Contractor</SelectItem>
                <SelectItem value="sub">Subcontractor</SelectItem>
                <SelectItem value="sub-sub">Sub-subcontractor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="markup">Markup (%)</Label>
            <Input
              id="markup"
              type="number"
              min="0"
              max="100"
              value={edge.data?.markup || ''}
              onChange={(e) => handleChange('markup', parseFloat(e.target.value))}
              onFocus={handleInputFocus}
              onClick={handleInputClick}
              onKeyDown={handleKeyDown}
              className="mt-1"
            />
          </div>
        </>
      )}
    </>
  );
}