# Approval Chain Templates (Phase 6)

## Overview
Instead of hardcoding approval logic, contracts reference pre-defined approval chain templates.

---

## Database Schema

```sql
-- Create approval chain templates table
CREATE TABLE approval_chain_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id TEXT, -- Which company owns this template (null = global)
  steps JSONB NOT NULL, -- Ordered list of approval steps
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example templates
INSERT INTO approval_chain_templates (id, name, description, steps) VALUES
  (
    'template-simple',
    'Simple Approval',
    'Internal manager approval only',
    '[
      {
        "step": 1,
        "role": "manager",
        "scope": "contractor_company",
        "required": true
      }
    ]'
  ),
  (
    'template-standard',
    'Standard Approval',
    'Manager + Client approval',
    '[
      {
        "step": 1,
        "role": "manager",
        "scope": "contractor_company",
        "required": true
      },
      {
        "step": 2,
        "role": "client",
        "scope": "client_company",
        "required": true
      }
    ]'
  ),
  (
    'template-enterprise',
    'Enterprise Approval',
    'Manager → Finance → Client → Procurement',
    '[
      {
        "step": 1,
        "role": "manager",
        "scope": "contractor_company",
        "required": true
      },
      {
        "step": 2,
        "role": "finance",
        "scope": "contractor_company",
        "required": true,
        "condition": {
          "type": "amount_threshold",
          "value": 5000
        }
      },
      {
        "step": 3,
        "role": "client",
        "scope": "client_company",
        "required": true
      },
      {
        "step": 4,
        "role": "procurement",
        "scope": "client_company",
        "required": false,
        "condition": {
          "type": "amount_threshold",
          "value": 10000
        }
      }
    ]'
  );

-- Add template reference to contracts
ALTER TABLE project_contracts 
  ADD COLUMN approval_chain_template_id TEXT 
  REFERENCES approval_chain_templates(id);

-- Set default template
UPDATE project_contracts 
SET approval_chain_template_id = 'template-standard'
WHERE approval_chain_template_id IS NULL;
```

---

## Updated buildApprovalChain Function

```typescript
async function buildApprovalChain(contractId: string): Promise<ApprovalStep[]> {
  
  // 1. Get contract with template
  const { data: contract } = await supabase
    .from('project_contracts')
    .select(`
      *,
      approval_chain_templates (
        id,
        name,
        steps
      ),
      projects (
        id,
        company_id
      )
    `)
    .eq('id', contractId)
    .single();
  
  if (!contract) throw new Error('Contract not found');
  
  // 2. Get template steps
  const templateSteps = contract.approval_chain_templates?.steps || [];
  
  // 3. Build actual approval chain by resolving each step
  const chain: ApprovalStep[] = [];
  
  for (const templateStep of templateSteps) {
    
    // Check if step is conditional
    if (templateStep.condition) {
      const shouldInclude = await evaluateCondition(
        templateStep.condition, 
        contract
      );
      if (!shouldInclude) continue; // Skip this step
    }
    
    // Resolve approver based on role and scope
    const approver = await resolveApprover({
      role: templateStep.role,
      scope: templateStep.scope,
      contractorCompanyId: contract.company_id,
      clientCompanyId: contract.projects.company_id,
    });
    
    if (approver) {
      chain.push({
        step: chain.length + 1, // Sequential step number
        approverId: approver.id,
        approverName: approver.name,
        role: templateStep.role,
        companyId: approver.company_id,
        required: templateStep.required,
      });
    } else if (templateStep.required) {
      throw new Error(`Required approver not found: ${templateStep.role}`);
    }
  }
  
  return chain;
}

// Helper: Resolve approver from role + scope
async function resolveApprover(params: {
  role: string;
  scope: 'contractor_company' | 'client_company';
  contractorCompanyId: string;
  clientCompanyId: string;
}): Promise<{ id: string; name: string; company_id: string } | null> {
  
  const companyId = params.scope === 'contractor_company' 
    ? params.contractorCompanyId 
    : params.clientCompanyId;
  
  const { data: user } = await supabase
    .from('users')
    .select('id, name, company_id')
    .eq('company_id', companyId)
    .eq('user_type', params.role)
    .eq('is_active', true)
    .limit(1)
    .single();
  
  return user;
}

// Helper: Evaluate conditional step
async function evaluateCondition(
  condition: { type: string; value: any },
  contract: any
): Promise<boolean> {
  
  switch (condition.type) {
    case 'amount_threshold':
      // Calculate timesheet amount (would need to query entries)
      const amount = await calculateTimesheetAmount(contract.id);
      return amount >= condition.value;
    
    case 'contract_type':
      return contract.contract_type === condition.value;
    
    case 'client_requires_approval':
      return contract.requires_client_approval === true;
    
    default:
      return true;
  }
}
```

---

## Example Scenarios

### Scenario 1: Simple Freelancer Contract

```sql
-- Create contract with simple template
INSERT INTO project_contracts (
  id,
  approval_chain_template_id,
  ...
) VALUES (
  'contract-freelancer-001',
  'template-simple',  -- Only manager approval
  ...
);
```

**Result:**
```
Approval Chain:
  Step 1: Manager Bob ✅
  Done!
```

---

### Scenario 2: Standard Agency Contract

```sql
-- Create contract with standard template
INSERT INTO project_contracts (
  id,
  approval_chain_template_id,
  ...
) VALUES (
  'contract-agency-001',
  'template-standard',  -- Manager + Client
  ...
);
```

**Result:**
```
Approval Chain:
  Step 1: Manager Bob ✅
  Step 2: Client Carol ✅
  Done!
```

---

### Scenario 3: Enterprise Contract (Conditional Steps)

```sql
-- Create contract with enterprise template
INSERT INTO project_contracts (
  id,
  approval_chain_template_id,
  hourly_rate,
  ...
) VALUES (
  'contract-enterprise-001',
  'template-enterprise',  -- Complex chain
  150.00,  -- High rate
  ...
);
```

**Result (if timesheet > $5,000):**
```
Approval Chain:
  Step 1: Manager Bob ✅
  Step 2: Finance Director Dave ✅ (triggered by amount > $5k)
  Step 3: Client Carol ✅
  Step 4: Procurement Emily ✅ (triggered by amount > $10k)
  Done!
```

**Result (if timesheet < $5,000):**
```
Approval Chain:
  Step 1: Manager Bob ✅
  Step 2: Client Carol ✅
  Done! (Finance and Procurement skipped)
```

---

## Custom Templates Per Client

```sql
-- Client Corp wants custom approval flow
INSERT INTO approval_chain_templates (
  id,
  name,
  company_id,  -- Owned by Client Corp
  steps
) VALUES (
  'template-clientcorp-custom',
  'Client Corp Special Approval',
  'company-client-corp',
  '[
    {
      "step": 1,
      "role": "manager",
      "scope": "contractor_company"
    },
    {
      "step": 2,
      "role": "project_manager",
      "scope": "client_company",
      "specific_user_id": "user-specific-pm"
    },
    {
      "step": 3,
      "role": "finance",
      "scope": "client_company"
    }
  ]'
);

-- Assign to contract
UPDATE project_contracts 
SET approval_chain_template_id = 'template-clientcorp-custom'
WHERE project_id IN (
  SELECT id FROM projects WHERE company_id = 'company-client-corp'
);
```

---

## UI for Template Management

```tsx
function ApprovalTemplateEditor() {
  const [steps, setSteps] = useState([
    { role: 'manager', scope: 'contractor_company', required: true },
  ]);
  
  return (
    <div>
      <h2>Create Approval Chain Template</h2>
      
      {steps.map((step, idx) => (
        <Card key={idx}>
          <CardHeader>Step {idx + 1}</CardHeader>
          <CardContent>
            <Select value={step.role} onChange={...}>
              <option value="manager">Manager</option>
              <option value="client">Client</option>
              <option value="finance">Finance</option>
              <option value="procurement">Procurement</option>
            </Select>
            
            <Select value={step.scope} onChange={...}>
              <option value="contractor_company">Contractor Company</option>
              <option value="client_company">Client Company</option>
            </Select>
            
            <Checkbox checked={step.required}>Required</Checkbox>
            
            <Button onClick={() => removeStep(idx)}>Remove</Button>
          </CardContent>
        </Card>
      ))}
      
      <Button onClick={() => addStep()}>Add Step</Button>
      <Button onClick={() => saveTemplate()}>Save Template</Button>
    </div>
  );
}
```

---

## Benefits

✅ **Flexible**: Each contract can have different approval chains  
✅ **Reusable**: Templates can be shared across contracts  
✅ **Conditional**: Steps can be skipped based on rules  
✅ **Auditable**: Template changes are tracked  
✅ **Scalable**: No code changes needed for new approval flows  
✅ **Client-Specific**: Clients can define their own templates  

---

## Migration Path

**Phase 5B (Current)**: Hardcoded logic in `buildApprovalChain()`  
**Phase 6A**: Add `approval_chain_templates` table  
**Phase 6B**: Migrate existing contracts to templates  
**Phase 6C**: Add template editor UI  
**Phase 7**: Add conditional steps and advanced rules  

---

**This is the future-proof approach!** 🚀
