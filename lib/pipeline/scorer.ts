import type { SourceItem } from "./models";

const DEFAULT_TOP_N = 18;
const DEFAULT_TIMEOUT_MS = 8000;
const VOYAGE_RERANK_MODEL = "rerank-2.5";
export const RERANK_QUERY_SUFFIX = "semantic brand universe competitive intent";

type VoyageRerankResponse = {
  data?: Array<{ index?: number; relevanceScore?: number }>;
};

type VoyageRerankClient = {
  rerank: (
    request: {
      query: string;
      documents: string[];
      model: string;
      topK: number;
      returnDocuments: boolean;
      truncation: boolean;
    },
    requestOptions: {
      abortSignal?: AbortSignal;
      timeoutInSeconds: number;
      maxRetries: number;
    },
  ) => Promise<VoyageRerankResponse>;
};

type VoyageModule = {
  VoyageAIClient: new (opts: { apiKey: string }) => VoyageRerankClient;
};

function loadVoyageClient(voyageApiKey: string): VoyageRerankClient {
  // The SDK's ESM build currently trips Node/Vitest directory import resolution, so load CJS lazily.
  const { VoyageAIClient } = require("voyageai") as VoyageModule;
  return new VoyageAIClient({ apiKey: voyageApiKey });
}

function sourceToDocument(source: SourceItem): string {
  return [
    `[${source.provider}] ${source.title}`,
    `query: ${source.query}`,
    `url: ${source.url}`,
    `snippet: ${source.snippet}`,
  ].join("\n");
}

function naiveTopSources(sources: SourceItem[], topN: number): SourceItem[] {
  return sources.slice(0, topN);
}

function makeAbortSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

function normalizeTopN(topN: number | undefined): number {
  if (!Number.isFinite(topN)) return DEFAULT_TOP_N;
  return Math.max(0, Math.floor(topN ?? DEFAULT_TOP_N));
}

export async function rerankSourcesWithVoyage(
  sources: SourceItem[],
  brand: string,
  client: VoyageRerankClient,
  opts?: { timeoutMs?: number; topN?: number },
): Promise<SourceItem[]> {
  const topN = normalizeTopN(opts?.topN);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const query = `${brand} ${RERANK_QUERY_SUFFIX}`;

  const response = await client.rerank(
    {
      query,
      documents: sources.map(sourceToDocument),
      model: VOYAGE_RERANK_MODEL,
      topK: topN,
      returnDocuments: false,
      truncation: true,
    },
    {
      abortSignal: makeAbortSignal(timeoutMs),
      timeoutInSeconds: Math.ceil(timeoutMs / 1000),
      maxRetries: 0,
    },
  );

  return (response.data ?? [])
    .filter((item): item is { index: number; relevanceScore?: number } => typeof item.index === "number")
    .sort(
      (a, b) =>
        (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) ||
        a.index - b.index,
    )
    .map((item) => sources[item.index])
    .filter((item): item is SourceItem => Boolean(item))
    .slice(0, topN);
}

export async function scoreSourcesForSynthesis(
  sources: SourceItem[],
  brand: string,
  opts?: { voyageApiKey?: string; timeoutMs?: number; topN?: number },
): Promise<SourceItem[]> {
  const topN = normalizeTopN(opts?.topN);
  const voyageApiKey = opts?.voyageApiKey?.trim();
  if (!voyageApiKey) {
    return naiveTopSources(sources, topN);
  }

  try {
    const client = loadVoyageClient(voyageApiKey);
    const rankedSources = await rerankSourcesWithVoyage(sources, brand, client, {
      timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      topN,
    });
    return rankedSources.length > 0 ? rankedSources : naiveTopSources(sources, topN);
  } catch (error) {
    console.warn("[scorer] Voyage rerank failed; falling back to source order.", {
      message: error instanceof Error ? error.message : "Unknown rerank error",
    });
    return naiveTopSources(sources, topN);
  }
}
