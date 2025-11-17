// ============================================================================
// ContractsDemoPage - Demo page for Local Scope Visibility UI
// ============================================================================

import React from 'react';
import { MyContractsPanel } from './MyContractsPanel';
import { MigrationRunner } from './MigrationRunner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { 
  Eye, 
  Building2, 
  Users,
  ArrowRight,
  Info,
} from 'lucide-react';

/**
 * Demo page showing Local Scope Visibility in action
 * 
 * This page demonstrates how different organizations see different
 * views of the same project based on their contract relationships.
 * 
 * Example Scenario:
 * - Client (Acme Inc) → Agency (TechCorp) @ $150/hr
 * - Agency (TechCorp) → Sub (DevShop) @ $85/hr
 * - Agency margin: $65/hr (43%)
 */
export function ContractsDemoPage() {
  // In production, these would come from auth context
  const [selectedOrg, setSelectedOrg] = React.useState<'client' | 'agency' | 'sub'>('agency');

  const projectId = 'demo-project-123';
  
  // Mock org IDs
  const orgIds = {
    client: '11111111-1111-1111-1111-111111111111',
    agency: '22222222-2222-2222-2222-222222222222',
    sub: '33333333-3333-3333-3333-333333333333',
  };

  const orgNames = {
    client: 'Acme Inc (Client)',
    agency: 'TechCorp Agency',
    sub: 'DevShop Subcontractor',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Local Scope Visibility</h1>
          <p className="text-gray-600">
            Each organization sees only their direct contracts. No complex masking needed.
          </p>
        </div>

        {/* Migration Runner */}
        <MigrationRunner />

        {/* Info Banner */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">
                  How Local Scope Works
                </h3>
                <p className="text-sm text-blue-800 mb-3">
                  Each organization sees a "projection" of the project based on their
                  contracts. This matches how real businesses work - you manage your
                  relationships, not everyone else's.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 mb-1">CLIENT SEES</p>
                    <p className="text-sm font-medium text-blue-900">
                      Agency only
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Sub is hidden
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 mb-1">AGENCY SEES</p>
                    <p className="text-sm font-medium text-blue-900">
                      Client + Sub
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Both contracts visible
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 mb-1">SUB SEES</p>
                    <p className="text-sm font-medium text-blue-900">
                      Agency only
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Client is hidden
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Org Selector */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5" />
              View as Organization
            </h3>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedOrg} onValueChange={(v) => setSelectedOrg(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="client" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Acme Inc
                  <Badge variant="outline" className="ml-1">Client</Badge>
                </TabsTrigger>
                <TabsTrigger value="agency" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  TechCorp
                  <Badge variant="outline" className="ml-1">Agency</Badge>
                </TabsTrigger>
                <TabsTrigger value="sub" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  DevShop
                  <Badge variant="outline" className="ml-1">Sub</Badge>
                </TabsTrigger>
              </TabsList>

              {/* Client View */}
              <TabsContent value="client" className="mt-6">
                <ViewExplanation
                  orgName="Acme Inc (Client)"
                  canSee={['TechCorp Agency @ $150/hr']}
                  cannotSee={['DevShop Subcontractor', 'Agency→Sub contract', 'Sub workers']}
                  reason="You only see your direct vendor (Agency). Their subcontractors are hidden unless disclosed."
                />
                <div className="mt-6">
                  <MyContractsPanel
                    projectId={projectId}
                    viewerOrgId={orgIds.client}
                  />
                </div>
              </TabsContent>

              {/* Agency View */}
              <TabsContent value="agency" className="mt-6">
                <ViewExplanation
                  orgName="TechCorp Agency"
                  canSee={[
                    'Acme Inc (Client) @ $150/hr',
                    'DevShop Sub @ $85/hr',
                    'All workers (yours + sub\'s)',
                    'Margin calculation ($65/hr)'
                  ]}
                  cannotSee={['Client\'s other vendors', 'Sub\'s other customers']}
                  reason="You see both your customer (upstream) and your vendor (downstream). You can calculate margins and manage the full chain."
                  highlight="💰 Margin: $150 - $85 = $65/hr (43%)"
                />
                <div className="mt-6">
                  <MyContractsPanel
                    projectId={projectId}
                    viewerOrgId={orgIds.agency}
                  />
                </div>
              </TabsContent>

              {/* Sub View */}
              <TabsContent value="sub" className="mt-6">
                <ViewExplanation
                  orgName="DevShop Subcontractor"
                  canSee={['TechCorp Agency @ $85/hr', 'Your assigned workers']}
                  cannotSee={['Acme Inc (Client)', 'Client→Agency contract', 'Client rate ($150/hr)']}
                  reason="You only see your direct customer (Agency). The end client is hidden - you work through the agency."
                />
                <div className="mt-6">
                  <MyContractsPanel
                    projectId={projectId}
                    viewerOrgId={orgIds.sub}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Visualization */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Contract Chain Visualization</h3>
          </CardHeader>
          <CardContent>
            <ContractChainVisualization selectedOrg={selectedOrg} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// View Explanation Component
// ============================================================================

interface ViewExplanationProps {
  orgName: string;
  canSee: string[];
  cannotSee: string[];
  reason: string;
  highlight?: string;
}

function ViewExplanation({
  orgName,
  canSee,
  cannotSee,
  reason,
  highlight,
}: ViewExplanationProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-5 h-5 text-blue-600" />
        <h4 className="font-semibold">Viewing as: {orgName}</h4>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Can See */}
        <div className="p-4 border border-green-200 rounded-lg bg-green-50">
          <p className="font-medium text-green-900 mb-2">✅ Visible to you:</p>
          <ul className="space-y-1">
            {canSee.map((item, i) => (
              <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cannot See */}
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
          <p className="font-medium text-gray-900 mb-2">❌ Hidden from you:</p>
          <ul className="space-y-1">
            {cannotSee.map((item, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {highlight && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900">{highlight}</p>
        </div>
      )}

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Why?</strong> {reason}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Contract Chain Visualization
// ============================================================================

function ContractChainVisualization({ 
  selectedOrg 
}: { 
  selectedOrg: 'client' | 'agency' | 'sub' 
}) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-4">
        {/* Client */}
        <OrgBox
          name="Acme Inc"
          type="Client"
          logo="🏢"
          visible={selectedOrg === 'client' || selectedOrg === 'agency'}
          isViewer={selectedOrg === 'client'}
        />

        <ArrowRight className={`w-6 h-6 ${
          selectedOrg === 'client' || selectedOrg === 'agency' ? 'text-green-600' : 'text-gray-300'
        }`} />

        {/* Contract 1 */}
        <ContractBox
          rate="$150/hr"
          visible={selectedOrg === 'client' || selectedOrg === 'agency'}
        />

        <ArrowRight className={`w-6 h-6 ${
          selectedOrg === 'client' || selectedOrg === 'agency' ? 'text-green-600' : 'text-gray-300'
        }`} />

        {/* Agency */}
        <OrgBox
          name="TechCorp"
          type="Agency"
          logo="🚀"
          visible={true}
          isViewer={selectedOrg === 'agency'}
        />

        <ArrowRight className={`w-6 h-6 ${
          selectedOrg === 'agency' || selectedOrg === 'sub' ? 'text-green-600' : 'text-gray-300'
        }`} />

        {/* Contract 2 */}
        <ContractBox
          rate="$85/hr"
          visible={selectedOrg === 'agency' || selectedOrg === 'sub'}
        />

        <ArrowRight className={`w-6 h-6 ${
          selectedOrg === 'agency' || selectedOrg === 'sub' ? 'text-green-600' : 'text-gray-300'
        }`} />

        {/* Sub */}
        <OrgBox
          name="DevShop"
          type="Sub"
          logo="💻"
          visible={selectedOrg === 'agency' || selectedOrg === 'sub'}
          isViewer={selectedOrg === 'sub'}
        />
      </div>
    </div>
  );
}

function OrgBox({ 
  name, 
  type, 
  logo, 
  visible, 
  isViewer 
}: { 
  name: string;
  type: string;
  logo: string;
  visible: boolean;
  isViewer: boolean;
}) {
  if (!visible) {
    return (
      <div className="w-32 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-100">
        <p className="text-xs text-gray-400 text-center">Hidden</p>
      </div>
    );
  }

  return (
    <div className={`w-32 p-3 border-2 rounded-lg text-center transition-all ${
      isViewer 
        ? 'border-blue-500 bg-blue-50 shadow-lg' 
        : 'border-green-500 bg-green-50'
    }`}>
      <div className="text-2xl mb-1">{logo}</div>
      <p className="font-semibold text-sm">{name}</p>
      <Badge variant="outline" className="text-xs mt-1">
        {type}
      </Badge>
      {isViewer && (
        <Badge className="text-xs mt-1 bg-blue-600 text-white">
          You
        </Badge>
      )}
    </div>
  );
}

function ContractBox({ rate, visible }: { rate: string; visible: boolean }) {
  if (!visible) {
    return (
      <div className="w-24 h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center bg-gray-100">
        <p className="text-xs text-gray-400">Hidden</p>
      </div>
    );
  }

  return (
    <div className="w-24 p-2 border-2 border-green-500 rounded bg-white text-center">
      <p className="text-xs text-gray-500">Contract</p>
      <p className="font-semibold text-sm">{rate}</p>
    </div>
  );
}