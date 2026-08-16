import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVENT_TYPE_ANALYSIS,
  EVENT_TYPE_RESUME_OPTIMIZATION,
  FREE_DAILY_ANALYSIS_LIMIT_ENV,
  FREE_DAILY_RESUME_OPTIMIZATION_LIMIT_ENV,
  UNLIMITED_USER_EMAILS_ENV,
} from "./constants";

/** 读取免限邮箱白名单（默认包含 mouringx@126.com）。 */
function getUnlimitedUserEmails(): string[] {
  const raw = process.env[UNLIMITED_USER_EMAILS_ENV] ?? "mouringx@126.com";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** 用户是否命中免限白名单（大小写不敏感）。 */
export function isUnlimitedUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  return getUnlimitedUserEmails().includes(target);
}

/** 按事件类型返回每日免费次数上限。 */
export function getDailyLimit(eventType: string): number {
  const isOptimization = eventType === EVENT_TYPE_RESUME_OPTIMIZATION;
  const envName = isOptimization
    ? FREE_DAILY_RESUME_OPTIMIZATION_LIMIT_ENV
    : FREE_DAILY_ANALYSIS_LIMIT_ENV;
  const fallback = isOptimization ? 2 : 10;
  const raw = Number(process.env[envName] ?? fallback);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** 今天 0 点（本地时区）。 */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 统计某用户今天某类用量事件的数量（只统计成功调用后写入的事件）。 */
export async function countTodayEvents(
  supabase: SupabaseClient,
  userId: string,
  eventType: string
): Promise<number> {
  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("created_at", startOfToday().toISOString());
  if (error) {
    throw new Error("用量查询失败，请稍后重试");
  }
  return count ?? 0;
}

export { EVENT_TYPE_ANALYSIS, EVENT_TYPE_RESUME_OPTIMIZATION };
