"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { RequireToolAuth } from "@/components/auth/require-tool-auth";
import { AccountMenu } from "@/components/tool/account-menu";
import { InfoHint } from "@/components/tool/info-hint";
import { ModelStrengthDash } from "@/components/tool/model-strength-dash";
import { ToolPaywall } from "@/components/tool/tool-paywall";
import AgentPlan, { type AgentPlanTask } from "@/components/ui/agent-plan";
import { ToolAccessGate, useToolAccess } from "@/components/tool/tool-access-gate";
import { cn } from "@/lib/utils";

const VIEW_WIDTH = 1180;
const VIEW_HEIGHT = 760;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const DEMO_STORAGE_KEY = "semantic_demo_used";

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

type ModelStrengthSeed = {
  model: string;
  avg: number;
  count: number;
  evidenceIds: string[];
};

type SemanticUniversePayload = {
  nodes: GraphNode[];
  links: GraphLink[];
  evidence: Evidence[];
  semanticDiscourse: SemanticDiscourseItem[];
  visualCorrelations: VisualCorrelationItem[];
  modelStrength: ModelStrengthSeed[];
};

type StepId = "sources" | "synthesis" | "images";
type StreamEvent =
  | { type: "step"; id: StepId; status: "running" | "done" | "error"; detail?: string }
  | { type: "done"; payload: LoosePayload }
  | { type: "error"; message: string };

type ToolAccessPayload = {
  subscriptionActive: boolean;
  hasFreeDemoRemaining: boolean;
};

type LoosePayload = Partial<{
  nodes: unknown;
  links: unknown;
  evidence: unknown;
  semanticDiscourse: unknown;
  visualCorrelations: unknown;
  modelStrength: unknown;
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
    ? (payload.semanticDiscourse as Array<SemanticDiscourseItem & { phrase?: string; model?: string }>).map(
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

  const modelStrength = Array.isArray(payload.modelStrength)
    ? (payload.modelStrength as ModelStrengthSeed[]).filter(
        (item) =>
          typeof item?.model === "string" &&
          typeof item?.avg === "number" &&
          typeof item?.count === "number",
      )
    : payload.modelStrength &&
        typeof payload.modelStrength === "object" &&
        Array.isArray((payload.modelStrength as { models?: unknown[] }).models)
      ? ((payload.modelStrength as { models: ModelStrengthSeed[] }).models ?? []).filter(
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

function makePipelineTasks(): AgentPlanTask[] {
  return [
    {
      id: "sources",
      title: "Collecting web sources",
      description: "Querying Tavily and Exa for shared-space news co-occurrence context",
      status: "pending",
      priority: "high",
      level: 0,
      dependencies: [],
      subtasks: [
        { id: "sources.1", title: "Tavily: shared-space news overlap", description: "3 queries for brand+competitor co-occurrence in overlapping categories", status: "pending", priority: "high" },
        { id: "sources.2", title: "Exa: dominance by intent space", description: "Category and intent-level dominance retrieval via Exa neural search", status: "pending", priority: "high" },
      ],
    },
    {
      id: "synthesis",
      title: "Synthesizing semantic graph",
      description: "GPT-4.1-mini maps nodes, links, evidence, and co-occurrence dominance gaps",
      status: "pending",
      priority: "high",
      level: 0,
      dependencies: ["sources"],
      subtasks: [
        { id: "synthesis.1", title: "Graph nodes & relationships", description: "8–14 nodes across brand, aesthetic, query, competitor, and gap categories", status: "pending", priority: "high" },
        { id: "synthesis.2", title: "Evidence extraction", description: "Grounding links in source-backed co-occurrence scores across shared spaces", status: "pending", priority: "medium" },
        { id: "synthesis.3", title: "Semantic discourse & gaps", description: "Identifying spaces where competitors dominate over the researched brand", status: "pending", priority: "medium" },
      ],
    },
    {
      id: "images",
      title: "Resolving visual assets",
      description: "Fetching og:image and inline images from source pages",
      status: "pending",
      priority: "medium",
      level: 1,
      dependencies: ["synthesis"],
      subtasks: [
        { id: "images.1", title: "Fetching source pages", description: "Up to 10 candidate URLs with 3.5s timeout per request", status: "pending", priority: "medium" },
        { id: "images.2", title: "Mapping visual correlations", description: "Distributing images across visual correlation cards by aesthetic theme", status: "pending", priority: "low" },
      ],
    },
  ];
}

function applyStepEvent(
  tasks: AgentPlanTask[],
  stepId: StepId,
  status: "running" | "done" | "error",
): AgentPlanTask[] {
  const taskStatus = status === "running" ? "in-progress" : status === "done" ? "completed" : "failed";
  return tasks.map((task) => {
    if (task.id !== stepId) return task;
    return {
      ...task,
      status: taskStatus,
      subtasks: task.subtasks.map((sub) => ({ ...sub, status: taskStatus })),
    };
  });
}

const INITIAL_GRAPH = buildGraph("6 degree's");

function ToolPageInner() {
  const { refetchAccess, hasFreeDemoRemaining, subscriptionActive } = useToolAccess();
  const [showPaywall, setShowPaywall] = useState(false);
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
  const [modelStrengthSeedData, setModelStrengthSeedData] = useState<ModelStrengthSeed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentTasks, setAgentTasks] = useState<AgentPlanTask[]>(makePipelineTasks());
  const [agentTraceOpen, setAgentTraceOpen] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (subscriptionActive) {
      setShowPaywall(false);
    }
  }, [subscriptionActive]);

  useEffect(() => {
    if (!subscriptionActive && !hasFreeDemoRemaining) {
      setShowPaywall(true);
    }
  }, [hasFreeDemoRemaining, subscriptionActive]);

  useEffect(() => {
    if (isLoading) setAgentTraceOpen(true);
  }, [isLoading]);

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

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const applyUniversePayload = (payload: SemanticUniversePayload, nextBrand: string) => {
    setBrandInput(nextBrand);
    setNodes(payload.nodes);
    setLinks(payload.links);
    setEvidenceData(payload.evidence);
    setSemanticDiscourseData(payload.semanticDiscourse);
    setVisualCorrelationsData(payload.visualCorrelations);
    setModelStrengthSeedData(payload.modelStrength);
    setSelectedNodeId("brand-core");
    setSelectedLinkId(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setLastRunAt(new Date().toISOString());
  };

  const exportGraphPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgBlob = new Blob(
      [`<?xml version="1.0" encoding="utf-8"?>`, svgStr],
      { type: "image/svg+xml;charset=utf-8" },
    );
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = VIEW_WIDTH * scale;
      canvas.height = VIEW_HEIGHT * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${brandInput.trim() || "semantic-universe"}-graph.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  };

  const runSemanticAnalysis = async () => {
    if (!subscriptionActive) {
      // Always validate access on click so paywall pops reliably after demo use.
      try {
        const accessRes = await fetch("/api/tool/access", { credentials: "include" });
        if (accessRes.ok) {
          const latest = (await accessRes.json()) as ToolAccessPayload;
          if (!latest.subscriptionActive && !latest.hasFreeDemoRemaining) {
            setLoadError("Your free demo has been used. Subscribe to continue running analyses.");
            setShowPaywall(true);
            return;
          }
        } else if (!hasFreeDemoRemaining) {
          setLoadError("Your free demo has been used. Subscribe to continue running analyses.");
          setShowPaywall(true);
          return;
        }
      } catch {
        if (!hasFreeDemoRemaining) {
          setLoadError("Your free demo has been used. Subscribe to continue running analyses.");
          setShowPaywall(true);
          return;
        }
      }
    }

    const targetBrand = brandInput.trim();
    if (!targetBrand) return;
    setIsLoading(true);
    setLoadError(null);
    setAgentTasks(makePipelineTasks());

    try {
      const response = await fetch("/api/semantic-universe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brand: targetBrand }),
      });

      if (response.status === 402) {
        void refetchAccess();
        setShowPaywall(true);
        return;
      }

      if (!response.ok || !response.body) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Semantic analysis request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as StreamEvent;
            if (event.type === "step") {
              setAgentTasks((prev) => applyStepEvent(prev, event.id, event.status));
            } else if (event.type === "done") {
              const payload = normalizePayload(event.payload);
              applyUniversePayload(payload, targetBrand);
              if (!subscriptionActive && typeof window !== "undefined") {
                // Client fallback guard so demo usage is enforced even if profile writes lag/fail.
                window.localStorage.setItem(DEMO_STORAGE_KEY, "1");
              }
              setAgentTasks((prev) =>
                prev.map((t) => ({
                  ...t,
                  status: "completed" as const,
                  subtasks: t.subtasks.map((s) => ({ ...s, status: "completed" as const })),
                })),
              );
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue;
            throw parseError;
          }
        }
      }

      if (hasFreeDemoRemaining && !subscriptionActive) {
        void refetchAccess();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch semantic universe data.";
      setLoadError(message);
      setAgentTasks((prev) =>
        prev.map((t) =>
          t.status === "in-progress" ? { ...t, status: "failed" as const } : t,
        ),
      );
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

  const selectNode = (nodeId: string) => {
    setSelectedLinkId(null);
    setSelectedNodeId(nodeId);
  };

  return (
    <div className="relative min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(40vh,28rem)] bg-[radial-gradient(circle_at_top,_rgba(255,174,77,0.2),_transparent_58%)]"
        aria-hidden
      />
      <header className="relative mx-auto mb-4 flex max-w-[1600px] flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {hasFreeDemoRemaining && !subscriptionActive ? (
            <p className="max-w-[min(100%,28rem)] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              Free demo: one full analysis run included. Subscribe afterward for unlimited access.
            </p>
          ) : null}
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1600px] gap-4 lg:grid-cols-[1.8fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="shrink-0 text-2xl font-semibold tracking-tight text-primary">
                6°
              </span>
              <form
                className="flex w-full max-w-[12rem] min-w-0 gap-2 sm:max-w-[14rem]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSemanticAnalysis();
                }}
              >
                <input
                  id="brand-input"
                  value={brandInput}
                  onChange={(event) => setBrandInput(event.target.value)}
                  aria-label="Brand under analysis"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-primary/50 transition focus:ring-2"
                  placeholder="Brand"
                  autoComplete="organization"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "…" : "Analyze"}
                </button>
              </form>
            </div>
            {loadError ? (
              <p className="text-xs text-rose-500">{loadError}</p>
            ) : lastRunAt && !isLoading ? (
              <p className="text-[0.65rem] text-muted-foreground">
                {new Date(lastRunAt).toLocaleTimeString()}
              </p>
            ) : null}
            <AnimatePresence>
              {isLoading ? (
                <motion.div
                  key="agent-plan-shell"
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 32,
                    mass: 0.85,
                    opacity: { duration: 0.22 },
                  }}
                  className="origin-top overflow-hidden rounded-xl border border-border bg-surface-inset"
                >
                  <div className="flex items-center gap-1.5 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setAgentTraceOpen((open) => !open)}
                      aria-expanded={agentTraceOpen}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg text-left transition hover:bg-primary/[0.08]"
                    >
                      <span className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Agent thinking
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          agentTraceOpen && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                    <InfoHint text="Live-style trace of planning steps while this analysis request runs." />
                  </div>
                  <AnimatePresence initial={false}>
                    {agentTraceOpen ? (
                      <motion.div
                        key="agent-plan-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.32,
                          ease: [0.2, 0.65, 0.3, 0.9],
                          opacity: { duration: 0.2 },
                        }}
                        className="overflow-hidden border-t border-border"
                      >
                        <div className="max-h-[min(42vh,400px)] overflow-y-auto">
                          <AgentPlan
                            className="bg-transparent p-0"
                            animateEntrance={false}
                            tasks={agentTasks}
                          />
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface-inset p-3">
              <p className="text-foreground">Weak or missing edges</p>
              <p className="mt-1 text-lg font-semibold">{weakLinkCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-inset p-3">
              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-foreground">Show only gaps</span>
                <input
                  type="checkbox"
                  checked={showGapsOnly}
                  onChange={() => setShowGapsOnly((value) => !value)}
                />
              </label>
              <p className="mt-1 text-xs text-foreground">
                Highlights where competitors dominate intent.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface-inset">
            <div className="flex justify-end px-3 pt-2">
              <button
                type="button"
                onClick={exportGraphPng}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
              >
                Export PNG
              </button>
            </div>
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
                        selectNode(node.id);
                      }}
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        // Select on press so evidence appears on first interaction.
                        selectNode(node.id);
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

          <ModelStrengthDash
            items={semanticDiscourseData}
            evidence={evidenceData}
            brand={brandInput}
            seedModels={modelStrengthSeedData}
            className="mt-4"
          />
        </section>

        <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <h2 className="text-lg font-semibold">Evidence explorer</h2>
            <InfoHint text="Queries and AI answers that justify links and nodes on the graph. Every node and edge is traceable to actual AI responses and query sources. Evidence updates when you select a node, link, or scope on the map." />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface-inset p-3 text-sm">
            <p className="font-medium">
              {selectedLink
                ? "Relationship selected"
                : selectedNode
                  ? "Node selected"
                  : "Brand overview"}
            </p>
            {selectedLink ? (
              <p className="mt-1 text-foreground">
                {nodeMap.get(selectedLink.source)?.label} →{" "}
                {nodeMap.get(selectedLink.target)?.label} (strength{" "}
                {Math.round(selectedLink.weight * 100)}%)
              </p>
            ) : null}
            {selectedNode ? (
              <p className="mt-1 text-foreground">
                {selectedNode.label} ({selectedNode.category})
              </p>
            ) : null}
          </div>

          <div className="mt-4 max-h-[850px] space-y-3 overflow-y-auto pr-1">
            {activeEvidence.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No evidence in the selected scope.
              </p>
            ) : null}
            {activeEvidence.map((entry) => (
              <article
                key={entry.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <p className="font-medium">{entry.query}</p>
                <p className="mt-2 text-foreground">{entry.aiResponse}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded border border-primary/15 bg-chip px-2 py-1">
                    co-occur: {entry.coOccurrence}
                  </span>
                  <span className="rounded border border-primary/15 bg-chip px-2 py-1">
                    {entry.timestamp}
                  </span>
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {entry.sourceTitle}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </main>

      <section className="mx-auto mt-4 w-full max-w-[1600px] rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 border-b border-border pb-4">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl font-semibold tracking-tight">How consumers talk</h2>
            <InfoHint text="How people describe the brand in prompts and AI answers—language patterns, not demographics. This section translates prompt language into discourse patterns and correlates those patterns to visual cues. Every pattern is timestamped and tied to evidence from AI response logs. The discourse stream shows language signals; the visual board shows imagery cues correlated to those themes." />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">Semantic discourse stream</p>
              <InfoHint text="Representative phrases from AI discourse, scoped to your graph selection when relevant." />
            </div>
            {discourseView.map((item) => (
              <article
                key={item.id}
                className={`rounded-lg border p-3 text-sm transition ${
                  item.isInScope
                    ? "border-primary/50 bg-primary/5"
                    : "border-border"
                }`}
              >
                <p className="font-medium">{item.phrase}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded border border-primary/15 bg-chip px-2 py-1">
                    aesthetic: {item.aesthetic}
                  </span>
                  <span className="rounded border border-primary/15 bg-chip px-2 py-1">
                    intent: {item.intent}
                  </span>
                  <span className="rounded border border-primary/15 bg-chip px-2 py-1">
                    model: {item.modelFamily}
                  </span>
                  <span className="rounded border border-primary/15 bg-chip px-2 py-1">
                    sentiment: {item.sentiment}
                  </span>
                  <span className="rounded border border-primary/15 bg-chip px-2 py-1">
                    seen: {item.observedAt}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">Visual correlation board</p>
              <InfoHint text="Visual proxies and mood cues aligned to semantic clusters (images or gradients)." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visualCorrelationView.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg border p-3 text-sm ${
                    item.isInScope
                      ? "border-primary/50"
                      : "border-border"
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
                      <span className="absolute right-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                        Moodboard
                      </span>
                    </div>
                  )}
                  <p className="mt-3 font-medium">{item.title}</p>
                  <p className="mt-1 text-foreground">{item.imageCue}</p>
                  {item.imageSource ? (
                    <a
                      href={item.imageSource}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-primary underline underline-offset-2"
                    >
                      image source
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-foreground">
                      Visual proxy generated from semantic language.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {item.visualTags.map((tag) => (
                      <span key={tag} className="rounded border border-primary/15 bg-chip px-2 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-foreground">
                    correlation: {Math.round(item.correlationScore * 100)}% • {item.observedWindow}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {showPaywall ? (
        <ToolPaywall variant="overlay" onDismiss={() => setShowPaywall(false)} />
      ) : null}

    </div>
  );
}

function ToolPageContent() {
  return (
    <ToolAccessGate>
      <ToolPageInner />
    </ToolAccessGate>
  );
}

export default function ToolPage() {
  return (
    <RequireToolAuth>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <ToolPageContent />
      </Suspense>
    </RequireToolAuth>
  );
}
