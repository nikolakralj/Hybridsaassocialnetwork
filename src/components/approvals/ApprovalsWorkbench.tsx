// Phase 5 Day 3: Global Approvals Workbench
// Cross-project approval inbox with filters, bulk actions, and graph overlay

import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  Filter, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Sparkles,
  Clock,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner@2.0.3';
import {
  getApprovalQueueMock,
  approveItemMock,
  rejectItemMock,
  bulkApproveItemsMock,
  type ApprovalQueueItem,
  type QueueFilters,
} from '../../utils/api/approvals-queue';
import { GraphOverlayModal } from './GraphOverlayModal';
import { usePersona } from '../../contexts/PersonaContext'; // ✅ TEST MODE