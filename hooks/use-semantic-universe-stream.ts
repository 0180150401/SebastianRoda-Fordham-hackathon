"use client";

import { useCallback } from "react";
import { createNdjsonParser, NdjsonParseError } from "@/lib/pipeline/ndjson";
import type { DoneEvent, ErrorEvent, PipelineEvent, StepEvent } from "@/lib/pipeline/types";

export type StreamCallbacks = {
  onStep?: (event: StepEvent) => void;
  onDone?: (event: DoneEvent) => void;
  onError?: (event: ErrorEvent) => void;
  onFatal?: (error: NdjsonParseError | Error) => void;
};

export function useSemanticUniverseStream() {
  const consume = useCallback(async (body: ReadableStream<Uint8Array>, callbacks: StreamCallbacks) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const parser = createNdjsonParser();

    const dispatch = (events: PipelineEvent[]) => {
      for (const ev of events) {
        if (ev.type === "run_meta") {
          /* correlation-only — UI ignores run_id */
        } else if (ev.type === "step") callbacks.onStep?.(ev);
        else if (ev.type === "done") callbacks.onDone?.(ev);
        else if (ev.type === "error") callbacks.onError?.(ev);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        dispatch(parser.pushChunk(chunk));
      }
      dispatch(parser.pushChunk(decoder.decode()));
      dispatch(parser.end());
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      callbacks.onFatal?.(e);
      throw e;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* reader may already be released */
      }
    }
  }, []);

  return { consume };
}
