/**
 * NotificationPreferencesPanel — User notification settings
 *
 * Phase 5 Day 8: Email Notification Strategy
 *
 * Two modes:
 * - Default: Notify at each approval step (reassurance)
 * - Quiet: Only final approval or rejection
 */

import React from 'react';
import {
  Bell, BellOff, Mail, Clock, Shield,
  Volume2, VolumeX, Info, CheckCircle2,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useNotificationStore, type EmailDigestMode } from '../../contexts/NotificationContext';

const DIGEST_OPTIONS: { value: EmailDigestMode; label: string; desc: string }[] = [
  { value: 'immediate', label: 'Immediate', desc: 'Email me as events happen' },
  { value: 'daily', label: 'Daily Digest', desc: 'One email per day with all activity' },
  { value: 'weekly', label: 'Weekly Digest', desc: 'One email per week' },
  { value: 'quiet', label: 'No Emails', desc: 'In-app notifications only' },
];

export function NotificationPreferencesPanel({ onClose }: { onClose?: () => void }) {
  const store = useNotificationStore();
  const { prefs, updatePrefs } = store;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold">Notification Preferences</h3>
        </div>
        <Badge variant="outline" className="text-[9px]">Phase 5 Day 8</Badge>
      </div>

      {/* Approval Step Notifications */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Approval Chain Notifications
          </div>
        </div>
        <div className="p-4 space-y-3">
          {/* Each step mode */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name="stepMode"
              checked={prefs.notifyEachStep}
              onChange={() => updatePrefs({ notifyEachStep: true })}
              className="mt-1 accent-blue-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-sm font-medium">Notify at each approval step</span>
                <Badge className="text-[8px] bg-blue-100 text-blue-700 border-blue-200">Default</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Get reassurance as your timesheet moves through the approval chain.
                You'll know the moment anyone approves.
              </p>
              <div className="mt-2 text-[10px] text-muted-foreground bg-blue-50 rounded-md px-3 py-2 border border-blue-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Info className="h-3 w-3 text-blue-500" />
                  <span className="font-semibold text-blue-600">Psychology</span>
                </div>
                After submitting, you're anxious. Getting <strong>any</strong> positive signal
                within hours builds trust. Without it, you'd wait days wondering if your
                timesheet disappeared.
              </div>
            </div>
          </label>

          <Separator />

          {/* Quiet mode */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name="stepMode"
              checked={!prefs.notifyEachStep}
              onChange={() => updatePrefs({ notifyEachStep: false })}
              className="mt-1 accent-blue-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <VolumeX className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-sm font-medium">Quiet mode — final only</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Only notify on final approval (ready to invoice) or any rejection.
                Middle approvals shown in-app only.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Always-on notifications */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Always Active
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          <ToggleRow
            icon={<Shield className="h-3.5 w-3.5 text-red-500" />}
            label="Rejection alerts"
            description="Immediately notify when any party rejects"
            checked={prefs.notifyOnRejection}
            onChange={(v) => updatePrefs({ notifyOnRejection: v })}
            locked
          />
          <Separator />
          <ToggleRow
            icon={<Mail className="h-3.5 w-3.5 text-blue-500" />}
            label="Submission alerts (for approvers)"
            description="Notify when someone submits a timesheet for your approval"
            checked={prefs.notifyOnSubmission}
            onChange={(v) => updatePrefs({ notifyOnSubmission: v })}
          />
        </div>
      </div>

      {/* Email digest */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Email Delivery
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2">
            {DIGEST_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updatePrefs({ emailDigest: opt.value })}
                className={`text-left p-3 rounded-lg border transition-all ${
                  prefs.emailDigest === opt.value
                    ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                    : 'hover:bg-muted/30'
                }`}
              >
                <div className="text-xs font-semibold">{opt.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quiet hours */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quiet Hours
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.quietHoursEnabled}
              onChange={(e) => updatePrefs({ quietHoursEnabled: e.target.checked })}
              className="accent-blue-600"
            />
            <span className="text-[10px] font-medium">{prefs.quietHoursEnabled ? 'On' : 'Off'}</span>
          </label>
        </div>
        {prefs.quietHoursEnabled && (
          <div className="p-4 flex items-center gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">From</label>
              <input
                type="time"
                value={prefs.quietHoursStart}
                onChange={(e) => updatePrefs({ quietHoursStart: e.target.value })}
                className="h-8 px-2 text-xs rounded border focus:border-blue-400 outline-none"
              />
            </div>
            <div className="text-xs text-muted-foreground mt-4">to</div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Until</label>
              <input
                type="time"
                value={prefs.quietHoursEnd}
                onChange={(e) => updatePrefs({ quietHoursEnd: e.target.value })}
                className="h-8 px-2 text-xs rounded border focus:border-blue-400 outline-none"
              />
            </div>
            <BellOff className="h-4 w-4 text-muted-foreground ml-auto" />
          </div>
        )}
      </div>

      {/* Email template preview hint */}
      <div className="rounded-lg bg-muted/20 p-3 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
        <div className="text-[11px] text-muted-foreground">
          <strong className="text-foreground">4 email templates ready:</strong> First approval,
          middle approval digest, final approval (invoice-ready), and rejection alert.
          Templates use your project branding and include deep links back to WorkGraph.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Toggle Row helper
// ============================================================================

function ToggleRow({ icon, label, description, checked, onChange, locked }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 ${locked ? 'opacity-80' : 'cursor-pointer'}`}>
      {icon}
      <div className="flex-1">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{description}</div>
      </div>
      <div className="flex items-center gap-1.5">
        {locked && <Badge variant="outline" className="text-[7px] h-3.5">Required</Badge>}
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !locked && onChange(e.target.checked)}
          disabled={locked}
          className="accent-blue-600"
        />
      </div>
    </label>
  );
}
