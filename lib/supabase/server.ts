import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 服务端 Supabase 客户端（读取/写入请求 cookie，使用当前用户会话，RLS 生效）。 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 服务端组件/路由处理器中无法写 cookie 时静默忽略，
            // 会话刷新由 proxy.ts 负责。
          }
        },
      },
    }
  );
}
