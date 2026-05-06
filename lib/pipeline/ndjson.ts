import {
  MAX_NDJSON_LINE_BYTES,
  pipelineEventSchema,
  type PipelineEvent,
} from "@/lib/pipeline/types";

export class NdjsonParseError extends Error {
  readonly cause?: unknown;
  readonly rawLineSnippet?: string;
  constructor(message: string, opts?: { cause?: unknown; rawLineSnippet?: string }) {
    super(message);
    this.name = "NdjsonParseError";
    this.cause = opts?.cause;
    this.rawLineSnippet = opts?.rawLineSnippet?.slice(0, 200);
  }
}

export function createNdjsonParser() {
  let buffer = "";
  function pushChunk(chunk: string): PipelineEvent[] {
    if (buffer.length + chunk.length > MAX_NDJSON_LINE_BYTES * 2) {
      throw new NdjsonParseError("Stream line exceeded maximum size");
    }
    buffer += chunk;
    const out: PipelineEvent[] = [];
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      const trimmed = line.trim();
      if (trimmed === "") continue;
      if (Buffer.byteLength(trimmed, "utf8") > MAX_NDJSON_LINE_BYTES) {
        throw new NdjsonParseError("NDJSON line exceeded MAX_NDJSON_LINE_BYTES");
      }
      let json: unknown;
      try {
        json = JSON.parse(trimmed);
      } catch (e) {
        throw new NdjsonParseError("Stream contained invalid JSON", {
          cause: e,
          rawLineSnippet: trimmed,
        });
      }
      const result = pipelineEventSchema.safeParse(json);
      if (!result.success) {
        const issue = result.error.issues[0];
        const path = issue?.path?.join(".") || "<root>";
        throw new NdjsonParseError(
          `Stream event failed validation at "${path}": ${issue?.message ?? "unknown"}`,
          { cause: result.error },
        );
      }
      out.push(result.data);
    }
    return out;
  }
  function end(): PipelineEvent[] {
    if (buffer.trim() !== "") {
      const snippet = buffer;
      buffer = "";
      throw new NdjsonParseError("Stream ended with incomplete line", { rawLineSnippet: snippet });
    }
    buffer = "";
    return [];
  }
  return { pushChunk, end };
}

export function parseNdjsonEvents(chunks: Iterable<string>): PipelineEvent[] {
  const parser = createNdjsonParser();
  const events: PipelineEvent[] = [];
  for (const c of chunks) events.push(...parser.pushChunk(c));
  events.push(...parser.end());
  return events;
}
