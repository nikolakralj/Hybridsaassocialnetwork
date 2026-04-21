import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { Context } from "../types";
import { buildViewerOptions } from "../components/workgraph/graph-visibility";
import type { BaseEdge, BaseNode } from "../types/workgraph";
import type { ApprovalParty } from "../utils/graph/approval-fallback";
import { projectId as supabaseProjectId, publicAnonKey } from "../utils/supabase/info";

type NameDirectoryEntry = {
  name: string;
  type: string;
  orgId?: string;
};

type NameDirectoryByProject = Record<string, Record<string, NameDirectoryEntry>>;
type ApprovalDirectoryByProject = Record<string, ApprovalParty[]>;

interface WorkGraphContextType {
  currentContext: Context;
  availableContexts: Context[];
  switchContext: (contextId: string) => void;
  nameDirectory: NameDirectoryByProject;
  approvalDirectory: ApprovalDirectoryByProject;
  loadGraphContext: (projectId: string) => Promise<void>;
}

const EMPTY_NAME_DIRECTORY: Record<string, NameDirectoryEntry> = {};
const EMPTY_APPROVAL_PARTIES: ApprovalParty[] = [];

const WorkGraphContext = createContext<WorkGraphContextType | undefined>(undefined);

function readStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const storages: Array<Storage | undefined> = [window.sessionStorage, window.localStorage];
  for (const storage of storages) {
    if (!storage) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as T;
      if (storage === window.localStorage) {
        try {
          window.sessionStorage.setItem(key, raw);
        } catch {
          // Ignore promotion failures.
        }
      }
      return parsed;
    } catch {
      // Try the next storage backend.
    }
  }

  return null;
}

function writeStoredJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(value);
  try {
    window.sessionStorage.setItem(key, payload);
  } catch {
    // Ignore quota / availability failures.
  }
  try {
    window.localStorage.setItem(key, payload);
  } catch {
    // Ignore quota / availability failures.
  }
}

function normalizeNodeType(raw: any): BaseNode["type"] {
  if (typeof raw?.type === "string") {
    return raw.type as BaseNode["type"];
  }

  const nodeType = typeof raw?.nodeType === "string" ? raw.nodeType : "";
  const directMap: Record<string, BaseNode["type"]> = {
    party: "party",
    person: "person",
    contract: "contract",
    sow: "sow",
    po: "po",
    budget: "budget",
    milestone: "milestone",
    timesheet: "timesheet",
    expense: "expense",
    team: "team",
  };
  if (nodeType in directMap) return directMap[nodeType];

  // Fallback for the persisted workgraph backend schema.
  if (nodeType === "company" || nodeType === "agency" || nodeType === "client" || nodeType === "freelancer" || nodeType === "approver") {
    return "party";
  }

  const data = raw?.data || {};
  if (data?.partyType || data?.orgType || data?.organizationId || data?.organization_id) return "party";
  if (data?.email || data?.role || data?.partyId || data?.orgId || data?.company || data?.companyId) return "person";

  return "party";
}

function normalizeEdgeType(raw: any): BaseEdge["type"] {
  const candidate =
    (typeof raw?.type === "string" && raw.type) ||
    (typeof raw?.edgeType === "string" && raw.edgeType) ||
    (typeof raw?.data?.edgeType === "string" && raw.data.edgeType) ||
    "";

  switch (candidate) {
    case "approves":
    case "owns":
    case "funds":
    case "assigns":
    case "worksOn":
    case "billsTo":
    case "invoices":
    case "subcontracts":
      return candidate as BaseEdge["type"];
    case "bills_to":
      return "billsTo";
    case "employs":
      return "assigns";
    default:
      return "approves";
  }
}

function normalizeNode(raw: any): BaseNode | null {
  if (!raw || typeof raw.id !== "string") return null;

  const position = raw.position && typeof raw.position.x === "number" && typeof raw.position.y === "number"
    ? raw.position
    : {
        x: Number(raw.positionX ?? raw.x ?? 0),
        y: Number(raw.positionY ?? raw.y ?? 0),
      };

  return {
    id: raw.id,
    type: normalizeNodeType(raw),
    position,
    data: raw.data && typeof raw.data === "object" ? raw.data : {},
  };
}

function normalizeEdge(raw: any): BaseEdge | null {
  if (!raw || typeof raw.id !== "string") return null;

  const source = typeof raw.source === "string" ? raw.source : typeof raw.sourceNodeId === "string" ? raw.sourceNodeId : typeof raw.from === "string" ? raw.from : "";
  const target = typeof raw.target === "string" ? raw.target : typeof raw.targetNodeId === "string" ? raw.targetNodeId : typeof raw.to === "string" ? raw.to : "";
  if (!source || !target) return null;

  const normalizedData = raw.data && typeof raw.data === "object" ? { ...raw.data } : {};
  if (!normalizedData.edgeType) {
    normalizedData.edgeType = typeof raw.edgeType === "string"
      ? raw.edgeType
      : typeof raw.type === "string"
        ? raw.type
        : undefined;
  }

  return {
    id: raw.id,
    type: normalizeEdgeType(raw),
    source,
    target,
    data: normalizedData,
  };
}

function normalizeGraphNodes(rawNodes: unknown): BaseNode[] {
  if (!Array.isArray(rawNodes)) return [];
  return rawNodes.map(normalizeNode).filter((node): node is BaseNode => Boolean(node));
}

function normalizeGraphEdges(rawEdges: unknown): BaseEdge[] {
  if (!Array.isArray(rawEdges)) return [];
  return rawEdges.map(normalizeEdge).filter((edge): edge is BaseEdge => Boolean(edge));
}

function buildDirectoriesFromGraph(nodes: BaseNode[], edges: BaseEdge[]) {
  const viewerOptions = buildViewerOptions(nodes, edges);
  const nameDirectory: Record<string, NameDirectoryEntry> = {};
  const personOrgFromViewers = new Map<string, string>();

  viewerOptions.forEach((viewer) => {
    if (viewer.nodeId === "__admin__") return;
    nameDirectory[viewer.nodeId] = {
      name: viewer.name,
      type: viewer.type,
      orgId: viewer.orgId,
    };
    if (viewer.orgId) {
      personOrgFromViewers.set(viewer.nodeId, viewer.orgId);
    }
  });

  nodes.forEach((node) => {
    if (node.type === "party" && node.data?.name && !nameDirectory[node.id]) {
      nameDirectory[node.id] = {
        name: node.data.name,
        type: "party",
      };
    }
  });

  const approvalDirectory = nodes
    .filter((node) => node.type === "party")
    .map((partyNode) => {
      const partyId = partyNode.id;
      const people = nodes
        .filter((node) => node.type === "person" && (
          node.data?.partyId === partyId ||
          node.data?.orgId === partyId ||
          personOrgFromViewers.get(node.id) === partyId
        ))
        .map((personNode) => ({
          id: personNode.id,
          name: personNode.data?.name || personNode.id,
          canApprove: personNode.data?.canApprove === true,
        }));

      const billsTo = edges
        .filter((edge) =>
          edge.source === partyId &&
          (edge.data?.edgeType === "billsTo" || edge.data?.edgeType === "subcontracts" || edge.data?.edgeType === "bills_to")
        )
        .map((edge) => edge.target);

      return {
        id: partyId,
        name: partyNode.data?.name || partyId,
        partyType: partyNode.data?.partyType || "company",
        billsTo,
        people,
        isCreator: partyNode.data?.isCreator === true,
        isProjectOwner: partyNode.data?.isProjectOwner === true,
      } satisfies ApprovalParty;
    });

  return { nameDirectory, approvalDirectory };
}

async function getLatestGraph(projectId: string): Promise<{ nodes: BaseNode[]; edges: BaseEdge[] } | null> {
  if (!projectId) return null;

  try {
    const response = await fetch(
      `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/graph-versions/active?projectId=${encodeURIComponent(projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to load latest graph: ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    const graphVersion = payload?.graphVersion;
    const graphData = graphVersion?.graph_data || graphVersion?.graphData || {};

    return {
      nodes: normalizeGraphNodes(graphData.nodes ?? graphData?.graph?.nodes),
      edges: normalizeGraphEdges(graphData.edges ?? graphData?.graph?.edges),
    };
  } catch (error) {
    console.warn("Falling back to empty graph context after load failure", error);
    return null;
  }
}

export function WorkGraphProvider({ children }: { children: ReactNode }) {
  // Mock contexts for demo - in production, these would come from auth/database
  const mockContexts: Context[] = [
    {
      id: "personal-1",
      type: "personal",
      name: "John Doe",
      role: undefined,
    },
    {
      id: "company-1",
      type: "company",
      name: "TechVentures Inc.",
      role: "owner",
    },
    {
      id: "agency-1",
      type: "agency",
      name: "Elite Tech Recruiters",
      role: "admin",
    },
  ];

  const [currentContext, setCurrentContext] = useState<Context>(mockContexts[0]);
  const [availableContexts] = useState<Context[]>(mockContexts);
  const [nameDirectory, setNameDirectory] = useState<NameDirectoryByProject>({});
  const [approvalDirectory, setApprovalDirectory] = useState<ApprovalDirectoryByProject>({});
  const loadPromisesRef = useRef(new Map<string, Promise<void>>());

  const switchContext = useCallback((contextId: string) => {
    const newContext = availableContexts.find((c) => c.id === contextId);
    if (newContext) {
      setCurrentContext(newContext);
    }
  }, [availableContexts]);

  const loadGraphContext = useCallback(async (projectId: string) => {
    if (!projectId) return;

    const pending = loadPromisesRef.current.get(projectId);
    if (pending) {
      await pending;
      return;
    }

    const task = (async () => {
      const nameKey = `workgraph-name-dir:${projectId}`;
      const approvalKey = `workgraph-approval-dir:${projectId}`;

      const storedNameDirectory = readStoredJson<Record<string, NameDirectoryEntry>>(nameKey);
      const storedApprovalPayload = readStoredJson<{ parties?: ApprovalParty[] }>(approvalKey);

      if (storedNameDirectory && storedApprovalPayload) {
        setNameDirectory((current) => ({
          ...current,
          [projectId]: storedNameDirectory,
        }));
        setApprovalDirectory((current) => ({
          ...current,
          [projectId]: storedApprovalPayload.parties || [],
        }));
        return;
      }

      const latestGraph = await getLatestGraph(projectId);
      const derived = latestGraph
        ? buildDirectoriesFromGraph(latestGraph.nodes, latestGraph.edges)
        : { nameDirectory: {}, approvalDirectory: [] as ApprovalParty[] };

      writeStoredJson(nameKey, derived.nameDirectory);
      writeStoredJson(approvalKey, { parties: derived.approvalDirectory });

      setNameDirectory((current) => ({
        ...current,
        [projectId]: derived.nameDirectory,
      }));
      setApprovalDirectory((current) => ({
        ...current,
        [projectId]: derived.approvalDirectory,
      }));
    })().finally(() => {
      loadPromisesRef.current.delete(projectId);
    });

    loadPromisesRef.current.set(projectId, task);
    await task;
  }, []);

  const contextValue = useMemo(() => ({
    currentContext,
    availableContexts,
    switchContext,
    nameDirectory,
    approvalDirectory,
    loadGraphContext,
  }), [currentContext, availableContexts, switchContext, nameDirectory, approvalDirectory, loadGraphContext]);

  return (
    <WorkGraphContext.Provider value={contextValue}>
      {children}
    </WorkGraphContext.Provider>
  );
}

export function useWorkGraphContext() {
  const context = useContext(WorkGraphContext);
  if (!context) {
    throw new Error("useWorkGraphContext must be used within WorkGraphProvider");
  }
  return context;
}

export function useWorkGraph() {
  return useWorkGraphContext();
}
