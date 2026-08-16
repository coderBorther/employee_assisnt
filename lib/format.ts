/** 时间格式化（zh-CN 短格式）。 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 从 analyses.result JSONB 中取出总匹配度分数。 */
export function totalScoreFromResult(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const match = r.matchAnalysis as Record<string, unknown> | undefined;
  const score = match?.totalScore;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}
