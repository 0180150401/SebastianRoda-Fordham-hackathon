import type { SourceItem } from "./models";
import type { RetrievalLimits } from "./query-planner";
import { buildFallbackQueryPlan, getRetrievalLimits } from "./query-planner";
import type { QueryPlanEvent, RetrievalQueryObject } from "./types";

type RetrieverKeys = {
  tavilyKey: string;
  exaKey: string;
  limits?: RetrievalLimits;
};

type PlannedRetrieverKeys = RetrieverKeys & { queryPlan: QueryPlanEvent };

type Provider = "tavily" | "exa";

export type RetrievalFailure = {
  queryId: string;
  provider: Provider;
  reason: string;
};

export type RetrievalStats = {
  plannedQueries: number;
  providerSearchesPlanned: number;
  providerSearchesSucceeded: number;
  providerSearchesFailed: number;
  failures: RetrievalFailure[];
};

export type PlannedRetrievalResult = {
  sources: SourceItem[];
  stats: RetrievalStats;
};

export function dedupeByUrl(items: SourceItem[]): SourceItem[] {
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

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

function asReason(error: unknown): string {
  if (error instanceof Error) return error.name === "TimeoutError" ? "timeout" : error.message;
  return String(error);
}

function applyProviderCap(
  queries: RetrievalQueryObject[],
  provider: Provider,
  limit: number,
): RetrievalQueryObject[] {
  return queries.filter((query) => query.providers.includes(provider)).slice(0, limit);
}

async function fetchTavilyQuery(
  query: RetrievalQueryObject,
  apiKey: string,
  limits: RetrievalLimits,
): Promise<SourceItem[]> {
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query: query.searchPhrase,
    search_depth: "advanced",
    include_answer: false,
    max_results: 7,
  };
  if (query.recency === "bounded") {
    body.topic = "news";
    body.days = 30;
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: timeoutSignal(limits.providerTimeoutMs),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`tavily_${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
  };
  return (json.results ?? []).map((result) => ({
    query: query.searchPhrase,
    title: result.title ?? "Untitled result",
    url: result.url ?? "",
    snippet: result.content ?? "",
    published: result.published_date,
    provider: "tavily" as const,
  }));
}

async function fetchExaQuery(
  query: RetrievalQueryObject,
  apiKey: string,
  limits: RetrievalLimits,
): Promise<SourceItem[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    signal: timeoutSignal(limits.providerTimeoutMs),
    body: JSON.stringify({
      query: query.searchPhrase,
      type: "neural",
      numResults: 7,
      contents: {
        highlights: true,
        text: { maxCharacters: 1500 },
      },
    }),
  });
  if (!res.ok) throw new Error(`exa_${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      highlights?: string[];
      contents?: { text?: string; highlights?: string[] };
      publishedDate?: string;
    }>;
  };
  return (json.results ?? []).map((result) => ({
    query: query.searchPhrase,
    title: result.title ?? "Untitled result",
    url: result.url ?? "",
    snippet:
      result.contents?.text ??
      result.text ??
      result.contents?.highlights?.join(" ") ??
      result.highlights?.join(" ") ??
      "",
    published: result.publishedDate,
    provider: "exa" as const,
  }));
}

async function runProviderQuery(
  provider: Provider,
  query: RetrievalQueryObject,
  keys: Pick<RetrieverKeys, "tavilyKey" | "exaKey">,
  limits: RetrievalLimits,
): Promise<{ sources: SourceItem[]; failure?: RetrievalFailure }> {
  try {
    const sources =
      provider === "tavily"
        ? await fetchTavilyQuery(query, keys.tavilyKey, limits)
        : await fetchExaQuery(query, keys.exaKey, limits);
    return { sources };
  } catch (error) {
    return {
      sources: [],
      failure: { queryId: query.id, provider, reason: asReason(error) },
    };
  }
}

async function retrievePlannedSources(
  _brand: string,
  opts: Required<Pick<RetrieverKeys, "tavilyKey" | "exaKey" | "limits">> & { queryPlan: QueryPlanEvent },
): Promise<PlannedRetrievalResult> {
  const tavilyQueries = new Set(applyProviderCap(
    opts.queryPlan.queries,
    "tavily",
    opts.limits.maxProviderSearchesPerProvider,
  ).map((query) => query.id));
  const exaQueries = new Set(applyProviderCap(
    opts.queryPlan.queries,
    "exa",
    opts.limits.maxProviderSearchesPerProvider,
  ).map((query) => query.id));
  const jobs: Array<Promise<{ sources: SourceItem[]; failure?: RetrievalFailure }>> = [];
  for (const query of opts.queryPlan.queries) {
    if (tavilyQueries.has(query.id)) {
      jobs.push(runProviderQuery("tavily", query, opts, opts.limits));
    }
    if (exaQueries.has(query.id)) {
      jobs.push(runProviderQuery("exa", query, opts, opts.limits));
    }
  }
  const retrieval = Promise.all(jobs);
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<Array<{ sources: SourceItem[]; failure?: RetrievalFailure }>>((resolve) => {
    budgetTimer = setTimeout(() => {
      resolve(jobs.map(() => ({
        sources: [],
        failure: { queryId: "retrieval_budget", provider: "tavily", reason: "total_budget_timeout" },
      })));
    }, opts.limits.totalRetrievalBudgetMs);
  });

  const responses = await Promise.race([retrieval, budget]);
  if (budgetTimer) clearTimeout(budgetTimer);
  const failures = responses.flatMap((response) => response.failure ? [response.failure] : []);
  const sources = dedupeByUrl(responses.flatMap((response) => response.sources)).slice(0, 36);

  return {
    sources,
    stats: {
      plannedQueries: opts.queryPlan.queries.length,
      providerSearchesPlanned: jobs.length,
      providerSearchesSucceeded: responses.length - failures.length,
      providerSearchesFailed: failures.length,
      failures,
    },
  };
}

export function createLegacyQueryPlan(brand: string): QueryPlanEvent {
  return buildFallbackQueryPlan(brand, { limits: getRetrievalLimits() });
}

export async function retrieveSourcesForBrand(
  brand: string,
  opts: PlannedRetrieverKeys,
): Promise<PlannedRetrievalResult>;
export async function retrieveSourcesForBrand(
  brand: string,
  opts: RetrieverKeys,
): Promise<SourceItem[]>;
export async function retrieveSourcesForBrand(
  brand: string,
  opts: RetrieverKeys | PlannedRetrieverKeys,
): Promise<SourceItem[] | PlannedRetrievalResult> {
  const limits = opts.limits ?? getRetrievalLimits();
  const hasExplicitPlan = "queryPlan" in opts;
  const queryPlan = hasExplicitPlan ? opts.queryPlan : createLegacyQueryPlan(brand);
  const result = await retrievePlannedSources(brand, {
    tavilyKey: opts.tavilyKey,
    exaKey: opts.exaKey,
    queryPlan,
    limits,
  });

  if (hasExplicitPlan) return result;
  return result.sources.slice(0, 18);
}
