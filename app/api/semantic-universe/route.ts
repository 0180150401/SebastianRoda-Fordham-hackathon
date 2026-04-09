import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseSemanticTool, isSubscriptionActive } from "@/lib/tool-access";
import { NextResponse } from "next/server";

function hasDemoCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)semantic_demo_used=1(?:;|$)/.test(cookie);
}

async function markFreeDemoUsed(userId: string) {
  const iso = new Date().toISOString();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      await admin.from("profiles").update({ free_demo_used_at: iso }).eq("id", userId);
      return;
    } catch (e) {
      console.error("[semantic-universe] mark demo (admin)", e);
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ free_demo_used_at: iso }).eq("id", userId);
  if (error) console.error("[semantic-universe] mark demo (user)", error);
}

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
    `${brand} co-occurrence with competing brands in news`,
    `${brand} versus alternatives in shared product categories news`,
    `${brand} mention share across minimalist quiet luxury streetwear news`,
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
    `${brand} co-occurrence with rival brands across shared intents`,
    `${brand} news where competitors dominate similar audiences`,
    `${brand} category-level comparison where rivals outperform`,
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

function extractCompetitorNamesFromSources(brand: string, sources: SourceItem[]): string[] {
  // Mine from raw source snippets — richer text than post-processed evidence.
  const corpusText = sources
    .map((s) => `${s.query} ${s.title} ${s.snippet}`)
    .join(" ");

  const minedCounts = new Map<string, number>();
  const matches = corpusText.matchAll(/\b([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,2})\b/g);
  for (const match of matches) {
    const normalized = normalizeBrandCandidate(match[1] ?? "");
    if (!isLikelyBrandName(normalized, brand)) continue;
    minedCounts.set(normalized, (minedCounts.get(normalized) ?? 0) + 1);
  }

  return Array.from(minedCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter((name) => !isPublisherLikeLabel(name))
    .slice(0, 10);
}

function extractCompetitorNamesFromEvidence(brand: string, evidence: Evidence[]): string[] {
  const corpusText = evidence.map((entry) => `${entry.query} ${entry.aiResponse}`).join(" ");

  const minedCounts = new Map<string, number>();
  const matches = corpusText.matchAll(/\b([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,2})\b/g);
  for (const match of matches) {
    const normalized = normalizeBrandCandidate(match[1] ?? "");
    if (!isLikelyBrandName(normalized, brand)) continue;
    minedCounts.set(normalized, (minedCounts.get(normalized) ?? 0) + 1);
  }

  return Array.from(minedCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter((name) => !isPublisherLikeLabel(name))
    .slice(0, 8);
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
  brand: string,
  competitorName: string,
  evidence: Evidence[],
  fallbackIds: string[],
): string[] {
  const brandName = brand.toLowerCase();
  const name = competitorName.toLowerCase();

  const scored = evidence
    .map((entry) => {
      const corpus = `${entry.query} ${entry.aiResponse} ${entry.sourceTitle}`.toLowerCase();
      if (!corpus.includes(name)) return null;
      const hasBrand = corpus.includes(brandName);
      const hasSharedSpaceCue =
        /co-occurr|shared|same|overlap|vs|versus|compared|alternative|category|intent|news|coverage|recommend/.test(
          corpus,
        );
      const score =
        entry.coOccurrence + (hasBrand ? 30 : 0) + (hasSharedSpaceCue ? 22 : 0);
      return {
        id: entry.id,
        score,
      };
    })
    .filter((item): item is { id: string; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.id);

  if (scored.length > 0) return scored;

  const matched = evidence
    .filter((entry) => `${entry.query} ${entry.aiResponse}`.toLowerCase().includes(name))
    .sort((a, b) => b.coOccurrence - a.coOccurrence)
    .slice(0, 2)
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
          typeof row.modelFamily === "string"
            ? row.modelFamily
            : typeof row.model === "string"
              ? row.model
              : typeof row.engine === "string"
                ? row.engine
                : "ChatGPT",
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
        gradient: (() => {
          if (typeof row.gradient === "string" && row.gradient.includes("gradient")) return row.gradient;
          if (typeof row.cssGradient === "string" && row.cssGradient.includes("gradient")) return row.cssGradient;
          // Build gradient from colorPalette if provided
          const palette = Array.isArray(row.colorPalette)
            ? row.colorPalette.filter((c): c is string => typeof c === "string" && c.startsWith("#"))
            : [];
          if (palette.length >= 2) {
            const stops = palette.slice(0, 3);
            if (stops.length === 2) stops.push(stops[1]);
            return `linear-gradient(140deg, ${stops[0]} 0%, ${stops[1]} 45%, ${stops[2]} 100%)`;
          }
          // Index-based fallback palette variety
          const fallbacks = [
            "linear-gradient(140deg, #f5f0e8 0%, #c9b99a 45%, #7a6248 100%)",
            "linear-gradient(140deg, #0f172a 0%, #1e3a5f 45%, #2563eb 100%)",
            "linear-gradient(140deg, #1a1a1a 0%, #2d2d2d 45%, #be123c 100%)",
            "linear-gradient(140deg, #f0fdf4 0%, #86efac 45%, #16a34a 100%)",
            "linear-gradient(140deg, #fafaf9 0%, #e7e5e4 45%, #a8a29e 100%)",
          ];
          return fallbacks[index % fallbacks.length];
        })(),
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
        brand,
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
      brand,
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
            modelFamily: "ChatGPT",
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
  verifiedCompetitors: string[],
): Promise<SemanticUniversePayload> {
  const context = sources
    .slice(0, 18)
    .map(
      (source, index) =>
        `${index + 1}. [${source.provider}] ${source.title} | ${source.url}\nquery: ${source.query}\nsnippet: ${source.snippet.slice(0, 400)}`,
    )
    .join("\n\n");

  const competitorConstraint =
    verifiedCompetitors.length > 0
      ? `VERIFIED COMPETITORS (found in source data — use ONLY these as competitor nodes, do not invent others):\n${verifiedCompetitors.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}`
      : `VERIFIED COMPETITORS: None identified in source data. Do not add competitor nodes — use gap nodes instead to represent areas where unnamed competitors dominate.`;

  const prompt = `You are generating structured JSON for a brand semantic universe graph. Be precise and evidence-grounded.

Brand under analysis: "${brand}"

=== STRICT GROUNDING RULES ===
1. COMPETITORS: ${competitorConstraint}
   Do NOT invent competitor names not in the list above.
   Infer competitor dominance from co-occurrence strength in shared intent spaces where both ${brand} and competitors appear in the source context.

2. EVIDENCE: Every evidence item's aiResponse must paraphrase or quote directly from the source snippets below. Do not invent quotes, stats, or source titles.
   Evidence should prioritize news-like or publication context where brand + competitor overlap can be assessed.

3. NODE LABELS: Use specific, meaningful labels reflecting actual themes in the sources (e.g. "Capsule wardrobe", "Sustainable basics", "Direct competitors") — not generic terms like "cluster" or "market".

4. GAPS: A gap node represents a real search intent cluster where ${brand} is absent or weak based on the sources. Only add a gap if the source data supports it.
   Gap-to-competitor links must use evidenceIds with high coOccurrence in shared spaces.

5. COORDINATES: 1180×760 canvas. Brand-core fixed at (590, 380). Spread other nodes across the canvas.

=== OUTPUT SCHEMA ===
{
  "nodes": [{ "id": string, "label": string, "category": "brand"|"aesthetic"|"query"|"competitor"|"gap", "x": number, "y": number, "vx": 0, "vy": 0, "size": number, "anchorX": number, "anchorY": number, "fixed"?: boolean, "gapHint"?: string }],
  "links": [{ "id": string, "source": string, "target": string, "weight": number (0–1), "evidenceIds": string[], "dominantCompetitor"?: string, "missing"?: boolean }],
  "evidence": [{ "id": string, "query": string, "aiResponse": string, "sourceTitle": string, "sourceUrl": string, "coOccurrence": number (1–100), "timestamp": string (YYYY-MM-DD) }],
  "semanticDiscourse": [{ "id": string, "phraseTemplate": string (use {brand} placeholder), "aesthetic": string, "intent": string, "observedAt": string, "modelFamily": string, "sentiment": "positive"|"neutral"|"mixed", "evidenceIds": string[] }],
  "visualCorrelations": [{ "id": string, "title": string, "imageCue": string, "visualTags": string[], "correlationScore": number (0–1), "observedWindow": string, "gradient": string (valid CSS gradient), "evidenceIds": string[], "colorPalette": string[] }]
}

=== VISUAL CORRELATION RULES ===
Each visualCorrelation card represents a distinct aesthetic cluster observed in the sources. Follow these rules precisely:

- "title": A specific, evocative cluster name drawn from the source language (e.g. "Industrial utility", "Coastal softness", "Dark heritage"). NOT generic like "Visual cluster 1".
- "imageCue": A rich 1–2 sentence mood-board direction describing what a photo shoot for this cluster would look like — lighting, materials, silhouettes, setting, color register. Ground it in actual language from the source snippets.
- "visualTags": 3–5 specific visual descriptors pulled directly from source snippets (e.g. ["raw linen", "concrete floors", "overcast daylight", "wide silhouette"]).
- "correlationScore": Estimate based on how many evidence items reference this aesthetic cluster divided by total evidence. Strong clusters score 0.65–0.95. Gaps/competitor-dominated score 0.15–0.45.
- "observedWindow": Derive a real date range from the evidence timestamps for this cluster (e.g. "Mar 04 – Apr 07, 2026"). Do not use generic "Observed around date".
- "gradient": A carefully composed CSS linear-gradient that visually matches the cluster's color register. Use 3 color stops. Examples: warm neutrals → "#f5f0e8, #c9b99a, #7a6248". Dark industrial → "#1a1a1a, #2d3748, #4a5568". Do NOT default to gray every time.
- "colorPalette": 3 hex color values that define this cluster's visual identity (matches the gradient stops).
- "evidenceIds": Only include IDs of evidence items that actually reference this visual cluster.

Produce: 8–14 nodes, 10–18 links (every link needs at least one evidenceId, include 2–4 missing:true gap links), 8–14 evidence items, 3–5 semanticDiscourse items, 4–5 visualCorrelations.

=== SOURCE CONTEXT ===
${context || "No external sources available — generate minimal fallback structure only."}
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

const encoder = new TextEncoder();

function emitLine(controller: ReadableStreamDefaultController, event: object) {
  controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
}

export async function POST(request: Request) {
  // Auth and access checks are synchronous — return early before starting the stream.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("free_demo_used_at, stripe_status")
    .eq("id", user.id)
    .maybeSingle();

  const subscriptionActive = isSubscriptionActive(profile?.stripe_status);
  const demoAlreadyUsed =
    Boolean(profile?.free_demo_used_at) || hasDemoCookie(request);
  if (!canUseSemanticTool(subscriptionActive, demoAlreadyUsed ? "1" : null)) {
    return NextResponse.json(
      { error: "Subscription required.", code: "PAYWALL" },
      { status: 402 },
    );
  }

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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Web sources
        emitLine(controller, { type: "step", id: "sources", status: "running" });
        const [tavilyResults, exaResults] = await Promise.all([
          fetchTavily(brand, tavilyKey).catch(() => [] as SourceItem[]),
          fetchExa(brand, exaKey).catch(() => [] as SourceItem[]),
        ]);
        const sources = dedupeByUrl([...tavilyResults, ...exaResults]).slice(0, 18);
        emitLine(controller, { type: "step", id: "sources", status: "done", detail: `${sources.length} sources collected` });

        // Step 2: LLM synthesis
        emitLine(controller, { type: "step", id: "synthesis", status: "running" });
        const verifiedCompetitors = extractCompetitorNamesFromSources(brand, sources);
        let payload: SemanticUniversePayload;
        try {
          payload = await synthesizeWithOpenAI(brand, sources, openAiKey, verifiedCompetitors);
        } catch {
          payload = buildFallback(brand, sources);
        }
        emitLine(controller, { type: "step", id: "synthesis", status: "done" });

        // Step 3: Image enrichment
        emitLine(controller, { type: "step", id: "images", status: "running" });
        const enriched = await enrichVisualCorrelationsWithImages(payload, sources);
        emitLine(controller, { type: "step", id: "images", status: "done" });

        if (!subscriptionActive && !demoAlreadyUsed) {
          await markFreeDemoUsed(user.id);
        }

        emitLine(controller, { type: "done", payload: enriched });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected server error.";
        emitLine(controller, { type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });

  // Fallback guard: enforce one free run even when profile writes fail.
  if (!subscriptionActive && !demoAlreadyUsed) {
    response.headers.append(
      "Set-Cookie",
      "semantic_demo_used=1; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly",
    );
  }

  return response;
}
