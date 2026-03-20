import React, { memo } from 'react';
// Legacy node component (not used by active SVG engine). Stub reactflow deps.
const Handle = ({ type, position, className }: any) => <div className={className} />;
const Position = { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' } as const;
import { User } from 'lucide-react';

export const PersonNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-green-400 bg-green-50 min-w-[160px] shadow-md">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
          <User className="h-4 w-4 text-green-700" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900 text-sm">{data.name}</div>
        </div>
      </div>

      {data.role && (
        <div className="text-xs text-gray-600 mt-1 ml-10">
          {data.role}
        </div>
      )}

      {data.email && (
        <div className="text-xs text-gray-500 mt-1 ml-10">
          {data.email}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  );
});

PersonNode.displayName = 'PersonNode';