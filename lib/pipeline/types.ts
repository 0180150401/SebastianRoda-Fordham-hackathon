import * as z from "zod";

export const STEP_IDS = ["sources", "synthesis", "images"] as const;
export type StepId = (typeof STEP_IDS)[number];

export const STEP_STATUSES = ["running", "done", "error"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** Mitigate DoS via oversized NDJSON lines; parser should enforce. */
export const MAX_NDJSON_LINE_BYTES = 1_000_000;

const runMetaEventSchema = z.object({
  type: z.literal("run_meta"),
  run_id: z.string().uuid(),
});

const stepEventSchema = z.object({
  type: z.literal("step"),
  id: z.enum(STEP_IDS),
  status: z.enum(STEP_STATUSES),
  detail: z.string().max(2_000).optional(),
});

const doneEventSchema = z.object({
  type: z.literal("done"),
  payload: z.unknown(),
});

const errorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string().min(1).max(4_000),
});

export const retrievalQueryCategories = [
  "competitors",
  "adjacent_categories",
  "partners_ecosystem",
  "customer_segments",
  "claims_positioning",
  "risks_controversies",
  "recent_signals",
  "category_language",
] as const;

export const retrievalProviders = ["tavily", "exa"] as const;

export const retrievalQueryObjectSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  intent: z.string().min(1).max(400),
  searchPhrase: z.string().min(1).max(500),
  category: z.enum(retrievalQueryCategories),
  recency: z.enum(["none", "bounded"]),
  providers: z.array(z.enum(retrievalProviders)).min(1).max(2),
  successCriteria: z.string().min(1).max(500),
});

export const queryPlanDisplaySchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(600),
  items: z.array(z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    intent: z.string().min(1).max(300),
  })).min(1).max(12),
});

const queryPlanEventSchema = z.object({
  type: z.literal("query_plan"),
  plan_id: z.string().min(1).max(120),
  display: queryPlanDisplaySchema,
  queries: z.array(retrievalQueryObjectSchema).min(1).max(12),
});

export const pipelineEventSchema = z.discriminatedUnion("type", [
  runMetaEventSchema,
  queryPlanEventSchema,
  stepEventSchema,
  doneEventSchema,
  errorEventSchema,
]);

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;
export type RunMetaEvent = z.infer<typeof runMetaEventSchema>;
export type RetrievalQueryObject = z.infer<typeof retrievalQueryObjectSchema>;
export type QueryPlanDisplay = z.infer<typeof queryPlanDisplaySchema>;
export type QueryPlanEvent = z.infer<typeof queryPlanEventSchema>;
export type StepEvent = z.infer<typeof stepEventSchema>;
export type DoneEvent = z.infer<typeof doneEventSchema>;
export type ErrorEvent = z.infer<typeof errorEventSchema>;
