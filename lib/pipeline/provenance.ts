import type {
  Evidence,
  GraphLink,
  GraphNode,
  ResultType,
  SemanticUniversePayload,
} from "./models";

export type ProvenanceValidationResult = {
  payload: SemanticUniversePayload;
  resultType: ResultType;
  reason?: string;
  rejectedLinks: number;
  rejectedNodes: number;
  repairedLinks: number;
  groundedEdgeCount: number;
  passageEvidenceCount: number;
};

type ValidationOpts = {
  minimumNodes?: number;
  minimumGroundedEdges?: number;
  minimumEvidence?: number;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "brand",
  "by",
  "core",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function tokens(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
  );
}

function evidenceText(entry: Evidence): string {
  return [
    entry.query,
    entry.sourceTitle,
    entry.excerpt ?? entry.aiResponse,
  ].join(" ");
}

function sourceIdsForEvidence(evidenceById: Map<string, Evidence>, evidenceIds: string[]): string[] {
  const ids = new Set<string>();
  for (const evidenceId of evidenceIds) {
    const sourceId = evidenceById.get(evidenceId)?.sourceId;
    if (sourceId) ids.add(sourceId);
  }
  return Array.from(ids);
}

function filterEvidenceIds(ids: unknown, evidenceIdSet: Set<string>): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && evidenceIdSet.has(id));
}

function filterSourceIds(ids: unknown, sourceIdSet: Set<string>): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && sourceIdSet.has(id));
}

function bestRepairEvidenceId(
  link: GraphLink,
  nodesById: Map<string, GraphNode>,
  evidence: Evidence[],
): string | null {
  const sourceLabel = nodesById.get(link.source)?.label ?? link.source;
  const targetLabel = nodesById.get(link.target)?.label ?? link.target;
  const needle = tokens(`${sourceLabel} ${targetLabel} ${link.dominantCompetitor ?? ""}`);
  if (needle.size === 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const entry of evidence) {
    const haystack = tokens(evidenceText(entry));
    let score = 0;
    for (const token of needle) {
      if (haystack.has(token)) score += 1;
    }
    if (score > (best?.score ?? 0)) best = { id: entry.id, score };
  }
  return best && best.score >= 2 ? best.id : null;
}

function attachNodeEvidence(nodes: GraphNode[], links: GraphLink[], evidenceIdSet: Set<string>): GraphNode[] {
  const incidentEvidence = new Map<string, Set<string>>();
  for (const link of links) {
    for (const nodeId of [link.source, link.target]) {
      const bucket = incidentEvidence.get(nodeId) ?? new Set<string>();
      for (const evidenceId of link.evidenceIds) {
        if (evidenceIdSet.has(evidenceId)) bucket.add(evidenceId);
      }
      incidentEvidence.set(nodeId, bucket);
    }
  }

  return nodes.map((node) => {
    const ownIds = filterEvidenceIds(node.evidenceIds, evidenceIdSet);
    const derivedIds = Array.from(incidentEvidence.get(node.id) ?? []);
    const evidenceIds = ownIds.length > 0 ? ownIds : derivedIds;
    return { ...node, evidenceIds };
  });
}

export function validateGraphProvenance(
  payload: SemanticUniversePayload,
  opts?: ValidationOpts,
): ProvenanceValidationResult {
  const minimumNodes = opts?.minimumNodes ?? 4;
  const minimumGroundedEdges = opts?.minimumGroundedEdges ?? 3;
  const minimumEvidence = opts?.minimumEvidence ?? 3;

  const evidence = payload.evidence.filter((entry) => entry.id);
  const evidenceById = new Map(evidence.map((entry) => [entry.id, entry]));
  const evidenceIdSet = new Set(evidenceById.keys());
  const sourceIdSet = new Set(
    evidence.map((entry) => entry.sourceId).filter((id): id is string => Boolean(id)),
  );

  const nodesById = new Map(payload.nodes.map((node) => [node.id, node]));
  const repairedLinks: GraphLink[] = [];
  let repairedLinksCount = 0;
  let rejectedLinks = 0;

  for (const link of payload.links) {
    let evidenceIds = filterEvidenceIds(link.evidenceIds, evidenceIdSet);
    if (evidenceIds.length === 0) {
      const repairedId = bestRepairEvidenceId(link, nodesById, evidence);
      if (repairedId) {
        evidenceIds = [repairedId];
        repairedLinksCount += 1;
      }
    }
    if (evidenceIds.length === 0) {
      rejectedLinks += 1;
      continue;
    }
    const sourceIds = filterSourceIds(link.sourceIds, sourceIdSet);
    repairedLinks.push({
      ...link,
      evidenceIds,
      sourceIds: sourceIds.length > 0 ? sourceIds : sourceIdsForEvidence(evidenceById, evidenceIds),
    });
  }

  let nodes = attachNodeEvidence(payload.nodes, repairedLinks, evidenceIdSet).map((node) => ({
    ...node,
    sourceIds: filterSourceIds(node.sourceIds, sourceIdSet).length > 0
      ? filterSourceIds(node.sourceIds, sourceIdSet)
      : sourceIdsForEvidence(evidenceById, node.evidenceIds ?? []),
  }));

  const supportedNodeIds = new Set<string>();
  let rejectedNodes = 0;
  for (const node of nodes) {
    if (node.id === "brand-core" || node.category === "brand" || (node.evidenceIds?.length ?? 0) > 0) {
      supportedNodeIds.add(node.id);
    } else {
      rejectedNodes += 1;
    }
  }

  nodes = nodes.filter((node) => supportedNodeIds.has(node.id));
  const links = repairedLinks.filter((link) => {
    const keep = supportedNodeIds.has(link.source) && supportedNodeIds.has(link.target);
    if (!keep) rejectedLinks += 1;
    return keep;
  });

  const cleanEvidenceIds = (ids: string[]) => ids.filter((id) => evidenceIdSet.has(id));
  const semanticDiscourse = payload.semanticDiscourse.map((item) => ({
    ...item,
    evidenceIds: cleanEvidenceIds(item.evidenceIds),
  }));
  const visualCorrelations = payload.visualCorrelations.map((item) => ({
    ...item,
    evidenceIds: cleanEvidenceIds(item.evidenceIds),
  }));
  const modelStrength = {
    ...payload.modelStrength,
    models: payload.modelStrength.models.map((model) => ({
      ...model,
      evidenceIds: cleanEvidenceIds(model.evidenceIds),
    })),
  };

  const groundedEdgeCount = links.filter((link) => link.evidenceIds.length > 0).length;
  const passageEvidenceCount = evidence.length;
  let resultType: ResultType = "success";
  let reason: string | undefined;
  if (rejectedLinks > 0 || rejectedNodes > 0) {
    resultType = "degraded";
    reason = "unsupported_relationships_removed";
  } else if (repairedLinksCount > 0) {
    resultType = "degraded";
    reason = "unsupported_relationships_repaired";
  }

  if (
    nodes.length < minimumNodes ||
    groundedEdgeCount < minimumGroundedEdges ||
    passageEvidenceCount < minimumEvidence
  ) {
    resultType = "fallback";
    reason = "below_grounded_graph_floor";
  }

  return {
    payload: {
      ...payload,
      nodes,
      links,
      evidence,
      semanticDiscourse,
      visualCorrelations,
      modelStrength,
      resultType,
      resultReason: reason,
    },
    resultType,
    reason,
    rejectedLinks,
    rejectedNodes,
    repairedLinks: repairedLinksCount,
    groundedEdgeCount,
    passageEvidenceCount,
  };
}
