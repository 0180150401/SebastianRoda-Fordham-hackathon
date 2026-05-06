import OpenAI from "openai";

import {
  pipelineEventSchema,
  type QueryPlanEvent,
  type RetrievalQueryObject,
} from "./types";

export type RetrievalLimits = {
  minQueries: number;
  maxQueries: number;
  maxProviderSearchesPerProvider: number;
  providerTimeoutMs: number;
  totalRetrievalBudgetMs: number;
  minimumUsableSources: number;
};

const DEFAULT_LIMITS: RetrievalLimits = {
  minQueries: 5,
  maxQueries: 12,
  maxProviderSearchesPerProvider: 8,
  providerTimeoutMs: 8000,
  totalRetrievalBudgetMs: 45000,
  minimumUsableSources: 6,
};

type EnvSource = Record<string, string | undefined>;

type PlannerOpts = {
  openai?: OpenAI;
  openaiApiKey?: string;
  runId?: string;
  limits?: RetrievalLimits;
};

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getRetrievalLimits(env: EnvSource = process.env): RetrievalLimits {
  const minQueries = clamp(
    readPositiveInt(env.SEMANTIC_RETRIEVAL_MIN_QUERIES, DEFAULT_LIMITS.minQueries),
    DEFAULT_LIMITS.minQueries,
    DEFAULT_LIMITS.maxQueries,
  );
  const maxQueries = clamp(
    readPositiveInt(env.SEMANTIC_RETRIEVAL_MAX_QUERIES, DEFAULT_LIMITS.maxQueries),
    minQueries,
    DEFAULT_LIMITS.maxQueries,
  );

  return {
    minQueries,
    maxQueries,
    maxProviderSearchesPerProvider: clamp(
      readPositiveInt(
        env.SEMANTIC_RETRIEVAL_MAX_PROVIDER_SEARCHES,
        DEFAULT_LIMITS.maxProviderSearchesPerProvider,
      ),
      1,
      DEFAULT_LIMITS.maxProviderSearchesPerProvider,
    ),
    providerTimeoutMs: clamp(
      readPositiveInt(env.SEMANTIC_RETRIEVAL_PROVIDER_TIMEOUT_MS, DEFAULT_LIMITS.providerTimeoutMs),
      1000,
      DEFAULT_LIMITS.providerTimeoutMs,
    ),
    totalRetrievalBudgetMs: clamp(
      readPositiveInt(env.SEMANTIC_RETRIEVAL_TOTAL_BUDGET_MS, DEFAULT_LIMITS.totalRetrievalBudgetMs),
      5000,
      DEFAULT_LIMITS.totalRetrievalBudgetMs,
    ),
    minimumUsableSources: clamp(
      readPositiveInt(env.SEMANTIC_RETRIEVAL_MIN_USABLE_SOURCES, DEFAULT_LIMITS.minimumUsableSources),
      1,
      20,
    ),
  };
}

const CATEGORY_TEMPLATES: Array<Omit<RetrievalQueryObject, "id" | "searchPhrase" | "successCriteria"> & {
  phrase: (brand: string) => string;
  success: (brand: string) => string;
}> = [
  {
    label: "Competitive set",
    intent: "Find peer brands and substitutes users compare against this brand.",
    category: "competitors",
    recency: "none",
    providers: ["tavily", "exa"],
    phrase: (brand) => `${brand} competitors alternatives similar brands customer intent`,
    success: (brand) => `Results mention ${brand} alongside peer or substitute brands.`,
  },
  {
    label: "Adjacent categories",
    intent: "Map nearby categories where the brand may share demand.",
    category: "adjacent_categories",
    recency: "none",
    providers: ["tavily", "exa"],
    phrase: (brand) => `${brand} adjacent categories shared product spaces audience`,
    success: (brand) => `Results connect ${brand} to adjacent category demand.`,
  },
  {
    label: "Partners and ecosystem",
    intent: "Find retailers, partners, creators, and ecosystem entities around the brand.",
    category: "partners_ecosystem",
    recency: "none",
    providers: ["tavily", "exa"],
    phrase: (brand) => `${brand} partners retailers collaborations ecosystem`,
    success: (brand) => `Results identify ecosystem entities tied to ${brand}.`,
  },
  {
    label: "Customer segments",
    intent: "Understand audience segments and jobs-to-be-done around the brand.",
    category: "customer_segments",
    recency: "none",
    providers: ["tavily", "exa"],
    phrase: (brand) => `${brand} target customer segments use cases audience`,
    success: (brand) => `Results describe customer segments connected to ${brand}.`,
  },
  {
    label: "Claims and positioning",
    intent: "Collect product claims, positioning phrases, and differentiators.",
    category: "claims_positioning",
    recency: "none",
    providers: ["tavily", "exa"],
    phrase: (brand) => `${brand} positioning claims differentiators brand language`,
    success: (brand) => `Results include positioning language used for ${brand}.`,
  },
  {
    label: "Risks and controversies",
    intent: "Check risks, criticism, controversies, or trust signals.",
    category: "risks_controversies",
    recency: "bounded",
    providers: ["tavily"],
    phrase: (brand) => `${brand} controversy criticism risk trust recent news`,
    success: (brand) => `Results surface recent trust or risk context for ${brand}.`,
  },
  {
    label: "Recent signals",
    intent: "Look for fresh launches, funding, partnerships, market movement, or press.",
    category: "recent_signals",
    recency: "bounded",
    providers: ["tavily", "exa"],
    phrase: (brand) => `${brand} recent launch partnership funding market news`,
    success: (brand) => `Results include recent market movement involving ${brand}.`,
  },
  {
    label: "Category language",
    intent: "Extract the language people use to describe the category and intent space.",
    category: "category_language",
    recency: "none",
    providers: ["tavily", "exa"],
    phrase: (brand) => `${brand} category language descriptors search intent`,
    success: (brand) => `Results show category descriptors that frame ${brand}.`,
  },
];

export function buildFallbackQueryPlan(
  brand: string,
  opts?: { runId?: string; limits?: RetrievalLimits },
): QueryPlanEvent {
  const limits = opts?.limits ?? getRetrievalLimits();
  const targetCount = clamp(8, limits.minQueries, limits.maxQueries);
  const queries = CATEGORY_TEMPLATES.slice(0, targetCount).map((template, index) => ({
    id: `q${index + 1}_${template.category}`,
    label: template.label,
    intent: template.intent,
    searchPhrase: template.phrase(brand),
    category: template.category,
    recency: template.recency,
    providers: template.providers,
    successCriteria: template.success(brand),
  }));

  return {
    type: "query_plan",
    plan_id: opts?.runId ? `${opts.runId}:retrieval-plan` : `retrieval-plan:${brand}`,
    display: {
      title: "Retrieval plan",
      summary: `Searching ${queries.length} angles across competitors, category context, customer intent, risks, and recent signals.`,
      items: queries.map(({ id, label, intent }) => ({ id, label, intent })),
    },
    queries,
  };
}

function coerceQueryPlan(candidate: unknown, brand: string, opts: { runId?: string; limits: RetrievalLimits }): QueryPlanEvent | null {
  const parsed = pipelineEventSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.type !== "query_plan") return null;

  const queries = parsed.data.queries
    .slice(0, opts.limits.maxQueries)
    .map((query) => ({
      ...query,
      searchPhrase: query.searchPhrase.includes(brand)
        ? query.searchPhrase
        : `${brand} ${query.searchPhrase}`,
    }));
  const boundedCount = queries.filter((query) => query.recency === "bounded").length;
  if (queries.length < opts.limits.minQueries || boundedCount < 1 || boundedCount > 2) return null;

  return {
    ...parsed.data,
    plan_id: parsed.data.plan_id || `${opts.runId ?? crypto.randomUUID()}:retrieval-plan`,
    display: {
      ...parsed.data.display,
      items: parsed.data.display.items.filter((item) =>
        queries.some((query) => query.id === item.id),
      ),
    },
    queries,
  };
}

export async function planRetrievalQueries(
  brand: string,
  opts: PlannerOpts = {},
): Promise<QueryPlanEvent> {
  const limits = opts.limits ?? getRetrievalLimits();
  const fallback = () => buildFallbackQueryPlan(brand, { runId: opts.runId, limits });
  const openai = opts.openai ?? (opts.openaiApiKey ? new OpenAI({ apiKey: opts.openaiApiKey }) : null);
  if (!openai) return fallback();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Return only JSON for a query_plan event. Create structured retrieval query objects for brand research. Use 5-12 queries, 1-2 bounded recency queries, and friendly display copy.",
        },
        {
          role: "user",
          content: `Brand: ${brand}\nCategories: competitors, adjacent_categories, partners_ecosystem, customer_segments, claims_positioning, risks_controversies, recent_signals, category_language.`,
        },
      ],
    });
    const content = completion.choices[0]?.message.content;
    if (!content) return fallback();
    const candidate = JSON.parse(content) as unknown;
    return coerceQueryPlan(candidate, brand, { runId: opts.runId, limits }) ?? fallback();
  } catch (error) {
    console.warn("[query-planner] fallback", error instanceof Error ? error.message : error);
    return fallback();
  }
}
