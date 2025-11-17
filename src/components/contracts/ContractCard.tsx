// ============================================================================
// ContractCard - Display individual contract with relationship context
// ============================================================================

import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  ArrowUp, 
  ArrowDown, 
  Users, 
  DollarSign, 
  Calendar,
  Eye,
  AlertCircle,
} from 'lucide-react';
import type { ViewerContract } from '../../types/project-contracts';

interface ContractCardProps {
  contract: ViewerContract;
  onViewDetails?: (contractId: string) => void;
  onRequestDisclosure?: (contractId: string) => void;
  showMargin?: boolean;
}

export function ContractCard({
  contract,
  onViewDetails,
  onRequestDisclosure,
  showMargin = false,
}: ContractCardProps) {
  const isSelling = contract.relationship === 'selling';
  const isBuying = contract.relationship === 'buying';
  const isDisclosed = contract.relationship === 'disclosed';

  // Determine counterparty info
  const counterpartyOrg = contract.counterparty_org;
  const direction = isSelling ? 'Customer' : isBuying ? 'Vendor' : 'Partner';
  const directionIcon = isSelling ? ArrowUp : isBuying ? ArrowDown : Eye;
  const directionColor = isSelling ? 'text-green-600' : isBuying ? 'text-blue-600' : 'text-purple-600';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {/* Left: Direction + Org */}
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-gray-50 ${directionColor}`}>
              {React.createElement(directionIcon, { className: "w-5 h-5" })}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {direction}
                </span>
                {isDisclosed && (
                  <Badge variant="outline" className="text-xs">
                    <Eye className="w-3 h-3 mr-1" />
                    Disclosed
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold mt-1">
                {counterpartyOrg.logo && (
                  <span className="mr-2">{counterpartyOrg.logo}</span>
                )}
                {counterpartyOrg.name}
              </h3>
              <p className="text-sm text-gray-500 capitalize">
                {counterpartyOrg.type}
              </p>
            </div>
          </div>

          {/* Right: Status badge */}
          <Badge 
            variant={contract.status === 'active' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {contract.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contract Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Rate (if visible) */}
          {contract.rate && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Rate</p>
                <p className="font-semibold">
                  {contract.currency} ${contract.rate.toFixed(2)}/hr
                </p>
              </div>
            </div>
          )}

          {/* Worker Count */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Workers</p>
              <p className="font-semibold">
                {contract.worker_count || 0} active
              </p>
            </div>
          </div>

          {/* Contract Type */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Type</p>
              <p className="font-semibold capitalize">
                {contract.contract_type.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        {/* Margin (for agencies with both buying and selling) */}
        {showMargin && contract.rate && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700">Margin</p>
                <p className="font-semibold text-green-800">
                  Calculated from contracts
                </p>
              </div>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        )}

        {/* Disclosed indicator */}
        {isDisclosed && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-purple-800">
                  This contract is visible to you via disclosure agreement.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails?.(contract.id)}
            className="flex-1"
          >
            View Details
          </Button>

          {/* Request Disclosure (only for buying relationships where sub might exist) */}
          {isBuying && !contract.disclosed_to_org_id && onRequestDisclosure && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRequestDisclosure(contract.id)}
              className="flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              Request Visibility
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Contract Summary Card (compact version for lists)
// ============================================================================

interface ContractSummaryProps {
  contract: ViewerContract;
  onClick?: () => void;
}

export function ContractSummary({ contract, onClick }: ContractSummaryProps) {
  const isSelling = contract.relationship === 'selling';
  const icon = isSelling ? ArrowUp : ArrowDown;
  const iconColor = isSelling ? 'text-green-600' : 'text-blue-600';

  return (
    <button
      onClick={onClick}
      className="w-full p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {React.createElement(icon, { className: `w-4 h-4 ${iconColor}` })}
          <div>
            <p className="font-medium">
              {contract.counterparty_org.logo && (
                <span className="mr-2">{contract.counterparty_org.logo}</span>
              )}
              {contract.counterparty_org.name}
            </p>
            <p className="text-sm text-gray-500">
              {contract.rate ? `$${contract.rate}/hr` : contract.contract_type}
            </p>
          </div>
        </div>

        <div className="text-right">
          <Badge variant="outline" className="text-xs">
            {contract.worker_count || 0} workers
          </Badge>
        </div>
      </div>
    </button>
  );
}
