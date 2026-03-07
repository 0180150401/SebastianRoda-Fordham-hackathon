"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const VIEW_WIDTH = 1180;
const VIEW_HEIGHT = 760;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const ESTIMATED_ANALYSIS_SECONDS = 24;
const ANALYSIS_STEPS = [
  "Collecting web results",
  "Extracting semantic signals",
  "Synthesizing GEO graph",
  "Scoring gaps and competitors",
  "Rendering evidence-linked map",
];

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
};

type GraphLink = {
  id: string;
  source: string;
  target: string;
  weight: number;
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

type SemanticUniversePayload = {
  nodes: GraphNode[];
  links: GraphLink[];
  evidence: Evidence[];
  semanticDiscourse: SemanticDiscourseItem[];
  visualCorrelations: VisualCorrelationItem[];
};

type LoosePayload = Partial<{
  nodes: unknown;
  links: unknown;
  evidence: unknown;
  semanticDiscourse: unknown;
  visualCorrelations: unknown;
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

function normalizePayload(payload: LoosePayload): SemanticUniversePayload {
  const nodes = Array.isArray(payload.nodes)
    ? (payload.nodes as GraphNode[]).filter(
        (node) =>
          typeof node?.id === "string" &&
          typeof node?.label === "string" &&
          typeof node?.category === "string",
      )
    : [];

  const links = Array.isArray(payload.links)
    ? (payload.links as GraphLink[]).filter(
        (link) =>
          typeof link?.id === "string" &&
          typeof link?.source === "string" &&
          typeof link?.target === "string" &&
          typeof link?.weight === "number",
      )
    : [];

  const evidence = Array.isArray(payload.evidence)
    ? (payload.evidence as Evidence[]).filter(
        (item) =>
          typeof item?.id === "string" &&
          typeof item?.query === "string" &&
          typeof item?.aiResponse === "string" &&
          typeof item?.sourceTitle === "string" &&
          typeof item?.sourceUrl === "string",
      )
    : [];

  const semanticDiscourse = Array.isArray(payload.semanticDiscourse)
    ? (payload.semanticDiscourse as Array<SemanticDiscourseItem & { phrase?: string }>).map(
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
          modelFamily: item?.modelFamily ?? "mixed models",
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

  const visualCorrelations = Array.isArray(payload.visualCorrelations)
    ? (payload.visualCorrelations as VisualCorrelationItem[]).map((item, index) => ({
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

  return {
    nodes: nodes.length ? nodes : INITIAL_GRAPH.nodes,
    links: links.length ? links : INITIAL_GRAPH.links,
    evidence: evidence.length ? evidence : EVIDENCE,
    semanticDiscourse: semanticDiscourse.length ? semanticDiscourse : SEMANTIC_DISCOURSE,
    visualCorrelations: visualCorrelations.length ? visualCorrelations : VISUAL_CORRELATIONS,
  };
}

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

function nodeColor(category: NodeCategory): string {
  if (category === "brand") return "#0f766e";
  if (category === "aesthetic") return "#2563eb";
  if (category === "query") return "#7c3aed";
  if (category === "competitor") return "#e11d48";
  return "#f97316";
}

function simulateGraph(
  nodes: GraphNode[],
  links: GraphLink[],
  draggedNodeId: string | null,
): void {
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = Math.max(dx * dx + dy * dy, 0.5);
      const repulsion = 3600 / distanceSq;
      const distance = Math.sqrt(distanceSq);
      const nx = dx / distance;
      const ny = dy / distance;
      a.vx -= nx * repulsion;
      a.vy -= ny * repulsion;
      b.vx += nx * repulsion;
      b.vy += ny * repulsion;
    }
  }

  for (const link of links) {
    const sourceIndex = indexById.get(link.source);
    const targetIndex = indexById.get(link.target);
    if (sourceIndex === undefined || targetIndex === undefined) {
      continue;
    }
    const source = nodes[sourceIndex];
    const target = nodes[targetIndex];
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const restLength = 110 + (1 - link.weight) * 140;
    const spring = (distance - restLength) * 0.0075;
    const nx = dx / distance;
    const ny = dy / distance;
    source.vx += nx * spring;
    source.vy += ny * spring;
    target.vx -= nx * spring;
    target.vy -= ny * spring;
  }

  for (const node of nodes) {
    if (node.fixed) {
      node.x = CENTER_X;
      node.y = CENTER_Y;
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    if (draggedNodeId === node.id) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx += (node.anchorX - node.x) * 0.003;
    node.vy += (node.anchorY - node.y) * 0.003;
    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x += node.vx;
    node.y += node.vy;
    node.x = Math.min(Math.max(node.x, 80), VIEW_WIDTH - 80);
    node.y = Math.min(Math.max(node.y, 70), VIEW_HEIGHT - 70);
  }
}

const INITIAL_GRAPH = buildGraph("6 degree's");

export default function Home() {
  const [brandInput, setBrandInput] = useState("6 degree's");
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("brand-core");
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_GRAPH.nodes);
  const [links, setLinks] = useState<GraphLink[]>(INITIAL_GRAPH.links);
  const [evidenceData, setEvidenceData] = useState<Evidence[]>(EVIDENCE);
  const [semanticDiscourseData, setSemanticDiscourseData] =
    useState<SemanticDiscourseItem[]>(SEMANTIC_DISCOURSE);
  const [visualCorrelationsData, setVisualCorrelationsData] =
    useState<VisualCorrelationItem[]>(VISUAL_CORRELATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [analysisElapsedSec, setAnalysisElapsedSec] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let rafId = 0;
    const animate = () => {
      setNodes((previousNodes) => {
        const nextNodes = previousNodes.map((node) => ({ ...node }));
        simulateGraph(nextNodes, links, draggedNodeId);
        return nextNodes;
      });
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(rafId);
  }, [draggedNodeId, links]);

  useEffect(() => {
    if (!isLoading) return;
    const intervalId = window.setInterval(() => {
      setAnalysisElapsedSec((previous) => previous + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const applyUniversePayload = (payload: SemanticUniversePayload, nextBrand: string) => {
    setBrandInput(nextBrand);
    setNodes(payload.nodes);
    setLinks(payload.links);
    setEvidenceData(payload.evidence);
    setSemanticDiscourseData(payload.semanticDiscourse);
    setVisualCorrelationsData(payload.visualCorrelations);
    setSelectedNodeId("brand-core");
    setSelectedLinkId(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setLastRunAt(new Date().toISOString());
  };

  const runSemanticAnalysis = async () => {
    const targetBrand = brandInput.trim();
    if (!targetBrand) return;
    setIsLoading(true);
    setAnalysisElapsedSec(0);
    setLoadError(null);

    try {
      const response = await fetch("/api/semantic-universe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand: targetBrand }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Semantic analysis request failed.");
      }

      const payload = normalizePayload((await response.json()) as LoosePayload);
      applyUniversePayload(payload, targetBrand);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch semantic universe data.";
      setLoadError(message);
      const fallbackGraph = buildGraph(targetBrand);
      setNodes(fallbackGraph.nodes);
      setLinks(fallbackGraph.links);
      setSelectedNodeId("brand-core");
      setSelectedLinkId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const visibleLinks = useMemo(() => {
    if (!showGapsOnly) {
      return links;
    }
    return links.filter((link) => link.missing || link.weight < 0.4);
  }, [links, showGapsOnly]);

  const visibleNodeIds = useMemo(() => {
    if (!showGapsOnly) {
      return new Set(nodes.map((node) => node.id));
    }
    const ids = new Set<string>(["brand-core"]);
    for (const link of visibleLinks) {
      ids.add(link.source);
      ids.add(link.target);
    }
    return ids;
  }, [nodes, showGapsOnly, visibleLinks]);

  const visibleNodes = useMemo(
    () => nodes.filter((node) => visibleNodeIds.has(node.id)),
    [nodes, visibleNodeIds],
  );

  const selectedLink = selectedLinkId
    ? links.find((link) => link.id === selectedLinkId) ?? null
    : null;
  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  const activeEvidence = useMemo(() => {
    if (selectedLink) {
      const selectedEvidenceIds = Array.isArray(selectedLink.evidenceIds)
        ? selectedLink.evidenceIds
        : [];
      return evidenceData.filter((entry) => selectedEvidenceIds.includes(entry.id));
    }

    if (selectedNode) {
      const evidenceIds = new Set<string>();
      for (const link of links) {
        if (link.source === selectedNode.id || link.target === selectedNode.id) {
          const linkEvidenceIds = Array.isArray(link.evidenceIds) ? link.evidenceIds : [];
          for (const evidenceId of linkEvidenceIds) {
            evidenceIds.add(evidenceId);
          }
        }
      }
      return evidenceData.filter((entry) => evidenceIds.has(entry.id));
    }

    const coreEvidenceIds = new Set<string>();
    for (const link of links) {
      if (link.source === "brand-core") {
        const linkEvidenceIds = Array.isArray(link.evidenceIds) ? link.evidenceIds : [];
        for (const evidenceId of linkEvidenceIds) {
          coreEvidenceIds.add(evidenceId);
        }
      }
    }
    return evidenceData.filter((entry) => coreEvidenceIds.has(entry.id));
  }, [evidenceData, links, selectedLink, selectedNode]);

  const evidenceCoverage =
    links.length === 0
      ? 0
      : Math.round(
          (links.filter((link) => Array.isArray(link.evidenceIds) && link.evidenceIds.length > 0)
            .length /
            links.length) *
            100,
        );
  const weakLinkCount = links.filter((link) => link.missing || link.weight < 0.4).length;
  const activeEvidenceIds = useMemo(
    () => new Set(activeEvidence.map((entry) => entry.id)),
    [activeEvidence],
  );
  const discourseView = useMemo(() => {
    const normalizedBrand = brandInput.trim() || "the brand";
    return semanticDiscourseData.map((item) => ({
      ...item,
      phrase: (item.phraseTemplate ?? "Users mention {brand} in semantic clusters.").replace(
        "{brand}",
        normalizedBrand,
      ),
      isInScope: (Array.isArray(item.evidenceIds) ? item.evidenceIds : []).some((id) =>
        activeEvidenceIds.has(id),
      ),
    }));
  }, [activeEvidenceIds, brandInput, semanticDiscourseData]);
  const visualCorrelationView = useMemo(
    () =>
      visualCorrelationsData.map((item) => ({
        ...item,
        isInScope: (Array.isArray(item.evidenceIds) ? item.evidenceIds : []).some((id) =>
          activeEvidenceIds.has(id),
        ),
      })),
    [activeEvidenceIds, visualCorrelationsData],
  );
  const completedStepCount = Math.min(
    ANALYSIS_STEPS.length,
    Math.max(
      1,
      Math.floor((Math.min(analysisElapsedSec, ESTIMATED_ANALYSIS_SECONDS) / ESTIMATED_ANALYSIS_SECONDS) * ANALYSIS_STEPS.length) + 1,
    ),
  );
  const estimatedRemainingSec = Math.max(0, ESTIMATED_ANALYSIS_SECONDS - analysisElapsedSec);
  const currentStepLabel = ANALYSIS_STEPS[Math.max(0, completedStepCount - 1)];

  const toGraphCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) {
      return { x: CENTER_X, y: CENTER_Y };
    }
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * VIEW_HEIGHT;
    return {
      x: (x - pan.x) / zoom,
      y: (y - pan.y) / zoom,
    };
  };

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-6">
      <main className="mx-auto grid w-full max-w-[1600px] gap-4 lg:grid-cols-[1.8fr_1fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex flex-col gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-primary)]">
                6 degree&apos;s semantic universe
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Explore brand position as a living knowledge graph
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-black dark:text-zinc-300">
                Enter a brand and inspect how concepts co-occur in AI answers and search
                behavior. Click nodes and links to inspect underlying evidence.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSemanticAnalysis();
                }}
              >
                <label htmlFor="brand-input" className="mb-1 block text-sm font-medium">
                  Brand under analysis
                </label>
                <div className="flex gap-2">
                  <input
                    id="brand-input"
                    value={brandInput}
                    onChange={(event) => setBrandInput(event.target.value)}
                    className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none ring-[var(--brand-primary)]/50 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Type brand name"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 whitespace-nowrap rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? "Analyzing..." : "Analyze"}
                  </button>
                </div>
              </form>
              {loadError ? (
                <p className="mt-2 text-xs text-rose-500">{loadError}</p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-black dark:text-zinc-300">
                    {lastRunAt
                      ? `Live data updated ${new Date(lastRunAt).toLocaleTimeString()}`
                      : "Run analysis to fetch OpenAI + Tavily + Exa data."}
                  </p>
                  {isLoading ? (
                    <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900/60">
                      <p className="font-medium text-zinc-700 dark:text-zinc-200">
                        Estimated run: {completedStepCount}/{ANALYSIS_STEPS.length} steps
                      </p>
                      <p className="mt-1 text-black dark:text-zinc-300">
                        {currentStepLabel} • ~{estimatedRemainingSec}s remaining
                      </p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
                          style={{
                            width: `${Math.min(100, (completedStepCount / ANALYSIS_STEPS.length) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-black dark:text-zinc-300">Evidence-backed links</p>
              <p className="mt-1 text-lg font-semibold">{evidenceCoverage}%</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-black dark:text-zinc-300">Weak or missing edges</p>
              <p className="mt-1 text-lg font-semibold">{weakLinkCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-black dark:text-zinc-300">Show only gaps</span>
                <input
                  type="checkbox"
                  checked={showGapsOnly}
                  onChange={() => setShowGapsOnly((value) => !value)}
                />
              </label>
              <p className="mt-1 text-xs text-black dark:text-zinc-300">
                Highlights where competitors dominate intent.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              className="h-[72vh] w-full cursor-grab touch-none"
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                setIsPanning(true);
                panStartRef.current = {
                  x: event.clientX - pan.x,
                  y: event.clientY - pan.y,
                };
              }}
              onMouseMove={(event) => {
                if (draggedNodeId) {
                  const point = toGraphCoords(event.clientX, event.clientY);
                  setNodes((previousNodes) =>
                    previousNodes.map((node) =>
                      node.id === draggedNodeId
                        ? { ...node, x: point.x, y: point.y, vx: 0, vy: 0 }
                        : node,
                    ),
                  );
                  return;
                }

                if (!isPanning) return;
                setPan({
                  x: event.clientX - panStartRef.current.x,
                  y: event.clientY - panStartRef.current.y,
                });
              }}
              onMouseUp={() => {
                setDraggedNodeId(null);
                setIsPanning(false);
              }}
              onMouseLeave={() => {
                setDraggedNodeId(null);
                setIsPanning(false);
              }}
              onWheel={(event) => {
                event.preventDefault();
                const nextZoom = Math.max(0.6, Math.min(1.8, zoom - event.deltaY * 0.001));
                setZoom(nextZoom);
              }}
            >
              <rect x={0} y={0} width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="transparent" />
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                <text x={120} y={120} fill="var(--foreground)" opacity={0.9} fontSize={14}>
                  Aesthetic cluster
                </text>
                <text x={910} y={215} fill="var(--foreground)" opacity={0.9} fontSize={14}>
                  Competitor gravity
                </text>
                <text x={875} y={610} fill="#fb7185" fontSize={14}>
                  Uncaptured intent
                </text>

                {visibleLinks.map((link) => {
                  const source = nodeMap.get(link.source);
                  const target = nodeMap.get(link.target);
                  if (!source || !target) return null;
                  const isSelected = selectedLinkId === link.id;
                  const opacity = Math.min(0.95, 0.18 + link.weight);
                  return (
                    <g
                      key={link.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedLinkId(link.id);
                        setSelectedNodeId("");
                      }}
                      className="cursor-pointer"
                    >
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={link.missing ? "#fb7185" : "#64748b"}
                        strokeWidth={isSelected ? 4 : 2 + link.weight * 2}
                        strokeOpacity={isSelected ? 1 : opacity}
                        strokeDasharray={link.missing ? "7 6" : undefined}
                      />
                      {link.dominantCompetitor ? (
                        <text
                          x={(source.x + target.x) / 2 + 6}
                          y={(source.y + target.y) / 2 - 6}
                          fill="#f43f5e"
                          fontSize={11}
                        >
                          {link.dominantCompetitor} dominates
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                {visibleNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedNodeId(node.id);
                        setSelectedLinkId(null);
                      }}
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        if (!node.fixed) {
                          setDraggedNodeId(node.id);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        r={node.size}
                        fill={nodeColor(node.category)}
                        opacity={node.category === "gap" ? 0.35 : 0.9}
                        stroke={isSelected ? "#f8fafc" : "transparent"}
                        strokeWidth={isSelected ? 3 : 0}
                      />
                      <text
                        y={node.size + 18}
                        textAnchor="middle"
                        fill={node.category === "gap" ? "#c2410c" : "var(--foreground)"}
                        fontSize={13}
                      >
                        {node.label}
                      </text>
                      {node.gapHint ? (
                        <text y={node.size + 33} textAnchor="middle" fill="#fb7185" fontSize={11}>
                          {node.gapHint}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </section>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Evidence explorer</h2>
          <p className="mt-1 text-sm text-black dark:text-zinc-300">
            Every node and edge is traceable to actual AI responses and query sources.
          </p>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <p className="font-medium">
              {selectedLink
                ? "Relationship selected"
                : selectedNode
                  ? "Node selected"
                  : "Brand overview"}
            </p>
            {selectedLink ? (
              <p className="mt-1 text-black dark:text-zinc-300">
                {nodeMap.get(selectedLink.source)?.label} →{" "}
                {nodeMap.get(selectedLink.target)?.label} (strength{" "}
                {Math.round(selectedLink.weight * 100)}%)
              </p>
            ) : null}
            {selectedNode ? (
              <p className="mt-1 text-black dark:text-zinc-300">
                {selectedNode.label} ({selectedNode.category})
              </p>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {activeEvidence.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-black dark:border-zinc-700 dark:text-zinc-300">
                No evidence in the selected scope.
              </p>
            ) : null}
            {activeEvidence.map((entry) => (
              <article
                key={entry.id}
                className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-medium">{entry.query}</p>
                <p className="mt-2 text-black dark:text-zinc-300">{entry.aiResponse}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    co-occur: {entry.coOccurrence}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    {entry.timestamp}
                  </span>
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--brand-primary)] underline underline-offset-2"
                  >
                    {entry.sourceTitle}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </main>

      <section className="mx-auto mt-4 w-full max-w-[1600px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <h2 className="text-xl font-semibold tracking-tight">
            How users semantically talk about {brandInput.trim() || "this brand"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-black dark:text-zinc-300">
            This section translates prompt language into discourse patterns and correlates
            those patterns to visual cues. Every pattern is timestamped and tied to
            evidence from AI response logs.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Semantic discourse stream</p>
            {discourseView.map((item) => (
              <article
                key={item.id}
                className={`rounded-lg border p-3 text-sm transition ${
                  item.isInScope
                    ? "border-[var(--brand-primary)]/50 bg-[var(--brand-primary)]/5"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <p className="font-medium">{item.phrase}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    aesthetic: {item.aesthetic}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    intent: {item.intent}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    model: {item.modelFamily}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    sentiment: {item.sentiment}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                    seen: {item.observedAt}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Visual correlation board</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {visualCorrelationView.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg border p-3 text-sm ${
                    item.isInScope
                      ? "border-[var(--brand-primary)]/50"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-24 w-full rounded-md border border-black/10 object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="relative h-24 rounded-md border border-black/10"
                      style={{ backgroundImage: item.gradient }}
                      aria-label={item.title}
                    >
                      <span className="absolute right-2 top-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                        Moodboard
                      </span>
                    </div>
                  )}
                  <p className="mt-3 font-medium">{item.title}</p>
                  <p className="mt-1 text-black dark:text-zinc-300">{item.imageCue}</p>
                  {item.imageSource ? (
                    <a
                      href={item.imageSource}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-[var(--brand-primary)] underline underline-offset-2"
                    >
                      image source
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-black dark:text-zinc-300">
                      Visual proxy generated from semantic language.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {item.visualTags.map((tag) => (
                      <span key={tag} className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-black dark:text-zinc-300">
                    correlation: {Math.round(item.correlationScore * 100)}% • {item.observedWindow}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
