import type { SourceItem } from "./models";

type RetrieverKeys = {
  tavilyKey: string;
  exaKey: string;
};

export function dedupeByUrl(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  const out: SourceItem[] = [];
  for (const item of items) {
    const key = item.url || `${item.title}-${item.query}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function fetchTavily(brand: string, apiKey: string): Promise<SourceItem[]> {
  const queries = [
    `${brand} co-occurrence with competing brands in news`,
    `${brand} versus alternatives in shared product categories news`,
    `${brand} mention share across minimalist quiet luxury streetwear news`,
  ];

  const responses = await Promise.all(
    queries.map(async (query) => {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "advanced",
          include_answer: false,
          max_results: 7,
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
      };
      return (json.results ?? []).map((result) => ({
        query,
        title: result.title ?? "Untitled result",
        url: result.url ?? "",
        snippet: result.content ?? "",
        published: result.published_date,
        provider: "tavily" as const,
      }));
    }),
  );

  return responses.flat();
}

async function fetchExa(brand: string, apiKey: string): Promise<SourceItem[]> {
  const queries = [
    `${brand} co-occurrence with rival brands across shared intents`,
    `${brand} news where competitors dominate similar audiences`,
    `${brand} category-level comparison where rivals outperform`,
  ];

  const responses = await Promise.all(
    queries.map(async (query) => {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query,
          type: "neural",
          numResults: 7,
          useAutoprompt: true,
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string }>;
      };
      return (json.results ?? []).map((result) => ({
        query,
        title: result.title ?? "Untitled result",
        url: result.url ?? "",
        snippet: result.text ?? "",
        published: result.publishedDate,
        provider: "exa" as const,
      }));
    }),
  );

  return responses.flat();
}

export async function retrieveSourcesForBrand(
  brand: string,
  opts: RetrieverKeys,
): Promise<SourceItem[]> {
  const [tavilyResults, exaResults] = await Promise.all([
    fetchTavily(brand, opts.tavilyKey).catch(() => [] as SourceItem[]),
    fetchExa(brand, opts.exaKey).catch(() => [] as SourceItem[]),
  ]);
  return dedupeByUrl([...tavilyResults, ...exaResults]).slice(0, 18);
}
