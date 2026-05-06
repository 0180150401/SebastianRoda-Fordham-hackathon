import type { SupabaseClient } from "@supabase/supabase-js";

export class DailyCapError extends Error {
  readonly code = "DAILY_CAP" as const;
  constructor(message = "Daily analysis budget exceeded.") {
    super(message);
    this.name = "DailyCapError";
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw.replace(/^['"]|['"]$/g, "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Max pseudo-tokens (OpenAI in+out + retrieval charges) per user per UTC calendar day. */
export function getSemanticDailyTokenBudget(): number {
  return parsePositiveInt(process.env.SEMANTIC_DAILY_TOKEN_BUDGET, 500_000);
}

/** Pseudo-token charge per semantic-universe retrieval cycle (Tavily + Exa pair). Geo-chat uses 0. */
export function getRetrievalUnitTokenCharge(): number {
  return parsePositiveInt(process.env.SEMANTIC_RETRIEVAL_UNIT_TOKEN_CHARGE, 500);
}

export function getUtcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export type DailyRollup = {
  input: number;
  output: number;
  retrievalUnits: number;
};

export async function loadDailyRollup(
  supabase: SupabaseClient,
  userId: string,
  usageDate = getUtcDateString(),
): Promise<DailyRollup> {
  const { data, error } = await supabase
    .from("user_daily_usage")
    .select("openai_input_tokens, openai_output_tokens, retrieval_units")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) {
    console.warn("[daily-token-budget] load rollup", error.message);
    return { input: 0, output: 0, retrievalUnits: 0 };
  }
  if (!data) return { input: 0, output: 0, retrievalUnits: 0 };
  return {
    input: Number(data.openai_input_tokens) || 0,
    output: Number(data.openai_output_tokens) || 0,
    retrievalUnits: Number(data.retrieval_units) || 0,
  };
}

export function pseudoTokensUsed(rollup: DailyRollup): number {
  const charge = getRetrievalUnitTokenCharge();
  return rollup.input + rollup.output + rollup.retrievalUnits * charge;
}

export async function assertDailyBudgetAllows(supabase: SupabaseClient, userId: string): Promise<void> {
  const rollup = await loadDailyRollup(supabase, userId);
  const budget = getSemanticDailyTokenBudget();
  if (pseudoTokensUsed(rollup) >= budget) {
    throw new DailyCapError();
  }
}

export async function applyOpenAiUsage(
  supabase: SupabaseClient,
  userId: string,
  usage: { input: number; output: number },
  retrievalUnitsDelta: number,
  usageDate = getUtcDateString(),
): Promise<void> {
  const addIn = Math.max(0, usage.input);
  const addOut = Math.max(0, usage.output);
  const addUnits = Math.max(0, retrievalUnitsDelta);

  const { data: existing, error: selErr } = await supabase
    .from("user_daily_usage")
    .select("openai_input_tokens, openai_output_tokens, retrieval_units")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (selErr) {
    console.error("[daily-token-budget] select rollup", selErr.message);
    return;
  }

  if (!existing) {
    const { error } = await supabase.from("user_daily_usage").insert({
      user_id: userId,
      usage_date: usageDate,
      openai_input_tokens: addIn,
      openai_output_tokens: addOut,
      retrieval_units: addUnits,
    });
    if (error) console.error("[daily-token-budget] insert rollup", error.message);
    return;
  }

  const { error } = await supabase
    .from("user_daily_usage")
    .update({
      openai_input_tokens: Number(existing.openai_input_tokens) + addIn,
      openai_output_tokens: Number(existing.openai_output_tokens) + addOut,
      retrieval_units: Number(existing.retrieval_units) + addUnits,
    })
    .eq("user_id", userId)
    .eq("usage_date", usageDate);

  if (error) console.error("[daily-token-budget] update rollup", error.message);
}
