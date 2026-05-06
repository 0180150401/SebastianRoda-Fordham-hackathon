import type { SemanticUniversePayload, SourceItem } from "./models";
import { dedupeByUrl } from "./retriever";

function looksLikeImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractInlineImages(html: string): string[] {
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  return matches.map((match) => match[1]).slice(0, 6);
}

async function resolveSourceImages(pageUrl: string): Promise<string[]> {
  if (!pageUrl || pageUrl.includes("example.com")) return [];
  if (looksLikeImageUrl(pageUrl)) return [pageUrl];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(pageUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; 6degrees-bot/1.0)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    const primary = extractMetaImage(html);
    const inline = extractInlineImages(html);
    const rawCandidates = [primary, ...inline].filter(
      (candidate): candidate is string => Boolean(candidate),
    );
    const absoluteCandidates = rawCandidates
      .map((candidate) => {
        try {
          return new URL(candidate, pageUrl).toString();
        } catch {
          return null;
        }
      })
      .filter((candidate): candidate is string => Boolean(candidate))
      .filter((candidate) => candidate.startsWith("http"));
    return [...new Set(absoluteCandidates)].slice(0, 4);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichVisualCorrelationsWithImages(
  payload: SemanticUniversePayload,
  sources: SourceItem[],
): Promise<SemanticUniversePayload> {
  const candidateUrls = dedupeByUrl(sources)
    .map((source) => source.url)
    .filter((url) => typeof url === "string" && url.length > 0 && !url.includes("example.com"))
    .slice(0, 10);

  const resolvedImages = (
    await Promise.all(
      candidateUrls.map(async (url) => ({
        sourceUrl: url,
        imageUrls: await resolveSourceImages(url),
      })),
    )
  ).filter(
    (item): item is { sourceUrl: string; imageUrls: string[] } => item.imageUrls.length > 0,
  );

  const flattened = resolvedImages.flatMap((item) =>
    item.imageUrls.map((imageUrl) => ({ sourceUrl: item.sourceUrl, imageUrl })),
  );

  let imageCursor = 0;
  const visualCorrelations = payload.visualCorrelations.map((item) => {
    const existingImages = Array.isArray(item.imageUrls)
      ? item.imageUrls.filter((url) => typeof url === "string" && url.length > 0)
      : item.imageUrl
        ? [item.imageUrl]
        : [];
    if (existingImages.length > 0 && !existingImages[0].includes("example.com")) {
      return { ...item, imageUrls: existingImages, imageUrl: existingImages[0], moodboardMode: false };
    }
    const picked = flattened.slice(imageCursor, imageCursor + 4);
    imageCursor += 4;
    if (picked.length > 0) {
      return {
        ...item,
        imageUrl: picked[0].imageUrl,
        imageUrls: picked.map((entry) => entry.imageUrl),
        imageSource: picked[0].sourceUrl,
        moodboardMode: false,
      };
    }
    return { ...item, moodboardMode: true };
  });

  return { ...payload, visualCorrelations };
}
