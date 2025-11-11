/**
 * Edge Type Guide
 * 
 * Visual reference showing all edge types and when to use them.
 * Helps users understand the semantic meaning of different connections.
 */

import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { 
  ArrowRight,
  Building2, 
  User, 
  FileText,
  Wallet,
  Info
} from 'lucide-react';
import { EDGE_TYPES, EDGE_TYPE_EXAMPLES } from '../../utils/workgraph/edge-type-rules';

interface EdgeTypeGuideProps {
  open: boolean;
  onClose: () => void;
}

export function EdgeTypeGuide({ open, onClose }: EdgeTypeGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Edge Type Reference Guide</DialogTitle>
          <DialogDescription>
            Learn when to use each edge type when connecting nodes in your WorkGraph
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6 pb-4">
            {/* Edge Types */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Available Edge Types</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(EDGE_TYPES).map((edgeType) => (
                  <div 
                    key={edgeType.id}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: edgeType.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{edgeType.label}</h4>
                          {edgeType.animated && (
                            <Badge variant="outline" className="text-xs">Animated</Badge>
                          )}
                          {edgeType.dashed && (
                            <Badge variant="outline" className="text-xs">Dashed</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {edgeType.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="bg-muted px-2 py-1 rounded">
                            {edgeType.sourceLabel}
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="bg-muted px-2 py-1 rounded">
                            {edgeType.targetLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Real-World Examples */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Common Scenarios</h3>
              <div className="space-y-3">
                {Object.entries(EDGE_TYPE_EXAMPLES).map(([scenario, example]) => {
                  const edgeType = EDGE_TYPES[example.edgeType];
                  return (
                    <div 
                      key={scenario}
                      className="p-4 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">{scenario}</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            {example.description}
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">{example.source}</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge 
                              className="gap-1.5"
                              style={{ 
                                backgroundColor: edgeType?.color,
                                color: 'white',
                                borderColor: edgeType?.color
                              }}
                            >
                              {edgeType?.label}
                            </Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="outline">{example.target}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Reference Table */}
            <div>
              <h3 className="font-semibold text-lg mb-3">Quick Reference by Node Type</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-semibold">From</th>
                      <th className="text-left p-3 font-semibold">To</th>
                      <th className="text-left p-3 font-semibold">Recommended Edge Types</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          Person
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          Company
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <EdgeBadge type="worksOn" />
                          <EdgeBadge type="reportsTo" />
                          <EdgeBadge type="submitsExpensesTo" />
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          Company
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          Person
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <EdgeBadge type="assigns" />
                          <EdgeBadge type="approves" />
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          Company
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          Company
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <EdgeBadge type="subcontracts" />
                          <EdgeBadge type="funds" />
                          <EdgeBadge type="billsTo" />
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Contract
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          Company
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <EdgeBadge type="billsTo" />
                          <EdgeBadge type="funds" />
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          Expense
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          Person
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <EdgeBadge type="submitsExpensesTo" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                Pro Tips
              </h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground ml-6 list-disc">
                <li>The system will automatically recommend edge types based on what you're connecting</li>
                <li>Use <strong>Approves</strong> for timesheet approval flows (direction matters!)</li>
                <li>Use <strong>Funds</strong> to track budget and money flow</li>
                <li>Use <strong>Subcontracts</strong> when one company hires another</li>
                <li>Use <strong>Bills To</strong> for invoice routing</li>
                <li>Use <strong>Assigns</strong> when companies assign people to projects</li>
                <li>Animated edges (like Approves) indicate active workflows</li>
              </ul>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for edge type badges in table
function EdgeBadge({ type }: { type: string }) {
  const edgeType = EDGE_TYPES[type];
  if (!edgeType) return null;
  
  return (
    <Badge 
      variant="outline" 
      className="text-xs gap-1.5 border-2"
      style={{ borderColor: edgeType.color }}
    >
      <span 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: edgeType.color }}
      />
      {edgeType.label}
    </Badge>
  );
}
