import OpenAI from "openai";
import { observeOpenAI } from "langfuse";

import { isLangfuseEnabled } from "@/lib/langfuse/client";

export function createTracedOpenAI(
  apiKey: string,
  opts?: { userId?: string; traceName?: string },
): OpenAI {
  const base = new OpenAI({ apiKey });
  if (!isLangfuseEnabled()) return base;
  return observeOpenAI(base, {
    traceName: opts?.traceName ?? "openai",
    userId: opts?.userId,
  }) as OpenAI;
}
