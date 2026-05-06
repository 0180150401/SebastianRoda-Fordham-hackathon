import type { SourceItem } from "./models";

export const SOURCE_REJECTION_REASONS = [
  "too_short",
  "bot_blocked",
  "access_denied",
  "missing_url",
  "missing_title",
  "boilerplate_noise",
] as const;

export type SourceRejectionReason = (typeof SOURCE_REJECTION_REASONS)[number];

export type SourceQualityResult = {
  usableSources: SourceItem[];
  rejectedCounts: Record<SourceRejectionReason, number>;
  safeSamples: Array<{ reason: SourceRejectionReason; url?: string; title?: string }>;
};

const BOT_BLOCK_PATTERNS = [
  /are you a robot/i,
  /verify you are human/i,
  /captcha/i,
  /bot detection/i,
  /cloudflare/i,
];

const ACCESS_DENIED_PATTERNS = [
  /access denied/i,
  /403 forbidden/i,
  /not authorized/i,
  /permission denied/i,
  /request blocked/i,
];

const BOILERPLATE_PATTERNS = [
  /enable javascript/i,
  /accept cookies/i,
  /subscribe to continue/i,
  /sign in to continue/i,
  /privacy policy terms/i,
];

function emptyCounts(): Record<SourceRejectionReason, number> {
  return {
    too_short: 0,
    bot_blocked: 0,
    access_denied: 0,
    missing_url: 0,
    missing_title: 0,
    boilerplate_noise: 0,
  };
}

function tokenCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function classifySource(source: SourceItem): SourceRejectionReason | null {
  if (!source.url.trim()) return "missing_url";
  if (!source.title.trim()) return "missing_title";

  const text = `${source.title} ${source.snippet}`.trim();
  if (BOT_BLOCK_PATTERNS.some((pattern) => pattern.test(text))) return "bot_blocked";
  if (ACCESS_DENIED_PATTERNS.some((pattern) => pattern.test(text))) return "access_denied";
  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text))) return "boilerplate_noise";
  if (tokenCount(source.snippet) < 150) return "too_short";

  return null;
}

export function filterSourcesForQuality(sources: SourceItem[]): SourceQualityResult {
  const rejectedCounts = emptyCounts();
  const usableSources: SourceItem[] = [];
  const safeSamples: SourceQualityResult["safeSamples"] = [];

  for (const source of sources) {
    const reason = classifySource(source);
    if (!reason) {
      usableSources.push(source);
      continue;
    }

    rejectedCounts[reason] += 1;
    if (safeSamples.length < 6) {
      safeSamples.push({
        reason,
        url: source.url || undefined,
        title: source.title || undefined,
      });
    }
  }

  return { usableSources, rejectedCounts, safeSamples };
}
