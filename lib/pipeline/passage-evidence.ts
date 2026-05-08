import type { Evidence, SourceDocument, SourceItem, SourcePassage } from "./models";

const DEFAULT_MAX_PASSAGES = 24;
const DEFAULT_MAX_EXCERPT_CHARS = 420;
const MIN_PASSAGE_CHARS = 24;

function rankId(prefix: string, rank: number): string {
  return `${prefix}-${String(rank).padStart(2, "0")}`;
}

function trimText(input: string, maxChars: number): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  return compact.slice(0, maxChars - 1).trimEnd() + "…";
}

function sourceIdFor(source: SourceItem, sourceRank: number): string {
  return source.sourceId?.trim() || rankId("src", sourceRank);
}

function passagesForSource(source: SourceItem): SourcePassage[] {
  const provided = source.passages ?? [];
  if (provided.length > 0) return provided;
  return source.snippet ? [{ kind: "snippet", text: source.snippet }] : [];
}

export function buildSourceDocuments(sources: SourceItem[]): SourceDocument[] {
  return sources.map((source, index) => ({
    id: sourceIdFor(source, index + 1),
    query: source.query,
    title: source.title,
    url: source.url,
    provider: source.provider,
    rank: index + 1,
    score: source.score,
    published: source.published,
  }));
}

export function buildPassageEvidence(
  sources: SourceItem[],
  opts?: { maxPassages?: number; maxExcerptChars?: number },
): Evidence[] {
  const maxPassages = opts?.maxPassages ?? DEFAULT_MAX_PASSAGES;
  const maxExcerptChars = opts?.maxExcerptChars ?? DEFAULT_MAX_EXCERPT_CHARS;
  const seen = new Set<string>();
  const evidence: Evidence[] = [];

  for (const [sourceIndex, source] of sources.entries()) {
    const sourceRank = sourceIndex + 1;
    const sourceId = sourceIdFor(source, sourceRank);
    let passageRank = 0;
    for (const passage of passagesForSource(source)) {
      const excerpt = trimText(passage.text, maxExcerptChars);
      if (excerpt.length < MIN_PASSAGE_CHARS) continue;
      const dedupeKey = excerpt.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      passageRank += 1;
      evidence.push({
        id: `${rankId("ev", sourceRank)}-${String(passageRank).padStart(2, "0")}`,
        sourceId,
        provider: source.provider,
        query: source.query,
        aiResponse: excerpt,
        excerpt,
        sourceTitle: source.title,
        sourceUrl: source.url,
        retrievalScore: passage.score ?? source.score,
        sourceRank,
        coOccurrence: Math.max(20, Math.round(74 - evidence.length * 2)),
        timestamp: source.published?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      });
      if (evidence.length >= maxPassages) return evidence;
    }
  }

  return evidence;
}

export function formatEvidenceForSynthesis(evidence: Evidence[]): string {
  return evidence
    .map((entry) => [
      `[${entry.id}] sourceId: ${entry.sourceId ?? "unknown"} | ${entry.provider ?? "source"}`,
      `title: ${entry.sourceTitle}`,
      `url: ${entry.sourceUrl}`,
      `query: ${entry.query}`,
      `excerpt: ${entry.excerpt ?? entry.aiResponse}`,
    ].join("\n"))
    .join("\n\n");
}
