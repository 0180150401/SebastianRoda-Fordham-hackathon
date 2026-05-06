/** Langfuse configuration helpers — tracing is optional when keys are absent. */

export function isLangfuseEnabled(): boolean {
  if (process.env.LANGFUSE_ENABLED?.trim().toLowerCase() === "false") return false;
  const secret = process.env.LANGFUSE_SECRET_KEY?.replace(/^['"]|['"]$/g, "").trim();
  const pub = process.env.LANGFUSE_PUBLIC_KEY?.replace(/^['"]|['"]$/g, "").trim();
  return Boolean(secret && pub);
}
