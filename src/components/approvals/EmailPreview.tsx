// Phase 5 Day 7: Email Template Preview Component
// Development tool to preview email templates

import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { generateEmailPreviews } from '../../utils/notifications/email-sender';
import { Download, Eye, Code } from 'lucide-react';

export function EmailPreview() {
  const [selectedTemplate, setSelectedTemplate] = useState<'approvalRequest' | 'approvalCompleted' | 'slaAlert'>('approvalRequest');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  
  const previews = generateEmailPreviews();
  const currentHtml = previews[selectedTemplate];

  const handleDownload = () => {
    const blob = new Blob([currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate}-template.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(currentHtml);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl m-0 mb-2">📧 Email Template Preview</h2>
          <p className="text-muted-foreground m-0">
            Preview and test approval notification emails
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyToClipboard}
            className="gap-2"
          >
            <Code className="w-4 h-4" />
            Copy HTML
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>

      <Tabs value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="approvalRequest" className="gap-2">
            📨 Approval Request
          </TabsTrigger>
          <TabsTrigger value="approvalCompleted" className="gap-2">
            ✅ Completed
          </TabsTrigger>
          <TabsTrigger value="slaAlert" className="gap-2">
            ⚠️ SLA Alert
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <Card className="overflow-hidden">
            {/* Header */}
            <div className="border-b border-border bg-muted p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Preview</Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedTemplate === 'approvalRequest' && 'Sent to approver when timesheet submitted'}
                  {selectedTemplate === 'approvalCompleted' && 'Sent to submitter when approved/rejected'}
                  {selectedTemplate === 'slaAlert' && 'Sent when approvals are overdue'}
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'preview' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('preview')}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </Button>
                <Button
                  variant={viewMode === 'code' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('code')}
                  className="gap-2"
                >
                  <Code className="w-4 h-4" />
                  Code
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-0">
              {viewMode === 'preview' ? (
                <div className="bg-gray-100 p-8">
                  <div 
                    className="bg-white max-w-2xl mx-auto shadow-lg rounded-lg overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: currentHtml }}
                  />
                </div>
              ) : (
                <div className="max-h-[600px] overflow-auto">
                  <pre className="p-6 text-sm bg-gray-950 text-gray-100">
                    <code>{currentHtml}</code>
                  </pre>
                </div>
              )}
            </div>
          </Card>
        </div>
      </Tabs>

      {/* Template Info */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <div className="text-blue-600">ℹ️</div>
          <div>
            <p className="m-0 text-sm">
              <strong>Testing:</strong> These templates use mock data. In production, real approval data will be used.
            </p>
            <p className="m-0 text-sm mt-2">
              <strong>Mobile-Friendly:</strong> All templates are responsive and tested on iOS/Android.
            </p>
            <p className="m-0 text-sm mt-2">
              <strong>Action Buttons:</strong> Links in emails use secure, expiring tokens (72 hours).
            </p>
          </div>
        </div>
      </Card>

      {/* Template Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h4 className="m-0 mb-2 text-sm font-medium">📨 Approval Request</h4>
          <p className="text-xs text-muted-foreground m-0">
            Sent when someone submits a timesheet for approval. Includes approve/reject buttons.
          </p>
          <div className="mt-3 space-y-1">
            <div className="text-xs">
              <Badge variant="outline" className="text-xs">To: Approver</Badge>
            </div>
            <div className="text-xs">
              <Badge variant="outline" className="text-xs">Trigger: Submission</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="m-0 mb-2 text-sm font-medium">✅ Approval Completed</h4>
          <p className="text-xs text-muted-foreground m-0">
            Sent to submitter when their timesheet is approved or rejected. Includes reason if rejected.
          </p>
          <div className="mt-3 space-y-1">
            <div className="text-xs">
              <Badge variant="outline" className="text-xs">To: Submitter</Badge>
            </div>
            <div className="text-xs">
              <Badge variant="outline" className="text-xs">Trigger: Approval/Rejection</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="m-0 mb-2 text-sm font-medium">⚠️ SLA Alert</h4>
          <p className="text-xs text-muted-foreground m-0">
            Sent when pending approvals are approaching or past their due date. Daily digest.
          </p>
          <div className="mt-3 space-y-1">
            <div className="text-xs">
              <Badge variant="outline" className="text-xs">To: Approver</Badge>
            </div>
            <div className="text-xs">
              <Badge variant="outline" className="text-xs">Trigger: SLA Breach</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
