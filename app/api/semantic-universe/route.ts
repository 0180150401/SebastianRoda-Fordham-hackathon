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
  imageUrls?: string[];
  imageSource?: string;
  moodboardMode?: boolean;
};

type ModelStrengthModel = {
  model: string;
  avg: number;
  count: number;
  status: "strong" | "emerging" | "weak";
  evidenceIds: string[];
};

type ModelStrengthPayload = {
  score: number;
  strong: number;
  observed: number;
  models: ModelStrengthModel[];
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
  modelStrength: ModelStrengthPayload;
};

const TRACKED_MODELS = [
  "OpenAI",
  "Claude",
  "Gemini",
  "Perplexity",
  "Copilot",
  "Google AI Overview",
] as const;

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function sanitizeEvidenceUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const host = parsed.hostname.toLowerCase();
    if (host === "example.com" || host.endsWith(".example.com")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
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

function extractInlineImages(html: string): string[] {
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  return matches.map((match) => match[1]).slice(0, 6);
}

async function resolveSourceImages(pageUrl: string): Promise<string[]> {
  if (!pageUrl || pageUrl.includes("example.com")) return [];
  if (looksLikeImageUrl(pageUrl)) return [pageUrl];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(pageUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; 6degrees-bot/1.0)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    const primary = extractMetaImage(html);
    const inline = extractInlineImages(html);
    const rawCandidates = [primary, ...inline].filter(
      (candidate): candidate is string => Boolean(candidate),
    );
    const absoluteCandidates = rawCandidates
      .map((candidate) => {
        try {
          return new URL(candidate, pageUrl).toString();
        } catch {
          return null;
        }
      })
      .filter((candidate): candidate is string => Boolean(candidate))
      .filter((candidate) => candidate.startsWith("http"));
    return [...new Set(absoluteCandidates)].slice(0, 4);
  } catch {
    return [];
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
        imageUrls: await resolveSourceImages(url),
      })),
    )
  ).filter(
    (item): item is { sourceUrl: string; imageUrls: string[] } => item.imageUrls.length > 0,
  );

  const flattened = resolvedImages.flatMap((item) =>
    item.imageUrls.map((imageUrl) => ({ sourceUrl: item.sourceUrl, imageUrl })),
  );

  let imageCursor = 0;
  const visualCorrelations = payload.visualCorrelations.map((item) => {
    const existingImages = Array.isArray(item.imageUrls)
      ? item.imageUrls.filter((url) => typeof url === "string" && url.length > 0)
      : item.imageUrl
        ? [item.imageUrl]
        : [];
    if (existingImages.length > 0 && !existingImages[0].includes("example.com")) {
      return { ...item, imageUrls: existingImages, imageUrl: existingImages[0], moodboardMode: false };
    }
    const picked = flattened.slice(imageCursor, imageCursor + 4);
    imageCursor += 4;
    if (picked.length > 0) {
      return {
        ...item,
        imageUrl: picked[0].imageUrl,
        imageUrls: picked.map((entry) => entry.imageUrl),
        imageSource: picked[0].sourceUrl,
        moodboardMode: false,
      };
    }
    return { ...item, moodboardMode: true };
  });

  return { ...payload, visualCorrelations };
}

async function fetchTavily(brand: string, apiKey: string): Promise<SourceItem[]> {
  const queries = [
    `${brand} fashion brand aesthetics`,
    `${brand} competitors quiet luxury minimalist streetwear`,
    `${brand} campaign lookbook products`,
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
          max_results: 7,
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
    `${brand} brand perception fashion AI recommendations`,
    `${brand} style descriptors minimalist parisian quiet luxury`,
    `${brand} product imagery lookbook fashion collection`,
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
          numResults: 7,
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
    sourceUrl: sanitizeEvidenceUrl(source.url),
    coOccurrence: Math.max(20, 72 - index * 4),
    timestamp: source.published?.slice(0, 10) || now,
  }));

  const safeEvidence = evidence.length
    ? evidence
    : [
        {
          id: "ev-01",
          query: `${normalizedBrand} semantic fashion landscape`,
          aiResponse:
            "Baseline analysis generated due to sparse external results. Configure data connectors for richer evidence density.",
          sourceTitle: "Fallback synthesis",
          sourceUrl: "",
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
      id: "minimalist",
      label: "Minimalist",
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
      id: "parisian",
      label: "Parisian",
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
      id: "quiet-luxury",
      label: "Quiet luxury",
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
      id: "streetwear",
      label: "Streetwear",
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
      label: "discovery gap",
      category: "gap",
      x: 920,
      y: 330,
      vx: 0,
      vy: 0,
      size: 12,
      anchorX: 920,
      anchorY: 330,
      gapHint: "Low brand share",
    },
  ];

  const links: GraphLink[] = [
    {
      id: "l-brand-minimalist",
      source: "brand-core",
      target: "minimalist",
      weight: 0.78,
      evidenceIds: [first],
    },
    {
      id: "l-brand-parisian",
      source: "brand-core",
      target: "parisian",
      weight: 0.7,
      evidenceIds: [second],
    },
    {
      id: "l-brand-quiet",
      source: "brand-core",
      target: "quiet-luxury",
      weight: 0.45,
      evidenceIds: [third],
      missing: true,
      dominantCompetitor: "Established luxury houses",
    },
    {
      id: "l-brand-streetwear",
      source: "brand-core",
      target: "streetwear",
      weight: 0.35,
      evidenceIds: [third],
      missing: true,
      dominantCompetitor: "Streetwear incumbents",
    },
    {
      id: "l-streetwear-gap",
      source: "streetwear",
      target: "gap-discovery",
      weight: 0.24,
      evidenceIds: [third],
      missing: true,
    },
  ];

  const semanticDiscourse: SemanticDiscourseItem[] = [
    {
      id: "sd-01",
      phraseTemplate: `Users describe ${normalizedBrand} as polished minimalism with practical tailoring.`,
      aesthetic: "minimalist",
      intent: "style positioning",
      observedAt: now,
      modelFamily: "OpenAI synthesis",
      sentiment: "positive",
      evidenceIds: [first],
    },
    {
      id: "sd-02",
      phraseTemplate: `When users ask broad luxury prompts, ${normalizedBrand} appears less frequently than top incumbents.`,
      aesthetic: "quiet luxury",
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
      title: "Tailored minimal palette",
      imageCue: "Structured neutrals, matte textures, clean silhouettes",
      visualTags: ["stone", "graphite", "architecture"],
      correlationScore: 0.8,
      observedWindow: `Observed on ${now}`,
      gradient: "linear-gradient(140deg, #d4d4d8 0%, #a1a1aa 45%, #3f3f46 100%)",
      evidenceIds: [first],
      moodboardMode: true,
    },
    {
      id: "vc-02",
      title: "Streetwear discovery gap",
      imageCue: "High contrast visuals map to competitors in broad prompts",
      visualTags: ["contrast", "oversized", "youthful edge"],
      correlationScore: 0.32,
      observedWindow: `Observed on ${now}`,
      gradient: "linear-gradient(140deg, #0f172a 0%, #1e293b 45%, #be123c 100%)",
      evidenceIds: [third],
      moodboardMode: true,
    },
  ];

  const modelStrength = buildModelStrengthPayload(safeEvidence, semanticDiscourse);
  return {
    nodes,
    links,
    evidence: safeEvidence,
    semanticDiscourse,
    visualCorrelations,
    modelStrength,
  };
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

function isPublisherLikeLabel(label: string): boolean {
  const value = label.trim().toLowerCase();
  if (!value) return false;
  if (value.includes("http://") || value.includes("https://") || value.includes(".com")) {
    return true;
  }

  const outletPatterns = [
    "times",
    "post",
    "journal",
    "gazette",
    "herald",
    "observer",
    "financial times",
    "business insider",
    "forbes",
    "bloomberg",
    "reuters",
    "associated press",
    "news",
    "magazine",
    "newspaper",
    "media",
    "press",
    "daily mail",
    "the guardian",
    "the telegraph",
    "vogue business",
    "wwd",
  ];

  const protectedIntentTerms = [
    "streetwear",
    "quiet luxury",
    "minimalist",
    "parisian",
    "capsule",
    "tailoring",
    "style",
    "fashion",
    "aesthetic",
    "brand identity",
    "product",
    "customer",
    "intent",
    "market",
    "competition",
    "gap",
  ];

  if (protectedIntentTerms.some((term) => value.includes(term))) {
    return false;
  }

  return outletPatterns.some((term) => value.includes(term));
}

function normalizeBrandCandidate(value: string): string {
  return value
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyBrandName(candidate: string, brand: string): boolean {
  const value = candidate.toLowerCase();
  if (!value) return false;
  if (value === brand.toLowerCase()) return false;
  if (value.length < 2 || value.length > 32) return false;

  const bannedTokens = [
    "market",
    "cluster",
    "intent",
    "style",
    "fashion",
    "product",
    "collection",
    "article",
    "report",
    "analysis",
    "news",
    "magazine",
    "press",
    "media",
    "times",
    "journal",
    "post",
    "observer",
    "forbes",
    "reuters",
    "pinterest",
    "fashionunited",
    "whowhatwear",
    "mayfeyr",
    "darveys",
    "paper straight",
  ];
  if (bannedTokens.some((token) => value.includes(token))) return false;
  return true;
}

function extractCompetitorNamesFromEvidence(brand: string, evidence: Evidence[]): string[] {
  const knownCompetitors = [
    "The Row",
    "Loro Piana",
    "Toteme",
    "Khaite",
    "Ami Paris",
    "Sezane",
    "A.P.C.",
    "Maison Kitsune",
    "Coperni",
    "Acne Studios",
    "Jil Sander",
    "Nike",
    "Reebok",
    "Adidas",
  ];
  const corpusText = evidence.map((entry) => `${entry.query} ${entry.aiResponse}`).join(" ");
  const corpusLower = corpusText.toLowerCase();

  const knownMatches = knownCompetitors.filter(
    (name) => corpusLower.includes(name.toLowerCase()) && name.toLowerCase() !== brand.toLowerCase(),
  );

  // Heuristic brand mining from article-derived evidence text.
  const minedCounts = new Map<string, number>();
  const matches = corpusText.matchAll(/\b([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,2})\b/g);
  for (const match of matches) {
    const normalized = normalizeBrandCandidate(match[1] ?? "");
    if (!isLikelyBrandName(normalized, brand)) continue;
    minedCounts.set(normalized, (minedCounts.get(normalized) ?? 0) + 1);
  }
  const minedBrands = Array.from(minedCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const combined = [...new Set([...knownMatches, ...minedBrands])];
  return combined.filter((name) => !isPublisherLikeLabel(name)).slice(0, 8);
}

function uniqueNodeId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let counter = 2;
  while (existing.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

function isGenericIntentLabel(label: string): boolean {
  const value = label.trim().toLowerCase();
  if (!value) return true;
  const genericTerms = [
    "competition",
    "competitor",
    "cluster",
    "intent",
    "market",
    "gap",
    "uncaptured intent",
    "priority intent",
  ];
  return genericTerms.some((term) => value === term || value.includes(`${term} `));
}

function pickEvidenceIdsForCompetitor(
  competitorName: string,
  evidence: Evidence[],
  fallbackIds: string[],
): string[] {
  const name = competitorName.toLowerCase();
  const matched = evidence
    .filter((entry) => `${entry.query} ${entry.aiResponse}`.toLowerCase().includes(name))
    .sort((a, b) => b.coOccurrence - a.coOccurrence)
    .slice(0, 3)
    .map((entry) => entry.id);
  if (matched.length > 0) return matched;
  return fallbackIds.slice(0, 2);
}

function inferModelsFromText(text: string): string[] {
  const value = text.toLowerCase();
  const models: string[] = [];
  if (value.includes("openai") || value.includes("gpt")) models.push("OpenAI");
  if (value.includes("claude") || value.includes("anthropic")) models.push("Claude");
  if (value.includes("gemini")) models.push("Gemini");
  if (value.includes("perplexity")) models.push("Perplexity");
  if (value.includes("copilot") || value.includes("bing")) models.push("Copilot");
  if (value.includes("google ai overview") || value.includes("ai overview")) {
    models.push("Google AI Overview");
  }
  if (value.includes("cross-model") || value.includes("mixed models")) {
    models.push("OpenAI", "Claude", "Gemini");
  }
  return [...new Set(models)];
}

function inferModelsFromEvidence(entry: Evidence): {
  models: string[];
  inferredFromProxy: boolean;
} {
  const explicit = inferModelsFromText(
    `${entry.sourceTitle} ${entry.query} ${entry.aiResponse} ${entry.sourceUrl}`,
  );
  if (explicit.length > 0) {
    return { models: explicit, inferredFromProxy: false };
  }
  return { models: ["OpenAI", "Claude", "Gemini"], inferredFromProxy: true };
}

function buildModelStrengthPayload(
  evidence: Evidence[],
  semanticDiscourse: SemanticDiscourseItem[],
): ModelStrengthPayload {
  const buckets = new Map<
    string,
    { total: number; count: number; evidenceIds: Set<string> }
  >();
  for (const model of TRACKED_MODELS) {
    buckets.set(model, { total: 0, count: 0, evidenceIds: new Set<string>() });
  }

  for (const entry of evidence) {
    const { models, inferredFromProxy } = inferModelsFromEvidence(entry);
    for (const model of models) {
      const bucket = buckets.get(model);
      if (!bucket) continue;
      bucket.total += inferredFromProxy ? entry.coOccurrence * 0.7 : entry.coOccurrence;
      bucket.count += 1;
      bucket.evidenceIds.add(entry.id);
    }
  }

  for (const discourse of semanticDiscourse) {
    const models = inferModelsFromText(discourse.modelFamily);
    for (const model of models) {
      const bucket = buckets.get(model);
      if (!bucket) continue;
      bucket.total += 45;
      bucket.count += 1;
      for (const evidenceId of discourse.evidenceIds) {
        bucket.evidenceIds.add(evidenceId);
      }
    }
  }

  const observed = Array.from(buckets.entries())
    .filter(([, bucket]) => bucket.count > 0)
    .map(([model, bucket]) => {
      const avg = bucket.total / bucket.count;
      const status: "strong" | "emerging" | "weak" =
        avg >= 55 ? "strong" : avg >= 40 ? "emerging" : "weak";
      return {
        model,
        avg,
        count: bucket.count,
        status,
        evidenceIds: Array.from(bucket.evidenceIds),
      };
    })
    .sort((a, b) => b.avg - a.avg);

  if (observed.length === 0) {
    return { score: 0, strong: 0, observed: 0, models: [] };
  }

  const strong = observed.filter((model) => model.status === "strong").length;
  const weightedTotal = observed.reduce((sum, model) => sum + model.avg * model.count, 0);
  const weightedCount = observed.reduce((sum, model) => sum + model.count, 0);
  const score =
    weightedCount > 0
      ? Math.max(0, Math.min(100, Math.round(weightedTotal / weightedCount)))
      : 0;
  return { score, strong, observed: observed.length, models: observed };
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
    sourceUrl: sanitizeEvidenceUrl(source.url),
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
          ? sanitizeEvidenceUrl(row.sourceUrl)
          : typeof row.url === "string"
            ? sanitizeEvidenceUrl(row.url)
            : "";
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
      sourceUrl: "",
      coOccurrence: 35,
      timestamp: now,
    });
  }
  const evidenceIdSet = new Set(safeEvidence.map((entry) => entry.id));
  const firstEvidenceId = safeEvidence[0].id;

  const nodeRaw = Array.isArray(payload.nodes) ? payload.nodes : [];
  const rawNodes = nodeRaw
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
  let nodes = rawNodes.filter((node) => node.id === "brand-core" || !isPublisherLikeLabel(node.label));

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

  let nodeIdSet = new Set(nodes.map((node) => node.id));
  const linksRaw = Array.isArray(payload.links) ? payload.links : [];
  let links = linksRaw
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
        .filter((id) => evidenceIdSet.has(id));
      return {
        id:
          typeof row.id === "string" && row.id.trim().length
            ? row.id.trim()
            : `l-${toSlug(source)}-${toSlug(target)}-${index + 1}`,
        source,
        target,
        weight,
        evidenceIds,
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

  const extractedCompetitors = extractCompetitorNamesFromEvidence(brand, safeEvidence);
  const allowedCompetitorSet = new Set(extractedCompetitors.map((name) => name.toLowerCase()));

  if (allowedCompetitorSet.size > 0) {
    for (const node of nodes) {
      if (node.category !== "competitor") continue;
      const nodeLabel = node.label.trim().toLowerCase();
      if (!allowedCompetitorSet.has(nodeLabel)) {
        node.category = "aesthetic";
      }
    }
    for (const link of links) {
      if (!link.dominantCompetitor) continue;
      if (!allowedCompetitorSet.has(link.dominantCompetitor.trim().toLowerCase())) {
        link.dominantCompetitor = undefined;
      }
    }
  }

  // Safety pass: if any publisher-like labels slipped in, prune nodes and attached links.
  const blockedNodeIds = new Set(
    nodes
      .filter((node) => node.id !== "brand-core" && isPublisherLikeLabel(node.label))
      .map((node) => node.id),
  );
  if (blockedNodeIds.size > 0) {
    nodes = nodes.filter((node) => !blockedNodeIds.has(node.id));
    links = links.filter(
      (link) => !blockedNodeIds.has(link.source) && !blockedNodeIds.has(link.target),
    );
    nodeIdSet = new Set(nodes.map((node) => node.id));
  }

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
        .filter((id) => evidenceIdSet.has(id));
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
        evidenceIds,
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
        .filter((id) => evidenceIdSet.has(id));
      return {
        id:
          typeof row.id === "string" && row.id.trim().length
            ? row.id.trim()
            : `vc-${index + 1}`,
        title: typeof row.title === "string" ? row.title : `Visual motif ${index + 1}`,
        imageCue:
          typeof row.imageCue === "string"
            ? row.imageCue
            : "Inferred from semantic phrasing: likely neutral/minimal palette, clean tailoring, understated textures, and styling cues aligned to the dominant intent cluster.",
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
        evidenceIds,
        imageUrl:
          typeof row.imageUrl === "string"
            ? row.imageUrl
            : typeof row.image === "string"
              ? row.image
              : undefined,
        imageUrls: Array.isArray(row.imageUrls)
          ? row.imageUrls.filter((url): url is string => typeof url === "string")
          : typeof row.imageUrl === "string"
            ? [row.imageUrl]
            : typeof row.image === "string"
              ? [row.image]
              : undefined,
        imageSource:
          typeof row.imageSource === "string"
            ? row.imageSource
            : typeof row.sourceUrl === "string"
              ? sanitizeEvidenceUrl(row.sourceUrl)
              : undefined,
        moodboardMode:
          typeof row.moodboardMode === "boolean"
            ? row.moodboardMode
            : !(typeof row.imageUrl === "string" || typeof row.image === "string"),
      } satisfies VisualCorrelationItem;
    })
    .filter((item): item is VisualCorrelationItem => item !== null);

  const hasUncapturedIntent = links.some(
    (link) => Boolean(link.missing) || link.weight < 0.35 || link.evidenceIds.length === 0,
  );
  if (!hasUncapturedIntent) {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const competitorNodes = nodes.filter(
      (node) => node.category === "competitor" && !isPublisherLikeLabel(node.label),
    );

    const specificCompetitors: Array<{ id: string; label: string }> = [];

    for (const competitor of competitorNodes.slice(0, 2)) {
      specificCompetitors.push({ id: competitor.id, label: competitor.label });
    }

    for (const competitorName of extractedCompetitors) {
      if (specificCompetitors.some((competitor) => competitor.label === competitorName)) {
        continue;
      }
      const competitorId = uniqueNodeId(`competitor-${toSlug(competitorName)}`, nodeIds);
      nodeIds.add(competitorId);
      nodes.push({
        id: competitorId,
        label: competitorName,
        category: "competitor",
        x: 940,
        y: 590 + specificCompetitors.length * 70,
        vx: 0,
        vy: 0,
        size: 13,
        anchorX: 930,
        anchorY: 580 + specificCompetitors.length * 70,
      });
      specificCompetitors.push({ id: competitorId, label: competitorName });
      if (specificCompetitors.length >= 2) break;
    }

    if (specificCompetitors.length === 0) {
      const fallbackName = "The Row";
      const fallbackId = uniqueNodeId(`competitor-${toSlug(fallbackName)}`, nodeIds);
      nodeIds.add(fallbackId);
      nodes.push({
        id: fallbackId,
        label: fallbackName,
        category: "competitor",
        x: 940,
        y: 590,
        vx: 0,
        vy: 0,
        size: 13,
        anchorX: 930,
        anchorY: 580,
      });
      specificCompetitors.push({ id: fallbackId, label: fallbackName });
    }

    const weakestBrandLink = links
      .filter((link) => link.source === "brand-core" || link.target === "brand-core")
      .sort((a, b) => a.weight - b.weight)[0];
    const weakestTargetId =
      weakestBrandLink?.source === "brand-core"
        ? weakestBrandLink.target
        : weakestBrandLink?.target === "brand-core"
          ? weakestBrandLink.source
          : nodes.find((node) => node.id !== "brand-core" && node.category !== "competitor")?.id ??
            "brand-core";
    const weakestTargetLabel = nodes.find((node) => node.id === weakestTargetId)?.label ?? "priority intent";
    const fallbackIntentLabel = links
      .filter((link) => link.source === "brand-core" || link.target === "brand-core")
      .map((link) => (link.source === "brand-core" ? link.target : link.source))
      .map((nodeId) => nodes.find((node) => node.id === nodeId)?.label ?? "")
      .find((label) => !isGenericIntentLabel(label));
    const normalizedWeakestIntentLabel =
      !isGenericIntentLabel(weakestTargetLabel) && weakestTargetLabel
        ? weakestTargetLabel
        : fallbackIntentLabel || "quiet luxury search intent";

    const gapNodeId = uniqueNodeId("gap-uncaptured-intent", nodeIds);
    nodes.push({
      id: gapNodeId,
      label: `${normalizedWeakestIntentLabel} gap`,
      category: "gap",
      x: 835,
      y: 620,
      vx: 0,
      vy: 0,
      size: 12,
      anchorX: 830,
      anchorY: 620,
      gapHint: `${specificCompetitors.map((competitor) => competitor.label).join(" & ")}`,
    });

    links.push({
      id: `l-brand-core-${gapNodeId}`,
      source: "brand-core",
      target: gapNodeId,
      weight: 0.22,
      evidenceIds: weakestBrandLink?.evidenceIds ?? safeEvidence.slice(0, 1).map((entry) => entry.id),
      missing: true,
      dominantCompetitor: specificCompetitors[0]?.label,
    });

    for (const competitor of specificCompetitors.slice(0, 2)) {
      const competitorEvidenceIds = pickEvidenceIdsForCompetitor(
        competitor.label,
        safeEvidence,
        weakestBrandLink?.evidenceIds ?? safeEvidence.slice(0, 2).map((entry) => entry.id),
      );
      links.push({
        id: `l-${gapNodeId}-${competitor.id}`,
        source: gapNodeId,
        target: competitor.id,
        weight: 0.82,
        evidenceIds: competitorEvidenceIds,
        dominantCompetitor: competitor.label,
      });
    }
  }

  for (const link of links) {
    if (!link.dominantCompetitor) continue;
    if (link.evidenceIds.length > 0) continue;
    link.evidenceIds = pickEvidenceIdsForCompetitor(
      link.dominantCompetitor,
      safeEvidence,
      safeEvidence.slice(0, 2).map((entry) => entry.id),
    );
  }

  if (nodes.length < 3 || links.length < 2) {
    return null;
  }

  const resolvedSemanticDiscourse: SemanticDiscourseItem[] =
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
        ];

  const resolvedVisualCorrelations: VisualCorrelationItem[] =
    visualCorrelations.length > 0
      ? visualCorrelations
      : [
          {
            id: "vc-1",
            title: "Primary visual language",
            imageCue:
              "Inferred from strongest semantic cluster: probable color direction, silhouette structure, material feel, and styling references users most frequently associate with the brand.",
            visualTags: ["neutral palette", "clean lines"],
            correlationScore: 0.5,
            observedWindow: `Observed around ${now}`,
            gradient: "linear-gradient(140deg, #d4d4d8 0%, #a1a1aa 45%, #3f3f46 100%)",
            evidenceIds: [firstEvidenceId],
            moodboardMode: true,
          },
        ];

  const modelStrength = buildModelStrengthPayload(
    safeEvidence,
    resolvedSemanticDiscourse,
  );

  return {
    nodes,
    links,
    evidence: safeEvidence,
    semanticDiscourse: resolvedSemanticDiscourse,
    visualCorrelations: resolvedVisualCorrelations,
    modelStrength,
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
