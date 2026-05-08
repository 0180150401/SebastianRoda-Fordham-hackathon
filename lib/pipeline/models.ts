export type NodeCategory = "brand" | "aesthetic" | "query" | "competitor" | "gap";
export type EntityType = "Person" | "Org" | "Concept" | "Event" | "Claim";
export type RelType = "causal" | "associative" | "contextual";

export type GraphNode = {
  id: string;
  label: string;
  category: NodeCategory;
  entityType?: EntityType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  anchorX: number;
  anchorY: number;
  fixed?: boolean;
  gapHint?: string;
  sourceIds?: string[];
  evidenceIds?: string[];
};

export type GraphLink = {
  id: string;
  source: string;
  target: string;
  weight: number;
  sourceIds: string[];
  evidenceIds: string[];
  dominantCompetitor?: string;
  missing?: boolean;
  relType?: RelType;
};

export type ResultType = "success" | "degraded" | "fallback";

export type SourceProvider = "tavily" | "exa";

export type SourcePassage = {
  text: string;
  kind: "highlight" | "text" | "chunk" | "snippet";
  score?: number;
};

export type Evidence = {
  id: string;
  query: string;
  aiResponse: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceId?: string;
  provider?: SourceProvider;
  excerpt?: string;
  retrievalScore?: number;
  sourceRank?: number;
  coOccurrence: number;
  timestamp: string;
};

export type SemanticDiscourseItem = {
  id: string;
  phraseTemplate: string;
  aesthetic: string;
  intent: string;
  observedAt: string;
  modelFamily: string;
  sentiment: "positive" | "neutral" | "mixed";
  evidenceIds: string[];
};

export type VisualCorrelationItem = {
  id: string;
  title: string;
  imageCue: string;
  visualTags: string[];
  correlationScore: number;
  observedWindow: string;
  gradient: string;
  evidenceIds: string[];
  imageUrl?: string;
  imageUrls?: string[];
  imageSource?: string;
  moodboardMode?: boolean;
};

export type ModelStrengthModel = {
  model: string;
  avg: number;
  count: number;
  status: "strong" | "emerging" | "weak";
  evidenceIds: string[];
};

export type ModelStrengthPayload = {
  score: number;
  strong: number;
  observed: number;
  models: ModelStrengthModel[];
};

export type SourceItem = {
  sourceId?: string;
  query: string;
  title: string;
  url: string;
  snippet: string;
  published?: string;
  provider: SourceProvider;
  score?: number;
  passages?: SourcePassage[];
};

export type SourceDocument = {
  id: string;
  query: string;
  title: string;
  url: string;
  provider: SourceProvider;
  rank: number;
  score?: number;
  published?: string;
};

export type SemanticUniversePayload = {
  nodes: GraphNode[];
  links: GraphLink[];
  evidence: Evidence[];
  semanticDiscourse: SemanticDiscourseItem[];
  visualCorrelations: VisualCorrelationItem[];
  modelStrength: ModelStrengthPayload;
  resultType?: ResultType;
  resultReason?: string;
};

export const TRACKED_MODELS = [
  "OpenAI",
  "Claude",
  "Gemini",
  "Perplexity",
  "Copilot",
  "Google AI Overview",
] as const;
