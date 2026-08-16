"use client";

import { createBrowserClient } from "@supabase/ssr";

/** 浏览器端 Supabase 客户端（cookie 会话由 @supabase/ssr 自动管理）。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
