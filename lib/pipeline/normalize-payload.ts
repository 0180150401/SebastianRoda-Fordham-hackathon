/**
 * Pure payload normalization for semantic-universe stream `done` events.
 * Extracted from app/tool/page.tsx (Phase 01-01).
 */

const VIEW_WIDTH = 1180;
const VIEW_HEIGHT = 760;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;

type NodeCategory = "brand" | "aesthetic" | "query" | "competitor" | "gap";

type Evidence = {
  id: string;
  query: string;
  aiResponse: string;
  sourceTitle: string;
  sourceUrl: string;
  coOccurrence: number;
  timestamp: string;
};

type GraphNode = {
  id: string;
  label: string;
  category: NodeCategory;
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

type GraphLink = {
  id: string;
  source: string;
  target: string;
  weight: number;
  sourceIds?: string[];
  evidenceIds: string[];
  dominantCompetitor?: string;
  missing?: boolean;
};

type SemanticDiscourseItem = {
  id: string;
  phraseTemplate: string;
  aesthetic: string;
  intent: string;
  observedAt: string;
  modelFamily: string;
  sentiment: "positive" | "neutral" | "mixed";
  evidenceIds: string[];
};

type VisualCorrelationItem = {
  id: string;
  title: string;
  imageCue: string;
  visualTags: string[];
  correlationScore: number;
  observedWindow: string;
  gradient: string;
  evidenceIds: string[];
  imageUrl?: string;
  imageSource?: string;
  moodboardMode?: boolean;
};

type ModelStrengthSeed = {
  model: string;
  avg: number;
  count: number;
  evidenceIds: string[];
};

export type SemanticUniversePayload = {
  nodes: GraphNode[];
  links: GraphLink[];
  evidence: Evidence[];
  semanticDiscourse: SemanticDiscourseItem[];
  visualCorrelations: VisualCorrelationItem[];
  modelStrength: ModelStrengthSeed[];
  resultType?: "success" | "degraded" | "fallback";
  resultReason?: string;
};


type LoosePayload = Partial<{
  nodes: unknown;
  links: unknown;
  evidence: unknown;
  semanticDiscourse: unknown;
  visualCorrelations: unknown;
  modelStrength: unknown;
  resultType: unknown;
  resultReason: unknown;
}>;

const EVIDENCE: Evidence[] = [
  {
    id: "ev-01",
    query: "Best minimalist Parisian labels for women in 2026",
    aiResponse:
      "Sezane and Toteme dominate this look. 6 degree's is only mentioned in one response thread focused on workwear capsules.",
    sourceTitle: "Google AI Overview - FR fashion intent sample",
    sourceUrl: "https://example.com/google-ai-overview-fashion-fr",
    coOccurrence: 43,
    timestamp: "2026-03-04",
  },
  {
    id: "ev-02",
    query: "Quiet luxury alternatives to The Row",
    aiResponse:
      "The model repeatedly returns Loro Piana, Khaite, and Jil Sander. 6 degree's appears with low confidence and no product-level citation.",
    sourceTitle: "OpenAI response sample set A12",
    sourceUrl: "https://example.com/openai-set-a12",
    coOccurrence: 57,
    timestamp: "2026-03-02",
  },
  {
    id: "ev-03",
    query: "Parisian streetwear brands with clean tailoring",
    aiResponse:
      "Ami Paris and A.P.C. are core entities. 6 degree's is connected to tailoring but not to streetwear intent terms.",
    sourceTitle: "Perplexity trend extraction",
    sourceUrl: "https://example.com/perplexity-fashion-paris",
    coOccurrence: 38,
    timestamp: "2026-03-01",
  },
  {
    id: "ev-04",
    query: "Capsule wardrobe brands for premium basics",
    aiResponse:
      "6 degree's has moderate co-mentions with capsule wardrobe and premium basics, mostly in long-form recommendation responses.",
    sourceTitle: "Bing Copilot search + answer log",
    sourceUrl: "https://example.com/copilot-capsule",
    coOccurrence: 61,
    timestamp: "2026-03-05",
  },
  {
    id: "ev-05",
    query: "Ethical quiet luxury labels with modern silhouettes",
    aiResponse:
      "6 degree's shows up when sustainability constraints are explicit. Without that qualifier, competitor mentions absorb most answer share.",
    sourceTitle: "Claude + search ground truth run",
    sourceUrl: "https://example.com/claude-ground-truth",
    coOccurrence: 49,
    timestamp: "2026-03-03",
  },
  {
    id: "ev-06",
    query: "Brands similar to Toteme but younger and bolder",
    aiResponse:
      "Coperni and Acne Studios dominate. 6 degree's has weak adjacency to the 'younger + bold' semantic axis.",
    sourceTitle: "Gemini query bundle 9",
    sourceUrl: "https://example.com/gemini-bundle-9",
    coOccurrence: 35,
    timestamp: "2026-03-04",
  },
  {
    id: "ev-07",
    query: "What is the best minimalist streetwear in Paris?",
    aiResponse:
      "A.P.C., Maison Kitsune, and Ami appear in >80% of responses. 6 degree's only appears in follow-up prompts.",
    sourceTitle: "Cross-model overlap analysis",
    sourceUrl: "https://example.com/cross-model-overlap",
    coOccurrence: 67,
    timestamp: "2026-03-06",
  },
  {
    id: "ev-08",
    query: "Understated luxury clothing for professionals",
    aiResponse:
      "6 degree's is directly linked with understated tailoring and elevated basics with strong confidence in two model families.",
    sourceTitle: "Internal GEO answer corpus",
    sourceUrl: "https://example.com/internal-geo-corpus",
    coOccurrence: 71,
    timestamp: "2026-03-05",
  },
  {
    id: "ev-09",
    query: "Who owns quiet luxury in AI recommendations?",
    aiResponse:
      "The Row, Loro Piana, and Khaite dominate central graph degree. 6 degree's has weak edge density in the quiet luxury cluster.",
    sourceTitle: "Entity graph centrality export",
    sourceUrl: "https://example.com/entity-centrality",
    coOccurrence: 54,
    timestamp: "2026-03-06",
  },
  {
    id: "ev-10",
    query: "Parisian minimalist brands with sustainable sourcing",
    aiResponse:
      "6 degree's scores high when sustainability and traceability are required in the prompt, creating a strong triad with minimalist terms.",
    sourceTitle: "Search query n-gram report",
    sourceUrl: "https://example.com/ngram-report",
    coOccurrence: 64,
    timestamp: "2026-03-07",
  },
  {
    id: "ev-11",
    query: "Best quiet luxury handbags alternatives",
    aiResponse:
      "No direct 6 degree's mention in top responses. Competitor nodes absorb intent around accessories and status signaling.",
    sourceTitle: "Accessories intent sample",
    sourceUrl: "https://example.com/accessories-intent",
    coOccurrence: 41,
    timestamp: "2026-03-02",
  },
  {
    id: "ev-12",
    query: "How do users describe 6 degree's style?",
    aiResponse:
      "Most grounded descriptors: minimalist, polished, architectural, and modern Parisian. Streetwear appears as a weak edge.",
    sourceTitle: "Descriptor extraction notebook",
    sourceUrl: "https://example.com/descriptor-extraction",
    coOccurrence: 59,
    timestamp: "2026-03-07",
  },
];

const SEMANTIC_DISCOURSE: SemanticDiscourseItem[] = [
  {
    id: "sd-01",
    phraseTemplate:
      "Users ask for brands like {brand} when they want minimalist workwear that still feels Parisian.",
    aesthetic: "minimalist + parisian",
    intent: "professional capsule",
    observedAt: "2026-03-07",
    modelFamily: "OpenAI, Claude",
    sentiment: "positive",
    evidenceIds: ["ev-08", "ev-10", "ev-12"],
  },
  {
    id: "sd-02",
    phraseTemplate:
      "People compare {brand} to Toteme but describe it as warmer and more wearable for daily office life.",
    aesthetic: "quiet structure",
    intent: "brand comparison",
    observedAt: "2026-03-04",
    modelFamily: "Gemini, Perplexity",
    sentiment: "mixed",
    evidenceIds: ["ev-01", "ev-06"],
  },
  {
    id: "sd-03",
    phraseTemplate:
      "When prompts mention streetwear, {brand} is often absent unless users force a follow-up query.",
    aesthetic: "streetwear",
    intent: "discovery gap",
    observedAt: "2026-03-06",
    modelFamily: "Cross-model overlap",
    sentiment: "mixed",
    evidenceIds: ["ev-03", "ev-07"],
  },
  {
    id: "sd-04",
    phraseTemplate:
      "Users looking for ethical quiet luxury explicitly ask if {brand} has traceable sourcing and responsible materials.",
    aesthetic: "quiet luxury + ethical",
    intent: "trust validation",
    observedAt: "2026-03-03",
    modelFamily: "Claude, Bing Copilot",
    sentiment: "positive",
    evidenceIds: ["ev-05", "ev-10"],
  },
  {
    id: "sd-05",
    phraseTemplate:
      "Accessory-focused prompts rarely include {brand}, even when users describe similar silhouettes and price points.",
    aesthetic: "accessories + understated",
    intent: "uncaptured demand",
    observedAt: "2026-03-02",
    modelFamily: "Google AI Overview",
    sentiment: "neutral",
    evidenceIds: ["ev-11", "ev-09"],
  },
];

const VISUAL_CORRELATIONS: VisualCorrelationItem[] = [
  {
    id: "vc-01",
    title: "Architectural minimalism",
    imageCue: "Clean tailoring, cool neutrals, matte textures",
    visualTags: ["stone", "charcoal", "structured silhouette"],
    correlationScore: 0.84,
    observedWindow: "Seen consistently: Mar 04 - Mar 07",
    gradient: "linear-gradient(140deg, #d4d4d8 0%, #a1a1aa 45%, #3f3f46 100%)",
    evidenceIds: ["ev-08", "ev-10", "ev-12"],
  },
  {
    id: "vc-02",
    title: "Parisian polished",
    imageCue: "Soft daylight, tailored layers, understated luxury cues",
    visualTags: ["cream", "ink black", "city classic"],
    correlationScore: 0.76,
    observedWindow: "Spike in prompts: Mar 01 - Mar 05",
    gradient: "linear-gradient(140deg, #f5f5f4 0%, #d6d3d1 45%, #57534e 100%)",
    evidenceIds: ["ev-01", "ev-04", "ev-12"],
  },
  {
    id: "vc-03",
    title: "Streetwear adjacency gap",
    imageCue: "Relaxed silhouettes and bold contrast still map to competitors",
    visualTags: ["high contrast", "oversized", "youthful edge"],
    correlationScore: 0.31,
    observedWindow: "Persistent gap: Mar 03 - Mar 07",
    gradient: "linear-gradient(140deg, #0f172a 0%, #1e293b 45%, #be123c 100%)",
    evidenceIds: ["ev-03", "ev-07"],
  },
  {
    id: "vc-04",
    title: "Quiet luxury accessories gap",
    imageCue: "Premium accessories signals resolve to established rivals",
    visualTags: ["leather focus", "status minimalism", "heritage cues"],
    correlationScore: 0.28,
    observedWindow: "Uncaptured cluster: Mar 02 - Mar 06",
    gradient: "linear-gradient(140deg, #fafaf9 0%, #e7e5e4 45%, #fb7185 100%)",
    evidenceIds: ["ev-11", "ev-09"],
  },
];

function buildGraph(brand: string): { nodes: GraphNode[]; links: GraphLink[] } {
  const normalizedBrand = brand.trim() || "Your brand";
  const nodes: GraphNode[] = [
    {
      id: "brand-core",
      label: normalizedBrand,
      category: "brand",
      x: CENTER_X,
      y: CENTER_Y,
      vx: 0,
      vy: 0,
      size: 26,
      anchorX: CENTER_X,
      anchorY: CENTER_Y,
      fixed: true,
    },
    {
      id: "minimalist",
      label: "Minimalist",
      category: "aesthetic",
      x: 410,
      y: 250,
      vx: 0,
      vy: 0,
      size: 18,
      anchorX: 430,
      anchorY: 240,
    },
    {
      id: "parisian",
      label: "Parisian",
      category: "aesthetic",
      x: 575,
      y: 210,
      vx: 0,
      vy: 0,
      size: 16,
      anchorX: 620,
      anchorY: 220,
    },
    {
      id: "streetwear",
      label: "Streetwear",
      category: "aesthetic",
      x: 795,
      y: 280,
      vx: 0,
      vy: 0,
      size: 15,
      anchorX: 780,
      anchorY: 280,
    },
    {
      id: "quiet-luxury",
      label: "Quiet luxury",
      category: "aesthetic",
      x: 810,
      y: 450,
      vx: 0,
      vy: 0,
      size: 18,
      anchorX: 790,
      anchorY: 470,
    },
    {
      id: "capsule-wardrobe",
      label: "Capsule wardrobe",
      category: "query",
      x: 560,
      y: 565,
      vx: 0,
      vy: 0,
      size: 14,
      anchorX: 560,
      anchorY: 560,
    },
    {
      id: "sustainable-luxury",
      label: "Sustainable luxury",
      category: "query",
      x: 350,
      y: 515,
      vx: 0,
      vy: 0,
      size: 14,
      anchorX: 360,
      anchorY: 510,
    },
    {
      id: "toteme",
      label: "Toteme",
      category: "competitor",
      x: 315,
      y: 285,
      vx: 0,
      vy: 0,
      size: 13,
      anchorX: 300,
      anchorY: 300,
    },
    {
      id: "ami-paris",
      label: "Ami Paris",
      category: "competitor",
      x: 735,
      y: 185,
      vx: 0,
      vy: 0,
      size: 13,
      anchorX: 730,
      anchorY: 190,
    },
    {
      id: "khaite",
      label: "Khaite",
      category: "competitor",
      x: 920,
      y: 490,
      vx: 0,
      vy: 0,
      size: 12,
      anchorX: 920,
      anchorY: 500,
    },
    {
      id: "the-row",
      label: "The Row",
      category: "competitor",
      x: 900,
      y: 400,
      vx: 0,
      vy: 0,
      size: 12,
      anchorX: 930,
      anchorY: 390,
    },
    {
      id: "gap-streetwear",
      label: "Gap: streetwear authority",
      category: "gap",
      x: 905,
      y: 315,
      vx: 0,
      vy: 0,
      size: 12,
      anchorX: 900,
      anchorY: 325,
      gapHint: "Competitors dominate this cluster.",
    },
    {
      id: "gap-accessories",
      label: "Gap: accessories intent",
      category: "gap",
      x: 955,
      y: 575,
      vx: 0,
      vy: 0,
      size: 12,
      anchorX: 960,
      anchorY: 570,
      gapHint: "No strong brand mentions in AI answers.",
    },
  ];

  const links: GraphLink[] = [
    {
      id: "l-brand-minimalist",
      source: "brand-core",
      target: "minimalist",
      weight: 0.85,
      evidenceIds: ["ev-08", "ev-10", "ev-12"],
    },
    {
      id: "l-brand-parisian",
      source: "brand-core",
      target: "parisian",
      weight: 0.72,
      evidenceIds: ["ev-01", "ev-12"],
    },
    {
      id: "l-brand-streetwear",
      source: "brand-core",
      target: "streetwear",
      weight: 0.32,
      evidenceIds: ["ev-03", "ev-07"],
      missing: true,
      dominantCompetitor: "Ami Paris",
    },
    {
      id: "l-brand-quiet",
      source: "brand-core",
      target: "quiet-luxury",
      weight: 0.39,
      evidenceIds: ["ev-02", "ev-09"],
      missing: true,
      dominantCompetitor: "The Row",
    },
    {
      id: "l-brand-capsule",
      source: "brand-core",
      target: "capsule-wardrobe",
      weight: 0.67,
      evidenceIds: ["ev-04", "ev-08"],
    },
    {
      id: "l-brand-sustainability",
      source: "brand-core",
      target: "sustainable-luxury",
      weight: 0.74,
      evidenceIds: ["ev-05", "ev-10"],
    },
    {
      id: "l-minimalist-toteme",
      source: "minimalist",
      target: "toteme",
      weight: 0.66,
      evidenceIds: ["ev-01", "ev-06"],
      dominantCompetitor: "Toteme",
    },
    {
      id: "l-streetwear-ami",
      source: "streetwear",
      target: "ami-paris",
      weight: 0.81,
      evidenceIds: ["ev-03", "ev-07"],
      dominantCompetitor: "Ami Paris",
    },
    {
      id: "l-quiet-row",
      source: "quiet-luxury",
      target: "the-row",
      weight: 0.87,
      evidenceIds: ["ev-02", "ev-09"],
      dominantCompetitor: "The Row",
    },
    {
      id: "l-quiet-khaite",
      source: "quiet-luxury",
      target: "khaite",
      weight: 0.79,
      evidenceIds: ["ev-02", "ev-09"],
      dominantCompetitor: "Khaite",
    },
    {
      id: "l-streetwear-gap",
      source: "streetwear",
      target: "gap-streetwear",
      weight: 0.2,
      evidenceIds: ["ev-07"],
      missing: true,
    },
    {
      id: "l-quiet-accessory-gap",
      source: "quiet-luxury",
      target: "gap-accessories",
      weight: 0.18,
      evidenceIds: ["ev-11"],
      missing: true,
    },
  ];

  return { nodes, links };
}

const INITIAL_GRAPH = buildGraph("6 degree's");

export function normalizePayload(payload: unknown): SemanticUniversePayload {
  const payloadLoose: LoosePayload =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as LoosePayload)
      : {};
  const nodes = Array.isArray(payloadLoose.nodes)
    ? (payloadLoose.nodes as GraphNode[]).filter(
        (node) =>
          typeof node?.id === "string" &&
          typeof node?.label === "string" &&
          typeof node?.category === "string",
      )
    : [];

  const links = Array.isArray(payloadLoose.links)
    ? (payloadLoose.links as GraphLink[]).filter(
        (link) =>
          typeof link?.id === "string" &&
          typeof link?.source === "string" &&
          typeof link?.target === "string" &&
          typeof link?.weight === "number",
      )
    : [];

  const evidence = Array.isArray(payloadLoose.evidence)
    ? (payloadLoose.evidence as Evidence[]).filter(
        (item) =>
          typeof item?.id === "string" &&
          typeof item?.query === "string" &&
          typeof item?.aiResponse === "string" &&
          typeof item?.sourceTitle === "string" &&
          typeof item?.sourceUrl === "string",
      )
    : [];

  const semanticDiscourse = Array.isArray(payloadLoose.semanticDiscourse)
    ? (payloadLoose.semanticDiscourse as Array<SemanticDiscourseItem & { phrase?: string; model?: string }>).map(
        (item, index) => ({
          id: item?.id ?? `sd-${index + 1}`,
          phraseTemplate:
            typeof item?.phraseTemplate === "string"
              ? item.phraseTemplate
              : typeof item?.phrase === "string"
                ? item.phrase
                : "Users discuss {brand} in a variety of semantic contexts.",
          aesthetic: item?.aesthetic ?? "unspecified",
          intent: item?.intent ?? "unspecified",
          observedAt: item?.observedAt ?? new Date().toISOString().slice(0, 10),
          modelFamily:
            typeof item?.modelFamily === "string"
              ? item.modelFamily
              : typeof item?.model === "string"
                ? item.model
                : "mixed models",
          sentiment:
            item?.sentiment === "positive" || item?.sentiment === "neutral" || item?.sentiment === "mixed"
              ? item.sentiment
              : "neutral",
          evidenceIds: Array.isArray(item?.evidenceIds)
            ? item.evidenceIds.filter((evidenceId): evidenceId is string => typeof evidenceId === "string")
            : [],
        }),
      )
    : [];

  const visualCorrelations = Array.isArray(payloadLoose.visualCorrelations)
    ? (payloadLoose.visualCorrelations as VisualCorrelationItem[]).map((item, index) => ({
        id: item?.id ?? `vc-${index + 1}`,
        title: item?.title ?? "Visual correlation",
        imageCue: item?.imageCue ?? "No visual cue available.",
        visualTags: Array.isArray(item?.visualTags)
          ? item.visualTags.filter((tag): tag is string => typeof tag === "string")
          : [],
        correlationScore:
          typeof item?.correlationScore === "number"
            ? Math.max(0, Math.min(1, item.correlationScore))
            : 0.5,
        observedWindow: item?.observedWindow ?? "Observation window unavailable",
        gradient:
          item?.gradient ??
          "linear-gradient(140deg, #d4d4d8 0%, #a1a1aa 45%, #3f3f46 100%)",
        evidenceIds: Array.isArray(item?.evidenceIds)
          ? item.evidenceIds.filter((evidenceId): evidenceId is string => typeof evidenceId === "string")
          : [],
        imageUrl:
          typeof item?.imageUrl === "string" && item.imageUrl.length > 0
            ? item.imageUrl
            : undefined,
        imageSource:
          typeof item?.imageSource === "string" && item.imageSource.length > 0
            ? item.imageSource
            : undefined,
        moodboardMode: typeof item?.moodboardMode === "boolean" ? item.moodboardMode : undefined,
      }))
    : [];

  const modelStrength = Array.isArray(payloadLoose.modelStrength)
    ? (payloadLoose.modelStrength as ModelStrengthSeed[]).filter(
        (item) =>
          typeof item?.model === "string" &&
          typeof item?.avg === "number" &&
          typeof item?.count === "number",
      )
    : payloadLoose.modelStrength &&
        typeof payloadLoose.modelStrength === "object" &&
        Array.isArray((payloadLoose.modelStrength as { models?: unknown[] }).models)
      ? ((payloadLoose.modelStrength as { models: ModelStrengthSeed[] }).models ?? []).filter(
          (item) =>
            typeof item?.model === "string" &&
            typeof item?.avg === "number" &&
            typeof item?.count === "number",
        )
      : [];

  return {
    nodes: nodes.length ? nodes : INITIAL_GRAPH.nodes,
    links: links.length ? links : INITIAL_GRAPH.links,
    evidence: evidence.length ? evidence : EVIDENCE,
    semanticDiscourse: semanticDiscourse.length ? semanticDiscourse : SEMANTIC_DISCOURSE,
    visualCorrelations: visualCorrelations.length ? visualCorrelations : VISUAL_CORRELATIONS,
    modelStrength,
    resultType:
      payloadLoose.resultType === "success" ||
      payloadLoose.resultType === "degraded" ||
      payloadLoose.resultType === "fallback"
        ? payloadLoose.resultType
        : undefined,
    resultReason: typeof payloadLoose.resultReason === "string" ? payloadLoose.resultReason : undefined,
  };
}
