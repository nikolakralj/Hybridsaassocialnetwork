// Test Dashboard - Quick access to all testable features
// Created: 2025-10-31
// Purpose: Comprehensive testing interface for all WorkGraph features

import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Calendar,
  Users,
  FileText,
  Layers,
  Shield,
  Settings,
  Play,
  Book,
  AlertCircle,
  Sparkles,
  Mail
} from 'lucide-react';
import { EmailPreview } from './approvals/EmailPreview'; // ✅ DAY 7: Email templates

interface TestItem {
  id: string;
  name: string;
  route: string;
  description: string;
  status: 'complete' | 'partial' | 'pending';
  icon: any;
  tests: string[];
  implementation: string;
}

export function TestDashboard() {
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Show email preview if requested
  if (showEmailPreview) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Email Template Preview</h1>
              <Button
                variant="outline"
                onClick={() => setShowEmailPreview(false)}
              >
                ← Back to Test Dashboard
              </Button>
            </div>
          </div>
        </div>
        <EmailPreview />
      </div>
    );
  }

  const testSections: { category: string; items: TestItem[] }[] = [
    {
      category: 'Project Management',
      items: [
        {
          id: 'project-wizard',
          name: 'Project Creation Wizard',
          route: 'projects',
          description: '4-step wizard to create collaborative projects',
          status: 'complete',
          icon: FileText,
          implementation: 'M5.1 - Day 1 Complete',
          tests: [
            'Create project with basic info',
            'Add parties to project',
            'Invite collaborators with roles',
            'Review and submit',
            'Check toast confirmation',
            'Verify navigation to builder'
          ]
        },
        {
          id: 'visual-builder',
          name: 'Visual WorkGraph Builder',
          route: 'visual-builder',
          description: 'Drag-and-drop graph builder with nodes & edges',
          status: 'complete',
          icon: Layers,
          implementation: 'Phase A1 Complete',
          tests: [
            'Drag nodes from palette',
            'Connect nodes with edges',
            'Edit node properties',
            'Validate graph structure',
            'Compile to policy JSON',
            'Run policy simulator',
            'Load/save templates'
          ]
        },
        {
          id: 'projects-list',
          name: 'Projects List View',
          route: 'projects',
          description: 'Browse and manage all projects',
          status: 'partial',
          icon: FileText,
          implementation: 'M5.1 - UI Complete',
          tests: [
            'View empty state',
            'Click "New Project" button',
            'See project cards (pending Day 2)',
            'Navigate to project builder',
            'Check custom routing'
          ]
        }
      ]
    },
    {
      category: 'Time & Approvals',
      items: [
        {
          id: 'timesheets',
          name: 'Timesheet System',
          route: 'timesheet-demo',
          description: 'Multi-person calendar with drag & drop',
          status: 'complete',
          icon: Calendar,
          implementation: 'Phases 1-3 Complete',
          tests: [
            'Enter time in calendar',
            'Switch calendar/table view',
            'Drag entries to copy',
            'Multi-person view',
            'Bulk entry "Copy to Others"',
            'Database sync (check console)'
          ]
        },
        {
          id: 'approvals',
          name: '3-Layer Approval System',
          route: 'project-workspace',
          description: 'Contract-grouped approval workflow',
          status: 'complete',
          icon: CheckCircle2,
          implementation: 'Phase 2-3 Complete',
          tests: [
            'View approval queue',
            'Open monthly drawer',
            'Approve/reject timesheets',
            'Batch approval selection',
            'Filter by status/contract',
            'Check grouping by org/contract/person'
          ]
        }
      ]
    },
    {
      category: 'Policy & Permissions',
      items: [
        {
          id: 'policy-simulator',
          name: 'Policy Simulator',
          route: 'visual-builder',
          description: 'Simulate approval flows with test data',
          status: 'complete',
          icon: Play,
          implementation: 'Phase A1 Complete',
          tests: [
            'Open simulator from builder',
            'Enter test scenario inputs',
            'Run simulation',
            'View approval flow visualization',
            'Check masked fields',
            'Verify party perspectives'
          ]
        },
        {
          id: 'permissions',
          name: 'Permission System',
          route: 'projects',
          description: 'Role-based access control',
          status: 'complete',
          icon: Shield,
          implementation: 'M5.1 Complete',
          tests: [
            'Assign Owner/Editor/Viewer roles',
            'Check UI permission gating',
            'Test canUserPerform() checks',
            'Verify role descriptions',
            'Test unauthorized access'
          ]
        }
      ]
    },
    {
      category: 'Onboarding & Navigation',
      items: [
        {
          id: 'onboarding',
          name: 'Multi-Persona Onboarding',
          route: 'landing',
          description: 'Freelancer/Company/Agency flows',
          status: 'complete',
          icon: Users,
          implementation: 'Sprint 0 Complete',
          tests: [
            'Personal profile setup',
            'Freelancer onboarding',
            'Company onboarding',
            'Agency onboarding',
            'Navigation to dashboard'
          ]
        },
        {
          id: 'navigation',
          name: 'Custom Routing System',
          route: 'feed',
          description: 'No react-router, custom navigation',
          status: 'complete',
          icon: ArrowRight,
          implementation: 'M5.1 Fixes Applied',
          tests: [
            'Navigate between sections',
            'Browser back/forward',
            'Direct URL access',
            'Hamburger menu',
            'Navigation events'
          ]
        }
      ]
    }
  ];

  const handleNavigate = (route: string) => {
    const event = new CustomEvent('navigate', { detail: route });
    window.dispatchEvent(event);
  };

  const toggleTest = (testId: string, testName: string) => {
    const key = `${testId}-${testName}`;
    const newCompleted = new Set(completedTests);
    if (newCompleted.has(key)) {
      newCompleted.delete(key);
    } else {
      newCompleted.add(key);
    }
    setCompletedTests(newCompleted);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'pending':
        return <Circle className="w-4 h-4 text-gray-400" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const totalTests = testSections.reduce(
    (sum, section) => sum + section.items.reduce((s, item) => s + item.tests.length, 0),
    0
  );

  const completedCount = completedTests.size;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">WorkGraph Test Dashboard</h1>
              <p className="text-sm text-gray-500">Comprehensive testing for all features</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">
                  {completedCount}/{totalTests}
                </div>
                <div className="text-xs text-gray-500">Tests Completed</div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNavigate('feed')}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Back to App
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">8</div>
                <div className="text-xs text-gray-500">Features Complete</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">1</div>
                <div className="text-xs text-gray-500">Partial (Day 2)</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalTests}</div>
                <div className="text-xs text-gray-500">Total Tests</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Book className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">4</div>
                <div className="text-xs text-gray-500">Categories</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Day 7 Feature: Email Templates */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold m-0 mb-1">
                  📧 Email Templates
                </h3>
                <p className="text-sm text-gray-600 m-0">
                  Preview approval notification emails (Day 7 Feature)
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowEmailPreview(true)}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              Preview Templates
            </Button>
          </div>
        </Card>

        {/* Test Sections */}
        <div className="space-y-8">
          {testSections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <h2 className="text-lg font-semibold mb-4">{section.category}</h2>

              <div className="grid grid-cols-1 gap-4">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const itemCompletedTests = item.tests.filter((test) =>
                    completedTests.has(`${item.id}-${test}`)
                  ).length;

                  return (
                    <Card key={item.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="p-3 bg-purple-100 rounded-lg">
                            <Icon className="w-6 h-6 text-purple-600" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{item.name}</h3>
                              {getStatusIcon(item.status)}
                              <Badge
                                variant="outline"
                                className={getStatusColor(item.status)}
                              >
                                {item.status}
                              </Badge>
                            </div>

                            <p className="text-sm text-gray-600 mb-2">
                              {item.description}
                            </p>

                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Settings className="w-3 h-3" />
                              {item.implementation}
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleNavigate(item.route)}
                          size="sm"
                        >
                          Test Now
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>

                      {/* Test Checklist */}
                      <div className="ml-16 mt-4 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">Test Checklist</div>
                          <div className="text-xs text-gray-500">
                            {itemCompletedTests}/{item.tests.length} completed
                          </div>
                        </div>

                        {item.tests.map((test, testIdx) => {
                          const isCompleted = completedTests.has(`${item.id}-${test}`);
                          return (
                            <button
                              key={testIdx}
                              onClick={() => toggleTest(item.id, test)}
                              className={`
                                w-full text-left px-3 py-2 rounded-lg border transition-colors
                                ${
                                  isCompleted
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                }
                              `}
                            >
                              <div className="flex items-center gap-3">
                                {isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                )}
                                <span
                                  className={`text-sm ${
                                    isCompleted
                                      ? 'text-green-900'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {test}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Documentation Link */}
        <Card className="p-6 mt-8 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Book className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">
                Full Testing Documentation
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                For detailed testing instructions, edge cases, and bug reporting templates,
                see the comprehensive test guide.
              </p>
              <div className="text-sm text-gray-500">
                📄 <code>/docs/guides/COMPREHENSIVE_TEST_GUIDE.md</code>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}