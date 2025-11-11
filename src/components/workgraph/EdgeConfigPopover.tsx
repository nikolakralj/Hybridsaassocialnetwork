import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Info, Lightbulb, AlertTriangle } from 'lucide-react';
import { 
  EDGE_TYPES, 
  getRecommendedEdgeTypes, 
  getDefaultEdgeType,
  getEdgeDescription,
  validateEdgeType
} from '../../utils/workgraph/edge-type-rules';

interface EdgeConfigPopoverProps {
  open: boolean;
  sourceNode: any;
  targetNode: any;
  onSave: (edgeData: any) => void;
  onCancel: () => void;
}

export function EdgeConfigPopover({
  open,
  sourceNode,
  targetNode,
  onSave,
  onCancel,
}: EdgeConfigPopoverProps) {
  // Get smart default based on node types
  const defaultEdgeType = getDefaultEdgeType(
    sourceNode?.type || 'party',
    targetNode?.type || 'party',
    sourceNode?.data,
    targetNode?.data
  );
  
  const [edgeType, setEdgeType] = useState<string>(defaultEdgeType);
  const [order, setOrder] = useState<number>(1);
  const [amount, setAmount] = useState<string>('');
  const [markup, setMarkup] = useState<string>('');

  // Get recommendations for this connection
  const suggestions = getRecommendedEdgeTypes(
    sourceNode?.type || 'party',
    targetNode?.type || 'party',
    sourceNode?.data,
    targetNode?.data
  );

  // Validate current edge type selection
  const validation = validateEdgeType(
    sourceNode?.type || 'party',
    targetNode?.type || 'party',
    edgeType,
    sourceNode?.data,
    targetNode?.data
  );

  // Update default when nodes change
  useEffect(() => {
    if (sourceNode && targetNode) {
      const newDefault = getDefaultEdgeType(
        sourceNode.type,
        targetNode.type,
        sourceNode.data,
        targetNode.data
      );
      setEdgeType(newDefault);
    }
  }, [sourceNode?.id, targetNode?.id]);

  const handleSave = () => {
    const data: any = { edgeType };

    if (edgeType === 'approves') {
      data.order = order;
      data.required = true;
    } else if (edgeType === 'funds') {
      data.amount = parseFloat(amount) || 0;
      data.fundingType = 'direct';
    } else if (edgeType === 'subcontracts') {
      data.role = 'sub';
      data.markup = parseFloat(markup) || 0;
    }

    onSave(data);
  };

  const isRecommended = suggestions.edgeTypes.includes(edgeType);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Edge Connection</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Define how {sourceNode?.data?.name} connects to {targetNode?.data?.name}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Connection preview */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Badge variant="outline" className="font-medium">
              {sourceNode?.data?.name || 'Source'}
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="font-medium">
              {targetNode?.data?.name || 'Target'}
            </Badge>
          </div>

          {/* Recommendations banner */}
          {suggestions.edgeTypes.length > 0 && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Recommended for this connection:</div>
                <div className="text-sm text-muted-foreground mb-2">{suggestions.reasoning}</div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.edgeTypes.slice(0, 3).map((type) => (
                    <Badge 
                      key={type}
                      variant={edgeType === type ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setEdgeType(type)}
                    >
                      <span 
                        className="w-2 h-2 rounded-full mr-1.5" 
                        style={{ backgroundColor: EDGE_TYPES[type]?.color }}
                      />
                      {EDGE_TYPES[type]?.label}
                    </Badge>
                  ))}
                </div>
                {suggestions.examples && suggestions.examples.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground italic">
                    Example: {suggestions.examples[0]}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Warning for unusual edge type */}
          {validation.warning && !isRecommended && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                {validation.warning}
              </AlertDescription>
            </Alert>
          )}

          {/* Edge Type Selector */}
          <div>
            <Label htmlFor="edgeType" className="text-base">Relationship Type</Label>
            <Select value={edgeType} onValueChange={setEdgeType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(EDGE_TYPES).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: type.color }}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Edge description */}
            <div className="mt-2 p-3 bg-muted rounded-md">
              <p className="text-sm">
                <Info className="h-3.5 w-3.5 inline mr-1.5 text-blue-600" />
                {getEdgeDescription(
                  edgeType, 
                  sourceNode?.data?.name || 'Source',
                  targetNode?.data?.name || 'Target'
                )}
              </p>
            </div>
          </div>

          {/* Approval-specific fields */}
          {edgeType === 'approves' && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="font-medium text-sm">Approval Configuration</span>
              </div>
              
              <div>
                <Label htmlFor="order">Approval Order (Step Number)</Label>
                <Input
                  id="order"
                  type="number"
                  min="1"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This is step {order} in the approval sequence. Lower numbers are approved first.
                </p>
              </div>
            </div>
          )}

          {/* Funds-specific fields */}
          {edgeType === 'funds' && (
            <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium text-sm">Funding Configuration</span>
              </div>
              
              <div>
                <Label htmlFor="amount">Funding Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="e.g., 100000"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Specify budget or funding amount for tracking purposes
                </p>
              </div>
            </div>
          )}

          {/* Subcontract-specific fields */}
          {edgeType === 'subcontracts' && (
            <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="font-medium text-sm">Subcontract Configuration</span>
              </div>
              
              <div>
                <Label htmlFor="markup">Markup Percentage</Label>
                <Input
                  id="markup"
                  type="number"
                  min="0"
                  max="100"
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="e.g., 15"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Prime contractor's markup on subcontractor rates (0-100%)
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <span 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: EDGE_TYPES[edgeType]?.color }}
            />
            Create {EDGE_TYPES[edgeType]?.label} Edge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}