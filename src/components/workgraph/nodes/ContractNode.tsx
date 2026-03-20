import React, { memo } from 'react';
// Legacy node component (not used by active SVG engine). Stub reactflow deps.
const Handle = ({ type, position, className }: any) => <div className={className} />;
const Position = { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' } as const;
import { FileText, Lock } from 'lucide-react';

export const ContractNode = memo(({ data }: any) => {
  const getRate = () => {
    switch (data.contractType) {
      case 'hourly':
        return data.hourlyRate ? `$${data.hourlyRate}/hr` : 'Rate not set';
      case 'daily':
        return data.dailyRate ? `$${data.dailyRate}/day` : 'Rate not set';
      case 'fixed':
        return data.fixedAmount ? `$${data.fixedAmount.toLocaleString()}` : 'Amount not set';
      default:
        return 'Custom';
    }
  };

  const hasHiddenRates = data.visibility?.hideRateFrom?.length > 0;

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-yellow-400 bg-yellow-50 min-w-[180px] shadow-md">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-5 w-5 text-yellow-600" />
        <div className="flex-1">
          <div className="font-medium text-gray-900">{data.name}</div>
          <div className="text-xs text-gray-600 capitalize">{data.contractType}</div>
        </div>
        {hasHiddenRates && (
          <Lock className="h-4 w-4 text-gray-500" title="Rate visibility restricted" />
        )}
      </div>

      <div className="text-sm font-medium text-gray-900 mt-1">
        {getRate()}
      </div>

      {data.startDate && (
        <div className="text-xs text-gray-600 mt-2">
          Start: {new Date(data.startDate).toLocaleDateString()}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  );
});

ContractNode.displayName = 'ContractNode';