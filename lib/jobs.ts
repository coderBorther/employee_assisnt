import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONCURRENCY_LIMIT_CODE,
  CONCURRENCY_LIMIT_MESSAGE,
  RESUME_WORKER_URL_ENV,
} from "./constants";

/** 是否启用后台 worker（配置了 RESUME_WORKER_URL 即启用；本地开发未配置则走同步调用）。 */
export function isWorkerEnabled(): boolean {
  return Boolean(process.env[RESUME_WORKER_URL_ENV]?.trim());
}

/** 并发超限的统一错误体（429）。 */
export function concurrencyLimitError(): { error: string; code: string } {
  return { error: CONCURRENCY_LIMIT_MESSAGE, code: CONCURRENCY_LIMIT_CODE };
}

/** 统计某用户当前在途任务数（analyses + resume_optimizations 的 pending/processing 合计）。 */
export async function countActiveJobs(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const [analysisRes, optimizationRes] = await Promise.all([
    supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]),
    supabase
      .from("resume_optimizations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]),
  ]);
  return (analysisRes.count ?? 0) + (optimizationRes.count ?? 0);
}

/** 查找同输入（input_hash）已在途（pending/processing）的任务，用于去重。 */
export async function findInFlightByInputHash(
  supabase: SupabaseClient,
  userId: string,
  table: "analyses" | "resume_optimizations",
  inputHash: string
): Promise<{ data: { id: string } | null; error: unknown }> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq("input_hash", inputHash)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as { id: string } | null, error };
}
