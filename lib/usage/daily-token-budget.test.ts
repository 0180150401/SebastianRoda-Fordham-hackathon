import { describe, expect, it } from "vitest";
import {
  assertDailyBudgetAllows,
  DailyCapError,
  getRetrievalUnitTokenCharge,
  getSemanticDailyTokenBudget,
  pseudoTokensUsed,
} from "@/lib/usage/daily-token-budget";

describe("daily-token-budget", () => {
  it("pseudoTokensUsed sums tokens and retrieval charge", () => {
    const charge = getRetrievalUnitTokenCharge();
    expect(pseudoTokensUsed({ input: 100, output: 50, retrievalUnits: 2 })).toBe(150 + 2 * charge);
  });

  it("DailyCapError exposes code DAILY_CAP", () => {
    const e = new DailyCapError();
    expect(e.code).toBe("DAILY_CAP");
  });

  it("getSemanticDailyTokenBudget returns non-negative default when env unset", () => {
    expect(getSemanticDailyTokenBudget()).toBeGreaterThan(0);
  });

  it("assertDailyBudgetAllows throws DailyCapError when pseudo usage meets budget", async () => {
    const budget = getSemanticDailyTokenBudget();
    const supabase = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: {
                          openai_input_tokens: budget,
                          openai_output_tokens: 0,
                          retrieval_units: 0,
                        },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
    await expect(assertDailyBudgetAllows(supabase as never, "user-id")).rejects.toBeInstanceOf(DailyCapError);
  });
});
