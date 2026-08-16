import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 路由守卫（middleware 已改名为 proxy）。
 * - 未登录访问受保护页面 → 重定向 /login?next=<path>
 * - 已登录访问 /login、/signup → 重定向 /
 * - 刷新会话 cookie（@supabase/ssr）
 * - /api/* 不在此拦截，由各路由处理器自行校验并返回 JSON 401
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password";

  if (!user && !isAuthPage && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|css|js)$).*)",
  ],
};
