// ============================================================================
// MyContractsPanel - Main contract dashboard (local scope visibility)
// ============================================================================

import React, { useState } from 'react';
import { useProjectContracts, useCategorizedContracts, useContractMargin } from '../../hooks/useProjectContracts';
import { ContractCard } from './ContractCard';
import { InvitationInbox } from './InvitationInbox';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Plus, 
  TrendingUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface MyContractsPanelProps {
  projectId: string;
  viewerOrgId: string;
  onCreateContract?: () => void;
  onViewDetails?: (contractId: string) => void;
}

export function MyContractsPanel({
  projectId,
  viewerOrgId,
  onCreateContract,
  onViewDetails,
}: MyContractsPanelProps) {
  const {
    contracts,
    invitations,
    loading,
    error,
    acceptInvitation,
    declineInvitation,
    requestContractDisclosure,
  } = useProjectContracts({
    projectId,
    viewerOrgId,
  });

  const { upstream, downstream, disclosed } = useCategorizedContracts(contracts);
  const margin = useContractMargin(contracts);

  const [selectedTab, setSelectedTab] = useState<'all' | 'upstream' | 'downstream'>('all');

  // Handle disclosure request
  const handleRequestDisclosure = async (contractId: string) => {
    try {
      await requestContractDisclosure(contractId, 'Request for compliance review');
      // Show success toast
    } catch (err) {
      console.error('Failed to request disclosure:', err);
      // Show error toast
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-red-200 rounded-lg bg-red-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Contracts</h3>
            <p className="text-sm text-red-700 mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalContracts = contracts.length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">My Contracts</h2>
          <p className="text-sm text-gray-500 mt-1">
            {activeContracts} active contract{activeContracts !== 1 ? 's' : ''} • 
            {totalContracts} total
          </p>
        </div>

        <Button onClick={onCreateContract} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Contract
        </Button>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <InvitationInbox
          invitations={invitations}
          onAccept={acceptInvitation}
          onDecline={declineInvitation}
        />
      )}

      {/* Margin Summary (for agencies) */}
      {margin && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Margin Analysis</h3>
              </div>
              <Badge className="bg-green-600 text-white">
                {margin.margin_percentage.toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-green-700">Selling Rate</p>
                <p className="text-lg font-semibold text-green-900">
                  ${margin.selling_rate.toFixed(2)}/hr
                </p>
              </div>
              <div>
                <p className="text-xs text-green-700">Buying Rate</p>
                <p className="text-lg font-semibold text-green-900">
                  ${margin.buying_rate.toFixed(2)}/hr
                </p>
              </div>
              <div>
                <p className="text-xs text-green-700">Margin</p>
                <p className="text-lg font-semibold text-green-900">
                  ${margin.margin_amount.toFixed(2)}/hr
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contracts Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            All
            <Badge variant="secondary">{totalContracts}</Badge>
          </TabsTrigger>
          <TabsTrigger value="upstream" className="flex items-center gap-2">
            <ArrowDown className="w-3 h-3" />
            Vendors
            <Badge variant="secondary">{upstream.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="downstream" className="flex items-center gap-2">
            <ArrowUp className="w-3 h-3" />
            Customers
            <Badge variant="secondary">{downstream.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* All Contracts */}
        <TabsContent value="all" className="mt-4">
          {contracts.length === 0 ? (
            <EmptyState
              title="No contracts yet"
              description="Create your first contract to get started."
              onAction={onCreateContract}
              actionLabel="Create Contract"
            />
          ) : (
            <div className="grid gap-4">
              {contracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onViewDetails={onViewDetails}
                  onRequestDisclosure={handleRequestDisclosure}
                  showMargin={false}
                />
              ))}

              {/* Disclosed contracts (if any) */}
              {disclosed.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Disclosed Contracts ({disclosed.length})
                  </h3>
                  <div className="grid gap-4">
                    {disclosed.map((contract) => (
                      <ContractCard
                        key={contract.id}
                        contract={contract}
                        onViewDetails={onViewDetails}
                        showMargin={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Vendor Contracts (Upstream - I'm buying) */}
        <TabsContent value="upstream" className="mt-4">
          {upstream.length === 0 ? (
            <EmptyState
              title="No vendor contracts"
              description="Add vendors to your project to see their contracts here."
            />
          ) : (
            <div className="grid gap-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-2">
                <p className="text-sm text-blue-800">
                  <strong>Vendors:</strong> Companies you buy services from. You see their rates and workers.
                </p>
              </div>

              {upstream.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onViewDetails={onViewDetails}
                  onRequestDisclosure={handleRequestDisclosure}
                  showMargin={false}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Customer Contracts (Downstream - I'm selling) */}
        <TabsContent value="downstream" className="mt-4">
          {downstream.length === 0 ? (
            <EmptyState
              title="No customer contracts"
              description="Add customers to your project to see their contracts here."
            />
          ) : (
            <div className="grid gap-4">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-2">
                <p className="text-sm text-green-800">
                  <strong>Customers:</strong> Companies you sell services to. They see your rates and deliverables.
                </p>
              </div>

              {downstream.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onViewDetails={onViewDetails}
                  showMargin={false}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Local Scope Explanation */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-700">Local Scope Visibility</p>
              <p className="mt-1">
                You see only your direct contracts. Your vendors' sub-vendors are hidden unless explicitly disclosed.
                This ensures privacy and clarity in multi-party projects.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  title: string;
  description: string;
  onAction?: () => void;
  actionLabel?: string;
}

function EmptyState({ title, description, onAction, actionLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Eye className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{description}</p>
      {onAction && actionLabel && (
        <Button onClick={onAction} variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
