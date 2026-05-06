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

export const pipelineEventSchema = z.discriminatedUnion("type", [
  runMetaEventSchema,
  stepEventSchema,
  doneEventSchema,
  errorEventSchema,
]);

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;
export type RunMetaEvent = z.infer<typeof runMetaEventSchema>;
export type StepEvent = z.infer<typeof stepEventSchema>;
export type DoneEvent = z.infer<typeof doneEventSchema>;
export type ErrorEvent = z.infer<typeof errorEventSchema>;
