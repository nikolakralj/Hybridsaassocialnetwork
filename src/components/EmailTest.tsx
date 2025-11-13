// Phase 5 Day 8: Email Sending Test Component
import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { CheckCircle2, Mail, Loader2, AlertCircle } from 'lucide-react';

export function EmailTest() {
  const [email, setEmail] = useState('nikola.kralj86@gmail.com');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [emailId, setEmailId] = useState('');

  const handleTestEmail = async () => {
    setStatus('sending');
    setMessage('');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/email/test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to: email }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Test email sent successfully!');
        setEmailId(data.emailId || '');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to send email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: ' + String(error));
    }
  };

  const handleSendApprovalRequest = async () => {
    setStatus('sending');
    setMessage('');
    
    try {
      // Generate mock approval token
      const mockToken = `approval-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const baseUrl = window.location.origin;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/email/approval-request`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email,
            approverName: 'Nikola',
            submitterName: 'Sarah Chen',
            projectName: 'Mobile App Redesign',
            periodLabel: 'Week 47 (Nov 11-17, 2025)',
            hours: 40,
            amount: 6000,
            approveUrl: `${baseUrl}/approve?token=${mockToken}`,
            rejectUrl: `${baseUrl}/reject?token=${mockToken}`,
            viewUrl: `${baseUrl}/approval-view?token=${mockToken}`,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Approval request email sent! Check your inbox.');
        setEmailId(data.emailId || '');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to send email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: ' + String(error));
    }
  };

  const handleSendFirstApproval = async () => {
    setStatus('sending');
    setMessage('');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/email/first-approval`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email,
            contractorName: 'Sarah Chen',
            approverName: 'TechCorp',
            projectName: 'Mobile App Redesign',
            periodLabel: 'Week 47 (Nov 11-17, 2025)',
            hours: 40,
            nextApprover: 'BigClient LLC',
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('First approval notification sent!');
        setEmailId(data.emailId || '');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to send email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: ' + String(error));
    }
  };

  const handleSendFinalApproval = async () => {
    setStatus('sending');
    setMessage('');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/email/final-approval`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email,
            contractorName: 'Sarah Chen',
            projectName: 'Mobile App Redesign',
            periodLabel: 'Week 47 (Nov 11-17, 2025)',
            hours: 40,
            amount: 6000,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Final approval notification sent!');
        setEmailId(data.emailId || '');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to send email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: ' + String(error));
    }
  };

  const handleSendRejection = async () => {
    setStatus('sending');
    setMessage('');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/email/rejection`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email,
            contractorName: 'Sarah Chen',
            rejectorName: 'BigClient LLC',
            projectName: 'Mobile App Redesign',
            periodLabel: 'Week 47 (Nov 11-17, 2025)',
            reason: 'Please provide more detailed task descriptions for each day.',
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Rejection notification sent!');
        setEmailId(data.emailId || '');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to send email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: ' + String(error));
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl m-0 mb-2">📧 Email System Test</h2>
          <p className="text-muted-foreground m-0">
            Test the real email sending with Resend API
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Recipient Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium m-0">Send Test Emails:</p>
          
          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={handleTestEmail}
              disabled={status === 'sending'}
              variant="outline"
              className="justify-start gap-2"
            >
              {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              1. Basic Email Test
            </Button>

            <Button
              onClick={handleSendApprovalRequest}
              disabled={status === 'sending'}
              variant="outline"
              className="justify-start gap-2"
            >
              {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              2. Approval Request (with action buttons)
            </Button>

            <Button
              onClick={handleSendFirstApproval}
              disabled={status === 'sending'}
              variant="outline"
              className="justify-start gap-2"
            >
              {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              3. First Approval Notification
            </Button>

            <Button
              onClick={handleSendFinalApproval}
              disabled={status === 'sending'}
              variant="outline"
              className="justify-start gap-2"
            >
              {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              4. Final Approval (ready to invoice)
            </Button>

            <Button
              onClick={handleSendRejection}
              disabled={status === 'sending'}
              variant="outline"
              className="justify-start gap-2"
            >
              {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              5. Rejection Notification
            </Button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <Card className={`p-4 ${
            status === 'success' ? 'bg-green-50 border-green-200' :
            status === 'error' ? 'bg-red-50 border-red-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              {status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
              {status === 'error' && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
              {status === 'sending' && <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />}
              
              <div className="flex-1">
                <p className="m-0 font-medium text-sm">
                  {status === 'success' && '✅ Success'}
                  {status === 'error' && '❌ Error'}
                  {status === 'sending' && '⏳ Sending...'}
                </p>
                <p className="m-0 text-sm mt-1">{message}</p>
                {emailId && (
                  <p className="m-0 text-xs mt-2 opacity-70">Email ID: {emailId}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="space-y-2">
            <p className="m-0 text-sm font-medium">📋 Complete End-to-End Approval Flow:</p>
            <ol className="m-0 text-sm space-y-1 list-decimal list-inside">
              <li>Click "2. Approval Request" to send an email with approve/reject buttons</li>
              <li>Check your email (nikola.kralj86@gmail.com)</li>
              <li>Click the "✅ Approve" button in the email</li>
              <li>You'll be taken to the deep-link handler</li>
              <li>System validates the token & updates database</li>
              <li>Sends notification email to contractor</li>
              <li>If multi-level approval: sends request to next approver</li>
            </ol>
            <div className="mt-3 p-3 bg-white rounded border border-blue-300">
              <p className="m-0 text-xs font-medium text-blue-900">⚠️ Note: Real Database Integration</p>
              <p className="m-0 text-xs text-blue-800 mt-1">
                The approval execution now connects to real Supabase tables (approval_tokens, approval_items, profiles). 
                For full testing, you'll need to create test data through the Projects UI or Database Setup.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="space-y-2">
            <p className="m-0 text-sm font-medium">🔑 Resend API Setup:</p>
            <p className="m-0 text-sm">
              You've already uploaded the <code className="bg-purple-100 px-1 py-0.5 rounded">RESEND_API_KEY</code> secret. 
              Get your API key from{' '}
              <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">
                resend.com/api-keys
              </a>
            </p>
          </div>
        </Card>
      </Card>
    </div>
  );
}