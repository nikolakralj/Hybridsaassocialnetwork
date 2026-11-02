import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  listMyBillingOrganizations,
  saveOrganizationBillingProfile,
  type OrganizationBillingProfile,
} from '../../utils/api/organizations-api';

/**
 * Seller/buyer details printed on invoices, kept once per company.
 * Drafts pick these up automatically (051 trigger); issued invoices keep what they had.
 */
export function OrganizationBillingCard() {
  const [profiles, setProfiles] = useState<OrganizationBillingProfile[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyBillingOrganizations()
      .then((rows) => { if (!cancelled) setProfiles(rows); })
      .catch(() => { if (!cancelled) setProfiles([]); });
    return () => { cancelled = true; };
  }, []);

  if (!profiles || profiles.length === 0) return null;

  const update = (id: string, patch: Partial<OrganizationBillingProfile>) =>
    setProfiles((rows) => (rows || []).map((row) => (row.organizationId === id ? { ...row, ...patch } : row)));

  const save = async (profile: OrganizationBillingProfile) => {
    setSavingId(profile.organizationId);
    try {
      await saveOrganizationBillingProfile(profile);
      toast.success(`Billing details saved for ${profile.organizationName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save billing details');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card data-testid="org-billing-card">
      <CardHeader className="pb-3">
        <h3 className="text-sm font-semibold">Company billing details</h3>
        <p className="text-xs text-muted-foreground">
          Printed on invoices your company issues or receives. New and draft invoices pick these up; issued invoices keep their details.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {profiles.map((profile) => {
          const id = profile.organizationId;
          return (
            <div key={id} className="space-y-3" data-org-billing={profile.organizationName}>
              <p className="text-sm font-medium">{profile.organizationName}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`billing-legal-${id}`} className="text-xs">Legal name</Label>
                  <Input id={`billing-legal-${id}`} value={profile.legalName} placeholder={profile.organizationName}
                    onChange={(e) => update(id, { legalName: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor={`billing-tax-${id}`} className="text-xs">Tax ID / VAT (OIB)</Label>
                  <Input id={`billing-tax-${id}`} value={profile.taxId}
                    onChange={(e) => update(id, { taxId: e.target.value })} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`billing-address-${id}`} className="text-xs">Address</Label>
                  <Textarea id={`billing-address-${id}`} value={profile.address} rows={2}
                    onChange={(e) => update(id, { address: e.target.value })} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`billing-iban-${id}`} className="text-xs">IBAN (where you get paid)</Label>
                  <Input id={`billing-iban-${id}`} value={profile.iban}
                    onChange={(e) => update(id, { iban: e.target.value })} className="mt-1" />
                </div>
              </div>
              <Button size="sm" onClick={() => void save(profile)} disabled={savingId === id}>
                {savingId === id ? 'Saving…' : 'Save billing details'}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
