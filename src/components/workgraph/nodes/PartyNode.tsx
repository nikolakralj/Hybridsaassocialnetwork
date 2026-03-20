import React, { memo } from 'react';
// Legacy node component (not used by active SVG engine). Stub reactflow deps.
const Handle = ({ type, position, className }: any) => <div className={className} />;
const Position = { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' } as const;
import { Building2, Users, User, Briefcase, Lock } from 'lucide-react';
import { Badge } from '../../ui/badge';

export const PartyNode = memo(({ data, selected }: any) => {
  const getIcon = () => {
    // If there's a logo (emoji), use it
    if (data.logo) {
      return <span className="text-2xl">{data.logo}</span>;
    }
    
    // Otherwise use icon based on type
    switch (data.partyType) {
      case 'client':
        return <Building2 className="h-5 w-5 text-purple-600" />;
      case 'agency':
        return <Users className="h-5 w-5 text-blue-600" />;
      case 'company':
        return <Building2 className="h-5 w-5 text-green-600" />;
      case 'contractor':
        return <User className="h-5 w-5 text-gray-600" />;
      case 'freelancer':
        return <Briefcase className="h-5 w-5 text-indigo-600" />;
      default:
        return <Building2 className="h-5 w-5 text-gray-600" />;
    }
  };

  const getColor = () => {
    switch (data.partyType) {
      case 'client':
        return 'border-purple-400 bg-purple-50';
      case 'agency':
        return 'border-blue-400 bg-blue-50';
      case 'company':
        return 'border-green-400 bg-green-50';
      case 'contractor':
        return 'border-gray-400 bg-gray-50';
      case 'freelancer':
        return 'border-indigo-400 bg-indigo-50';
      default:
        return 'border-gray-400 bg-gray-50';
    }
  };

  const isLocked = data.organizationId; // Locked if attached to existing org
  const cannotViewRates = data.canViewRates === false;

  return (
    <div 
      className={`px-4 py-3 rounded-lg border-2 min-w-[200px] shadow-md ${getColor()} ${
        selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      } relative`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      
      {/* Lock badge if attached to existing org */}
      {isLocked && (
        <div className="absolute -top-2 -right-2 bg-yellow-100 border border-yellow-400 rounded-full p-1">
          <Lock className="h-3 w-3 text-yellow-700" />
        </div>
      )}

      {/* Cannot view rates badge */}
      {cannotViewRates && !isLocked && (
        <div className="absolute -top-2 -right-2 bg-red-100 border border-red-400 rounded-full p-1">
          <Lock className="h-3 w-3 text-red-700" />
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        {/* Avatar/Logo slot */}
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{data.name}</div>
          <div className="text-xs text-gray-600 capitalize">{data.partyType}</div>
        </div>
      </div>

      {data.role && (
        <div className="text-xs text-gray-600 mt-1 truncate">
          {data.role}
        </div>
      )}

      {/* Permissions badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        {data.canApprove && (
          <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
            Can Approve
          </Badge>
        )}
        {data.canViewRates && (
          <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
            See Rates
          </Badge>
        )}
        {cannotViewRates && (
          <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
            No Rates
          </Badge>
        )}
        {data.canEditTimesheets && (
          <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
            Edit TS
          </Badge>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  );
});

PartyNode.displayName = 'PartyNode';