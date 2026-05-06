/** Kill switch for paid semantic + geo-chat routes (OBS-02). */

export function isSemanticPipelineDisabled(): boolean {
  const v = process.env.SEMANTIC_PIPELINE_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
