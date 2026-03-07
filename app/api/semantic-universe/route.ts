import { NextResponse } from "next/server";

type NodeCategory = "brand" | "aesthetic" | "query" | "competitor" | "gap";

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

type Evidence = {
  id: string;
  query: string;
  aiResponse: string;
  sourceTitle: string;
  sourceUrl: string;
  coOccurrence: number;
  timestamp: string;
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

type SourceItem = {
  query: string;
  title: string;
  url: string;
  snippet: string;
  published?: string;
  provider: "tavily" | "exa";
};

type SemanticUniversePayload = {
  nodes: GraphNode[];
  links: GraphLink[];
  evidence: Evidence[];
  semanticDiscourse: SemanticDiscourseItem[];
  visualCorrelations: VisualCorrelationItem[];
};

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function dedupeByUrl(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  const out: SourceItem[] = [];
  for (const item of items) {
    const key = item.url || `${item.title}-${item.query}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function looksLikeImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function resolveSourceImage(pageUrl: string): Promise<string | null> {
  if (!pageUrl || pageUrl.includes("example.com")) return null;
  if (looksLikeImageUrl(pageUrl)) return pageUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(pageUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; 6degrees-bot/1.0)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const candidate = extractMetaImage(html);
    if (!candidate) return null;
    try {
      return new URL(candidate, pageUrl).toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichVisualCorrelationsWithImages(
  payload: SemanticUniversePayload,
  sources: SourceItem[],
): Promise<SemanticUniversePayload> {
  const candidateUrls = dedupeByUrl(sources)
    .map((source) => source.url)
    .filter((url) => typeof url === "string" && url.length > 0 && !url.includes("example.com"))
    .slice(0, 10);

  const resolvedImages = (
    await Promise.all(
      candidateUrls.map(async (url) => ({
        sourceUrl: url,
        imageUrl: await resolveSourceImage(url),
      })),
    )
  ).filter((item): item is { sourceUrl: string; imageUrl: string } => Boolean(item.imageUrl));

  let imageIndex = 0;
  const visualCorrelations = payload.visualCorrelations.map((item) => {
    if (item.imageUrl && !item.imageUrl.includes("example.com")) {
      return { ...item, moodboardMode: false };
    }
    const found = resolvedImages[imageIndex];
    imageIndex += 1;
    if (found) {
      return {
        ...item,
        imageUrl: found.imageUrl,
        imageSource: found.sourceUrl,
        moodboardMode: false,
      };
    }
    return { ...item, moodboardMode: true };
  });

  return { ...payload, visualCorrelations };
}

async function fetchTavily(brand: string, apiKey: string): Promise<SourceItem[]> {
  const queries = [
    `${brand} brand overview products services positioning`,
    `${brand} customer sentiment competitors alternatives market perception`,
  ];

  const responses = await Promise.all(
    queries.map(async (query) => {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "advanced",
          include_answer: false,
          max_results: 5,
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
      };
      return (json.results ?? []).map((result) => ({
        query,
        title: result.title ?? "Untitled result",
        url: result.url ?? "",
        snippet: result.content ?? "",
        published: result.published_date,
        provider: "tavily" as const,
      }));
    }),
  );

  return responses.flat();
}

async function fetchExa(brand: string, apiKey: string): Promise<SourceItem[]> {
  const queries = [
    `${brand} user discussions reviews and intent signals`,
    `${brand} pricing trust quality support innovation perception`,
  ];

  const responses = await Promise.all(
    queries.map(async (query) => {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query,
          type: "neural",
          numResults: 5,
          useAutoprompt: true,
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string }>;
      };
      return (json.results ?? []).map((result) => ({
        query,
        title: result.title ?? "Untitled result",
        url: result.url ?? "",
        snippet: result.text ?? "",
        published: result.publishedDate,
        provider: "exa" as const,
      }));
    }),
  );

  return responses.flat();
}

function buildFallback(brand: string, sources: SourceItem[]): SemanticUniversePayload {
  const normalizedBrand = brand.trim() || "Your brand";
  const now = new Date().toISOString().slice(0, 10);
  const evidence = (sources.length > 0 ? sources : []).slice(0, 10).map((source, index) => ({
    id: `ev-${String(index + 1).padStart(2, "0")}`,
    query: source.query,
    aiResponse: source.snippet.slice(0, 260) || "No extracted snippet from source.",
    sourceTitle: source.title,
    sourceUrl: source.url || "https://example.com",
    coOccurrence: Math.max(20, 72 - index * 4),
    timestamp: source.published?.slice(0, 10) || now,
  }));

  const safeEvidence = evidence.length
    ? evidence
    : [
        {
          id: "ev-01",
          query: `${normalizedBrand} semantic brand landscape`,
          aiResponse:
            "Baseline analysis generated due to sparse external results. Configure data connectors for richer evidence density.",
          sourceTitle: "Fallback synthesis",
          sourceUrl: "https://example.com/fallback",
          coOccurrence: 35,
          timestamp: now,
        },
      ];

  const first = safeEvidence[0]?.id;
  const second = safeEvidence[1]?.id ?? first;
  const third = safeEvidence[2]?.id ?? first;

  const nodes: GraphNode[] = [
    {
      id: "brand-core",
      label: normalizedBrand,
      category: "brand",
      x: 590,
      y: 380,
      vx: 0,
      vy: 0,
      size: 26,
      anchorX: 590,
      anchorY: 380,
      fixed: true,
    },
    {
      id: "value-proposition",
      label: "Value proposition",
      category: "aesthetic",
      x: 420,
      y: 260,
      vx: 0,
      vy: 0,
      size: 17,
      anchorX: 440,
      anchorY: 250,
    },
    {
      id: "audience-intent",
      label: "Audience intent",
      category: "aesthetic",
      x: 600,
      y: 220,
      vx: 0,
      vy: 0,
      size: 16,
      anchorX: 620,
      anchorY: 220,
    },
    {
      id: "trust-quality",
      label: "Trust & quality",
      category: "aesthetic",
      x: 800,
      y: 450,
      vx: 0,
      vy: 0,
      size: 16,
      anchorX: 790,
      anchorY: 470,
    },
    {
      id: "pricing-positioning",
      label: "Pricing positioning",
      category: "aesthetic",
      x: 810,
      y: 300,
      vx: 0,
      vy: 0,
      size: 14,
      anchorX: 800,
      anchorY: 300,
    },
    {
      id: "gap-discovery",
      label: "Gap: discoverability",
      category: "gap",
      x: 920,
      y: 330,
      vx: 0,
      vy: 0,
      size: 12,
      anchorX: 920,
      anchorY: 330,
      gapHint: "Low semantic share in generic prompts.",
    },
  ];

  const links: GraphLink[] = [
    {
      id: "l-brand-value",
      source: "brand-core",
      target: "value-proposition",
      weight: 0.78,
      evidenceIds: [first],
    },
    {
      id: "l-brand-audience",
      source: "brand-core",
      target: "audience-intent",
      weight: 0.7,
      evidenceIds: [second],
    },
    {
      id: "l-brand-trust",
      source: "brand-core",
      target: "trust-quality",
      weight: 0.45,
      evidenceIds: [third],
      missing: true,
      dominantCompetitor: "Established competitors",
    },
    {
      id: "l-brand-pricing",
      source: "brand-core",
      target: "pricing-positioning",
      weight: 0.35,
      evidenceIds: [third],
      missing: true,
      dominantCompetitor: "Category incumbents",
    },
    {
      id: "l-pricing-gap",
      source: "pricing-positioning",
      target: "gap-discovery",
      weight: 0.24,
      evidenceIds: [third],
      missing: true,
    },
  ];

  const semanticDiscourse: SemanticDiscourseItem[] = [
    {
      id: "sd-01",
      phraseTemplate: `Users describe ${normalizedBrand} through clear value and use-case language, with strongest mentions around outcomes and reliability.`,
      aesthetic: "value proposition",
      intent: "brand positioning",
      observedAt: now,
      modelFamily: "OpenAI synthesis",
      sentiment: "positive",
      evidenceIds: [first],
    },
    {
      id: "sd-02",
      phraseTemplate: `In broad category prompts, ${normalizedBrand} appears less frequently than larger incumbents, indicating a discoverability gap.`,
      aesthetic: "competitive visibility",
      intent: "competitive visibility",
      observedAt: now,
      modelFamily: "OpenAI synthesis",
      sentiment: "mixed",
      evidenceIds: [third],
    },
  ];

  const visualCorrelations: VisualCorrelationItem[] = [
    {
      id: "vc-01",
      title: "Core brand moodboard",
      imageCue: "Visual motifs reflecting product quality, trust signals, and brand personality.",
      visualTags: ["clarity", "consistency", "quality cues"],
      correlationScore: 0.8,
      observedWindow: `Observed on ${now}`,
      gradient: "linear-gradient(140deg, #d4d4d8 0%, #a1a1aa 45%, #3f3f46 100%)",
      evidenceIds: [first],
      moodboardMode: true,
    },
    {
      id: "vc-02",
      title: "Discoverability gap moodboard",
      imageCue: "Visual proxy for competitor-dominated category narratives and weak brand association.",
      visualTags: ["competitor pressure", "generic intent", "awareness gap"],
      correlationScore: 0.32,
      observedWindow: `Observed on ${now}`,
      gradient: "linear-gradient(140deg, #0f172a 0%, #1e293b 45%, #be123c 100%)",
      evidenceIds: [third],
      moodboardMode: true,
    },
  ];

  return { nodes, links, evidence: safeEvidence, semanticDiscourse, visualCorrelations };
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output.");
  }
  return text.slice(start, end + 1);
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategory(label: string, id: string, brand: string): NodeCategory {
  const value = `${label} ${id}`.toLowerCase();
  if (id === "brand-core" || value.includes(brand.toLowerCase())) return "brand";
  if (value.includes("gap")) return "gap";
  if (
    value.includes("competitor") ||
    value.includes("versus") ||
    value.includes("domina") ||
    value.includes("the row") ||
    value.includes("toteme") ||
    value.includes("ami paris") ||
    value.includes("khaite")
  ) {
    return "competitor";
  }
  if (
    value.includes("query") ||
    value.includes("intent") ||
    value.includes("search") ||
    value.includes("discovery")
  ) {
    return "query";
  }
  return "aesthetic";
}

function normalizeModelPayload(
  raw: unknown,
  brand: string,
  sources: SourceItem[],
): SemanticUniversePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const now = new Date().toISOString().slice(0, 10);
  const sourceEvidence = sources.slice(0, 12).map((source, index) => ({
    id: `src-${index + 1}`,
    query: source.query,
    aiResponse: source.snippet.slice(0, 280) || "No extracted snippet.",
    sourceTitle: source.title,
    sourceUrl: source.url || "https://example.com",
    coOccurrence: Math.max(20, 68 - index * 3),
    timestamp: source.published?.slice(0, 10) || now,
  }));

  const evidenceRaw = Array.isArray(payload.evidence) ? payload.evidence : [];
  const evidence = evidenceRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const sourceTitle =
        typeof row.sourceTitle === "string"
          ? row.sourceTitle
          : typeof row.source === "string"
            ? row.source
            : typeof row.title === "string"
              ? row.title
              : "Untitled evidence";
      const aiResponse =
        typeof row.aiResponse === "string"
          ? row.aiResponse
          : typeof row.snippet === "string"
            ? row.snippet
            : "No summary available.";
      const sourceUrl =
        typeof row.sourceUrl === "string"
          ? row.sourceUrl
          : typeof row.url === "string"
            ? row.url
            : "https://example.com";
      const query =
        typeof row.query === "string"
          ? row.query
          : sources[index % Math.max(1, sources.length)]?.query ?? `${brand} semantic signal`;
      return {
        id:
          typeof row.id === "string" && row.id.trim().length
            ? row.id.trim()
            : `ev-${index + 1}`,
        query,
        aiResponse,
        sourceTitle,
        sourceUrl,
        coOccurrence:
          typeof row.coOccurrence === "number"
            ? Math.max(1, Math.min(100, row.coOccurrence))
            : typeof row.cooccurrence === "number"
              ? Math.max(1, Math.min(100, row.cooccurrence))
              : Math.max(15, 70 - index * 4),
        timestamp:
          typeof row.timestamp === "string"
            ? row.timestamp.slice(0, 10)
            : typeof row.observedDate === "string"
              ? row.observedDate.slice(0, 10)
              : now,
      } satisfies Evidence;
    })
    .filter((item): item is Evidence => Boolean(item));

  const safeEvidence = evidence.length ? evidence : sourceEvidence;
  if (safeEvidence.length === 0) {
    safeEvidence.push({
      id: "ev-1",
      query: `${brand} semantic landscape`,
      aiResponse: "Fallback evidence item due to missing sources.",
      sourceTitle: "Fallback",
      sourceUrl: "https://example.com",
      coOccurrence: 35,
      timestamp: now,
    });
  }
  const evidenceIdSet = new Set(safeEvidence.map((entry) => entry.id));
  const firstEvidenceId = safeEvidence[0].id;

  const nodeRaw = Array.isArray(payload.nodes) ? payload.nodes : [];
  const nodes = nodeRaw
    .map<GraphNode | null>((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label =
        typeof row.label === "string"
          ? row.label
          : typeof row.name === "string"
            ? row.name
            : `Concept ${index + 1}`;
      const id =
        typeof row.id === "string" && row.id.trim().length
          ? row.id.trim()
          : toSlug(label) || `node-${index + 1}`;
      const angle = (index / Math.max(1, nodeRaw.length)) * Math.PI * 2;
      const defaultX = 590 + Math.cos(angle) * 250;
      const defaultY = 380 + Math.sin(angle) * 210;
      const category =
        row.category === "brand" ||
        row.category === "aesthetic" ||
        row.category === "query" ||
        row.category === "competitor" ||
        row.category === "gap"
          ? (row.category as NodeCategory)
          : inferCategory(label, id, brand);
      return {
        id,
        label,
        category,
        x: typeof row.x === "number" ? row.x : defaultX,
        y: typeof row.y === "number" ? row.y : defaultY,
        vx: typeof row.vx === "number" ? row.vx : 0,
        vy: typeof row.vy === "number" ? row.vy : 0,
        size: typeof row.size === "number" ? row.size : id === "brand-core" ? 26 : 14,
        anchorX: typeof row.anchorX === "number" ? row.anchorX : typeof row.x === "number" ? row.x : defaultX,
        anchorY: typeof row.anchorY === "number" ? row.anchorY : typeof row.y === "number" ? row.y : defaultY,
        fixed: typeof row.fixed === "boolean" ? row.fixed : id === "brand-core",
        gapHint: typeof row.gapHint === "string" ? row.gapHint : undefined,
      } satisfies GraphNode;
    })
    .filter((item): item is GraphNode => item !== null);

  const hasBrandCore = nodes.some((node) => node.id === "brand-core");
  if (!hasBrandCore) {
    nodes.unshift({
      id: "brand-core",
      label: brand,
      category: "brand",
      x: 590,
      y: 380,
      vx: 0,
      vy: 0,
      size: 26,
      anchorX: 590,
      anchorY: 380,
      fixed: true,
    });
  } else {
    for (const node of nodes) {
      if (node.id === "brand-core") {
        node.label = brand;
        node.category = "brand";
        node.fixed = true;
        node.size = Math.max(24, node.size);
      }
    }
  }

  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const linksRaw = Array.isArray(payload.links) ? payload.links : [];
  const links = linksRaw
    .map<GraphLink | null>((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const sourceRaw = row.source;
      const targetRaw = row.target;
      const source =
        typeof sourceRaw === "string"
          ? sourceRaw
          : sourceRaw && typeof sourceRaw === "object" && typeof (sourceRaw as { id?: unknown }).id === "string"
            ? ((sourceRaw as { id: string }).id as string)
            : "";
      const target =
        typeof targetRaw === "string"
          ? targetRaw
          : targetRaw && typeof targetRaw === "object" && typeof (targetRaw as { id?: unknown }).id === "string"
            ? ((targetRaw as { id: string }).id as string)
            : "";
      if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) return null;
      const weightRaw =
        typeof row.weight === "number"
          ? row.weight
          : typeof row.coOccurrence === "number"
            ? row.coOccurrence
            : typeof row.strength === "number"
              ? row.strength
              : 0.45;
      const weight = Math.max(0.05, Math.min(1, weightRaw > 1 ? weightRaw / 100 : weightRaw));
      const evidenceIdsRaw = Array.isArray(row.evidenceIds)
        ? row.evidenceIds
        : Array.isArray(row.evidence)
          ? row.evidence
          : [];
      const evidenceIds = evidenceIdsRaw
        .filter((id): id is string => typeof id === "string")
        .map((id) => (evidenceIdSet.has(id) ? id : firstEvidenceId));
      return {
        id:
          typeof row.id === "string" && row.id.trim().length
            ? row.id.trim()
            : `l-${toSlug(source)}-${toSlug(target)}-${index + 1}`,
        source,
        target,
        weight,
        evidenceIds: evidenceIds.length ? evidenceIds : [firstEvidenceId],
        dominantCompetitor:
          typeof row.dominantCompetitor === "string"
            ? row.dominantCompetitor
            : typeof row.competitor === "string"
              ? row.competitor
              : undefined,
        missing:
          typeof row.missing === "boolean"
            ? row.missing
            : typeof row.isGap === "boolean"
              ? row.isGap
              : weight < 0.4,
      } satisfies GraphLink;
    })
    .filter((item): item is GraphLink => item !== null);

  const discourseRaw = Array.isArray(payload.semanticDiscourse) ? payload.semanticDiscourse : [];
  const semanticDiscourse = discourseRaw
    .map<SemanticDiscourseItem | null>((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const phrase =
        typeof row.phraseTemplate === "string"
          ? row.phraseTemplate
          : typeof row.phrase === "string"
            ? row.phrase
            : typeof row.text === "string"
              ? row.text
              : `Users discuss ${brand} through overlapping style intents.`;
      const evidenceIdsRaw = Array.isArray(row.evidenceIds) ? row.evidenceIds : [];
      const evidenceIds = evidenceIdsRaw
        .filter((id): id is string => typeof id === "string")
        .map((id) => (evidenceIdSet.has(id) ? id : firstEvidenceId));
      return {
        id:
          typeof row.id === "string" && row.id.trim().length
            ? row.id.trim()
            : `sd-${index + 1}`,
        phraseTemplate: phrase,
        aesthetic: typeof row.aesthetic === "string" ? row.aesthetic : "mixed aesthetics",
        intent: typeof row.intent === "string" ? row.intent : "semantic positioning",
        observedAt:
          typeof row.observedAt === "string"
            ? row.observedAt.slice(0, 10)
            : typeof row.observedDate === "string"
              ? row.observedDate.slice(0, 10)
              : now,
        modelFamily:
          typeof row.modelFamily === "string" ? row.modelFamily : "Cross-model sample",
        sentiment:
          row.sentiment === "positive" || row.sentiment === "neutral" || row.sentiment === "mixed"
            ? row.sentiment
            : "neutral",
        evidenceIds: evidenceIds.length ? evidenceIds : [firstEvidenceId],
      } satisfies SemanticDiscourseItem;
    })
    .filter((item): item is SemanticDiscourseItem => item !== null);

  const visualsRaw = Array.isArray(payload.visualCorrelations) ? payload.visualCorrelations : [];
  const visualCorrelations = visualsRaw
    .map<VisualCorrelationItem | null>((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const evidenceIdsRaw = Array.isArray(row.evidenceIds) ? row.evidenceIds : [];
      const evidenceIds = evidenceIdsRaw
        .filter((id): id is string => typeof id === "string")
        .map((id) => (evidenceIdSet.has(id) ? id : firstEvidenceId));
      return {
        id:
          typeof row.id === "string" && row.id.trim().length
            ? row.id.trim()
            : `vc-${index + 1}`,
        title: typeof row.title === "string" ? row.title : `Visual motif ${index + 1}`,
        imageCue:
          typeof row.imageCue === "string"
            ? row.imageCue
            : "Visual language inferred from semantic prompts.",
        visualTags: Array.isArray(row.visualTags)
          ? row.visualTags.filter((tag): tag is string => typeof tag === "string")
          : [],
        correlationScore:
          typeof row.correlationScore === "number"
            ? Math.max(0, Math.min(1, row.correlationScore))
            : 0.5,
        observedWindow:
          typeof row.observedWindow === "string"
            ? row.observedWindow
            : `Observed around ${now}`,
        gradient:
          typeof row.gradient === "string"
            ? row.gradient
            : typeof row.cssGradient === "string"
              ? row.cssGradient
              : "linear-gradient(140deg, #d4d4d8 0%, #a1a1aa 45%, #3f3f46 100%)",
        evidenceIds: evidenceIds.length ? evidenceIds : [firstEvidenceId],
        imageUrl:
          typeof row.imageUrl === "string"
            ? row.imageUrl
            : typeof row.image === "string"
              ? row.image
              : undefined,
        imageSource:
          typeof row.imageSource === "string"
            ? row.imageSource
            : typeof row.sourceUrl === "string"
              ? row.sourceUrl
              : undefined,
        moodboardMode:
          typeof row.moodboardMode === "boolean"
            ? row.moodboardMode
            : !(typeof row.imageUrl === "string" || typeof row.image === "string"),
      } satisfies VisualCorrelationItem;
    })
    .filter((item): item is VisualCorrelationItem => item !== null);

  if (nodes.length < 3 || links.length < 2) {
    return null;
  }

  return {
    nodes,
    links,
    evidence: safeEvidence,
    semanticDiscourse:
      semanticDiscourse.length > 0
        ? semanticDiscourse
        : [
            {
              id: "sd-1",
              phraseTemplate: `Users discuss ${brand} through clustered aesthetic language.`,
              aesthetic: "mixed",
              intent: "semantic overview",
              observedAt: now,
              modelFamily: "Cross-model sample",
              sentiment: "neutral",
              evidenceIds: [firstEvidenceId],
            },
          ],
    visualCorrelations:
      visualCorrelations.length > 0
        ? visualCorrelations
        : [
            {
              id: "vc-1",
              title: "Primary visual language",
              imageCue: "Visual motif inferred from the strongest semantic cluster.",
              visualTags: ["neutral palette", "clean lines"],
              correlationScore: 0.5,
              observedWindow: `Observed around ${now}`,
              gradient: "linear-gradient(140deg, #d4d4d8 0%, #a1a1aa 45%, #3f3f46 100%)",
              evidenceIds: [firstEvidenceId],
              moodboardMode: true,
            },
          ],
  };
}

async function synthesizeWithOpenAI(
  brand: string,
  sources: SourceItem[],
  openAiKey: string,
): Promise<SemanticUniversePayload> {
  const context = sources
    .slice(0, 14)
    .map(
      (source, index) =>
        `${index + 1}. [${source.provider}] ${source.title} | ${source.url}\nquery: ${source.query}\nsnippet: ${source.snippet.slice(0, 360)}`,
    )
    .join("\n\n");

  const prompt = `
You are generating data for a brand semantic universe graph.
Brand: ${brand}

Use the source context below to produce JSON only.
Requirements:
- Keep node coordinates in a 1180x760 canvas.
- Include node id "brand-core" with label equal to the brand.
- Return 8-14 nodes, 10-18 links.
- Every link must include evidenceIds from provided evidence items.
- Include gaps (missing links) where competitors dominate.
- Keep evidence grounded in source snippets with realistic coOccurrence values.
- Include semantic discourse examples with observed dates.
- Include visual correlation cards with gradient CSS strings.

Return JSON matching:
{
  "nodes": GraphNode[],
  "links": GraphLink[],
  "evidence": Evidence[],
  "semanticDiscourse": SemanticDiscourseItem[],
  "visualCorrelations": VisualCorrelationItem[]
}

Source context:
${context || "No external sources available."}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${openAiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "Return only valid JSON. Do not use markdown fences." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJsonObject(content));
  const normalized = normalizeModelPayload(parsed, brand, sources);
  if (!normalized) {
    throw new Error("Model output could not be normalized.");
  }
  return normalized;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { brand?: string };
    const brand = body.brand?.trim();
    if (!brand) {
      return NextResponse.json({ error: "Brand is required." }, { status: 400 });
    }

    const openAiKey = cleanEnvValue(process.env.OPENAI_API_KEY ?? process.env.OPENAI_API);
    const tavilyKey = cleanEnvValue(process.env.TAVILY_API_KEY ?? process.env.TAVILY_API);
    const exaKey = cleanEnvValue(process.env.EXA_API_KEY);

    if (!openAiKey || !tavilyKey || !exaKey) {
      return NextResponse.json(
        {
          error:
            "Missing one or more required environment variables: OPENAI_API_KEY, TAVILY_API_KEY, EXA_API_KEY.",
        },
        { status: 500 },
      );
    }

    const [tavilyResults, exaResults] = await Promise.all([
      fetchTavily(brand, tavilyKey).catch(() => []),
      fetchExa(brand, exaKey).catch(() => []),
    ]);

    const sources = dedupeByUrl([...tavilyResults, ...exaResults]).slice(0, 18);

    try {
      const payload = await synthesizeWithOpenAI(brand, sources, openAiKey);
      const enriched = await enrichVisualCorrelationsWithImages(payload, sources);
      return NextResponse.json(enriched);
    } catch {
      const fallback = buildFallback(brand, sources);
      const enriched = await enrichVisualCorrelationsWithImages(fallback, sources);
      return NextResponse.json(enriched);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
