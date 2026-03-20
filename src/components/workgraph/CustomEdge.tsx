import React from 'react';
// Legacy edge component (not used by active SVG engine). Stub reactflow deps.
type EdgeProps = any;
function getBezierPath(params: any): [string, number, number] {
  const { sourceX, sourceY, targetX, targetY } = params;
  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;
  return [`M ${sourceX} ${sourceY} C ${mx} ${sourceY}, ${mx} ${targetY}, ${targetX} ${targetY}`, mx, my];
}
import { Badge } from '../ui/badge';

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.edgeType || 'approves';
  
  // Get edge style based on type
  const getEdgeStyle = () => {
    const baseStyle = { ...style };
    
    switch (edgeType) {
      case 'approves':
        return {
          ...baseStyle,
          stroke: '#3b82f6', // blue
          strokeWidth: 2,
          strokeDasharray: '5,5',
        };
      case 'funds':
        return {
          ...baseStyle,
          stroke: '#10b981', // green
          strokeWidth: 3,
          strokeDasharray: '0',
        };
      case 'subcontracts':
        return {
          ...baseStyle,
          stroke: '#8b5cf6', // purple
          strokeWidth: 2,
          strokeDasharray: '5,5',
        };
      case 'billsTo':
        return {
          ...baseStyle,
          stroke: '#f59e0b', // orange
          strokeWidth: 3,
          strokeDasharray: '0',
        };
      case 'assigns':
        return {
          ...baseStyle,
          stroke: '#6366f1', // indigo
          strokeWidth: 1.5,
          strokeDasharray: '3,3',
        };
      case 'worksOn':
        return {
          ...baseStyle,
          stroke: '#64748b', // gray
          strokeWidth: 1,
          strokeDasharray: '0',
        };
      default:
        return baseStyle;
    }
  };

  // Get badge color
  const getBadgeClass = () => {
    switch (edgeType) {
      case 'approves':
        return 'bg-blue-100 border-blue-300 text-blue-700';
      case 'funds':
        return 'bg-green-100 border-green-300 text-green-700';
      case 'subcontracts':
        return 'bg-purple-100 border-purple-300 text-purple-700';
      case 'billsTo':
        return 'bg-orange-100 border-orange-300 text-orange-700';
      case 'assigns':
        return 'bg-indigo-100 border-indigo-300 text-indigo-700';
      case 'worksOn':
        return 'bg-gray-100 border-gray-300 text-gray-700';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  // Get label text
  const getLabelText = () => {
    if (edgeType === 'approves' && data?.order) {
      return `${edgeType} (${data.order})`;
    }
    if (edgeType === 'funds' && data?.amount) {
      return `${edgeType} ($${data.amount.toLocaleString()})`;
    }
    if (edgeType === 'subcontracts' && data?.markup) {
      return `${edgeType} (+${data.markup}%)`;
    }
    return edgeType;
  };

  return (
    <>
      <path
        id={id}
        style={getEdgeStyle()}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <foreignObject
        width={120}
        height={40}
        x={labelX - 60}
        y={labelY - 20}
        className="overflow-visible"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div className="flex items-center justify-center">
          <Badge 
            variant="outline" 
            className={`text-xs px-2 py-0.5 shadow-md ${getBadgeClass()}`}
          >
            {getLabelText()}
          </Badge>
        </div>
      </foreignObject>
    </>
  );
}