import React, { useState } from 'react';
import { X, Plus, Trash2, GripVertical, Building2, Users, User, ChevronRight, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface ApprovalChainParty {
  id: string;
  type: 'client' | 'agency' | 'company' | 'contractor';
  organizationId?: string;
  organizationName?: string;
  role: string; // e.g., "Project Manager", "Technical Lead"
  order: number; // Position in approval chain
  canApprove: boolean;
  canViewRates: boolean;
  canEditTimesheets: boolean;
  notificationEmail?: string;
}

interface ProjectContractConfig {
  id: string;
  contractorId: string;
  contractorName: string;
  contractorRole: 'individual_contributor' | 'company_employee' | 'agency_contractor';
  contractType: 'hourly' | 'daily' | 'fixed';
  hourlyRate?: number;
  dailyRate?: number;
  fixedAmount?: number;
  hideRateFrom: string[]; // Array of party IDs who can't see the rate
  startDate: string;
  endDate?: string;
  notes?: string;
}

interface ProjectConfiguration {
  id: string;
  name: string;
  description?: string;
  approvalChain: ApprovalChainParty[];
  contracts: ProjectContractConfig[];
  settings: {
    requireSequentialApproval: boolean; // Must approve in order
    allowBulkApproval: boolean;
    autoApproveThreshold?: number; // Hours threshold for auto-approval
    monthlyInvoicing: boolean;
  };
}

interface ProjectConfigurationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectConfiguration; // For editing existing project
  onSave: (project: ProjectConfiguration) => void | Promise<void>;
}

export function ProjectConfigurationDrawer({
  isOpen,
  onClose,
  project,
  onSave,
}: ProjectConfigurationDrawerProps) {
  const [projectName, setProjectName] = useState(project?.name || '');
  const [projectDescription, setProjectDescription] = useState(project?.description || '');
  const [approvalChain, setApprovalChain] = useState<ApprovalChainParty[]>(
    project?.approvalChain || []
  );
  const [contracts, setContracts] = useState<ProjectContractConfig[]>(
    project?.contracts || []
  );
  const [settings, setSettings] = useState(project?.settings || {
    requireSequentialApproval: true,
    allowBulkApproval: true,
    monthlyInvoicing: true,
  });

  const [activeTab, setActiveTab] = useState<'chain' | 'contracts' | 'settings'>('chain');

  if (!isOpen) return null;

  const handleAddParty = () => {
    const newParty: ApprovalChainParty = {
      id: `party-${Date.now()}`,
      type: 'company',
      role: '',
      order: approvalChain.length,
      canApprove: true,
      canViewRates: false,
      canEditTimesheets: false,
    };
    setApprovalChain([...approvalChain, newParty]);
  };

  const handleRemoveParty = (partyId: string) => {
    setApprovalChain(approvalChain.filter(p => p.id !== partyId));
  };

  const handleUpdateParty = (partyId: string, updates: Partial<ApprovalChainParty>) => {
    setApprovalChain(
      approvalChain.map(p => (p.id === partyId ? { ...p, ...updates } : p))
    );
  };

  const handleAddContract = () => {
    const newContract: ProjectContractConfig = {
      id: `contract-${Date.now()}`,
      contractorId: '',
      contractorName: '',
      contractorRole: 'individual_contributor',
      contractType: 'hourly',
      hideRateFrom: [],
      startDate: new Date().toISOString().split('T')[0],
    };
    setContracts([...contracts, newContract]);
  };

  const handleRemoveContract = (contractId: string) => {
    setContracts(contracts.filter(c => c.id !== contractId));
  };

  const handleUpdateContract = (contractId: string, updates: Partial<ProjectContractConfig>) => {
    setContracts(
      contracts.map(c => (c.id === contractId ? { ...c, ...updates } : c))
    );
  };

  const handleSave = () => {
    const projectConfig: ProjectConfiguration = {
      id: project?.id || `project-${Date.now()}`,
      name: projectName,
      description: projectDescription,
      approvalChain,
      contracts,
      settings,
    };
    onSave(projectConfig);
    onClose();
  };

  const getPartyIcon = (type: ApprovalChainParty['type']) => {
    switch (type) {
      case 'client':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      case 'agency':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'company':
        return <Building2 className="h-4 w-4 text-green-600" />;
      case 'contractor':
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {project ? 'Edit Project Configuration' : 'Create New Project'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {project
                ? 'Saving updates the project name and description. Parties and people are edited on the Project Graph (Edit supply chain).'
                : 'Set up approval chain, contracts, and permissions'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-6">
            <button
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'chain'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('chain')}
            >
              Approval Chain
            </button>
            <button
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'contracts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('contracts')}
            >
              Contracts
            </button>
            <button
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Basic Info (shown on all tabs) */}
          <div className="mb-6">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Mobile App Redesign"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="projectDescription">Description (Optional)</Label>
                <Textarea
                  id="projectDescription"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Brief description of the project"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Approval Chain Tab */}
          {activeTab === 'chain' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">Approval Chain</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Define who needs to approve timesheets and in what order
                  </p>
                </div>
                <Button onClick={handleAddParty} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Party
                </Button>
              </div>

              {/* Approval Chain Visualization */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Approval Flow</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-gray-100">Contractor Submits</Badge>
                  {approvalChain
                    .sort((a, b) => a.order - b.order)
                    .filter(p => p.canApprove)
                    .map((party, index) => (
                      <React.Fragment key={party.id}>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                        <Badge variant="outline" className="bg-white">
                          {party.organizationName || party.role || `Party ${index + 1}`}
                        </Badge>
                      </React.Fragment>
                    ))}
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  <Badge variant="default" className="bg-green-600">Approved</Badge>
                </div>
              </div>

              {/* Parties List */}
              <div className="space-y-3">
                {approvalChain.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>No parties in approval chain yet</p>
                    <p className="text-sm mt-1">Click "Add Party" to get started</p>
                  </div>
                ) : (
                  approvalChain
                    .sort((a, b) => a.order - b.order)
                    .map((party, index) => (
                      <div
                        key={party.id}
                        className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                            <div className="flex-1 grid grid-cols-3 gap-4">
                              {/* Party Type */}
                              <div>
                                <Label className="text-xs text-gray-500">Party Type</Label>
                                <Select
                                  value={party.type}
                                  onValueChange={(value) =>
                                    handleUpdateParty(party.id, {
                                      type: value as ApprovalChainParty['type'],
                                    })
                                  }
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="client">Client</SelectItem>
                                    <SelectItem value="agency">Agency</SelectItem>
                                    <SelectItem value="company">Company</SelectItem>
                                    <SelectItem value="contractor">Contractor</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Organization Name */}
                              <div>
                                <Label className="text-xs text-gray-500">Organization</Label>
                                <Input
                                  value={party.organizationName || ''}
                                  onChange={(e) =>
                                    handleUpdateParty(party.id, {
                                      organizationName: e.target.value,
                                    })
                                  }
                                  placeholder="e.g., Acme Corp"
                                  className="mt-1"
                                />
                              </div>

                              {/* Role */}
                              <div>
                                <Label className="text-xs text-gray-500">Role/Title</Label>
                                <Input
                                  value={party.role}
                                  onChange={(e) =>
                                    handleUpdateParty(party.id, { role: e.target.value })
                                  }
                                  placeholder="e.g., Project Manager"
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveParty(party.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Permissions */}
                        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`approve-${party.id}`}
                              checked={party.canApprove}
                              onCheckedChange={(checked) =>
                                handleUpdateParty(party.id, { canApprove: !!checked })
                              }
                            />
                            <Label htmlFor={`approve-${party.id}`} className="text-sm">
                              Can Approve
                            </Label>
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`rates-${party.id}`}
                              checked={party.canViewRates}
                              onCheckedChange={(checked) =>
                                handleUpdateParty(party.id, { canViewRates: !!checked })
                              }
                            />
                            <Label htmlFor={`rates-${party.id}`} className="text-sm">
                              Can View Rates
                            </Label>
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-${party.id}`}
                              checked={party.canEditTimesheets}
                              onCheckedChange={(checked) =>
                                handleUpdateParty(party.id, {
                                  canEditTimesheets: !!checked,
                                })
                              }
                            />
                            <Label htmlFor={`edit-${party.id}`} className="text-sm">
                              Can Edit Timesheets
                            </Label>
                          </div>
                        </div>

                        {/* Notification Email */}
                        <div className="mt-3">
                          <Label className="text-xs text-gray-500">
                            Notification Email (Optional)
                          </Label>
                          <Input
                            value={party.notificationEmail || ''}
                            onChange={(e) =>
                              handleUpdateParty(party.id, {
                                notificationEmail: e.target.value,
                              })
                            }
                            placeholder="email@example.com"
                            type="email"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* Contracts Tab */}
          {activeTab === 'contracts' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-gray-900">Contractor Contracts</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Add contractors and define their rates and permissions
                  </p>
                </div>
                <Button onClick={handleAddContract} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contract
                </Button>
              </div>

              {/* Contracts List */}
              <div className="space-y-4">
                {contracts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <User className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>No contracts added yet</p>
                    <p className="text-sm mt-1">Click "Add Contract" to add a contractor</p>
                  </div>
                ) : (
                  contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-4">
                          {/* Contractor Info */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-gray-500">Contractor Name</Label>
                              <Input
                                value={contract.contractorName}
                                onChange={(e) =>
                                  handleUpdateContract(contract.id, {
                                    contractorName: e.target.value,
                                  })
                                }
                                placeholder="e.g., John Doe"
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-gray-500">Contractor Role</Label>
                              <Select
                                value={contract.contractorRole}
                                onValueChange={(value) =>
                                  handleUpdateContract(contract.id, {
                                    contractorRole: value as ProjectContractConfig['contractorRole'],
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="individual_contributor">
                                    Individual Contributor
                                  </SelectItem>
                                  <SelectItem value="company_employee">
                                    Company Employee
                                  </SelectItem>
                                  <SelectItem value="agency_contractor">
                                    Agency Contractor
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Contract Details */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs text-gray-500">Contract Type</Label>
                              <Select
                                value={contract.contractType}
                                onValueChange={(value) =>
                                  handleUpdateContract(contract.id, {
                                    contractType: value as ProjectContractConfig['contractType'],
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hourly">Hourly</SelectItem>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="fixed">Fixed Price</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {contract.contractType === 'hourly' && (
                              <div>
                                <Label className="text-xs text-gray-500">Hourly Rate ($)</Label>
                                <Input
                                  type="number"
                                  value={contract.hourlyRate || ''}
                                  onChange={(e) =>
                                    handleUpdateContract(contract.id, {
                                      hourlyRate: parseFloat(e.target.value),
                                    })
                                  }
                                  placeholder="150"
                                  className="mt-1"
                                />
                              </div>
                            )}

                            {contract.contractType === 'daily' && (
                              <div>
                                <Label className="text-xs text-gray-500">Daily Rate ($)</Label>
                                <Input
                                  type="number"
                                  value={contract.dailyRate || ''}
                                  onChange={(e) =>
                                    handleUpdateContract(contract.id, {
                                      dailyRate: parseFloat(e.target.value),
                                    })
                                  }
                                  placeholder="1200"
                                  className="mt-1"
                                />
                              </div>
                            )}

                            {contract.contractType === 'fixed' && (
                              <div>
                                <Label className="text-xs text-gray-500">
                                  Fixed Amount ($)
                                </Label>
                                <Input
                                  type="number"
                                  value={contract.fixedAmount || ''}
                                  onChange={(e) =>
                                    handleUpdateContract(contract.id, {
                                      fixedAmount: parseFloat(e.target.value),
                                    })
                                  }
                                  placeholder="50000"
                                  className="mt-1"
                                />
                              </div>
                            )}

                            <div>
                              <Label className="text-xs text-gray-500">Start Date</Label>
                              <Input
                                type="date"
                                value={contract.startDate}
                                onChange={(e) =>
                                  handleUpdateContract(contract.id, {
                                    startDate: e.target.value,
                                  })
                                }
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-gray-500">
                                End Date (Optional)
                              </Label>
                              <Input
                                type="date"
                                value={contract.endDate || ''}
                                onChange={(e) =>
                                  handleUpdateContract(contract.id, {
                                    endDate: e.target.value,
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Rate Visibility */}
                          <div>
                            <Label className="text-xs text-gray-500 mb-2 block">
                              Hide Rate From
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {approvalChain.map((party) => (
                                <div key={party.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`hide-${contract.id}-${party.id}`}
                                    checked={contract.hideRateFrom.includes(party.id)}
                                    onCheckedChange={(checked) => {
                                      const hideRateFrom = checked
                                        ? [...contract.hideRateFrom, party.id]
                                        : contract.hideRateFrom.filter((id) => id !== party.id);
                                      handleUpdateContract(contract.id, { hideRateFrom });
                                    }}
                                  />
                                  <Label
                                    htmlFor={`hide-${contract.id}-${party.id}`}
                                    className="text-sm"
                                  >
                                    {party.organizationName || party.role || 'Unnamed Party'}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <Label className="text-xs text-gray-500">Notes (Optional)</Label>
                            <Textarea
                              value={contract.notes || ''}
                              onChange={(e) =>
                                handleUpdateContract(contract.id, { notes: e.target.value })
                              }
                              placeholder="Any additional notes about this contract"
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveContract(contract.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Project Settings</h3>

              <div className="space-y-6">
                {/* Approval Settings */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Approval Workflow
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="sequential">Sequential Approval Required</Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Approvals must happen in the order defined in the chain
                        </p>
                      </div>
                      <Switch
                        id="sequential"
                        checked={settings.requireSequentialApproval}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, requireSequentialApproval: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="bulk">Allow Bulk Approval</Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Approvers can approve multiple timesheets at once
                        </p>
                      </div>
                      <Switch
                        id="bulk"
                        checked={settings.allowBulkApproval}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, allowBulkApproval: checked })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="threshold">
                        Auto-Approve Threshold (Optional)
                      </Label>
                      <p className="text-sm text-gray-500 mt-1 mb-2">
                        Automatically approve timesheets under this many hours
                      </p>
                      <Input
                        id="threshold"
                        type="number"
                        value={settings.autoApproveThreshold || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            autoApproveThreshold: parseFloat(e.target.value) || undefined,
                          })
                        }
                        placeholder="e.g., 40"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Invoicing Settings */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Invoicing</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="monthly">Monthly Invoicing</Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Generate invoices monthly instead of weekly
                        </p>
                      </div>
                      <Switch
                        id="monthly"
                        checked={settings.monthlyInvoicing}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, monthlyInvoicing: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-500">
            {approvalChain.length} parties • {contracts.length} contracts
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {/* Editing an existing project saves name/description on their own;
                the parties list may still be loading or have failed to load, and
                must not block a rename. A new project still needs a party. */}
            <Button
              onClick={handleSave}
              disabled={!projectName.trim() || (!project && approvalChain.length === 0)}
              title={!projectName.trim() ? 'Add a project name' : undefined}
            >
              {project ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
