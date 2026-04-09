"use client";

import { InfoHint } from "@/components/tool/info-hint";
import { useMemo } from "react";

type DiscourseLike = {
  modelFamily: string;
  sentiment: "positive" | "neutral" | "mixed";
  observedAt?: string;
  intent?: string;
  evidenceIds?: string[];
};

type EvidenceLike = {
  id: string;
  aiResponse: string;
  query?: string;
  sourceTitle?: string;
  sourceUrl?: string;
};

type ModelRow = {
  label: string;
  strength: number;
  share: number;
  confidence: number;
  trend: number;
  brandRelevance: number;
  evidenceCoverage: number;
};

type SeedModel = {
  model: string;
  avg: number;
  count: number;
  evidenceIds?: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function sentimentWeight(sentiment: DiscourseLike["sentiment"]): number {
  switch (sentiment) {
    case "positive":
      return 1;
    case "neutral":
      return 0.55;
    case "mixed":
      return 0.38;
    default:
      return 0.5;
  }
}

function intentWeight(intent?: string): number {
  if (!intent) return 0.7;
  const normalized = intent.toLowerCase();
  if (/(comparison|alternatives|recommend|buy|purchase|commercial)/.test(normalized)) return 1;
  if (/(validation|trust|professional|capsule|discovery)/.test(normalized)) return 0.8;
  if (/(awareness|informational|educational)/.test(normalized)) return 0.65;
  return 0.7;
}

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recencyWeight(observedAt: Date | null, anchorDate: Date): number {
  if (!observedAt) return 0.7;
  const daysOld = Math.max(0, (anchorDate.getTime() - observedAt.getTime()) / DAY_MS);
  const decay = Math.exp(-daysOld / 21);
  return Math.max(0.35, decay);
}

function splitModelLabels(modelFamily: string): string[] {
  return modelFamily
    .split(/[,/&;+]|(?:\band\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ENGINE_ORDER = ["Gemini", "Claude", "ChatGPT"] as const;

const SOURCE_ENGINE_PATTERNS: Array<{ label: (typeof ENGINE_ORDER)[number]; regex: RegExp }> = [
  { label: "Gemini", regex: /\b(gemini|google ai studio)\b/i },
  { label: "Claude", regex: /\b(claude|anthropic)\b/i },
  { label: "ChatGPT", regex: /\b(chatgpt|openai|gpt-?4|gpt-?5)\b/i },
];

function canonicalEngineLabel(rawLabel: string): (typeof ENGINE_ORDER)[number] | null {
  const trimmed = rawLabel.trim();
  if (!trimmed) return null;

  for (const entry of SOURCE_ENGINE_PATTERNS) {
    if (entry.regex.test(trimmed)) return entry.label;
  }
  return null;
}

function inferEvidenceEngines(evidence?: EvidenceLike): Array<(typeof ENGINE_ORDER)[number]> {
  if (!evidence) return [];
  const text = `${evidence.sourceTitle ?? ""} ${evidence.query ?? ""} ${evidence.aiResponse ?? ""} ${evidence.sourceUrl ?? ""}`;
  if (!text.trim()) return [];
  return SOURCE_ENGINE_PATTERNS.filter((entry) => entry.regex.test(text)).map((entry) => entry.label);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRows(items: DiscourseLike[], evidence: EvidenceLike[], brand: string): ModelRow[] {
  const alpha = 1.5;
  const scores = new Map<(typeof ENGINE_ORDER)[number], number>();
  const scores7d = new Map<(typeof ENGINE_ORDER)[number], number>();
  const scores30d = new Map<(typeof ENGINE_ORDER)[number], number>();
  const evidenceDiversity = new Map<(typeof ENGINE_ORDER)[number], Set<string>>();
  const evidenceByLabel = new Map<(typeof ENGINE_ORDER)[number], Set<string>>();
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const normalizedBrand = brand.trim();
  const brandRegex = normalizedBrand ? new RegExp(escapeRegex(normalizedBrand), "ig") : null;

  for (const engine of ENGINE_ORDER) {
    scores.set(engine, 0);
    scores7d.set(engine, 0);
    scores30d.set(engine, 0);
    evidenceDiversity.set(engine, new Set<string>());
    evidenceByLabel.set(engine, new Set<string>());
  }

  const observedDates = items
    .map((item) => parseDate(item.observedAt))
    .filter((value): value is Date => value instanceof Date);

  const anchorDate = observedDates.length
    ? new Date(Math.max(...observedDates.map((date) => date.getTime())))
    : new Date();
  const since7d = anchorDate.getTime() - 7 * DAY_MS;
  const since30d = anchorDate.getTime() - 30 * DAY_MS;

  for (const item of items) {
    const familyLabels = splitModelLabels(item.modelFamily)
      .map(canonicalEngineLabel)
      .filter((label): label is (typeof ENGINE_ORDER)[number] => label !== null);
    const evidenceLabels = (item.evidenceIds ?? [])
      .flatMap((id) => inferEvidenceEngines(evidenceById.get(id)))
      .filter((label): label is (typeof ENGINE_ORDER)[number] => label !== null);
    const labels = [...new Set([...familyLabels, ...evidenceLabels])];
    if (!labels.length) continue;

    const observedAt = parseDate(item.observedAt);
    const baseWeight =
      sentimentWeight(item.sentiment) *
      intentWeight(item.intent) *
      recencyWeight(observedAt, anchorDate);
    const perLabelWeight = baseWeight / labels.length;

    for (const label of labels) {
      scores.set(label, (scores.get(label) ?? 0) + perLabelWeight);
      if (observedAt && observedAt.getTime() >= since7d) {
        scores7d.set(label, (scores7d.get(label) ?? 0) + perLabelWeight);
      }
      if (observedAt && observedAt.getTime() >= since30d) {
        scores30d.set(label, (scores30d.get(label) ?? 0) + perLabelWeight);
      }

      const bucket = evidenceDiversity.get(label) ?? new Set<string>();
      for (const evidenceId of item.evidenceIds ?? []) bucket.add(evidenceId);
      evidenceDiversity.set(label, bucket);

      const evidenceSet = evidenceByLabel.get(label) ?? new Set<string>();
      for (const evidenceId of item.evidenceIds ?? []) evidenceSet.add(evidenceId);
      evidenceByLabel.set(label, evidenceSet);
    }
  }

  // Fallback: if discourse carries no engine tags, infer directly from all evidence text.
  const hasAnySignal = [...scores.values()].some((value) => value > 0);
  if (!hasAnySignal) {
    for (const entry of evidence) {
      const labels = inferEvidenceEngines(entry);
      if (!labels.length) continue;
      const perLabelWeight = 0.7 / labels.length;
      for (const label of labels) {
        scores.set(label, (scores.get(label) ?? 0) + perLabelWeight);
        const bucket = evidenceDiversity.get(label) ?? new Set<string>();
        bucket.add(entry.id);
        evidenceDiversity.set(label, bucket);
        const evidenceSet = evidenceByLabel.get(label) ?? new Set<string>();
        evidenceSet.add(entry.id);
        evidenceByLabel.set(label, evidenceSet);
      }
    }
  }

  const labels = [...ENGINE_ORDER];

  const total = [...scores.values()].reduce((acc, value) => acc + value, 0);
  const total7d = [...scores7d.values()].reduce((acc, value) => acc + value, 0);
  const total30d = [...scores30d.values()].reduce((acc, value) => acc + value, 0);
  const denominator = total > 0 ? total + alpha * labels.length : 0;

  const posteriorRows = labels
    .map((label) => {
      const weightedMentions = scores.get(label) ?? 0;
      const posterior = denominator > 0 ? (weightedMentions + alpha) / denominator : 0;

      const recent7d = scores7d.get(label) ?? 0;
      const recent30d = scores30d.get(label) ?? 0;
      const share7d = total7d > 0 ? recent7d / total7d : posterior;
      const share30d = total30d > 0 ? recent30d / total30d : posterior;
      const trend = (share7d - share30d) * 100;

      const evidenceCount = evidenceDiversity.get(label)?.size ?? 0;
      const effectiveSample = weightedMentions * (0.75 + Math.min(evidenceCount, 8) / 8);
      const confidence =
        weightedMentions > 0
          ? Math.max(35, Math.min(97, 100 * (1 - Math.exp(-effectiveSample / 2.8))))
          : 0;

      const relatedEvidenceIds = [...(evidenceByLabel.get(label) ?? new Set<string>())];
      const evidenceCoverage = relatedEvidenceIds.length;
      let brandHits = 0;
      if (brandRegex) {
        for (const evidenceId of relatedEvidenceIds) {
          const source = evidenceById.get(evidenceId);
          if (!source) continue;
          // Use answer text only; query often includes the brand by construction.
          const text = source.aiResponse ?? "";
          brandRegex.lastIndex = 0;
          if (brandRegex.test(text)) {
            brandHits += 1;
          }
        }
      }
      const brandRelevance =
        evidenceCoverage > 0 ? Math.round((brandHits / evidenceCoverage) * 100) : 0;

      return {
        label,
        posterior,
        trend: Math.round(trend * 10) / 10,
        confidence: Math.round(confidence),
        brandRelevance,
        evidenceCoverage,
      };
    })
    .sort((a, b) => b.posterior - a.posterior || labels.indexOf(a.label) - labels.indexOf(b.label));

  return posteriorRows.map((row) => ({
    label: row.label,
    // Absolute Bayesian share avoids "all 100%" when engines tie.
    strength: Math.round(row.posterior * 1000) / 10,
    share: Math.round(row.posterior * 1000) / 10,
    confidence: row.confidence,
    trend: row.trend,
    brandRelevance: row.brandRelevance,
    evidenceCoverage: row.evidenceCoverage,
  }));
}

export type ModelStrengthDashProps = {
  items: DiscourseLike[];
  evidence: EvidenceLike[];
  brand: string;
  seedModels?: SeedModel[];
  className?: string;
};

function buildRowsWithSeed(
  items: DiscourseLike[],
  evidence: EvidenceLike[],
  brand: string,
  seedModels: SeedModel[],
): ModelRow[] {
  const fromSignals = buildRows(items, evidence, brand);
  const hasSignalStrength = fromSignals.some((row) => row.strength > 0 || row.evidenceCoverage > 0);
  if (hasSignalStrength || seedModels.length === 0) return fromSignals;

  const evidenceById = new Map(evidence.map((entry) => [entry.id, entry]));
  const normalizedBrand = brand.trim();
  const brandRegex = normalizedBrand ? new RegExp(escapeRegex(normalizedBrand), "ig") : null;

  const mapped = seedModels
    .map((seed) => {
      const label = canonicalEngineLabel(seed.model);
      if (!label) return null;
      const evidenceIds = Array.isArray(seed.evidenceIds)
        ? seed.evidenceIds.filter((id): id is string => typeof id === "string")
        : [];
      let brandHits = 0;
      for (const evidenceId of evidenceIds) {
        const source = evidenceById.get(evidenceId);
        if (!source || !brandRegex) continue;
        const text = source.aiResponse ?? "";
        brandRegex.lastIndex = 0;
        if (brandRegex.test(text)) brandHits += 1;
      }
      const evidenceCoverage = evidenceIds.length;
      const brandRelevance = evidenceCoverage > 0 ? Math.round((brandHits / evidenceCoverage) * 100) : 0;
      return {
        label,
        seedScore: Math.max(0, Math.min(100, seed.avg)),
        confidence: Math.max(0, Math.min(97, Math.round(seed.count * 12))),
        evidenceCoverage,
        brandRelevance,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const merged = new Map<
    (typeof ENGINE_ORDER)[number],
    { score: number; confidence: number; evidenceCoverage: number; brandRelevance: number; count: number }
  >();

  for (const entry of mapped) {
    const bucket = merged.get(entry.label) ?? {
      score: 0,
      confidence: 0,
      evidenceCoverage: 0,
      brandRelevance: 0,
      count: 0,
    };
    bucket.score += entry.seedScore;
    bucket.confidence += entry.confidence;
    bucket.evidenceCoverage += entry.evidenceCoverage;
    bucket.brandRelevance += entry.brandRelevance;
    bucket.count += 1;
    merged.set(entry.label, bucket);
  }

  const maxSeed = Math.max(
    1,
    ...ENGINE_ORDER.map((engine) => {
      const bucket = merged.get(engine);
      return bucket ? bucket.score / bucket.count : 0;
    }),
  );

  const totalSeed = ENGINE_ORDER.reduce((sum, engine) => {
    const bucket = merged.get(engine);
    return sum + (bucket ? bucket.score / bucket.count : 0);
  }, 0);

  return ENGINE_ORDER.map((engine) => {
    const bucket = merged.get(engine);
    const avgScore = bucket ? bucket.score / bucket.count : 0;
    const avgConfidence = bucket ? Math.round(bucket.confidence / bucket.count) : 0;
    const avgBrandRelevance = bucket ? Math.round(bucket.brandRelevance / bucket.count) : 0;
    return {
      label: engine,
      strength: avgScore > 0 ? Math.round((avgScore / maxSeed) * 100) : 0,
      share: totalSeed > 0 ? Math.round((avgScore / totalSeed) * 1000) / 10 : 0,
      confidence: avgConfidence,
      trend: 0,
      brandRelevance: avgBrandRelevance,
      evidenceCoverage: bucket?.evidenceCoverage ?? 0,
    };
  });
}

export function ModelStrengthDash({ items, evidence, brand, seedModels = [], className }: ModelStrengthDashProps) {
  const rows = useMemo(
    () => buildRowsWithSeed(items, evidence, brand, seedModels),
    [items, evidence, brand, seedModels],
  );
  const infoText =
    "SOMS compares only Gemini, Claude, and ChatGPT. Each engine score uses evidence-weighted mentions from discourse plus source metadata. Brand pop-up is the share of engine-linked evidence where the brand appears in the response.";

  if (rows.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-primary/20 bg-surface-inset px-4 py-6 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        Run analysis to populate model strength.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-border bg-surface-inset px-4 py-3 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Model strength
        </h3>
        <InfoHint text={infoText} />
      </div>
      <ul className="space-y-2.5" aria-label="Model strength by AI surface">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{row.strength}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15" role="presentation">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${row.strength}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded border border-primary/15 bg-chip px-1.5 py-0.5">
                share {row.share}%
              </span>
              <span className="rounded border border-primary/15 bg-chip px-1.5 py-0.5">
                brand pop-up {row.brandRelevance}%
              </span>
              <span className="rounded border border-primary/15 bg-chip px-1.5 py-0.5">
                conf {row.confidence}%
              </span>
              <span className="rounded border border-primary/15 bg-chip px-1.5 py-0.5">
                evidence {row.evidenceCoverage}
              </span>
              <span
                className="rounded border border-primary/15 bg-chip px-1.5 py-0.5"
                aria-label={`trend ${row.trend >= 0 ? "up" : "down"} ${Math.abs(row.trend)} percent`}
              >
                {row.trend >= 0 ? "+" : ""}
                {row.trend}% 7d
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
